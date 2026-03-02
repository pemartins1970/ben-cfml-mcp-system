/**
 * Adobe ColdFusion Server Bridge
 * Uses CF Admin API (CFIDE) to manage the server.
 */

import fetch from "node-fetch";

export class AdobeCFBridge {
  private baseUrl: string;
  private username: string;
  private password: string;
  private cfid: string | null = null;
  private cftoken: string | null = null;

  constructor(baseUrl: string, username: string, password: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.username = username;
    this.password = password;
  }

  private async authenticate() {
    if (this.cfid) return;

    const res = await fetch(`${this.baseUrl}/CFIDE/administrator/enter.cfm`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        cfadminPassword: this.password,
        requestedURL: "/CFIDE/administrator/index.cfm",
        submit: "Login",
      }).toString(),
      redirect: "manual",
    });

    const setCookie = res.headers.get("set-cookie") || "";
    const cfidMatch = setCookie.match(/CFID=([^;]+)/i);
    const cftokenMatch = setCookie.match(/CFTOKEN=([^;]+)/i);

    if (cfidMatch) this.cfid = cfidMatch[1];
    if (cftokenMatch) this.cftoken = cftokenMatch[1];
  }

  private cookieHeader(): string {
    return `CFID=${this.cfid}; CFTOKEN=${this.cftoken}`;
  }

  async getStatus(detail = "basic"): Promise<object> {
    try {
      await this.authenticate();
      const code = `
        <cfscript>
          info = {
            version: server.coldfusion.productversion,
            productname: server.coldfusion.productname,
            uptime: getTickCount()
          };
          writeOutput(serializeJSON(info));
        </cfscript>
      `;
      const result = await this.executeCode(code, "json");
      return { status: "online", data: JSON.parse(result), server: "adobe-cf" };
    } catch (e: any) {
      return { status: "error", message: e.message, server: "adobe-cf" };
    }
  }

  async clearCache(cacheType = "all"): Promise<object> {
    await this.authenticate();
    // Adobe CF admin URL for clearing
    const actionMap: Record<string, string> = {
      template: "clearTemplateCache",
      query: "clearQueryCache",
      all: "clearAllCaches",
    };

    const res = await fetch(
      `${this.baseUrl}/CFIDE/administrator/settings/cache.cfm?action=${actionMap[cacheType] || "clearAllCaches"}`,
      {
        method: "GET",
        headers: { Cookie: this.cookieHeader() },
      }
    );

    return { success: res.ok, cacheType, timestamp: new Date().toISOString() };
  }

  async reloadApplication(appName?: string, webroot?: string): Promise<object> {
    const code = `<cfscript>
      applicationStop();
      writeOutput(serializeJSON({ reloaded: true }));
    </cfscript>`;
    await this.executeCode(code, "json");
    return { success: true, timestamp: new Date().toISOString() };
  }

  async executeCode(code: string, outputType = "text"): Promise<string> {
    const res = await fetch(`${this.baseUrl}/cfmcp-exec.cfm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": this.cookieHeader() || "",
      },
      body: JSON.stringify({ code, token: this.password }),
    });
    if (!res.ok) throw new Error(`Adobe CF execution failed: ${res.status}`);
    return res.text();
  }

  async readFile(path: string): Promise<string> {
    const code = `<cfscript>writeOutput(fileRead("#path#"));</cfscript>`;
    return this.executeCode(code, "text");
  }

  async manageDatasource(config: any): Promise<object> {
    await this.authenticate();
    // Adobe CF uses WDDX-based admin API
    const wddxParams = `<wddxPacket version='1.0'><header/><data>
      <struct>
        <var name='datasourceName'><string>${config.name}</string></var>
        <var name='driver'><string>${config.driver || "MSSQLServer"}</string></var>
        <var name='host'><string>${config.host || "localhost"}</string></var>
        <var name='port'><number>${config.port || 1433}</number></var>
        <var name='database'><string>${config.database || ""}</string></var>
        <var name='username'><string>${config.username || ""}</string></var>
        <var name='password'><string>${config.password || ""}</string></var>
      </struct>
    </data></wddxPacket>`;

    const res = await fetch(`${this.baseUrl}/CFIDE/administrator/datasources/index.cfm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": this.cookieHeader(),
      },
      body: new URLSearchParams({
        action: config.action,
        wddxPacket: wddxParams,
      }).toString(),
    });

    return { success: res.ok, action: config.action, name: config.name };
  }
}
