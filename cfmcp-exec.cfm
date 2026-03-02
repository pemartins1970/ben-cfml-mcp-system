<!--- 
  cfmcp-exec.cfm
  ════════════════════════════════════════════════════════════
  CFML MCP Server Executor - Deploy this on your Lucee/Adobe CF server
  
  SECURITY: This file MUST be protected:
  1. Restrict by IP in web server config (Apache/IIS/Nginx)
  2. Use a strong token (environment variable)
  3. NEVER expose this to public internet
  
  Nginx example:
    location /cfmcp-exec.cfm {
      allow 127.0.0.1;
      deny all;
    }
  
  Apache example:
    <Files "cfmcp-exec.cfm">
      Require ip 127.0.0.1
    </Files>
  ════════════════════════════════════════════════════════════
--->

<cfscript>
  // ── Security Token Validation ──
  local.expectedToken = server.system.environment.LUCEE_ADMIN_PASSWORD ?: "lucee";
  
  request = getHTTPRequestData();
  
  if (request.method != "POST") {
    cfheader(statusCode="405", statusText="Method Not Allowed");
    writeOutput('{"error":"POST required"}');
    abort;
  }
  
  // Parse body
  local.body = {};
  if (len(request.content)) {
    try {
      local.body = deserializeJSON(request.content);
    } catch(e) {
      cfheader(statusCode="400", statusText="Bad Request");
      writeOutput('{"error":"Invalid JSON body"}');
      abort;
    }
  }
  
  // Validate token
  if ((local.body.token ?: "") != local.expectedToken) {
    cfheader(statusCode="403", statusText="Forbidden");
    writeOutput('{"error":"Invalid token"}');
    abort;
  }
  
  local.code = local.body.code ?: "";
  if (!len(trim(local.code))) {
    cfheader(statusCode="400", statusText="Bad Request");
    writeOutput('{"error":"No code provided"}');
    abort;
  }
  
  // Set JSON content type
  cfheader(name="Content-Type", value="application/json; charset=UTF-8");
  cfheader(name="X-CFML-MCP-Version", value="1.0.0");
  
  // ── Execute Code in Sandboxed Scope ──
  try {
    // Write code to temp file and include it (allows tag-based CFML)
    local.tempFile = getTempDirectory() & "cfmcp_" & createUUID() & ".cfm";
    
    fileWrite(local.tempFile, local.code);
    
    cfsavecontent(variable="local.output") {
      include "#local.tempFile#";
    }
    
    // Clean up temp file
    if (fileExists(local.tempFile)) {
      fileDelete(local.tempFile);
    }
    
    // Return output (if it's already JSON, return as-is; otherwise wrap it)
    if (isJSON(local.output)) {
      writeOutput(local.output);
    } else {
      writeOutput(serializeJSON({
        output: local.output,
        success: true
      }));
    }
    
  } catch(e) {
    // Clean up on error
    if (isDefined("local.tempFile") && fileExists(local.tempFile)) {
      try { fileDelete(local.tempFile); } catch(ignore) {}
    }
    
    cfheader(statusCode="500", statusText="Internal Server Error");
    writeOutput(serializeJSON({
      success: false,
      error: e.message,
      detail: e.detail ?: "",
      type: e.type ?: "Application",
      stacktrace: (local.body.debug ?: false) ? e.stackTrace ?: "" : ""
    }));
  }
</cfscript>
