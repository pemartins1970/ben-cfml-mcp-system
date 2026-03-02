#!/usr/bin/env node
/**
 * CFML MCP Server - Native MCP server for ColdFusion/CFML development
 * Supports: Lucee Server, Adobe ColdFusion
 * Protocol: Model Context Protocol (MCP) via stdio
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { CFMLValidator } from "./validators/cfml-validator.js";
import { LuceeServerBridge } from "./server-bridge/lucee-bridge.js";
import { AdobeCFBridge } from "./server-bridge/adobecf-bridge.js";
import { TestBoxRunner } from "./tools/testbox-runner.js";
import { FigmaDesignConverter } from "./frontend/figma-converter.js";

// ─────────────────────────────────────────────
// Server Configuration
// ─────────────────────────────────────────────
const serverConfig = {
  luceeUrl: process.env.LUCEE_URL || "http://localhost:8888",
  luceeAdminPass: process.env.LUCEE_ADMIN_PASSWORD || "lucee",
  adobeCfUrl: process.env.ADOBE_CF_URL || "http://localhost:8500",
  adobeCfUser: process.env.ADOBE_CF_USER || "admin",
  adobeCfPass: process.env.ADOBE_CF_PASSWORD || "admin",
  figmaToken: process.env.FIGMA_API_TOKEN || "",
  serverType: (process.env.CF_SERVER_TYPE || "lucee") as "lucee" | "adobe",
};

// ─────────────────────────────────────────────
// Tool Definitions
// ─────────────────────────────────────────────
const TOOLS: Tool[] = [
  // ── Validation Tools ──
  {
    name: "cfml_validate_syntax",
    description:
      "Validates CFML/CFM/CFC syntax. Returns errors, warnings and suggestions.",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "CFML code to validate" },
        filename: {
          type: "string",
          description: "Optional filename (.cfm/.cfc) to enable context-aware validation",
        },
        strict: {
          type: "boolean",
          description: "Enable strict mode validation (default: false)",
          default: false,
        },
      },
      required: ["code"],
    },
  },
  {
    name: "cfml_validate_file",
    description: "Validates a CFML file on the server filesystem.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute or webroot-relative path to the CFML file" },
      },
      required: ["path"],
    },
  },
  // ── Server Management Tools ──
  {
    name: "cfml_server_status",
    description: "Returns the status of the CF/Lucee server (memory, uptime, datasources, etc.)",
    inputSchema: {
      type: "object",
      properties: {
        detail: {
          type: "string",
          enum: ["basic", "full"],
          default: "basic",
          description: "Level of detail to return",
        },
      },
    },
  },
  {
    name: "cfml_clear_cache",
    description:
      "Clears server caches: template, query, function, class, or all.",
    inputSchema: {
      type: "object",
      properties: {
        cacheType: {
          type: "string",
          enum: ["template", "query", "function", "class", "all"],
          description: "Type of cache to clear",
          default: "all",
        },
      },
    },
  },
  {
    name: "cfml_reload_app",
    description: "Reloads a CFML application (triggers onApplicationStart).",
    inputSchema: {
      type: "object",
      properties: {
        appName: { type: "string", description: "Application name (optional, reloads all if omitted)" },
        webroot: { type: "string", description: "Webroot path of the application" },
      },
    },
  },
  {
    name: "cfml_execute_code",
    description:
      "Executes a CFML snippet on the live server and returns the output. USE WITH CARE.",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "CFML code to execute (cfscript or tag-based)" },
        outputType: {
          type: "string",
          enum: ["html", "json", "text"],
          default: "text",
        },
      },
      required: ["code"],
    },
  },
  {
    name: "cfml_manage_datasource",
    description: "Create, update, test or delete a datasource in the CF/Lucee admin.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["create", "update", "delete", "test", "list"],
        },
        name: { type: "string", description: "Datasource name" },
        driver: { type: "string", description: "JDBC driver (MySQL, MSSQL, PostgreSQL, etc.)" },
        host: { type: "string" },
        port: { type: "number" },
        database: { type: "string" },
        username: { type: "string" },
        password: { type: "string" },
      },
      required: ["action"],
    },
  },
  // ── TestBox Tools ──
  {
    name: "cfml_run_testbox",
    description:
      "Runs TestBox unit/BDD tests and returns results (passed, failed, skipped, coverage).",
    inputSchema: {
      type: "object",
      properties: {
        directory: {
          type: "string",
          description: "Directory containing test specs (relative to webroot)",
        },
        spec: {
          type: "string",
          description: "Specific CFC spec to run (e.g., tests.unit.MyServiceSpec)",
        },
        reporter: {
          type: "string",
          enum: ["json", "text", "dot", "tap", "junit"],
          default: "json",
        },
        labels: {
          type: "array",
          items: { type: "string" },
          description: "Filter by test labels/groups",
        },
        verbose: { type: "boolean", default: false },
      },
    },
  },
  {
    name: "cfml_generate_test",
    description:
      "Generates a TestBox BDD spec skeleton for a given CFC component.",
    inputSchema: {
      type: "object",
      properties: {
        componentPath: {
          type: "string",
          description: "Dot-notation CFC path (e.g., models.UserService)",
        },
        testType: {
          type: "string",
          enum: ["bdd", "unit"],
          default: "bdd",
        },
        includeMocks: { type: "boolean", default: true },
      },
      required: ["componentPath"],
    },
  },
  // ── Frontend / Figma Tools ──
  {
    name: "cfml_figma_to_cfml",
    description:
      "Converts a Figma design (via Figma AI Bridge or API) into CFML/CFScript component code.",
    inputSchema: {
      type: "object",
      properties: {
        figmaUrl: {
          type: "string",
          description: "Figma file/frame URL (e.g., https://www.figma.com/file/...)",
        },
        nodeId: { type: "string", description: "Specific Figma node ID to convert" },
        outputType: {
          type: "string",
          enum: ["cfm", "cfc", "cfscript"],
          default: "cfm",
        },
        framework: {
          type: "string",
          enum: ["none", "bootstrap5", "tailwind", "bulma"],
          default: "bootstrap5",
        },
        includeStyles: { type: "boolean", default: true },
      },
      required: ["figmaUrl"],
    },
  },
];

// ─────────────────────────────────────────────
// MCP Server Instance
// ─────────────────────────────────────────────
const server = new Server(
  { name: "cfml-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

const validator = new CFMLValidator();
const serverBridge =
  serverConfig.serverType === "lucee"
    ? new LuceeServerBridge(serverConfig.luceeUrl, serverConfig.luceeAdminPass)
    : new AdobeCFBridge(serverConfig.adobeCfUrl, serverConfig.adobeCfUser, serverConfig.adobeCfPass);
const testBox = new TestBoxRunner(serverBridge);
const figmaConverter = new FigmaDesignConverter(serverConfig.figmaToken);

// ─────────────────────────────────────────────
// Tool Router
// ─────────────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // ── Validation ──
      case "cfml_validate_syntax": {
        const result = await validator.validateCode(
          args!.code as string,
          args!.filename as string | undefined,
          args!.strict as boolean | undefined
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cfml_validate_file": {
        const result = await validator.validateFile(args!.path as string, serverBridge);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      // ── Server Management ──
      case "cfml_server_status": {
        const status = await serverBridge.getStatus(args?.detail as string);
        return { content: [{ type: "text", text: JSON.stringify(status, null, 2) }] };
      }

      case "cfml_clear_cache": {
        const result = await serverBridge.clearCache(args?.cacheType as string || "all");
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cfml_reload_app": {
        const result = await serverBridge.reloadApplication(
          args?.appName as string,
          args?.webroot as string
        );
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cfml_execute_code": {
        const result = await serverBridge.executeCode(
          args!.code as string,
          args?.outputType as string
        );
        return { content: [{ type: "text", text: result }] };
      }

      case "cfml_manage_datasource": {
        const result = await serverBridge.manageDatasource(args as any);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      // ── TestBox ──
      case "cfml_run_testbox": {
        const result = await testBox.run({
          directory: args?.directory as string,
          spec: args?.spec as string,
          reporter: (args?.reporter as string) || "json",
          labels: args?.labels as string[],
          verbose: args?.verbose as boolean,
        });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "cfml_generate_test": {
        const code = await testBox.generateSpec(
          args!.componentPath as string,
          (args?.testType as string) || "bdd",
          args?.includeMocks as boolean
        );
        return { content: [{ type: "text", text: code }] };
      }

      // ── Frontend ──
      case "cfml_figma_to_cfml": {
        const result = await figmaConverter.convert({
          figmaUrl: args!.figmaUrl as string,
          nodeId: args?.nodeId as string,
          outputType: (args?.outputType as string) || "cfm",
          framework: (args?.framework as string) || "bootstrap5",
          includeStyles: args?.includeStyles as boolean,
        });
        return { content: [{ type: "text", text: result }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err: any) {
    return {
      content: [{ type: "text", text: `Error: ${err.message}` }],
      isError: true,
    };
  }
});

// ─────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("CFML MCP Server running on stdio");
}

main().catch(console.error);
