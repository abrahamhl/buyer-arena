import { z } from 'zod';

/* ────────────────────────────── Personas ────────────────────────────── */

export const Level = z.enum(['low', 'medium', 'high']);
export type Level = z.infer<typeof Level>;

export const DeviceSchema = z.object({
  kind: z.enum(['desktop', 'mobile', 'tablet']),
  viewport: z.object({ width: z.number().int().positive(), height: z.number().int().positive() }),
});
export type Device = z.infer<typeof DeviceSchema>;

export const PersonaSchema = z.object({
  persona_id: z.string().min(1),
  /** Synthetic display name. Never a real, identifiable person. */
  name: z.string().min(1),
  segment: z.string().min(1),
  archetype: z.string().min(1),
  age_band: z.enum(['18-24', '25-34', '35-44', '45-54', '55-64', '65+']),
  /** Monthly budget in `currency` units. */
  budget: z.number().nonnegative(),
  currency: z.string().default('EUR'),
  /** 0 = struggles with software, 1 = expert. */
  technical_literacy: z.number().min(0).max(1),
  purchase_urgency: Level,
  /** 0 = trusts easily, 1 = needs strong proof (guarantees, security, refunds). */
  trust_threshold: z.number().min(0).max(1),
  /** 0 = price-insensitive, 1 = price is the deciding factor. */
  price_sensitivity: z.number().min(0).max(1),
  device: DeviceSchema,
  language: z.string().default('en'),
  motivation: z.string(),
  goal: z.string(),
  objections: z.array(z.string()).default([]),
  prior_experience: z.array(z.string()).default([]),
  time_pressure: Level,
  accessibility_constraints: z.array(z.string()).default([]),
  custom_attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
});
export type Persona = z.infer<typeof PersonaSchema>;

export const PopulationSchema = z.object({
  version: z.literal(1).default(1),
  template: z.string(),
  seed: z.number().int(),
  size: z.number().int().positive(),
  generated_by: z.string().default('buyer-arena'),
  personas: z.array(PersonaSchema).min(1),
});
export type Population = z.infer<typeof PopulationSchema>;

/* ────────────────────────────── Stories ────────────────────────────── */

export const StorySchema = z.object({
  persona_id: z.string(),
  /** Machine-readable scenario context. */
  context: z.object({
    situation: z.string(),
    pain: z.string(),
    trigger: z.string(),
    constraints: z.array(z.string()),
    success_looks_like: z.string(),
  }),
  /** Human-readable narrative. */
  narrative: z.string(),
  /** Narrative per UI language (es, en, nl). */
  narratives: z.record(z.string(), z.string()).optional(),
});
export type Story = z.infer<typeof StorySchema>;

/* ────────────────────────────── Task ────────────────────────────── */

export const TaskSchema = z.object({
  id: z.string(),
  /** What the buyer is asked to do. Written from the buyer's perspective, never mentions variants. */
  instruction: z.string(),
  success: z.object({
    url_pattern: z.string().optional(),
    text_pattern: z.string().optional(),
  }),
  /** Optional overrides for funnel stage detection. */
  checkout_url_pattern: z.string().default('checkout|payment|billing/confirm'),
});
export type Task = z.infer<typeof TaskSchema>;

/**
 * Everything a buyer is allowed to know. Built by an allow-list (see stories/brief.ts);
 * variant labels, hypotheses and expected outcomes are structurally excluded.
 */
export interface BuyerBrief {
  persona: Pick<
    Persona,
    | 'persona_id'
    | 'name'
    | 'age_band'
    | 'budget'
    | 'currency'
    | 'technical_literacy'
    | 'purchase_urgency'
    | 'trust_threshold'
    | 'price_sensitivity'
    | 'device'
    | 'language'
    | 'motivation'
    | 'goal'
    | 'objections'
    | 'prior_experience'
    | 'time_pressure'
    | 'accessibility_constraints'
  >;
  story: string;
  task: string;
  start_url: string;
}

/* ────────────────────────────── Events ────────────────────────────── */

export const EventType = z.enum([
  'navigate',
  'observe',
  'decision',
  'click',
  'fill',
  'submit',
  'scroll',
  'back',
  'dismiss_modal',
  'form_error',
  'console_error',
  'page_error',
  'request_failed',
  'http_error',
  'milestone',
  'objection',
  'abandon',
  'goal_complete',
  'blocked_offsite',
  'provider_call',
  'provider_error',
  'timeout',
  'error',
]);
export type EventType = z.infer<typeof EventType>;

export const JourneyEventSchema = z.object({
  /** Globally unique evidence id: `<runId>:e<seq>`. */
  id: z.string(),
  seq: z.number().int().nonnegative(),
  step: z.number().int().nonnegative(),
  /** Milliseconds since journey start. */
  t: z.number().nonnegative(),
  type: EventType,
  url: z.string(),
  target: z.string().optional(),
  detail: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  screenshot: z.string().optional(),
});
export type JourneyEvent = z.infer<typeof JourneyEventSchema>;

export const Milestone = z.enum([
  'landed',
  'pricing_found',
  'cta_discovered',
  'signup_started',
  'checkout_started',
  'goal_completed',
]);
export type Milestone = z.infer<typeof Milestone>;
export const FUNNEL: Milestone[] = [
  'landed',
  'pricing_found',
  'cta_discovered',
  'signup_started',
  'checkout_started',
  'goal_completed',
];

export const RunStatus = z.enum([
  'completed',
  'abandoned',
  'step_limit',
  'timeout',
  'error',
  'budget_exhausted',
]);
export type RunStatus = z.infer<typeof RunStatus>;

export const UsageSchema = z.object({
  provider: z.string(),
  model: z.string(),
  calls: z.number().int().nonnegative(),
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
  cached_tokens: z.number().int().nonnegative(),
  latency_ms: z.number().nonnegative(),
  estimated_cost_usd: z.number().nonnegative(),
});
export type Usage = z.infer<typeof UsageSchema>;

export const RunRecordSchema = z.object({
  run_id: z.string(),
  session_id: z.string(),
  variant: z.string(),
  persona_id: z.string(),
  segment: z.string(),
  archetype: z.string(),
  policy: z.string(),
  status: RunStatus,
  goal_completed: z.boolean(),
  abandon_reason: z.string().optional(),
  /** Translatable form of abandon_reason. */
  abandon_i18n: z
    .object({ k: z.string(), p: z.record(z.string(), z.union([z.string(), z.number()])).optional() })
    .optional(),
  objection: z.string().optional(),
  steps: z.number().int().nonnegative(),
  elapsed_ms: z.number().nonnegative(),
  started_at: z.string(),
  final_url: z.string(),
  url_history: z.array(z.string()),
  milestones: z.record(z.string(), z.number()),
  events: z.array(JourneyEventSchema),
  trace_path: z.string().optional(),
  /** Light accessibility signals, one entry per distinct page visited. */
  page_checks: z
    .array(
      z.object({
        url: z.string(),
        lang: z.string(),
        load_ms: z.number().nullable(),
        unlabeled_inputs: z.number(),
        images_without_alt: z.number(),
        unnamed_controls: z.number(),
        small_targets: z.number(),
        low_contrast: z.number(),
        interactive: z.number(),
        samples: z.array(z.object({ kind: z.string(), text: z.string() })),
      }),
    )
    .optional(),
  /** Privacy evidence: cookies set and third-party hosts the pages tried to call (never loaded). */
  privacy: z
    .object({
      cookies: z.number(),
      cookie_names: z.array(z.string()),
      insecure_cookies: z.number(),
      third_party_hosts: z.array(z.string()),
    })
    .optional(),
  network: z.string().optional(),
  usage: UsageSchema.optional(),
});
export type RunRecord = z.infer<typeof RunRecordSchema>;

/* ────────────────────────────── Findings ────────────────────────────── */

export const Severity = z.enum(['low', 'medium', 'high', 'critical']);
export type Severity = z.infer<typeof Severity>;
export const Confidence = z.enum(['low', 'medium', 'high']);
export type Confidence = z.infer<typeof Confidence>;
export const Claim = z.enum(['observed_fact', 'inference', 'hypothesis']);
export type Claim = z.infer<typeof Claim>;

export const AuditorFindingSchema = z.object({
  finding: z.string().min(1),
  topic: z.string().min(1),
  evidence_ids: z.array(z.string()).min(1),
  affected_segments: z.array(z.string()),
  severity: Severity,
  confidence: Confidence,
  claim: Claim.default('inference'),
  proposed_experiment: z.string(),
  /** Set by deterministic auditors when the finding text is computed from aggregates. Never trusted from LLM output. */
  computed: z.boolean().optional(),
  /** Structured parameters so the UI can render the finding in any language. */
  params: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});
export type AuditorFinding = z.infer<typeof AuditorFindingSchema>;

export const AuditorOutputSchema = z.object({ findings: z.array(AuditorFindingSchema) });
