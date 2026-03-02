# B.E.N. — A CFML-MCP-System
### *Bridge Engine for Native CFML*

![Version](https://img.shields.io/badge/version-1.0.0-00e676?style=flat-square)
![License](https://img.shields.io/badge/license-BUSL--1.1-ffab00?style=flat-square)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-00e676?style=flat-square&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178c6?style=flat-square&logo=typescript&logoColor=white)
![CFML](https://img.shields.io/badge/CFML-Lucee%20%7C%20Adobe%20CF-e84c4c?style=flat-square)
![MCP](https://img.shields.io/badge/MCP-native-00e676?style=flat-square)
![Status](https://img.shields.io/badge/status-active-00e676?style=flat-square)

> CFML ainda roda bilhões de dólares em produção. Nunca teve tooling moderno à altura. **Isso muda agora.**

Uma homenagem em vida ao incansável **Ben Forta** — e uma ponte entre o ecossistema CFML e a nova era de agentes de IA.

---

## O que é

**B.E.N.** é o primeiro sistema MCP nativo para CFML, combinando:

- **MCP Server** — integração direta com Trae, Cursor, VS Code e qualquer IDE com suporte MCP
- **Agente MoE + LLM** — roteamento inteligente entre múltiplos modelos de linguagem
- **Rotação de Chaves de API** — gerenciamento automático de chaves com fallback, cooldown e controle de budget

Projetado para desenvolvedores CFML que merecem ferramentas à altura do que constroem.

---

## Arquitetura

```
╔══════════════════════════════════════════════════════════════════╗
║                        ARQUITETURA GERAL                        ║
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

---

## Licença

Este projeto é distribuído sob a **Business Source License 1.1 (BUSL 1.1)**.

- **Uso pessoal e não-comercial:** gratuito
- **Uso comercial:** requer licença paga — entre em contato

Em **1º de março de 2036**, o código converte automaticamente para **Apache License 2.0**.

Veja o arquivo [`LICENSE`](./LICENSE) para os termos completos.

---

## Sobre o Nome

**B.E.N.** — *Bridge Engine for Native CFML* — é uma homenagem em vida a **Ben Forta**, cujo trabalho incansável moldou gerações de desenvolvedores CFML ao redor do mundo.

---

*Copyright © 2026 Paulo Marcelo Andrade Soares Martins. Todos os direitos reservados.*
