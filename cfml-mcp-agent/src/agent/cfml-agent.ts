/**
 * CFML MCP Agent - MCP Client + MoE Router + Multi-LLM with Key Rotation
 * 
 * This agent:
 * 1. Connects to the CFML MCP Server via stdio/SSE
 * 2. Uses MoE router to pick the best LLM for each task
 * 3. Rotates API keys with backoff on rate limits
 * 4. Executes MCP tool calls autonomously
 * 5. Maintains conversation memory
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { MoERouter, classifyTask, DEFAULT_EXPERTS, type Expert, type TaskType } from "../moe/moe-router.js";
import { LLMClient, type Message } from "../llm/llm-client.js";
import { KeyRotationManager, type ApiKey } from "../rotation/key-rotation.js";

// ─────────────────────────────────────────────
// Agent Configuration
// ─────────────────────────────────────────────
interface AgentConfig {
  mcpServerCommand?: string;      // e.g. "node dist/index.js" for stdio
  mcpServerUrl?: string;          // e.g. "http://localhost:3000/sse" for SSE
  transport?: "stdio" | "sse";
  apiKeys: ApiKey[];
  experts?: Expert[];
  maxIterations?: number;
  preferLowCost?: boolean;
  preferLowLatency?: boolean;
  verbose?: boolean;
  cfmlSystemPrompt?: string;
}

// ─────────────────────────────────────────────
// CFML Expert System Prompt
// ─────────────────────────────────────────────
const CFML_SYSTEM_PROMPT = `You are a senior ColdFusion/CFML developer and DevOps engineer.
You have deep expertise in:
- ColdFusion Markup Language (CFML), CFScript, CFC components
- Lucee and Adobe ColdFusion server administration
- TestBox BDD/Unit testing framework
- CommandBox, cfconfig, CFWheels, FW/1, ColdBox frameworks
- SQL (primarily MS SQL Server, MySQL, PostgreSQL) via cfquery/queryExecute
- Security best practices (OWASP, input validation, cfqueryparam)
- Performance optimization (caching, cfthread, query optimization)

When given a task:
1. Analyze the request carefully
2. Use the available MCP tools when needed (validate code, manage server, run tests)
3. Provide accurate, idiomatic CFML code
4. Always use cfqueryparam for SQL parameters
5. Follow CF10+ CFScript syntax when possible
6. Include error handling with try/catch

Available MCP Tools:
- cfml_validate_syntax: Validate CFML code before suggesting it
- cfml_clear_cache: Clear server caches when needed
- cfml_server_status: Check server health
- cfml_run_testbox: Run test suites
- cfml_generate_test: Create TestBox specs
- cfml_execute_code: Execute code on the live server
- cfml_figma_to_cfml: Convert Figma designs to CFML

Respond with working, production-ready CFML code.`;

// ─────────────────────────────────────────────
// Agent Class
// ─────────────────────────────────────────────
export class CFMLMCPAgent {
  private mcpClient: Client;
  private llmClient: LLMClient;
  private moeRouter: MoERouter;
  private config: AgentConfig;
  private conversationHistory: Message[] = [];
  private availableTools: any[] = [];
  private connected = false;

  constructor(config: AgentConfig) {
    this.config = {
      maxIterations: 10,
      transport: "stdio",
      verbose: false,
      ...config,
    };

    this.mcpClient = new Client(
      { name: "cfml-mcp-agent", version: "1.0.0" },
      { capabilities: { tools: {} } }
    );

    this.llmClient = new LLMClient(config.apiKeys);
    this.moeRouter = new MoERouter(config.experts || DEFAULT_EXPERTS);
  }

  // ─────────────────────────────────────────────
  // Connect to MCP Server
  // ─────────────────────────────────────────────
  async connect(): Promise<void> {
    let transport;

    if (this.config.transport === "sse" && this.config.mcpServerUrl) {
      transport = new SSEClientTransport(new URL(this.config.mcpServerUrl));
    } else {
      const [cmd, ...args] = (this.config.mcpServerCommand || "node dist/index.js").split(" ");
      transport = new StdioClientTransport({
        command: cmd,
        args,
        env: {
          ...process.env,
          LUCEE_URL: process.env.LUCEE_URL || "http://localhost:8888",
          LUCEE_ADMIN_PASSWORD: process.env.LUCEE_ADMIN_PASSWORD || "lucee",
          CF_SERVER_TYPE: process.env.CF_SERVER_TYPE || "lucee",
          FIGMA_API_TOKEN: process.env.FIGMA_API_TOKEN || "",
        },
      });
    }

    await this.mcpClient.connect(transport);
    this.connected = true;

    // Discover available tools
    const toolsResult = await this.mcpClient.listTools();
    this.availableTools = toolsResult.tools;

    this.log(`Connected to CFML MCP Server. ${this.availableTools.length} tools available.`);
  }

  // ─────────────────────────────────────────────
  // Main Agent Loop
  // ─────────────────────────────────────────────
  async run(userMessage: string): Promise<string> {
    if (!this.connected) await this.connect();

    // Add user message to history
    this.conversationHistory.push({ role: "user", content: userMessage });

    // Classify task for MoE routing
    const taskType = classifyTask(userMessage, this.conversationHistory.slice(-3).map((m) => m.content).join(" "));
    const routing = this.moeRouter.route(taskType, {
      preferLowCost: this.config.preferLowCost,
      preferLowLatency: this.config.preferLowLatency,
      requiresTools: true,
    });

    this.log(`[MoE] Task: ${taskType} → Expert: ${routing.expert.name} (${(routing.confidence * 100).toFixed(0)}% confidence)`);
    this.log(`[MoE] Reason: ${routing.reason}`);

    let iteration = 0;
    let finalResponse = "";

    // ── Agentic Loop ──
    while (iteration < (this.config.maxIterations || 10)) {
      iteration++;
      this.moeRouter.incrementActive(routing.expert.id);

      let llmResponse;
      try {
        llmResponse = await this.llmClient.request({
          messages: this.conversationHistory,
          expert: routing.expert,
          systemPrompt: this.config.cfmlSystemPrompt || CFML_SYSTEM_PROMPT,
          tools: this.buildLLMTools(),
          maxTokens: 4096,
          temperature: 0.3,
        });
      } finally {
        this.moeRouter.decrementActive(routing.expert.id);
      }

      this.log(`[LLM] Response from ${llmResponse.model} (${llmResponse.tokensUsed} tokens, ${llmResponse.latencyMs}ms)`);

      // ── Handle Tool Calls ──
      if (llmResponse.toolCalls?.length) {
        this.conversationHistory.push({
          role: "assistant",
          content: llmResponse.content || "",
        });

        const toolResults = await this.executeToolCalls(llmResponse.toolCalls);

        // Add tool results back to conversation
        this.conversationHistory.push({
          role: "user",
          content: `Tool Results:\n${toolResults.map((r) => `[${r.name}]: ${r.result}`).join("\n\n")}`,
        });

        // Continue loop to get final response
        continue;
      }

      // ── Final Response ──
      finalResponse = llmResponse.content;
      this.conversationHistory.push({ role: "assistant", content: finalResponse });
      break;
    }

    return finalResponse;
  }

  // ─────────────────────────────────────────────
  // Execute MCP Tool Calls
  // ─────────────────────────────────────────────
  private async executeToolCalls(toolCalls: any[]): Promise<{ name: string; result: string }[]> {
    const results = [];

    for (const call of toolCalls) {
      const toolName = call.name || call.function?.name;
      const toolArgs = call.input || JSON.parse(call.function?.arguments || "{}");

      this.log(`[Tool] Calling: ${toolName} with ${JSON.stringify(toolArgs).slice(0, 100)}...`);

      try {
        const result = await this.mcpClient.callTool({
          name: toolName,
          arguments: toolArgs,
        });

        const content = (result.content as any[])
          .map((c: any) => c.text || c.data || "")
          .join("\n");

        this.log(`[Tool] ${toolName} → ${content.slice(0, 100)}...`);
        results.push({ name: toolName, result: content });
      } catch (e: any) {
        this.log(`[Tool] ERROR: ${toolName} failed: ${e.message}`);
        results.push({ name: toolName, result: `Error: ${e.message}` });
      }
    }

    return results;
  }

  // ─────────────────────────────────────────────
  // Build LLM-compatible tool schemas from MCP tools
  // ─────────────────────────────────────────────
  private buildLLMTools(): object[] {
    return this.availableTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema, // Anthropic format
      // OpenAI format:
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));
  }

  // ─────────────────────────────────────────────
  // Utility
  // ─────────────────────────────────────────────
  clearHistory() {
    this.conversationHistory = [];
  }

  getStats() {
    return {
      rotation: this.llmClient.rotation.getStats(),
      conversationTurns: this.conversationHistory.length,
    };
  }

  private log(msg: string) {
    if (this.config.verbose) console.error(msg);
  }

  async disconnect() {
    await this.mcpClient.close();
    this.connected = false;
  }
}

// ─────────────────────────────────────────────
// CLI Entry Point
// ─────────────────────────────────────────────
async function main() {
  const agent = new CFMLMCPAgent({
    transport: "stdio",
    mcpServerCommand: process.env.CFML_MCP_CMD || "node ../cfml-mcp-server/dist/index.js",
    verbose: true,
    preferLowCost: process.env.PREFER_LOW_COST === "true",
    preferLowLatency: process.env.PREFER_LOW_LATENCY === "true",
    apiKeys: [
      // Anthropic Keys (primary)
      {
        id: "anthropic-1",
        provider: "anthropic",
        key: process.env.ANTHROPIC_API_KEY_1 || "",
        model: "claude-sonnet-4-6",
        priority: 10,
        maxRPM: 50,
        costPerMToken: 3.0,
      },
      {
        id: "anthropic-2",
        provider: "anthropic",
        key: process.env.ANTHROPIC_API_KEY_2 || "",
        model: "claude-sonnet-4-6",
        priority: 10,
        maxRPM: 50,
        costPerMToken: 3.0,
      },
      // OpenAI Keys (fallback)
      {
        id: "openai-1",
        provider: "openai",
        key: process.env.OPENAI_API_KEY_1 || "",
        model: "gpt-4o",
        priority: 7,
        maxRPM: 60,
        costPerMToken: 5.0,
      },
      // Gemini (low-cost fallback)
      {
        id: "gemini-1",
        provider: "gemini",
        key: process.env.GEMINI_API_KEY || "",
        model: "gemini-1.5-flash",
        priority: 5,
        maxRPM: 100,
        costPerMToken: 0.075,
      },
      // Groq (ultra-low latency)
      {
        id: "groq-1",
        provider: "groq",
        key: process.env.GROQ_API_KEY || "",
        model: "llama-3.1-70b-versatile",
        priority: 4,
        maxRPM: 30,
        costPerMToken: 0.59,
      },
    ].filter((k) => k.key), // Remove keys with empty values
  });

  // Interactive REPL
  const readline = await import("readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log("CFML MCP Agent ready. Type your CFML question or command.");
  console.log("Commands: .stats, .clear, .exit\n");

  await agent.connect();

  const ask = () => {
    rl.question("You: ", async (input) => {
      const trimmed = input.trim();
      if (!trimmed) { ask(); return; }

      if (trimmed === ".exit") { await agent.disconnect(); process.exit(0); }
      if (trimmed === ".clear") { agent.clearHistory(); console.log("History cleared."); ask(); return; }
      if (trimmed === ".stats") { console.log(JSON.stringify(agent.getStats(), null, 2)); ask(); return; }

      try {
        const response = await agent.run(trimmed);
        console.log(`\nAgent: ${response}\n`);
      } catch (e: any) {
        console.error(`Error: ${e.message}`);
      }
      ask();
    });
  };

  ask();
}

main().catch(console.error);
