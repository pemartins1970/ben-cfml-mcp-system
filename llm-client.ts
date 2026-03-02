/**
 * Multi-Provider LLM Client
 * Unified interface for OpenAI, Anthropic, Gemini, Groq, Mistral
 * with automatic key rotation and error handling.
 */

import fetch from "node-fetch";
import { KeyRotationManager, ApiKey } from "../rotation/key-rotation.js";
import type { Expert } from "../moe/moe-router.js";

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface LLMRequest {
  messages: Message[];
  expert: Expert;
  maxTokens?: number;
  temperature?: number;
  tools?: object[];
  stream?: boolean;
  systemPrompt?: string;
}

export interface LLMResponse {
  content: string;
  tokensUsed: number;
  model: string;
  provider: string;
  keyId: string;
  latencyMs: number;
  toolCalls?: any[];
}

// ─────────────────────────────────────────────
export class LLMClient {
  private keyManager: KeyRotationManager;

  constructor(keys: ApiKey[]) {
    this.keyManager = new KeyRotationManager(keys);
  }

  get rotation() {
    return this.keyManager;
  }

  // ─────────────────────────────────────────────
  // Main Request Method with Retry
  // ─────────────────────────────────────────────
  async request(req: LLMRequest, maxRetries = 3): Promise<LLMResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const apiKey = this.keyManager.getNextKey(req.expert.provider);
      if (!apiKey) {
        throw new Error(`No available API keys for provider: ${req.expert.provider}`);
      }

      const start = Date.now();
      try {
        const response = await this.dispatch(req, apiKey);
        this.keyManager.recordSuccess(apiKey.id, response.tokensUsed);
        response.keyId = apiKey.id;
        response.latencyMs = Date.now() - start;
        return response;
      } catch (e: any) {
        lastError = e;

        if (e.status === 429 || e.message?.includes("rate limit")) {
          this.keyManager.recordRateLimit(apiKey.id, e.retryAfterMs);
        } else if (e.status === 401 || e.status === 403) {
          this.keyManager.recordError(apiKey.id, true); // fatal
        } else {
          this.keyManager.recordError(apiKey.id, false);
        }

        // Wait before retry (except on last attempt)
        if (attempt < maxRetries - 1) {
          await sleep(1000 * (attempt + 1));
        }
      }
    }

    throw lastError || new Error("LLM request failed after retries");
  }

  // ─────────────────────────────────────────────
  // Provider Dispatch
  // ─────────────────────────────────────────────
  private async dispatch(req: LLMRequest, apiKey: ApiKey): Promise<LLMResponse> {
    switch (req.expert.provider) {
      case "anthropic": return this.callAnthropic(req, apiKey);
      case "openai": return this.callOpenAI(req, apiKey);
      case "gemini": return this.callGemini(req, apiKey);
      case "groq": return this.callOpenAICompatible(req, apiKey, "https://api.groq.com/openai/v1");
      case "mistral": return this.callOpenAICompatible(req, apiKey, "https://api.mistral.ai/v1");
      case "ollama": return this.callOllama(req, apiKey);
      default: throw new Error(`Unknown provider: ${req.expert.provider}`);
    }
  }

  // ─────────────────────────────────────────────
  // Anthropic
  // ─────────────────────────────────────────────
  private async callAnthropic(req: LLMRequest, apiKey: ApiKey): Promise<LLMResponse> {
    const messages = req.messages.filter((m) => m.role !== "system");
    const system = req.systemPrompt ||
      req.messages.find((m) => m.role === "system")?.content;

    const body: any = {
      model: req.expert.model,
      max_tokens: req.maxTokens || 4096,
      messages,
    };
    if (system) body.system = system;
    if (req.tools?.length) body.tools = req.tools;
    if (req.temperature !== undefined) body.temperature = req.temperature;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey.key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    await this.handleRateLimitHeaders(res.headers as any, apiKey.id);
    if (!res.ok) await this.throwHttpError(res);

    const data: any = await res.json();
    const content = data.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("");
    const toolCalls = data.content.filter((b: any) => b.type === "tool_use");

    return {
      content,
      tokensUsed: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      model: data.model,
      provider: "anthropic",
      keyId: apiKey.id,
      latencyMs: 0,
      toolCalls: toolCalls.length ? toolCalls : undefined,
    };
  }

  // ─────────────────────────────────────────────
  // OpenAI
  // ─────────────────────────────────────────────
  private async callOpenAI(req: LLMRequest, apiKey: ApiKey): Promise<LLMResponse> {
    return this.callOpenAICompatible(req, apiKey, "https://api.openai.com/v1");
  }

  private async callOpenAICompatible(
    req: LLMRequest,
    apiKey: ApiKey,
    baseUrl: string
  ): Promise<LLMResponse> {
    const messages = req.systemPrompt
      ? [{ role: "system", content: req.systemPrompt }, ...req.messages.filter((m) => m.role !== "system")]
      : req.messages;

    const body: any = {
      model: req.expert.model,
      max_tokens: req.maxTokens || 4096,
      messages,
    };
    if (req.temperature !== undefined) body.temperature = req.temperature;
    if (req.tools?.length) body.tools = req.tools;

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey.key}`,
      },
      body: JSON.stringify(body),
    });

    await this.handleRateLimitHeaders(res.headers as any, apiKey.id);
    if (!res.ok) await this.throwHttpError(res);

    const data: any = await res.json();
    const choice = data.choices?.[0];
    const toolCalls = choice?.message?.tool_calls;

    return {
      content: choice?.message?.content || "",
      tokensUsed: data.usage?.total_tokens || 0,
      model: data.model,
      provider: req.expert.provider,
      keyId: apiKey.id,
      latencyMs: 0,
      toolCalls: toolCalls?.length ? toolCalls : undefined,
    };
  }

  // ─────────────────────────────────────────────
  // Gemini
  // ─────────────────────────────────────────────
  private async callGemini(req: LLMRequest, apiKey: ApiKey): Promise<LLMResponse> {
    const contents = req.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const body: any = {
      contents,
      generationConfig: {
        maxOutputTokens: req.maxTokens || 4096,
        temperature: req.temperature ?? 0.7,
      },
    };

    const systemInstruction = req.systemPrompt || req.messages.find((m) => m.role === "system")?.content;
    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${req.expert.model}:generateContent?key=${apiKey.key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) await this.throwHttpError(res);

    const data: any = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const tokens =
      (data.usageMetadata?.promptTokenCount || 0) +
      (data.usageMetadata?.candidatesTokenCount || 0);

    return { content: text, tokensUsed: tokens, model: req.expert.model, provider: "gemini", keyId: apiKey.id, latencyMs: 0 };
  }

  // ─────────────────────────────────────────────
  // Ollama (local)
  // ─────────────────────────────────────────────
  private async callOllama(req: LLMRequest, apiKey: ApiKey): Promise<LLMResponse> {
    const baseUrl = apiKey.key || "http://localhost:11434";
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: req.expert.model,
        messages: req.messages,
        stream: false,
        options: { temperature: req.temperature ?? 0.7 },
      }),
    });

    if (!res.ok) await this.throwHttpError(res);
    const data: any = await res.json();

    return {
      content: data.message?.content || "",
      tokensUsed: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      model: req.expert.model,
      provider: "ollama",
      keyId: apiKey.id,
      latencyMs: 0,
    };
  }

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────
  private async handleRateLimitHeaders(headers: any, keyId: string) {
    const h: Record<string, string> = {};
    if (headers.get) {
      for (const name of ["retry-after", "x-ratelimit-reset-requests", "x-ratelimit-remaining-requests"]) {
        const val = headers.get(name);
        if (val) h[name] = val;
      }
    }
    if (Object.keys(h).length) this.keyManager.parseRateLimitHeaders(keyId, h);
  }

  private async throwHttpError(res: any) {
    const body = await res.text().catch(() => "");
    const err: any = new Error(`HTTP ${res.status}: ${body}`);
    err.status = res.status;
    throw err;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
