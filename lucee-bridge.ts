/**
 * Lucee Server Bridge
 * Communicates with Lucee via its REST Admin API and direct HTTP execution.
 */

import fetch from "node-fetch";

interface DatasourceConfig {
  action: string;
  name?: string;
  driver?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
}

export class LuceeServerBridge {
  private baseUrl: string;
  private adminPassword: string;
  private authToken: string | null = null;

  constructor(baseUrl: string, adminPassword: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.adminPassword = adminPassword;
  }

  // ─────────────────────────────────────────────
  // Authentication
  // ─────────────────────────────────────────────
  private async getAuthToken(): Promise<string> {
    if (this.authToken) return this.authToken;

    const res = await fetch(`${this.baseUrl}/lucee/admin/server.cfm`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        "lucee_action": "authenticate",
        "lucee_password": this.adminPassword,
      }).toString(),
    });

    if (!res.ok) throw new Error(`Lucee auth failed: ${res.status}`);
    const setCookie = res.headers.get("set-cookie") || "";
    this.authToken = setCookie.split(";")[0];
    return this.authToken;
  }

  private async adminRequest(endpoint: string, params: Record<string, string> = {}) {
    const token = await this.getAuthToken();
    const res = await fetch(`${this.baseUrl}/lucee/admin/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": token,
      },
      body: new URLSearchParams(params).toString(),
    });
    return res;
  }

  // ─────────────────────────────────────────────
  // Server Status
  // ─────────────────────────────────────────────
  async getStatus(detail = "basic"): Promise<object> {
    try {
      // Execute CFML to gather server info
      const code = `
        <cfscript>
          info = {};
          info.version = server.lucee.version;
          info.uptime = getTickCount();
          info.jvmMemory = {
            total: runtime.totalMemory(),
            free: runtime.freeMemory(),
            max: runtime.maxMemory()
          };
          info.requestCount = server.hitcount ?: 0;
          ${detail === "full" ? `
          info.datasources = application.getAllDatasources() ?: [];
          info.mappings = getContextRoot();
          ` : ""}
          writeOutput(serializeJSON(info));
        </cfscript>
      `;
      const result = await this.executeCode(code, "json");
      return { status: "online", data: JSON.parse(result), server: "lucee" };
    } catch (e: any) {
      return { status: "error", message: e.message, server: "lucee" };
    }
  }

  // ─────────────────────────────────────────────
  // Cache Management
  // ─────────────────────────────────────────────
  async clearCache(cacheType = "all"): Promise<object> {
    const actionMap: Record<string, string> = {
      template: "clearPagePool",
      query: "clearQueryCache",
      function: "clearFuncCache",
      class: "clearClassCache",
      all: "clearCache",
    };

    const action = actionMap[cacheType] || "clearCache";
    const code = `
      <cfscript>
        ${cacheType === "all" || cacheType === "template" ? 'pagePoolClear();' : ''}
        ${cacheType === "all" || cacheType === "query" ? '// query cache cleared via admin' : ''}
        result = { cleared: "#cacheType#", timestamp: now() };
        writeOutput(serializeJSON(result));
      </cfscript>
    `;

    try {
      // Also hit admin API
      await this.adminRequest("server.cfm", {
        lucee_action: action,
      });
      const output = await this.executeCode(code, "json");
      return { success: true, cacheType, timestamp: new Date().toISOString() };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  // ─────────────────────────────────────────────
  // Application Reload
  // ─────────────────────────────────────────────
  async reloadApplication(appName?: string, webroot?: string): Promise<object> {
    const code = `
      <cfscript>
        applicationStop();
        result = { reloaded: true, app: CGI.SERVER_NAME, timestamp: now() };
        writeOutput(serializeJSON(result));
      </cfscript>
    `;
    try {
      const url = webroot
        ? `${this.baseUrl}${webroot}/index.cfm?cfmcp_reload=1`
        : `${this.baseUrl}/index.cfm?cfmcp_reload=1`;
      const output = await this.executeCode(code, "json");
      return { success: true, message: "Application reloaded", timestamp: new Date().toISOString() };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  // ─────────────────────────────────────────────
  // Code Execution (via Lucee REST endpoint)
  // ─────────────────────────────────────────────
  async executeCode(code: string, outputType = "text"): Promise<string> {
    // Wrap code in a temp CFM that returns JSON/text
    const wrappedCode = outputType === "json"
      ? code
      : `<cfscript>var __out = ""; </cfscript>${code}`;

    const res = await fetch(`${this.baseUrl}/cfmcp-exec.cfm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: wrappedCode, token: this.adminPassword }),
    });

    if (!res.ok) {
      // Fallback: use Lucee's built-in REST executor if available
      const fallbackRes = await fetch(`${this.baseUrl}/lucee/rest/cfmcp/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${Buffer.from(`admin:${this.adminPassword}`).toString("base64")}`,
        },
        body: JSON.stringify({ code }),
      });
      if (!fallbackRes.ok) throw new Error(`Code execution failed: ${res.status}`);
      return fallbackRes.text();
    }

    return res.text();
  }

  // ─────────────────────────────────────────────
  // File Reading
  // ─────────────────────────────────────────────
  async readFile(path: string): Promise<string> {
    const code = `
      <cfscript>
        if (fileExists("#path#")) {
          writeOutput(fileRead("#path#"));
        } else {
          throw(message="File not found: #path#");
        }
      </cfscript>
    `;
    return this.executeCode(code, "text");
  }

  // ─────────────────────────────────────────────
  // Datasource Management
  // ─────────────────────────────────────────────
  async manageDatasource(config: DatasourceConfig): Promise<object> {
    const { action, name, driver, host, port, database, username, password } = config;

    if (action === "list") {
      const code = `<cfscript>
        ds = [];
        // Lucee datasource listing via admin
        writeOutput(serializeJSON(application.getAllDatasources() ?: []));
      </cfscript>`;
      const output = await this.executeCode(code, "json");
      return { action: "list", datasources: JSON.parse(output || "[]") };
    }

    if (action === "test" && name) {
      const code = `<cfscript>
        try {
          q = queryExecute("SELECT 1", {}, { datasource: "#name#" });
          writeOutput(serializeJSON({ success: true, datasource: "#name#" }));
        } catch(e) {
          writeOutput(serializeJSON({ success: false, error: e.message }));
        }
      </cfscript>`;
      const output = await this.executeCode(code, "json");
      return JSON.parse(output);
    }

    // create/update/delete via admin
    const params: Record<string, string> = {
      lucee_action: action === "create" ? "datasource.create" : action === "delete" ? "datasource.remove" : "datasource.update",
      name: name || "",
      type: driver || "MySQL",
      host: host || "localhost",
      port: String(port || 3306),
      database: database || "",
      username: username || "",
      password: password || "",
    };

    await this.adminRequest("server.cfm", params);
    return { success: true, action, name };
  }
}
