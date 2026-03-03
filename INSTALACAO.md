# 📦 Guia de Instalação e Configuração
## CFML MCP Server + Agent

---

## Índice

1. [Pré-requisitos](#1-pré-requisitos)
2. [Obtendo as Chaves de API](#2-obtendo-as-chaves-de-api-gratuitas)
3. [Instalando o MCP Server](#3-instalando-o-cfml-mcp-server)
4. [Instalando o Agent](#4-instalando-o-cfml-mcp-agent)
5. [Deploy do Executor no Servidor CF](#5-deploy-do-executor-no-servidor-cf)
6. [Configurando o Trae / VS Code / Cursor](#6-configurando-a-ide)
7. [Variáveis de Ambiente](#7-variáveis-de-ambiente)
8. [Testando a Instalação](#8-testando-a-instalação)
9. [Configuração com Ollama (100% local)](#9-configuração-com-ollama-100-local)
10. [Solução de Problemas](#10-solução-de-problemas)

---

## 1. Pré-requisitos

🔍 Diagnóstico e Suporte (Verificação do Ambiente)
Antes de configurar o MCP, recomendamos verificar se o seu servidor CFML (Lucee ou Adobe) atende aos requisitos de conectividade e segurança (como suporte a TLS 1.3 para APIs de IA).

Preparação: Copie o arquivo tools/ben_check.cfm para a raiz do seu servidor web.

Execução: Acesse http://seu-servidor/ben_check.cfm no seu navegador.

Análise: O script verificará sua versão do Java (11 ou superior necessária), a conectividade de saída e as permissões de gravação.

Precisa de ajuda? Se o ambiente estiver "OK", mas o sistema apresentar falhas, clique no botão "Copiar Log" no script e anexe o JSON a uma Issue no GitHub.

### Obrigatórios

| Dependência | Versão mínima | Como verificar |
|-------------|--------------|----------------|
| Node.js | 18+ | `node --version` |
| npm | 8+ | `npm --version` |
| Git | qualquer | `git --version` |

### Servidor CF (um dos dois)

| Opção | Download |
|-------|----------|
| **Lucee** (recomendado, gratuito) | [lucee.org/downloads](https://lucee.org/downloads.html) |
| **Adobe ColdFusion** | [adobe.com/coldfusion](https://www.adobe.com/products/coldfusion-family.html) |

### Instalando o Node.js (se não tiver)

**Windows:**
```
Baixe o instalador em: https://nodejs.org
```

**macOS:**
```bash
brew install node
```

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

---

## 2. Obtendo as Chaves de API (Gratuitas)

### Google Gemini — Recomendado como principal gratuito

1. Acesse [aistudio.google.com](https://aistudio.google.com)
2. Faça login com sua conta Google
3. Clique em **"Get API Key"** → **"Create API key"**
4. Copie a chave (começa com `AIzaSy...`)

Limites gratuitos: 15 requisições/min, 1 milhão de tokens/min no Gemini Flash.

---

### Groq — Melhor para baixa latência (gratuito)

1. Acesse [console.groq.com](https://console.groq.com)
2. Crie uma conta gratuita
3. Vá em **"API Keys"** → **"Create API Key"**
4. Copie a chave (começa com `gsk_...`)

Limites gratuitos: 30 requisições/min com Llama 3.1 70B.

---

### Mistral — Opcional (tier gratuito limitado)

1. Acesse [console.mistral.ai](https://console.mistral.ai)
2. Crie uma conta e confirme o e-mail
3. Vá em **"API Keys"** → **"Create new key"**
4. Copie a chave

---

### Anthropic / OpenAI — Apenas créditos iniciais

Estes não têm tier gratuito permanente. Se quiser usar:

- **Anthropic:** [console.anthropic.com](https://console.anthropic.com) — chave começa com `sk-ant-...`
- **OpenAI:** [platform.openai.com](https://platform.openai.com) — chave começa com `sk-proj-...`

Ambos oferecem créditos iniciais (~$5–10) para novos cadastros.

---

## 3. Instalando o CFML MCP Server

```bash
# Clone ou baixe o projeto
git clone https://github.com/seu-usuario/cfml-mcp-system.git
cd cfml-mcp-system/cfml-mcp-server

# Instale as dependências
npm install

# Compile o TypeScript
npm run build
```

Verifique se a compilação funcionou:

```bash
ls dist/
# Deve listar: index.js, validators/, server-bridge/, tools/, frontend/
```

---

## 4. Instalando o CFML MCP Agent

```bash
cd ../cfml-mcp-agent

# Instale as dependências
npm install

# Compile
npm run build
```

---

## 5. Deploy do Executor no Servidor CF

O arquivo `cfmcp-exec.cfm` precisa estar acessível no seu servidor Lucee ou Adobe CF. Ele é o "ponte" que permite ao MCP Server executar código CFML remotamente.

### Copiando o arquivo

```bash
# Exemplo com Lucee rodando em /opt/lucee/webapps/ROOT
cp cfml-mcp-server/deploy/cfmcp-exec.cfm /opt/lucee/webapps/ROOT/cfmcp-exec.cfm

# Ou para Adobe CF
cp cfml-mcp-server/deploy/cfmcp-exec.cfm C:\ColdFusion2023\cfusion\wwwroot\cfmcp-exec.cfm
```

### Protegendo o arquivo (OBRIGATÓRIO)

Nunca deixe este arquivo acessível publicamente. Restrinja por IP:

**Nginx:**
```nginx
location /cfmcp-exec.cfm {
    allow 127.0.0.1;
    allow ::1;
    deny all;
}
```

**Apache (.htaccess):**
```apache
<Files "cfmcp-exec.cfm">
    Require ip 127.0.0.1
    Require ip ::1
</Files>
```

**IIS (web.config):**
```xml
<system.webServer>
  <security>
    <ipSecurity allowUnlisted="false">
      <add ipAddress="127.0.0.1" allowed="true" />
    </ipSecurity>
  </security>
</system.webServer>
```

### Testando o executor

```bash
curl -X POST http://localhost:8888/cfmcp-exec.cfm \
  -H "Content-Type: application/json" \
  -d '{"code":"<cfscript>writeOutput(serializeJSON({ok:true,version:server.lucee.version}));</cfscript>","token":"sua_senha_lucee"}'
```

Resposta esperada:
```json
{"ok":true,"version":"6.1.0.237"}
```

---

## 6. Configurando a IDE

### Trae

Abra as configurações do Trae e localize o arquivo `mcp.json`. Adicione:

```json
{
  "mcpServers": {
    "cfml": {
      "command": "node",
      "args": ["/caminho/absoluto/cfml-mcp-server/dist/index.js"],
      "env": {
        "CF_SERVER_TYPE": "lucee",
        "LUCEE_URL": "http://localhost:8888",
        "LUCEE_ADMIN_PASSWORD": "sua_senha_aqui",
        "FIGMA_API_TOKEN": ""
      }
    }
  }
}
```

### VS Code (com extensão MCP)

Crie ou edite `.vscode/mcp.json` na raiz do seu projeto:

```json
{
  "servers": {
    "cfml-dev": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/../../cfml-mcp-server/dist/index.js"],
      "env": {
        "CF_SERVER_TYPE": "lucee",
        "LUCEE_URL": "http://localhost:8888",
        "LUCEE_ADMIN_PASSWORD": "lucee"
      }
    }
  }
}
```

### Cursor

Edite `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "cfml": {
      "command": "node",
      "args": ["/caminho/absoluto/cfml-mcp-server/dist/index.js"],
      "env": {
        "CF_SERVER_TYPE": "lucee",
        "LUCEE_URL": "http://localhost:8888",
        "LUCEE_ADMIN_PASSWORD": "lucee"
      }
    }
  }
}
```

> **Dica:** Use sempre o caminho absoluto nos `args` para evitar problemas de resolução de diretório.

---

## 7. Variáveis de Ambiente

A forma mais organizada é criar um arquivo `.env` na raiz do projeto. **Nunca commite este arquivo no Git.**

### Criando o `.env`

```bash
# Na raiz do projeto
cp .env.example .env
```

### Conteúdo completo do `.env`

```dotenv
# ─────────────────────────────────────────────
# Servidor ColdFusion
# ─────────────────────────────────────────────
CF_SERVER_TYPE=lucee               # "lucee" ou "adobe"

# Lucee
LUCEE_URL=http://localhost:8888
LUCEE_ADMIN_PASSWORD=lucee

# Adobe CF (preencha se CF_SERVER_TYPE=adobe)
ADOBE_CF_URL=http://localhost:8500
ADOBE_CF_USER=admin
ADOBE_CF_PASSWORD=

# ─────────────────────────────────────────────
# Figma (opcional)
# ─────────────────────────────────────────────
FIGMA_API_TOKEN=

# ─────────────────────────────────────────────
# Chaves LLM — Agent (adicione as que tiver)
# ─────────────────────────────────────────────

# Google Gemini (gratuito — recomendado)
GEMINI_API_KEY=AIzaSy-coloque-sua-chave-aqui

# Groq (gratuito — baixa latência)
GROQ_API_KEY=gsk_coloque-sua-chave-aqui

# Mistral (opcional)
MISTRAL_API_KEY=

# Anthropic (opcional — créditos iniciais)
ANTHROPIC_API_KEY_1=
ANTHROPIC_API_KEY_2=

# OpenAI (opcional — créditos iniciais)
OPENAI_API_KEY_1=

# ─────────────────────────────────────────────
# Preferências do Agent
# ─────────────────────────────────────────────
PREFER_LOW_COST=true               # Prioriza modelos mais baratos
PREFER_LOW_LATENCY=false           # Prioriza modelos mais rápidos
CFML_MCP_CMD=node /caminho/cfml-mcp-server/dist/index.js
```

### Carregando o `.env` no terminal

**Linux/macOS:**
```bash
export $(grep -v '^#' .env | xargs)
```

**Windows (PowerShell):**
```powershell
Get-Content .env | Where-Object { $_ -notmatch '^#' -and $_ -ne '' } | ForEach-Object {
    $name, $value = $_ -split '=', 2
    [System.Environment]::SetEnvironmentVariable($name, $value, 'Process')
}
```

---

## 8. Testando a Instalação

### Teste 1 — MCP Server responde

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | \
  node cfml-mcp-server/dist/index.js
```

Você deve ver a lista de 10 ferramentas em JSON.

### Teste 2 — Validação de sintaxe (sem servidor CF)

```bash
echo '{
  "jsonrpc":"2.0","id":2,
  "method":"tools/call",
  "params":{
    "name":"cfml_validate_syntax",
    "arguments":{
      "code":"<cfset x = 1><cfoutput>#x#</cfoutput>",
      "filename":"test.cfm"
    }
  }
}' | node cfml-mcp-server/dist/index.js
```

### Teste 3 — Agent interativo

```bash
cd cfml-mcp-agent

# Com Gemini gratuito
GEMINI_API_KEY=sua_chave node dist/agent/cfml-agent.js

# Prompt de teste:
# You: Valide este código: <cfset x = url.id><cfquery datasource="myDB">SELECT * FROM users WHERE id=#x#</cfquery>
```

### Teste 4 — Status do servidor Lucee

No agent interativo:
```
You: Qual é o status do servidor?
```

O agent deve chamar `cfml_server_status` e retornar informações sobre o Lucee.

---

## 9. Configuração com Ollama (100% local)

Ollama roda modelos LLM localmente, sem internet e sem custo.

### Instalando o Ollama

**Linux/macOS:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Windows:** Baixe em [ollama.com/download](https://ollama.com/download)

### Baixando um modelo CFML-friendly

```bash
# CodeLlama — bom para código (7B, ~4GB)
ollama pull codellama

# Ou DeepSeek Coder — excelente para código (6.7B, ~4GB)
ollama pull deepseek-coder

# Ou Llama 3.1 8B — bom geral (8B, ~5GB)
ollama pull llama3.1
```

### Adicionando Ollama ao Agent

Edite `cfml-mcp-agent/src/agent/cfml-agent.ts` e adicione na lista `apiKeys`:

```typescript
{
  id: "ollama-local",
  provider: "ollama",
  key: "http://localhost:11434",   // URL do Ollama local
  model: "codellama",              // ou "deepseek-coder"
  priority: 3,
  maxRPM: 999,
  costPerMToken: 0,                // gratuito
}
```

Compile novamente:
```bash
npm run build
```

---

## 10. Solução de Problemas

### `Cannot find module '@modelcontextprotocol/sdk'`

```bash
npm install @modelcontextprotocol/sdk
```

### `ECONNREFUSED` ao conectar no Lucee

Verifique se o Lucee está rodando:
```bash
curl http://localhost:8888/lucee/admin/server.cfm
```
Se não responder, inicie o Lucee e aguarde ~30 segundos.

### `403 Forbidden` no cfmcp-exec.cfm

O token enviado não bate com `LUCEE_ADMIN_PASSWORD`. Verifique se a variável de ambiente está definida corretamente.

### `No available API keys for provider`

Nenhuma chave do provider solicitado está configurada ou todas estão em cooldown. Verifique:
```
You: .stats
```
O campo `coolingDownKeys` mostra quantas chaves estão em espera e por quanto tempo.

### Agent retorna respostas genéricas sem chamar ferramentas

O LLM precisa de `supportsTools: true` no expert. Gemini Flash e Groq suportam tool calling — verifique se o modelo configurado no Ollama também suporta (CodeLlama suporta, modelos muito pequenos podem não suportar).

### Erro de compilação TypeScript

```bash
# Limpe e recompile
rm -rf dist/
npm run build
```

Se o erro persistir, verifique a versão do Node:
```bash
node --version   # precisa ser >= 18
```

---

## Estrutura final de diretórios

Após a instalação completa, você terá:

```
cfml-mcp-system/
├── .env                          ← suas chaves (nunca commitar)
├── .env.example                  ← template sem valores reais
├── cfml-mcp-server/
│   ├── dist/                     ← código compilado (gerado pelo build)
│   ├── src/                      ← código fonte TypeScript
│   └── deploy/
│       └── cfmcp-exec.cfm        ← deploy no webroot do CF
└── cfml-mcp-agent/
    ├── dist/                     ← código compilado
    └── src/                      ← código fonte TypeScript
```

---

## Próximos passos

Após a instalação, você pode:

- Abrir o Trae/Cursor e testar `@cfml` para ativar as ferramentas
- Rodar `node dist/agent/cfml-agent.js` para o modo interativo
- Usar `cfml_generate_test` para gerar specs TestBox dos seus CFCs existentes
- Conectar o Figma com `FIGMA_API_TOKEN` para converter designs em CFML
