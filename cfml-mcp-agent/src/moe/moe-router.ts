/**
 * MoE (Mixture of Experts) Router
 * Routes tasks to the best-suited LLM expert based on:
 * - Task type classification
 * - Expert capability scores
 * - Cost optimization
 * - Latency requirements
 */

export type TaskType =
  | "cfml_validate"
  | "cfml_generate"
  | "cfml_explain"
  | "cfml_debug"
  | "cfml_optimize"
  | "cfml_test_generate"
  | "cfml_security_review"
  | "ui_design"
  | "general";

export interface Expert {
  id: string;
  name: string;
  provider: "openai" | "anthropic" | "gemini" | "groq" | "ollama" | "mistral";
  model: string;
  capabilities: Partial<Record<TaskType, number>>; // 0-1 score
  avgLatencyMs: number;
  costPerMToken: number;
  contextWindow: number;
  supportsTools: boolean;
  maxConcurrent: number;
}

export interface RoutingDecision {
  expert: Expert;
  reason: string;
  confidence: number;
  alternatives: { expert: Expert; score: number }[];
}

// ─────────────────────────────────────────────
// Task Classifier
// ─────────────────────────────────────────────
export function classifyTask(prompt: string, context?: string): TaskType {
  const text = (prompt + " " + (context || "")).toLowerCase();

  if (/valida|syntax error|parse error|check.*code/.test(text)) return "cfml_validate";
  if (/secur|vuln|xss|sqli|injection|csrf|owasp/.test(text)) return "cfml_security_review";
  if (/bug|erro|debug|not work|exception|stacktrace/.test(text)) return "cfml_debug";
  if (/optimi|perform|slow|speed|cache|index/.test(text)) return "cfml_optimize";
  if (/test|testbox|spec|bdd|unit test|mock/.test(text)) return "cfml_test_generate";
  if (/design|figma|ui|layout|component|css|html/.test(text)) return "ui_design";
  if (/explain|what is|how does|document|comment/.test(text)) return "cfml_explain";
  if (/generat|create|write|build|make.*cfml|make.*cfc/.test(text)) return "cfml_generate";

  return "general";
}

// ─────────────────────────────────────────────
// Default Expert Registry
// ─────────────────────────────────────────────
export const DEFAULT_EXPERTS: Expert[] = [
  {
    id: "claude-sonnet",
    name: "Claude Sonnet 3.5",
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    capabilities: {
      cfml_validate: 0.90,
      cfml_generate: 0.95,
      cfml_explain: 0.97,
      cfml_debug: 0.93,
      cfml_optimize: 0.91,
      cfml_test_generate: 0.92,
      cfml_security_review: 0.95,
      ui_design: 0.85,
      general: 0.95,
    },
    avgLatencyMs: 1200,
    costPerMToken: 3.0,
    contextWindow: 200_000,
    supportsTools: true,
    maxConcurrent: 10,
  },
  {
    id: "gpt4o",
    name: "GPT-4o",
    provider: "openai",
    model: "gpt-4o",
    capabilities: {
      cfml_validate: 0.85,
      cfml_generate: 0.90,
      cfml_explain: 0.92,
      cfml_debug: 0.88,
      cfml_optimize: 0.87,
      cfml_test_generate: 0.85,
      cfml_security_review: 0.88,
      ui_design: 0.90,
      general: 0.92,
    },
    avgLatencyMs: 1500,
    costPerMToken: 5.0,
    contextWindow: 128_000,
    supportsTools: true,
    maxConcurrent: 8,
  },
  {
    id: "gemini-flash",
    name: "Gemini 1.5 Flash",
    provider: "gemini",
    model: "gemini-1.5-flash",
    capabilities: {
      cfml_validate: 0.75,
      cfml_generate: 0.80,
      cfml_explain: 0.82,
      cfml_debug: 0.75,
      cfml_optimize: 0.78,
      cfml_test_generate: 0.75,
      cfml_security_review: 0.72,
      ui_design: 0.78,
      general: 0.80,
    },
    avgLatencyMs: 600,
    costPerMToken: 0.075,
    contextWindow: 1_000_000,
    supportsTools: true,
    maxConcurrent: 20,
  },
  {
    id: "groq-llama",
    name: "Llama 3.1 70B (Groq)",
    provider: "groq",
    model: "llama-3.1-70b-versatile",
    capabilities: {
      cfml_validate: 0.70,
      cfml_generate: 0.72,
      cfml_explain: 0.78,
      cfml_debug: 0.70,
      cfml_optimize: 0.68,
      cfml_test_generate: 0.68,
      cfml_security_review: 0.65,
      ui_design: 0.65,
      general: 0.75,
    },
    avgLatencyMs: 150,   // Groq is very fast
    costPerMToken: 0.59,
    contextWindow: 131_072,
    supportsTools: true,
    maxConcurrent: 15,
  },
  {
    id: "mistral-large",
    name: "Mistral Large",
    provider: "mistral",
    model: "mistral-large-latest",
    capabilities: {
      cfml_validate: 0.80,
      cfml_generate: 0.82,
      cfml_explain: 0.85,
      cfml_debug: 0.80,
      cfml_optimize: 0.78,
      cfml_test_generate: 0.78,
      cfml_security_review: 0.80,
      ui_design: 0.75,
      general: 0.82,
    },
    avgLatencyMs: 900,
    costPerMToken: 2.0,
    contextWindow: 131_000,
    supportsTools: true,
    maxConcurrent: 10,
  },
];

// ─────────────────────────────────────────────
// MoE Router
// ─────────────────────────────────────────────
export class MoERouter {
  private experts: Expert[];
  private activeExperts: Map<string, number> = new Map(); // id → concurrent count

  constructor(experts: Expert[] = DEFAULT_EXPERTS) {
    this.experts = experts;
    for (const e of experts) this.activeExperts.set(e.id, 0);
  }

  route(
    taskType: TaskType,
    options: {
      preferLowCost?: boolean;
      preferLowLatency?: boolean;
      requiresTools?: boolean;
      minContextWindow?: number;
      excludeProviders?: string[];
      budgetPerMToken?: number;
    } = {}
  ): RoutingDecision {
    const {
      preferLowCost = false,
      preferLowLatency = false,
      requiresTools = false,
      minContextWindow = 0,
      excludeProviders = [],
      budgetPerMToken = Infinity,
    } = options;

    const eligible = this.experts.filter((e) => {
      if (excludeProviders.includes(e.provider)) return false;
      if (requiresTools && !e.supportsTools) return false;
      if (e.contextWindow < minContextWindow) return false;
      if (e.costPerMToken > budgetPerMToken) return false;
      const active = this.activeExperts.get(e.id) || 0;
      if (active >= e.maxConcurrent) return false;
      return true;
    });

    if (!eligible.length) {
      // Fallback to all experts
      return this.route(taskType, { ...options, excludeProviders: [] });
    }

    // Score each expert
    const scored = eligible.map((e) => {
      const capability = e.capabilities[taskType] || e.capabilities.general || 0.5;
      
      // Normalize factors
      const maxLatency = Math.max(...eligible.map((x) => x.avgLatencyMs));
      const maxCost = Math.max(...eligible.map((x) => x.costPerMToken));
      const latencyScore = 1 - e.avgLatencyMs / maxLatency;
      const costScore = 1 - e.costPerMToken / (maxCost || 1);

      // Weighted composite score
      let score = capability * 0.6;
      if (preferLowLatency) score += latencyScore * 0.3 + costScore * 0.1;
      else if (preferLowCost) score += costScore * 0.3 + latencyScore * 0.1;
      else score += latencyScore * 0.2 + costScore * 0.2;

      return { expert: e, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    return {
      expert: best.expert,
      confidence: best.score,
      reason: this.buildReason(best.expert, taskType, preferLowCost, preferLowLatency),
      alternatives: scored.slice(1, 3),
    };
  }

  incrementActive(expertId: string) {
    this.activeExperts.set(expertId, (this.activeExperts.get(expertId) || 0) + 1);
  }

  decrementActive(expertId: string) {
    this.activeExperts.set(expertId, Math.max(0, (this.activeExperts.get(expertId) || 0) - 1));
  }

  private buildReason(expert: Expert, task: TaskType, lowCost: boolean, lowLatency: boolean): string {
    const cap = (expert.capabilities[task] || 0) * 100;
    const reasons = [`${expert.name} (${cap.toFixed(0)}% task capability)`];
    if (lowCost) reasons.push(`low cost ($${expert.costPerMToken}/Mtoken)`);
    if (lowLatency) reasons.push(`fast response (~${expert.avgLatencyMs}ms)`);
    return reasons.join(", ");
  }
}
