# INSTALLATION — B.E.N.
### *Bridge Engine for Native CFML*

> Complete guide to install, configure, and run B.E.N. on your environment.

---

## Prerequisites

Before you begin, make sure you have:

- **Node.js** v18 or higher — [nodejs.org](https://nodejs.org)
- **npm** v9 or higher (included with Node.js)
- A running **Lucee** or **Adobe ColdFusion** server
- Access to the server's webroot to deploy `cfmcp-exec.cfm`
- At least one API key (see free options below)

Check your versions:

```bash
node --version   # must be >= 18.0.0
npm --version    # must be >= 9.0.0
```

---

## Step 1 — Get Free API Keys

B.E.N. works with free API keys. You don't need a credit card to get started.

**Google Gemini (recommended — best free tier)**
1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Sign in with your Google account
3. Click **Get API Key → Create API key**
4. Copy the key — it starts with `AIzaSy`

**Groq (fast, free, Llama 3.1)**
1. Go to [console.groq.com](https://console.groq.com)
2. Create a free account
3. Go to **API Keys → Create API Key**
4. Copy the key — it starts with `gsk_`

**Mistral (optional free tier)**
1. Go to [console.mistral.ai](https://console.mistral.ai)
2. Create a free account
3. Generate an API key in the **API Keys** section

**Paid providers (optional)**
- Anthropic (Claude): [console.anthropic.com](https://console.anthropic.com)
- OpenAI (GPT-4o): [platform.openai.com](https://platform.openai.com)

---

## Step 2 — Clone the Repository

```bash
git clone https://github.com/pemartins1970/ben-cfml-mcp-system.git
cd ben-cfml-mcp-system
```

---

## Step 3 — Install the MCP Server

```bash
cd cfml-mcp-server
npm install
npm run build
```

Expected output:
```
> cfml-mcp-server@1.0.0 build
> tsc
✓ Build completed — dist/ folder created
```

---

## Step 4 — Install the Agent

```bash
cd ../cfml-mcp-agent
npm install
npm run build
```

---

## Step 5 — Deploy the CF Executor

Copy `cfmcp-exec.cfm` to your ColdFusion/Lucee server webroot:

```bash
cp cfml-mcp-server/deploy/cfmcp-exec.cfm /path/to/your/webroot/
```

**IMPORTANT — Restrict access by IP**

**Nginx:**
```nginx
location /cfmcp-exec.cfm {
    allow 127.0.0.1;
    allow 10.0.0.0/8;   # your internal network
    deny all;
}
```

**Apache:**
```apache
<Files "cfmcp-exec.cfm">
    Require ip 127.0.0.1
    Require ip 10.0.0.0/8
</Files>
```

**IIS — web.config:**
```xml
<system.webServer>
  <security>
    <ipSecurity allowUnlisted="false">
      <add ipAddress="127.0.0.1" allowed="true" />
      <add ipAddress="10.0.0.0" subnetMask="255.0.0.0" allowed="true" />
    </ipSecurity>
  </security>
</system.webServer>
```

---

## Step 6 — Configure Environment Variables

Create a `.env` file in each module folder, or export directly in your shell.

**Minimum free configuration (no credit card required):**

```bash
# CF Server
export CF_SERVER_TYPE=lucee              # or "adobe"
export LUCEE_URL=http://localhost:8888
export LUCEE_ADMIN_PASSWORD=your_password

# Free LLM keys
export GEMINI_API_KEY=AIzaSy-xxx
export GROQ_API_KEY=gsk_xxx

# Executor token (choose any secure string)
export CFMCP_TOKEN=your_secure_token_here
```

**Full configuration (all providers):**

```bash
# Lucee
export CF_SERVER_TYPE=lucee
export LUCEE_URL=http://localhost:8888
export LUCEE_ADMIN_PASSWORD=your_password

# Adobe CF (if applicable)
export ADOBE_CF_URL=http://localhost:8500
export ADOBE_CF_USER=admin
export ADOBE_CF_PASSWORD=your_password

# Figma (optional — for design conversion)
export FIGMA_API_TOKEN=figd_xxxx

# Anthropic (paid)
export ANTHROPIC_API_KEY_1=sk-ant-xxx
export ANTHROPIC_API_KEY_2=sk-ant-yyy   # automatic rotation

# OpenAI (paid)
export OPENAI_API_KEY_1=sk-proj-xxx

# Free providers
export GEMINI_API_KEY=AIzaSy-xxx
export GROQ_API_KEY=gsk_xxx
export MISTRAL_API_KEY=xxx

# Executor token
export CFMCP_TOKEN=your_secure_token_here
```

---

## Step 7 — Configure Your IDE

Add the following to your `mcp.json` file in **Trae**, **VS Code**, or **Cursor**:

```json
{
  "mcpServers": {
    "cfml": {
      "command": "node",
      "args": ["/absolute/path/to/ben-cfml-mcp-system/cfml-mcp-server/dist/index.js"],
      "env": {
        "CF_SERVER_TYPE": "lucee",
        "LUCEE_URL": "http://localhost:8888",
        "LUCEE_ADMIN_PASSWORD": "your_password",
        "CFMCP_TOKEN": "your_secure_token_here",
        "FIGMA_API_TOKEN": ""
      }
    }
  }
}
```

**Where to find mcp.json:**
- **Trae:** `~/.trae/mcp.json`
- **Cursor:** `~/.cursor/mcp.json`
- **VS Code (with MCP extension):** `~/.vscode/mcp.json`

---

## Step 8 — Run the Agent

```bash
cd cfml-mcp-agent
node dist/agent/cfml-agent.js
```

Example prompts:

```
You: Validate this code: <cfquery name="q" datasource="myDS">SELECT * FROM users WHERE id=#url.id#</cfquery>
You: Generate a TestBox BDD spec for the component models.UserService
You: Clear the Lucee server cache and show status
You: Convert Figma https://figma.com/file/abc123 to a CFM component with Bootstrap 5
You: .stats    # view key rotation statistics
You: .help     # view all available commands
```

---

## Step 9 — 100% Local Setup with Ollama (Optional)

For completely offline, zero-cost, private usage:

**Install Ollama:**
```bash
# macOS / Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Windows: download from https://ollama.ai
```

**Download a code-specialized model:**
```bash
ollama pull codellama        # 7B — good for most tasks
ollama pull deepseek-coder   # excellent for code generation
```

**Verify Ollama is running:**
```bash
curl http://localhost:11434/api/tags
```

Once running, add Ollama as a provider in the agent configuration. The MoE router will automatically use it for offline tasks and privacy-sensitive workloads.

---

## Verification Tests

Run these commands to confirm each layer is working:

**1. Node.js and build:**
```bash
node -e "console.log('Node OK:', process.version)"
ls cfml-mcp-server/dist/index.js && echo "MCP Server build OK"
ls cfml-mcp-agent/dist/agent/cfml-agent.js && echo "Agent build OK"
```

**2. CF Executor:**
```bash
curl -s "http://localhost:8888/cfmcp-exec.cfm" \
  -H "X-CFMCP-Token: your_secure_token_here" \
  -d '{"action":"status"}' | head -50
```

**3. Gemini API:**
```bash
curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY" \
  | grep '"name"' | head -3
```

**4. Groq API:**
```bash
curl -s "https://api.groq.com/openai/v1/models" \
  -H "Authorization: Bearer $GROQ_API_KEY" \
  | grep '"id"' | head -3
```

---

## Troubleshooting

**`Cannot find module 'dist/index.js'`**
The build didn't complete. Run `npm run build` again inside the correct folder and check for TypeScript errors.

**`Connection refused` on CF Executor**
Confirm your Lucee/Adobe CF server is running and the URL in the environment variables matches exactly. Check that `cfmcp-exec.cfm` is in the webroot.

**`403 Forbidden` on CF Executor**
IP restriction is blocking your request. Add your machine's IP to the allow list in your web server config.

**`401 Unauthorized` on CF Executor**
The `CFMCP_TOKEN` in the request doesn't match the value on the server. Verify both are identical.

**`429 Too Many Requests`**
You've hit the rate limit on a free API key. The Key Rotation Manager will automatically switch to the next available key. Add more keys to the pool or wait for the cooldown window to reset.

**Agent starts but IDE doesn't recognize the tools**
Check the `mcp.json` path — it must be the **absolute path** to `dist/index.js`, not relative. Restart the IDE after updating `mcp.json`.

---

## Support

For issues, questions, or feedback:

- **GitHub Issues:** [github.com/pemartins1970/ben-cfml-mcp-system/issues](https://github.com/pemartins1970/ben-cfml-mcp-system/issues)
- **Commercial licensing and partnerships:** pemartins+bencfml@gmail.com

---

*Copyright © 2026 Paulo Marcelo Andrade Soares Martins. Distributed under Business Source License 1.1.*
