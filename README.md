# B.E.N. — A CFML-MCP-System
### *Bridge Engine for Native CFML*

![Version](https://img.shields.io/badge/version-1.0.0-00e676?style=flat-square)
![License](https://img.shields.io/badge/license-BUSL--1.1-ffab00?style=flat-square)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-00e676?style=flat-square&logo=node.js&logoColor=white)
![CFML](https://img.shields.io/badge/CFML-Lucee%20%7C%20Adobe%20CF-e84c4c?style=flat-square)
![Status](https://img.shields.io/badge/status-active-00e676?style=flat-square)

**ENGLISH**

> "ColdFusion is a dead language." If you've been working with CFML for a while, you already know how it feels. But CF keeps running billions of dollars every day. The community is small, loyal, and completely orphaned from modern tooling. **B.E.N. changes that.**

## About the name

**B.E.N.** — *Bridge Engine for Native CFML* — is a living tribute to **Ben Forta**, whose tireless work shaped generations of CFML developers around the world, and a bridge between the CFML ecosystem and the new era of AI agents.
---

## 🚀 Overview 

**B.E.N.** is the first native Model Context Protocol (MCP) system for CFML, combining:

- **MCP Server** — Direct integration with Trae, Cursor, VS Code, and any IDE with MCP support.
- **MoE + LLM Agent** — Intelligent routing between multiple language models (Claude, GPT, Gemini, Llama, Mistral).
- **API Key Management** — Automatic rotation with fallback, exponential backoff, and budget control.

### Integration with Agents and IDEs
Any tool that implements the MCP client can consume the server directly:
- **Trae / Cursor**: Native integration via `mcp.json`.
- **VS Code**: Via Anthropic MCP or Continue.dev extensions.
- **Claude Desktop**: Adds the server to your local config for a full desktop AI interface.
- **Automation**: Compatible with n8n/Make (via SSE) and CI/CD pipelines for code validation.

---

## 🔍 Diagnostics & Support (Environment Check)

Before configuring the MCP, validate if your CFML server meets the requirements (like TLS 1.3 support for AI APIs).
Antes de configurar o MCP, valide se seu servidor CFML atende aos requisitos (como suporte a TLS 1.3).

1.  **Prepare:** Copy [`tools/ben_check.cfm`](./tools/ben_check.cfm) to your server's webroot.
2.  **Run:** Access `http://your-server/ben_check.cfm` in your browser.
3.  **Analyze:** The script checks Java version (11+), connectivity, and write permissions.
4.  **Support:** If issues persist, click **"Copy Log"** in the script and attach the JSON to a [GitHub Issue](https://github.com/pemartins1970/ben-cfml-mcp-system/issues).

## ⚖️ Licensing & Terms 

This project is distributed under the **Business Source License 1.1 (BUSL 1.1)**.

B.E.N. is built with a "Contribution First" mindset. To ensure project sustainability:
* **FREE USE:** Personal projects, Open Source contributions, and individual learning.
* **COMMERCIAL USE:** If you are using B.E.N. for client-billable work, within a corporate environment, or if your employer derives direct value from its use, a **Commercial License** is required.
* *Note: Commercial plans for teams (5+ seats) are under development. Contact us for early access.*


**README EM PORTUGUÊS**

> "ColdFusion é uma linguagem morta." Se você trabalha com CFML há algum tempo, já sabe como é. Mas o CF continua movimentando bilhões de dólares todos os dias. A comunidade é pequena, leal e completamente órfã de ferramentas modernas. **B.E.N. muda isso.**

## Sobre o Nome

**B.E.N.** — *Bridge Engine for Native CFML* — é uma homenagem em vida a **Ben Forta**, cujo trabalho incansável moldou gerações de desenvolvedores CFML ao redor do mundo, e uma ponte entre o ecossistema CFML e a nova era dos agentes de IA.

## 🚀 Visão Geral (Português)

**B.E.N.** é o primeiro sistema MCP nativo para CFML, combinando:

- **MCP Server** — Integração direta com Trae, Cursor, VS Code e qualquer IDE com suporte a MCP.
- **Agente MoE + LLM** — Roteamento inteligente entre múltiplos modelos (Claude, GPT, Gemini, Llama, Mistral).
- **Gestão de Chaves de API** — Rotação automática com fallback, cooldown e controle de orçamento.

### Integração com Agentes e IDEs
Qualquer ferramenta que implemente o cliente MCP pode consumir o servidor:
- **Trae / Cursor**: Integração nativa via `mcp.json`.
- **VS Code**: Através das extensões Anthropic MCP ou Continue.dev.
- **Claude Desktop**: Interface direta com o agente de desktop da Anthropic.
- **Automação**: Compatível com n8n/Make (via SSE) e pipelines de CI/CD para validação de código.

---

## 🔍 Diagnóstico e Suporte (Verificação de Ambiente)

Antes de configurar o MCP, verifique se o seu servidor CFML atende aos requisitos (como suporte a TLS 1.3 para APIs de IA).
Antes de configurar o MCP, verifique se o seu servidor CFML atende aos requisitos (como suporte a TLS 1.3).

1. **Prepare:** Copie o arquivo [`tools/ben_check.cfm`](./tools/ben_check.cfm) para a raiz do seu servidor web.
2. **Execute:** Acesse `http://seu-servidor/ben_check.cfm` no seu navegador.
3. **Analise:** O script verifica a versão do Java (11+), a conectividade e as permissões de gravação.
4. **Suporte:** Se os problemas persistirem, clique em **"Copiar Log"** no script e anexe o JSON a uma [Issue do GitHub](https://github.com/pemartins1970/ben-cfml-mcp-system/issues).

---
## ⚖️ Licenciamento e Termos

B.E.N. foi construído com uma mentalidade de "Contribuição Primeiro". Para garantir a sustentabilidade do projeto:
* **USO GRATUITO:** Projetos pessoais, contribuições para Open Source e aprendizado individual.
* **USO COMERCIAL:** Se você utiliza o B.E.N. para trabalhos faturados a clientes, em ambientes corporativos, ou se seu empregador obtém valor direto do uso da ferramenta, uma **Licença Comercial** é necessária.
* *Nota: Planos comerciais para times estão em desenvolvimento.*

On **March 1, 2036**, the code automatically converts to **Apache License 2.0**.
See the [`LICENSE`](./LICENSE) file for full terms.

---


# B.E.N. — A CFML-MCP-System
- `cfmcp-exec.cfm` valida token em toda requisição
- Token lido de variável de ambiente — nunca hardcoded
- Restrição de acesso por IP no web server (Nginx/Apache/IIS)
- Use HTTPS em produção
- Considere Security Manager CF para sandboxing de operações

---

## Licença

Este projeto é distribuído sob a **Business Source License 1.1 (BUSL 1.1)**.

⚖️ Licensing & Terms / Licenciamento e Termos
English:
B.E.N. is built with a "Contribution First" mindset. To ensure project sustainability and prevent unfair commercial exploitation:

FREE USE: Personal projects, Open Source contributions, and individual learning.

COMMERCIAL USE: If you are using B.E.N. for client-billable work, within a corporate environment, or if your employer derives direct value from its use, a Commercial License is required.

Note: Commercial plans for teams (5+ seats) are under development. Contact us for early access.

Português:
O B.E.N. foi construído com uma mentalidade de "Contribuição Primeiro". Para garantir a sustentabilidade do projeto e evitar a exploração comercial predatória:

**USO GRATUITO:** 
- Projetos pessoais,
- Contribuições para Open Source,
- Aprendizado individual.

**USO COMERCIAL:** 
Se você utiliza o B.E.N. para trabalhos faturados a clientes, em ambientes corporativos, ou se seu empregador obtém valor direto do uso da ferramenta, uma Licença Comercial é necessária.

**Nota:** Planos comerciais para times estão em desenvolvimento. Entre em contato para acesso antecipado.

Em **1º de março de 2036**, o código converte automaticamente para **Apache License 2.0**.

Veja o arquivo [`LICENSE`](./LICENSE) para os termos completos.

---


## Arquitetura

```
╔═══════════════════════════════════════════════════════════════╗
║                        ARQUITETURA GERAL                      ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  ┌─────────────┐    MCP/stdio    ┌─────────────────────────┐  ║
║  │  Trae IDE   │◄───────────────►│   CFML MCP Server       │  ║
║  │  VS Code    │    ou SSE       │  (cfml-mcp-server)      │  ║
║  │  Cursor     │                 │                         │  ║
║  └─────────────┘                 │  ┌──────────────────┐   │  ║
║                                  │  │ CFML Validator   │   │  ║
║  ┌────────────────────────────┐  │  │ Syntax checker   │   │  ║
║  │   CFML MCP Agent           │  │  └──────────────────┘   │  ║
║  │                            │  │  ┌──────────────────┐   │  ║
║  │  ┌─────────┐ ┌──────────┐  │  │  │ Lucee Bridge     │   │  ║
║  │  │MoE      │ │Key       │  │  │  │ Adobe CF Bridge  │   │  ║
║  │  │Router   │ │Rotation  │  │  │  └──────────────────┘   │  ║
║  │  └────┬────┘ └────┬─────┘  │  │  ┌──────────────────┐   │  ║
║  │       │           │        │  │  │ TestBox Runner   │   │  ║
║  │  ┌────▼───────────▼─────┐  │  │  └──────────────────┘   │  ║
║  │  │   LLM Client         │  │  │  ┌──────────────────┐   │  ║
║  │  │  ┌───────────────┐   │  │  │  │ Figma Converter  │   │  ║
║  │  │  │ Anthropic     │   │  │  │  └──────────────────┘   │  ║
║  │  │  │ OpenAI        │   │  │  └─────────────────────────┘  ║
║  │  │  │ Gemini        │   │  │             │                 ║
║  │  │  │ Groq          │   │  │       HTTP POST               ║
║  │  │  │ Mistral       │   │  │             ▼                 ║
║  │  │  └───────────────┘   │  │   ┌──────────────────────__─┐ ║
║  │  └──────────────────────┘  │   │  Lucee / Adobe CF Server│ ║
║  └────────────────────────────┘   │  (cfmcp-exec.cfm)       │ ║
║                                   └──────────────────────_──┘ ║
╚═══════════════════════════════════════════════════════════════╝
```

---

## Estrutura do Projeto

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

## Ferramentas MCP Disponíveis

| Tool | Descrição |
|------|-----------|
| `cfml_validate_syntax` | Valida código CFML/CFScript sem executar |
| `cfml_validate_file` | Valida arquivo `.cfm`/`.cfc` no servidor |
| `cfml_server_status` | Status do servidor (memória, uptime, DSNs) |
| `cfml_clear_cache` | Limpa caches (template, query, tudo) |
| `cfml_reload_app` | Reinicia aplicação CFML |
| `cfml_execute_code` | Executa snippet CFML no servidor |
| `cfml_manage_datasource` | CRUD de datasources |
| `cfml_run_testbox` | Executa testes TestBox |
| `cfml_generate_test` | Gera spec TestBox BDD/Unit |
| `cfml_figma_to_cfml` | Converte design Figma em CFML |

---

## Sistema MoE — Experts e Capacidades

O router MoE classifica automaticamente cada tarefa em 9 categorias e seleciona o expert ideal por capacidade, custo e latência.

| Expert | Provider | Pontos Fortes | Custo |
|--------|----------|---------------|-------|
| Claude Sonnet 4 | Anthropic | Código CFML, segurança, geral | $3/Mtoken |
| GPT-4o | OpenAI | UI, explicações, geral | $5/Mtoken |
| Gemini 1.5 Flash | Google | Contexto longo, custo baixo | $0.075/Mtoken |
| Llama 3.1 70B | Groq | Ultra-baixa latência | $0.59/Mtoken |
| Mistral Large | Mistral | Código, custo-benefício | $2/Mtoken |

---

## Sistema de Rotação de Chaves

- Round-robin com pesos por prioridade
- Detecção automática de rate limits via headers HTTP
- Cooldown exponencial: 1s → 2s → 4s → ... → 60s
- Quarentena de chaves com 5+ erros consecutivos
- Reset de janela a cada 60 segundos (RPM tracking)
- Controle de budget por chave (USD)

---

## Instalação Rápida

```bash
# MCP Server
cd cfml-mcp-server
npm install && npm run build

# Agent
cd cfml-mcp-agent
npm install && npm run build

# Deploy do executor no servidor CF
cp cfml-mcp-server/deploy/cfmcp-exec.cfm /webroot/
```

Para o guia completo de instalação, configuração de variáveis de ambiente, proteção por IP e integração com IDEs, veja [`INSTALACAO.md`](./INSTALACAO.md).

---

## Configuração Mínima 100% Gratuita

O sistema funciona com chaves gratuitas. Esta configuração não custa nada:

```bash
export GEMINI_API_KEY=AIzaSy-xxx     # Google AI Studio — gratuito
export GROQ_API_KEY=gsk_xxx          # console.groq.com — gratuito
# + Ollama local para uso offline e privado
```

---

## Exemplo de Uso

```bash
cd cfml-mcp-agent
node dist/agent/cfml-agent.js

You: Valide este código: <cfquery name="q" datasource="myDS">SELECT * FROM users WHERE id=#url.id#</cfquery>
You: Gere um spec TestBox BDD para o componente models.UserService
You: Limpe o cache do servidor Lucee e mostre o status
You: Converta o Figma https://figma.com/file/abc123 em CFM com Bootstrap 5
You: .stats   # estatísticas de rotação de chaves
```

---

## Segurança

- `cfmcp-exec.cfm` valida token em toda requisição
- Token lido de variável de ambiente — nunca hardcoded
- Restrição de acesso por IP no web server (Nginx/Apache/IIS)
- Use HTTPS em produção
- Considere Security Manager CF para sandboxing de operações


*Copyright © 2026 Pê Martins. All rights reserved.*
