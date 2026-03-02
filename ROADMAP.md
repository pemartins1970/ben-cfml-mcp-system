# ROADMAP — B.E.N.
### *Bridge Engine for Native CFML*

> Este roadmap é público e intencional. Mostra onde estamos, para onde vamos, e o que estamos buscando construir com parceiros e contribuidores.

---

## Status Atual — v1.0 ✅

O núcleo do sistema está funcional e disponível.

- [x] MCP Server nativo para CFML (stdio + SSE)
- [x] Integração com Trae, Cursor e VS Code
- [x] CFML Validator — análise estática sem execução
- [x] Lucee Bridge — Admin API completa
- [x] Adobe CF Bridge — CFIDE + WDDX
- [x] TestBox Runner — execução e geração de specs BDD/Unit
- [x] Figma Converter — design → CFML/CFScript com Bootstrap 5, Tailwind e Bulma
- [x] Agente MoE com roteamento inteligente entre 5 LLMs
- [x] LLM Client multi-provider (Anthropic, OpenAI, Gemini, Groq, Mistral)
- [x] Key Rotation Manager — round-robin, backoff exponencial, quarentena, budget tracking
- [x] Suporte a configuração 100% gratuita (Gemini + Groq + Ollama)
- [x] Executor CFML no servidor (`cfmcp-exec.cfm`) com proteção por token + IP

---

## v1.1 — Estabilização e DX 🔧
*Horizonte: curto prazo*

- [ ] CLI de setup guiado (`ben init`) — configura variáveis, testa conexão, valida IDE
- [ ] Dashboard de status em tempo real (terminal UI) para monitorar chaves, RPM e budget
- [ ] Suporte a `.ben.config.json` — configuração centralizada por projeto
- [ ] Modo `--dry-run` para validação e execução sem efeitos colaterais
- [ ] Logs estruturados (JSON) para integração com ferramentas de observabilidade
- [ ] Documentação de todas as ferramentas MCP com exemplos reais

---

## v1.2 — Expansão de IDEs e Integrações 🔌
*Horizonte: médio prazo*

- [ ] Suporte oficial a **JetBrains IDEs** (IntelliJ, PyCharm, WebStorm via plugin MCP)
- [ ] Suporte a **Zed Editor**
- [ ] Integração com **CommandBox** — execução direta de comandos CFML via CLI
- [ ] Bridge para **FusionReactor** — métricas de performance integradas ao agente
- [ ] Suporte a **ORM nativo ColdFusion** — geração e validação de entidades
- [ ] Integração com **GitHub Actions** — CI/CD com validação CFML automatizada

---

## v1.3 — Inteligência e Agente Avançado 🧠
*Horizonte: médio prazo*

- [ ] MoE Router v2 — aprendizado por feedback (qual expert acertou mais em cada tipo de tarefa)
- [ ] Memória de contexto por projeto — o agente aprende o padrão do seu codebase
- [ ] Geração automática de documentação CFML (CFC → Markdown/HTML)
- [ ] Detecção proativa de vulnerabilidades (SQL injection, XSS, CSRF) com sugestão de correção
- [ ] Refactoring assistido — migração de tags CFML para CFScript
- [ ] Suporte a **Ollama** com modelos especializados em código (CodeLlama, DeepSeek Coder)

---

## v2.0 — Plataforma e Ecossistema 🚀
*Horizonte: longo prazo — aberto a parceiros*

- [ ] **Marketplace de Experts MoE** — comunidade pode publicar e assinar experts especializados (ex: expert para e-commerce, expert para sistemas financeiros em CFML)
- [ ] **Cloud-hosted version** — B.E.N. como serviço, sem infraestrutura local
- [ ] **Multi-tenant Key Manager** — gestão de chaves para equipes e organizações
- [ ] **B.E.N. for Teams** — workspace compartilhado com histórico, auditoria e controle de acesso
- [ ] **SDK público** — permita que a comunidade construa tools MCP customizadas sobre B.E.N.
- [ ] **Painel web** — visualização de uso, custos, histórico de execuções e métricas por projeto

---

## O que buscamos

Para acelerar este roadmap, estamos abertos a conversas com:

**Integradores e parceiros técnicos**
Empresas que desenvolvem sobre CFML e querem integrar B.E.N. às suas stacks ou ofertas de serviço.

**Empresas com sistemas CFML legados**
Organizações que precisam de tooling moderno para manutenção, modernização ou expansão de sistemas existentes.

**Investidores em developer tools e infrastructure**
O mercado de ferramentas para linguagens estabelecidas e subestimadas é real e defensável. Temos tração, nicho definido e visão de longo prazo.

**Contribuidores da comunidade**
Desenvolvedores CFML que queiram colocar a mão na massa — código, testes, documentação ou casos de uso reais.

---

## Como acompanhar

- Issues abertas e progresso: [GitHub Projects](https://github.com/)
- Discussões e sugestões: [GitHub Discussions](https://github.com/)
- Contato direto para parcerias: veja [`MANIFESTO.md`](./MANIFESTO.md)

---

*Copyright © 2026 Paulo Marcelo Andrade Soares Martins. Distribuído sob Business Source License 1.1.*
