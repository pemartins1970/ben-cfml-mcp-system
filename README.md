# CFML-MCP-System
O primeiro MCP nativo para CFML com agente MCP+MoE+LLM e com um sistema de gerenciamento e rotação de chaves de API.

# CFML MCP System
## MCP Server + MoE Agent com Rotação de Chaves

```
╔══════════════════════════════════════════════════════════════════╗
║                     ARQUITETURA GERAL                           ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  ┌─────────────┐    MCP/stdio    ┌──────────────────────────┐  ║
║  │  Trae IDE   │◄───────────────►│   CFML MCP Server        │  ║
║  │  VS Code    │    ou SSE        │  (cfml-mcp-server)       │  ║
║  │  Cursor     │                  │                          │  ║
║  └─────────────┘                  │  ┌──────────────────┐   │  ║
║                                   │  │ CFML Validator   │   │  ║
║  ┌─────────────────────────────┐  │  │ Syntax checker   │   │  ║
║  │   CFML MCP Agent            │  │  └──────────────────┘   │  ║
║  │                             │  │  ┌──────────────────┐   │  ║
║  │  ┌─────────┐ ┌──────────┐  │  │  │ Lucee Bridge     │   │  ║
║  │  │MoE      │ │Key       │  │  │  │ Adobe CF Bridge  │   │  ║
║  │  │Router   │ │Rotation  │  │  │  └──────────────────┘   │  ║
║  │  └────┬────┘ └────┬─────┘  │  │  ┌──────────────────┐   │  ║
║  │       │           │         │  │  │ TestBox Runner   │   │  ║
║  │  ┌────▼───────────▼─────┐  │  │  └──────────────────┘   │  ║
║  │  │   LLM Client         │  │  │  ┌──────────────────┐   │  ║
║  │  │  ┌───────────────┐   │  │  │  │ Figma Converter  │   │  ║
║  │  │  │ Anthropic     │   │  │  │  └──────────────────┘   │  ║
║  │  │  │ OpenAI        │   │  │  └──────────────────────────┘  ║
║  │  │  │ Gemini        │   │  │             │                  ║
║  │  │  │ Groq          │   │  │       HTTP POST               ║
║  │  │  │ Mistral       │   │  │             ▼                  ║
║  │  │  └───────────────┘   │  │  ┌──────────────────────────┐  ║
║  │  └──────────────────────┘  │  │  Lucee / Adobe CF Server  │  ║
║  └─────────────────────────────┘  │  (cfmcp-exec.cfm)        │  ║
║                                   └──────────────────────────┘  ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## 📁 Estrutura do Projeto

```
cfml-mcp-server/              ← Servidor MCP nativo para CFML
├── src/
│   ├── index.ts              ← Entry point + tool router
│   ├── validators/
│   │   └── cfml-validator.ts ← Validação estática de sintaxe CFML
│   ├── server-bridge/
│   │   ├── lucee-bridge.ts   ← Bridge Lucee Admin API
│   │   └── adobecf-bridge.ts ← Bridge Adobe CF Admin
│   ├── tools/
│   │   └── testbox-runner.ts ← Runner e gerador de specs TestBox
│   └── frontend/
│       └── figma-converter.ts← Figma → CFML via API
└── deploy/
    └── cfmcp-exec.cfm        ← Executor CFML (deploy no servidor)

cfml-mcp-agent/               ← Agente autônomo MCP + MoE + LLM
├── src/
│   ├── rotation/
│   │   └── key-rotation.ts   ← Gerenciador de rotação de chaves API
│   ├── moe/
│   │   └── moe-router.ts     ← Router MoE (classifica tarefas → expert)
│   ├── llm/
│   │   └── llm-client.ts     ← Cliente multi-provider (5 LLMs)
│   └── agent/
│       └── cfml-agent.ts     ← Agente principal + REPL CLI
```

---

## 🚀 Instalação e Configuração

### 1. MCP Server

```bash
cd cfml-mcp-server
npm install
npm run build
```

### 2. Agent

```bash
cd cfml-mcp-agent
npm install
npm run build
```

### 3. Deploy do Executor no Servidor CF

Copie `cfml-mcp-server/deploy/cfmcp-exec.cfm` para o webroot do seu servidor Lucee/Adobe CF.

**IMPORTANTE:** Proteja o arquivo no web server:

```nginx
# Nginx
location /cfmcp-exec.cfm {
    allow 127.0.0.1;
    allow 10.0.0.0/8;   # sua rede interna
    deny all;
}
```

---

## ⚙️ Variáveis de Ambiente

```bash
# Servidor CF
export CF_SERVER_TYPE=lucee          # ou "adobe"
export LUCEE_URL=http://localhost:8888
export LUCEE_ADMIN_PASSWORD=sua_senha_aqui

# Adobe CF (se usar adobe)
export ADOBE_CF_URL=http://localhost:8500
export ADOBE_CF_USER=admin
export ADOBE_CF_PASSWORD=sua_senha_aqui

# Figma (opcional - para conversão de designs)
export FIGMA_API_TOKEN=figd_xxxx

# Chaves LLM (para o Agent - adicione quantas quiser)
export ANTHROPIC_API_KEY_1=sk-ant-xxx
export ANTHROPIC_API_KEY_2=sk-ant-yyy    # rotação automática
export OPENAI_API_KEY_1=sk-proj-xxx
export GEMINI_API_KEY=AIzaSy-xxx
export GROQ_API_KEY=gsk_xxx
```

---

## 🔧 Configuração no Trae / VS Code / Cursor

Adicione ao `mcp.json`:

```json
{
  "mcpServers": {
    "cfml": {
      "command": "node",
      "args": ["/path/to/cfml-mcp-server/dist/index.js"],
      "env": {
        "LUCEE_URL": "http://localhost:8888",
        "LUCEE_ADMIN_PASSWORD": "lucee",
        "CF_SERVER_TYPE": "lucee",
        "FIGMA_API_TOKEN": ""
      }
    }
  }
}
```

---

## 🤖 Ferramentas MCP Disponíveis

| Tool | Descrição |
|------|-----------|
| `cfml_validate_syntax` | Valida código CFML/CFScript sem executar |
| `cfml_validate_file` | Valida arquivo .cfm/.cfc no servidor |
| `cfml_server_status` | Status do servidor (memória, uptime, DSNs) |
| `cfml_clear_cache` | Limpa caches (template, query, tudo) |
| `cfml_reload_app` | Reinicia aplicação CFML |
| `cfml_execute_code` | Executa snippet CFML no servidor |
| `cfml_manage_datasource` | CRUD de datasources |
| `cfml_run_testbox` | Executa testes TestBox |
| `cfml_generate_test` | Gera spec TestBox BDD/Unit |
| `cfml_figma_to_cfml` | Converte design Figma em CFML |

---

## 🧠 Sistema MoE - Experts e Capacidades

| Expert | Provider | Pontos Fortes | Custo |
|--------|----------|---------------|-------|
| Claude Sonnet 4 | Anthropic | Código CFML, segurança, geral | $3/Mtoken |
| GPT-4o | OpenAI | UI, explicações, geral | $5/Mtoken |
| Gemini 1.5 Flash | Google | Contexto longo, barato | $0.075/Mtoken |
| Llama 3.1 70B | Groq | Ultra-baixa latência | $0.59/Mtoken |
| Mistral Large | Mistral | Código, custo-benefício | $2/Mtoken |

O router MoE classifica automaticamente cada tarefa e direciona para o expert ideal.

---

## 🔑 Sistema de Rotação de Chaves

- **Round-robin** com pesos por prioridade
- **Detecção automática** de rate limits via headers HTTP
- **Cooldown exponencial**: 1s → 2s → 4s → ... → 60s
- **Quarentena** de chaves com 5+ erros consecutivos
- **Reset de janela** a cada 60 segundos (RPM tracking)
- **Controle de budget** por chave (USD)

---

## 💬 Exemplo de Uso do Agent

```bash
cd cfml-mcp-agent
ANTHROPIC_API_KEY_1=sk-ant-xxx node dist/agent/cfml-agent.ts

# Exemplos de prompts:
You: Valide este código: <cfquery name="q" datasource="myDS">SELECT * FROM users WHERE id=#url.id#</cfquery>
You: Gere um spec TestBox BDD para o componente models.UserService
You: Limpe o cache do servidor Lucee e mostre o status
You: Converta o Figma https://figma.com/file/abc123 em um componente CFM com Bootstrap 5
You: .stats   (ver estatísticas de rotação de chaves)
```

---

## 🛡️ Segurança

- `cfmcp-exec.cfm` valida token em **toda** requisição
- Token lido de variável de ambiente (nunca hardcoded)
- Restrinja acesso por IP no web server
- Use HTTPS em produção
- Considere adicionar sandbox CF (Security Manager) para limitar operações permitidas
