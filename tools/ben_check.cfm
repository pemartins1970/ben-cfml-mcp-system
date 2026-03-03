<cfcontent type="text/html" charset="utf-8">
<cfscript>
    diagnostics = {
        "timestamp": now(),
        "engine": {},
        "java": {},
        "network": { "endpoints": [] },
        "filesystem": {},
        "overall_status": "OK"
    };

    // 1. Validar Engine CFML
    diagnostics.engine.name = server.coldfusion.productname;
    diagnostics.engine.version = server.coldfusion.productversion;
    diagnostics.engine.is_supported = (listFirst(diagnostics.engine.version) >= 2018 || diagnostics.engine.name contains "Lucee");
    
    if (!diagnostics.engine.is_supported) diagnostics.overall_status = "WARNING";

    // 2. Validar Java Runtime (Crucial para TLS 1.3 / APIs de IA)
    System = createObject("java", "java.lang.System");
    diagnostics.java.version = System.getProperty("java.version");
    diagnostics.java.vendor = System.getProperty("java.vendor");
    diagnostics.java.is_ok = (val(listFirst(diagnostics.java.version, ".")) >= 11);

    if (!diagnostics.java.is_ok) diagnostics.overall_status = "ERROR";

    // 3. Testar Conectividade com Provedores de IA
    testUrls = [
        {"name": "OpenAI", "url": "https://api.openai.com"},
        {"name": "Anthropic", "url": "https://api.anthropic.com"},
        {"name": "Google Gemini", "url": "https://generativelanguage.googleapis.com"}
    ];

    for (item in testUrls) {
        testResult = {"name": item.name, "url": item.url, "status": "OK"};
        try {
            cfhttp(url=item.url, method="GET", timeout="5");
            if (val(cfhttp.statusCode) == 0) throw("Timeout");
        } catch (any e) {
            testResult.status = "ERROR";
            diagnostics.overall_status = "ERROR";
        }
        arrayAppend(diagnostics.network.endpoints, testResult);
    }

    // 4. Testar Permissões de Escrita
    currentDir = getDirectoryFromPath(getCurrentTemplatePath());
    diagnostics.filesystem.path = currentDir;
    try {
        testFile = currentDir & "ben_test_write.tmp";
        fileWrite(testFile, "test");
        fileDelete(testFile);
        diagnostics.filesystem.write_access = true;
    } catch (any e) {
        diagnostics.filesystem.write_access = false;
        diagnostics.overall_status = "ERROR";
    }

    jsonLog = serializeJSON(diagnostics);
</cfscript>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>B.E.N. | Environment Checker</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #24292e; max-width: 800px; margin: 40px auto; padding: 20px; background: #f6f8fa; }
        .card { background: white; border: 1px solid #e1e4e8; border-radius: 6px; padding: 24px; box-shadow: 0 1px 3px rgba(27,31,35,0.12); }
        .status-badge { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 10px; text-transform: uppercase; float: right; }
        .OK { background: #2ea44f; color: white; }
        .WARNING { background: #dbab09; color: white; }
        .ERROR { background: #d73a49; color: white; }
        .item { border-bottom: 1px solid #eaecef; padding: 14px 0; }
        .item:last-child { border-bottom: none; }
        h1 { color: #0366d6; margin-top: 0; font-size: 24px; }
        .lang-label { font-size: 12px; color: #6a737d; margin-bottom: 2px; display: block; }
        textarea { width: 100%; height: 120px; font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; font-size: 12px; margin-top: 10px; padding: 12px; border: 1px solid #d1d5da; border-radius: 6px; background: #f6f8fa; box-sizing: border-box; }
        .btn { display: inline-block; background: #0366d6; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; cursor: pointer; border: none; font-size: 14px; font-weight: 500; margin-top: 10px; }
        .btn:hover { background: #0255b3; }
        .warning-text { color: #d73a49; font-size: 13px; margin-top: 4px; display: block; font-weight: 500; }
        .footer { margin-top: 30px; font-size: 12px; color: #6a737d; text-align: center; }
    </style>
</head>
<body>

    <div class="card">
        <h1>B.E.N. Diagnostic Check</h1>
        <p>
            <span class="lang-label">EN: Environment validation for Bridge Engine for Native CFML.</span>
            <span class="lang-label">PT: Verificação de ambiente para o Bridge Engine for Native CFML.</span>
        </p>

        <cfoutput>
        <div class="item">
            <span class="status-badge #(diagnostics.engine.is_supported ? 'OK' : 'WARNING')#">
                #(diagnostics.engine.is_supported ? 'Compatible / Compatível' : 'Legacy / Legado')#
            </span>
            <strong>Engine CFML:</strong> #diagnostics.engine.name# #diagnostics.engine.version#
        </div>

        <div class="item">
            <span class="status-badge #(diagnostics.java.is_ok ? 'OK' : 'ERROR')#">
                #(diagnostics.java.is_ok ? 'OK' : 'Outdated / Desatualizado')#
            </span>
            <strong>Java Runtime:</strong> #diagnostics.java.version# (#diagnostics.java.vendor#)
            <cfif !diagnostics.java.is_ok>
                <span class="warning-text">
                    EN: B.E.N. requires Java 11+ for secure AI API connections.<br>
                    PT: O B.E.N. requer Java 11+ para conexões seguras com APIs de IA.
                </span>
            </cfif>
        </div>

        <div class="item">
            <strong>Connectivity / Conectividade:</strong><br>
            <cfloop array="#diagnostics.network.endpoints#" index="ep">
                <div style="font-size: 13px; margin-top: 4px;">
                    [#ep.name#]: <b style="color: #(ep.status == 'OK' ? '##2ea44f' : '##d73a49')#">#ep.status#</b>
                </div>
            </cfloop>
        </div>

        <div class="item">
            <span class="status-badge #(diagnostics.filesystem.write_access ? 'OK' : 'ERROR')#">
                #(diagnostics.filesystem.write_access ? 'OK' : 'Denied / Negado')#
            </span>
            <strong>Write Access / Escrita:</strong> #currentDir#
        </div>
        </cfoutput>
    </div>

    <div style="margin-top: 25px;">
        <h3>Technical Report / Relatório Técnico (JSON)</h3>
        <p><small>
            EN: Copy the log below and attach it to your GitHub Issue.<br>
            PT: Copie o log abaixo e anexe à sua Issue no GitHub.
        </small></p>
        <cfoutput>
            <textarea id="logArea" readonly>#jsonLog#</textarea>
            <button class="btn" onclick="copyLog()">Copy Log / Copiar Log</button>
        </cfoutput>
    </div>

    <div class="footer">
        B.E.N. Project &copy; 2026 Pê Martins | 
        <span style="color: #d73a49; font-weight: bold;">EN: Delete this file after use! / PT: Delete este arquivo após o uso!</span>
    </div>

    <script>
        function copyLog() {
            var copyText = document.getElementById("logArea");
            copyText.select();
            document.execCommand("copy");
            alert("Log copied to clipboard! / Log copiado para a área de transferência!");
        }
    </script>
</body>
</html>
