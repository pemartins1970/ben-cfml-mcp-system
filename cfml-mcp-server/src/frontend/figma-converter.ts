/**
 * Figma Design → CFML Converter
 * Uses Figma REST API to extract design tokens and generate CFML components.
 * Optionally bridges with Figma AI Bridge for advanced conversion.
 */

import fetch from "node-fetch";

interface ConvertOptions {
  figmaUrl: string;
  nodeId?: string;
  outputType: "cfm" | "cfc" | "cfscript";
  framework: "none" | "bootstrap5" | "tailwind" | "bulma";
  includeStyles: boolean;
}

interface FigmaNode {
  id: string;
  name: string;
  type: string;
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  fills?: any[];
  children?: FigmaNode[];
  style?: any;
  characters?: string;
  constraints?: any;
}

export class FigmaDesignConverter {
  private apiToken: string;

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  // ─────────────────────────────────────────────
  // Main Convert Entry Point
  // ─────────────────────────────────────────────
  async convert(options: ConvertOptions): Promise<string> {
    const { figmaUrl, nodeId, outputType, framework, includeStyles } = options;

    // Parse file key from URL
    const fileKey = this.extractFileKey(figmaUrl);
    if (!fileKey) {
      return `<!--- ERROR: Could not parse Figma file key from URL: ${figmaUrl} --->`;
    }

    if (!this.apiToken) {
      // Return a helpful scaffold when no token is provided
      return this.generateScaffold(options);
    }

    try {
      const node = await this.fetchFigmaNode(fileKey, nodeId);
      return this.nodeToCode(node, options);
    } catch (e: any) {
      return `<!--- Figma API Error: ${e.message} --->\n${this.generateScaffold(options)}`;
    }
  }

  // ─────────────────────────────────────────────
  // Figma API
  // ─────────────────────────────────────────────
  private extractFileKey(url: string): string | null {
    const match = url.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  }

  private async fetchFigmaNode(fileKey: string, nodeId?: string): Promise<FigmaNode> {
    const endpoint = nodeId
      ? `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${nodeId}`
      : `https://api.figma.com/v1/files/${fileKey}`;

    const res = await fetch(endpoint, {
      headers: { "X-Figma-Token": this.apiToken },
    });

    if (!res.ok) {
      throw new Error(`Figma API returned ${res.status}: ${await res.text()}`);
    }

    const data: any = await res.json();

    if (nodeId) {
      const nodes = data.nodes;
      const firstNode = nodes[Object.keys(nodes)[0]];
      return firstNode?.document;
    }

    return data.document?.children?.[0] || data.document;
  }

  // ─────────────────────────────────────────────
  // Node → CFML Code Generation
  // ─────────────────────────────────────────────
  private nodeToCode(node: FigmaNode, options: ConvertOptions): string {
    const html = this.renderNode(node, options.framework, 0);
    const styles = options.includeStyles ? this.extractStyles(node) : "";

    if (options.outputType === "cfc") {
      return this.wrapAsCFC(node.name, html, styles, options.framework);
    }

    if (options.outputType === "cfm") {
      return this.wrapAsCFM(node.name, html, styles, options.framework);
    }

    return this.wrapAsCFScript(node.name, html, styles);
  }

  private renderNode(node: FigmaNode, framework: string, depth: number): string {
    const indent = "  ".repeat(depth);
    const classes = this.frameworkClasses(node, framework);

    switch (node.type) {
      case "FRAME":
      case "COMPONENT":
      case "INSTANCE":
        return `${indent}<div class="${classes}" id="fig-${this.sanitizeId(node.name)}">\n` +
          (node.children?.map((c) => this.renderNode(c, framework, depth + 1)).join("\n") || "") +
          `\n${indent}</div>`;

      case "TEXT":
        const tag = this.textTagFromStyle(node);
        return `${indent}<${tag} class="${classes}">${node.characters || ""}</${tag}>`;

      case "RECTANGLE":
      case "ELLIPSE":
      case "VECTOR":
        const bg = this.fillToCSS(node.fills?.[0]);
        const w = node.absoluteBoundingBox?.width || 100;
        const h = node.absoluteBoundingBox?.height || 100;
        return `${indent}<div class="${classes}" style="width:${w}px;height:${h}px;${bg}"></div>`;

      case "GROUP":
        return `${indent}<div class="${classes} fig-group">\n` +
          (node.children?.map((c) => this.renderNode(c, framework, depth + 1)).join("\n") || "") +
          `\n${indent}</div>`;

      default:
        return `${indent}<!--- ${node.type}: ${node.name} --->`;
    }
  }

  private frameworkClasses(node: FigmaNode, framework: string): string {
    const name = node.name.toLowerCase();
    if (framework === "bootstrap5") {
      if (name.includes("row")) return "row";
      if (name.includes("col")) return "col";
      if (name.includes("btn") || name.includes("button")) return "btn btn-primary";
      if (name.includes("card")) return "card";
      if (name.includes("nav")) return "navbar navbar-expand-lg";
      if (name.includes("modal")) return "modal";
      if (name.includes("form")) return "form";
      if (name.includes("input")) return "form-control";
      if (name.includes("badge")) return "badge bg-primary";
      return "d-flex";
    }
    if (framework === "tailwind") {
      if (name.includes("btn") || name.includes("button")) return "px-4 py-2 bg-blue-500 text-white rounded";
      if (name.includes("card")) return "rounded-lg shadow p-4 bg-white";
      return "flex";
    }
    return `fig-${this.sanitizeId(node.name)}`;
  }

  private textTagFromStyle(node: FigmaNode): string {
    const fontSize = node.style?.fontSize || 14;
    if (fontSize >= 32) return "h1";
    if (fontSize >= 24) return "h2";
    if (fontSize >= 20) return "h3";
    if (fontSize >= 16) return "h4";
    return "p";
  }

  private fillToCSS(fill: any): string {
    if (!fill) return "";
    if (fill.type === "SOLID") {
      const { r, g, b, a = 1 } = fill.color || {};
      const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0");
      return `background-color:#${toHex(r)}${toHex(g)}${toHex(b)};`;
    }
    return "";
  }

  private extractStyles(node: FigmaNode): string {
    const rules: string[] = [];
    const collectStyles = (n: FigmaNode) => {
      const id = `fig-${this.sanitizeId(n.name)}`;
      const styles: string[] = [];
      if (n.absoluteBoundingBox) {
        styles.push(`width: ${n.absoluteBoundingBox.width}px`);
      }
      const fill = this.fillToCSS(n.fills?.[0]).replace(";", "");
      if (fill) styles.push(fill);
      if (styles.length) rules.push(`#${id} { ${styles.join("; ")}; }`);
      n.children?.forEach(collectStyles);
    };
    collectStyles(node);
    return rules.join("\n");
  }

  private sanitizeId(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
  }

  // ─────────────────────────────────────────────
  // Output Wrappers
  // ─────────────────────────────────────────────
  private wrapAsCFM(name: string, html: string, styles: string, framework: string): string {
    const frameworkLink = framework === "bootstrap5"
      ? `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">`
      : framework === "tailwind"
      ? `<script src="https://cdn.tailwindcss.com"></script>`
      : "";

    return `<!--- Generated by CFML MCP Server from Figma design: ${name} --->
<cfparam name="variables.componentTitle" default="${name}">

<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><cfoutput>#variables.componentTitle#</cfoutput></title>
  ${frameworkLink}
  ${styles ? `<style>\n${styles}\n  </style>` : ""}
</head>
<body>
  <cfoutput>
${html}
  </cfoutput>
</body>
</html>`;
  }

  private wrapAsCFC(name: string, html: string, styles: string, framework: string): string {
    const safeName = this.sanitizeId(name).replace(/-/g, "");
    return `/**
 * ${safeName} - CFML Component generated from Figma design
 * Design: ${name}
 * Generated by CFML MCP Server
 */
component displayName="${safeName}" hint="UI component converted from Figma" {

  /**
   * Renders the ${safeName} component
   * @returns HTML string
   */
  public string function render(
    struct args = {}
  ) output=true {
    var local = {};
    local.title = args.title ?: "${name}";
    local.classes = args.extraClasses ?: "";
  ?>
${html}
  <?cfscript return ""; ?>
  }

  /**
   * Returns inline styles for the component
   */
  public string function getStyles() {
    return '${styles.replace(/'/g, "\\'")}';
  }

}`;
  }

  private wrapAsCFScript(name: string, html: string, styles: string): string {
    return `// Generated from Figma: ${name}
// CFML MCP Server
component {

  function render() {
    local.html = '';
    local.html &= '${html.replace(/'/g, "\\'").replace(/\n/g, "\\n' & chr(10) & '")}';
    writeOutput(local.html);
  }

}`;
  }

  // ─────────────────────────────────────────────
  // Scaffold (when no token available)
  // ─────────────────────────────────────────────
  private generateScaffold(options: ConvertOptions): string {
    return `<!--- 
  CFML Component Scaffold
  ═══════════════════════════════════════════════
  Source Figma: ${options.figmaUrl}
  Framework: ${options.framework}
  Type: ${options.outputType}
  
  To enable full Figma-to-CFML conversion:
  Set FIGMA_API_TOKEN environment variable with your Figma Personal Access Token.
  Get it at: https://www.figma.com/developers/api#access-tokens
  ═══════════════════════════════════════════════
--->
<cfparam name="args" default="#structNew()#">

<!--- TODO: Replace with actual design from Figma --->
<div class="${options.framework === "bootstrap5" ? "container" : "wrapper"}">
  <div class="${options.framework === "bootstrap5" ? "row" : ""}">
    <div class="${options.framework === "bootstrap5" ? "col-12" : ""}">
      <h1>Component: Design Import Pending</h1>
      <p>Configure FIGMA_API_TOKEN to auto-generate from Figma design.</p>
      <!--- Import your Figma design here --->
    </div>
  </div>
</div>`;
  }
}
