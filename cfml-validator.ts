/**
 * CFML Syntax Validator
 * Performs static analysis on CFM/CFC code without executing it.
 * Checks for common errors, deprecated tags, and best practices.
 */

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  suggestions: ValidationIssue[];
  stats: {
    lines: number;
    tags: number;
    functions: number;
    cfscriptBlocks: number;
  };
}

export interface ValidationIssue {
  line: number;
  column?: number;
  message: string;
  code: string;
  severity: "error" | "warning" | "info";
}

// ── CFML Tag Registry ──
const VALID_CF_TAGS = new Set([
  "cfcomponent", "cffunction", "cfargument", "cfreturn",
  "cfscript", "cfoutput", "cfif", "cfelseif", "cfelse",
  "cfloop", "cfset", "cfparam", "cfinclude", "cfmodule",
  "cfquery", "cfqueryparam", "cfcol", "cfcontent",
  "cfmail", "cfmailparam", "cfmailpart",
  "cffile", "cfdirectory", "cfhttp", "cfhttpparam",
  "cfinvoke", "cfinvokeargument", "cfobject",
  "cftry", "cfcatch", "cfthrow", "cfrethrow",
  "cfswitch", "cfcase", "cfdefaultcase",
  "cfdump", "cfabort", "cfexit", "cfflush",
  "cflocation", "cfheader", "cfcookie",
  "cfsavecontent", "cfthread", "cflock",
  "cfcache", "cfimage", "cfpdf", "cfzip",
  "cfregistry", "cfservice", "cfspreadsheet",
  "cfform", "cfinput", "cfselect", "cftextarea",
  "cftable", "cfcol", "cfgrid", "cftree",
  "cflog", "cftrace", "cftimer",
  "cfimport", "cfinterface", "cfproperty",
]);

const DEPRECATED_TAGS = new Map([
  ["cfclient", "Use CFScript or JavaScript instead"],
  ["cfpresentation", "Deprecated in CF11+"],
  ["cfreport", "Use direct PDF generation instead"],
  ["cfsearch", "Deprecated - use Solr/Elasticsearch"],
  ["cfindex", "Deprecated - use Solr/Elasticsearch"],
  ["cfpod", "Deprecated UI component"],
  ["cflayout", "Deprecated UI component"],
  ["cfwindow", "Deprecated UI component"],
  ["cfajaximport", "Deprecated"],
]);

const SECURITY_PATTERNS = [
  {
    pattern: /url\.|form\.|cookie\.|cgi\./i,
    in: /cfquery|cfoutput/i,
    msg: "Possible unsanitized user input in query/output - use cfqueryparam or encodeForHTML()",
    code: "SEC001",
  },
  {
    pattern: /evaluate\s*\(/i,
    msg: "Use of evaluate() is a security risk and performance issue - use direct variable references",
    code: "SEC002",
  },
  {
    pattern: /iif\s*\(/i,
    msg: "iif() uses evaluate() internally - replace with ternary operator (CF10+)",
    code: "SEC003",
  },
];

const PERFORMANCE_PATTERNS = [
  {
    pattern: /<cfquery[^>]*>[\s\S]*?SELECT \*/i,
    msg: "Avoid SELECT * - specify only needed columns",
    code: "PERF001",
  },
  {
    pattern: /<cfloop[^>]*query=/i,
    msg: "Consider using cfoutput query= instead of cfloop for query iteration",
    code: "PERF002",
  },
];

// ─────────────────────────────────────────────
export class CFMLValidator {
  async validateCode(
    code: string,
    filename?: string,
    strict = false
  ): Promise<ValidationResult> {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];
    const suggestions: ValidationIssue[] = [];

    const lines = code.split("\n");
    const isCFC = filename?.endsWith(".cfc") || /cfcomponent/i.test(code);

    // ── Parse & tag validation ──
    this.validateTags(code, lines, errors, warnings);

    // ── Bracket/quote balance ──
    this.validateBalanced(code, errors);

    // ── CFC-specific rules ──
    if (isCFC) this.validateCFC(code, lines, warnings, suggestions);

    // ── Security checks ──
    this.checkSecurity(code, lines, warnings);

    // ── Performance hints ──
    this.checkPerformance(code, lines, suggestions);

    // ── Strict mode ──
    if (strict) this.strictChecks(code, lines, warnings, suggestions);

    // ── Stats ──
    const stats = this.computeStats(code);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      stats,
    };
  }

  async validateFile(path: string, bridge: any): Promise<ValidationResult> {
    try {
      const code = await bridge.readFile(path);
      return this.validateCode(code, path);
    } catch (e: any) {
      return {
        valid: false,
        errors: [{ line: 0, message: `Cannot read file: ${e.message}`, code: "FILE001", severity: "error" }],
        warnings: [],
        suggestions: [],
        stats: { lines: 0, tags: 0, functions: 0, cfscriptBlocks: 0 },
      };
    }
  }

  // ─────────────────────────────────────────────
  private validateTags(
    code: string,
    lines: string[],
    errors: ValidationIssue[],
    warnings: ValidationIssue[]
  ) {
    // Find all CF tags
    const tagPattern = /<\/?cf(\w+)/gi;
    let match: RegExpExecArray | null;
    const openStack: { tag: string; line: number }[] = [];
    const selfClosing = new Set(["cfset", "cfparam", "cfinclude", "cfqueryparam", "cfargument", "cfreturn", "cfthrow", "cfrethrow", "cfabort", "cfexit", "cfflush", "cflocation", "cfheader", "cfcookie", "cflog", "cftrace", "cfinvokeargument", "cfhttpparam", "cfmailparam", "cfproperty"]);

    while ((match = tagPattern.exec(code)) !== null) {
      const tagName = "cf" + match[1].toLowerCase();
      const lineNum = code.substring(0, match.index).split("\n").length;
      const isClose = match[0].startsWith("</");

      // Check deprecated
      if (DEPRECATED_TAGS.has(tagName)) {
        warnings.push({
          line: lineNum,
          message: `<${tagName}> is deprecated. ${DEPRECATED_TAGS.get(tagName)}`,
          code: "DEPR001",
          severity: "warning",
        });
      }

      // Check unknown tags
      if (!VALID_CF_TAGS.has(tagName) && !tagName.startsWith("cfx_")) {
        warnings.push({
          line: lineNum,
          message: `Unknown CFML tag: <${tagName}>`,
          code: "TAG001",
          severity: "warning",
        });
      }

      // Track open/close balance (skip self-closing)
      if (!selfClosing.has(tagName)) {
        if (!isClose) {
          openStack.push({ tag: tagName, line: lineNum });
        } else {
          const last = openStack[openStack.length - 1];
          if (last && last.tag === tagName) {
            openStack.pop();
          } else if (openStack.some((t) => t.tag === tagName)) {
            // Find and remove, but report crossing
            errors.push({
              line: lineNum,
              message: `Crossed/unclosed tags - closing </${tagName}> before closing <${last?.tag}>`,
              code: "TAG002",
              severity: "error",
            });
          }
        }
      }
    }

    // Remaining open tags
    for (const open of openStack) {
      errors.push({
        line: open.line,
        message: `Unclosed tag <${open.tag}>`,
        code: "TAG003",
        severity: "error",
      });
    }
  }

  private validateBalanced(code: string, errors: ValidationIssue[]) {
    // Check balanced ## in cfoutput
    const outputBlocks = code.match(/<cfoutput>[\s\S]*?<\/cfoutput>/gi) || [];
    for (const block of outputBlocks) {
      const hashes = (block.match(/#/g) || []).length;
      if (hashes % 2 !== 0) {
        errors.push({
          line: 0,
          message: "Unbalanced # delimiters inside <cfoutput> block",
          code: "SYN001",
          severity: "error",
        });
      }
    }
  }

  private validateCFC(
    code: string,
    lines: string[],
    warnings: ValidationIssue[],
    suggestions: ValidationIssue[]
  ) {
    // Functions without access attribute
    const fnPattern = /<cffunction[^>]*>/gi;
    let m: RegExpExecArray | null;
    while ((m = fnPattern.exec(code)) !== null) {
      if (!/access\s*=/i.test(m[0])) {
        const line = code.substring(0, m.index).split("\n").length;
        warnings.push({
          line,
          message: "cffunction missing 'access' attribute (defaults to public)",
          code: "CFC001",
          severity: "warning",
        });
      }
      if (!/returntype\s*=/i.test(m[0])) {
        const line = code.substring(0, m.index).split("\n").length;
        suggestions.push({
          line,
          message: "cffunction missing 'returntype' attribute - consider specifying for type safety",
          code: "CFC002",
          severity: "info",
        });
      }
    }

    // cfcomponent without hint
    if (/<cfcomponent(?![^>]*hint\s*=)/i.test(code)) {
      suggestions.push({
        line: 1,
        message: "Add a 'hint' attribute to cfcomponent for documentation",
        code: "CFC003",
        severity: "info",
      });
    }
  }

  private checkSecurity(code: string, lines: string[], warnings: ValidationIssue[]) {
    lines.forEach((line, idx) => {
      for (const check of SECURITY_PATTERNS) {
        if (check.pattern.test(line)) {
          warnings.push({
            line: idx + 1,
            message: check.msg,
            code: check.code,
            severity: "warning",
          });
        }
      }
    });
  }

  private checkPerformance(code: string, lines: string[], suggestions: ValidationIssue[]) {
    for (const check of PERFORMANCE_PATTERNS) {
      if (check.pattern.test(code)) {
        suggestions.push({
          line: 1,
          message: check.msg,
          code: check.code,
          severity: "info",
        });
      }
    }
  }

  private strictChecks(
    code: string,
    lines: string[],
    warnings: ValidationIssue[],
    suggestions: ValidationIssue[]
  ) {
    // Var scope in functions
    lines.forEach((line, idx) => {
      if (/<cfset\s+(?!var\s+\w+\s*=)(\w+)\s*=/i.test(line)) {
        if (code.indexOf("<cffunction") < code.substring(0, code.indexOf(line)).length) {
          suggestions.push({
            line: idx + 1,
            message: "Variable inside function may need 'var' scope declaration to prevent thread leaks",
            code: "STR001",
            severity: "info",
          });
        }
      }
    });
  }

  private computeStats(code: string) {
    return {
      lines: code.split("\n").length,
      tags: (code.match(/<cf\w+/gi) || []).length,
      functions: (code.match(/<cffunction|function\s+\w+\s*\(/gi) || []).length,
      cfscriptBlocks: (code.match(/<cfscript>/gi) || []).length,
    };
  }
}
