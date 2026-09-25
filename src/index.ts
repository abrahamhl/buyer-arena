/** Buyer Arena public API. */
export * from './core/types.js';
export { Rng, hashSeed } from './core/rng.js';
export {
  generatePopulation,
  loadPopulation,
  savePopulation,
  allocateArchetypes,
} from './personas/generate.js';
export { TEMPLATES, ARCHETYPES } from './personas/templates.js';
export { buildStory, buildBrief, assertNoLeak } from './stories/story.js';
export {
  runSession,
  loadRuns,
  loadManifest,
  type SessionOptions,
  type SessionManifest,
  type Variant,
} from './simulator/session.js';
export { runJourney } from './simulator/journey.js';
export { HeuristicBuyer } from './simulator/heuristic.js';
export { LlmBuyer } from './simulator/llm-policy.js';
export type { BuyerPolicy, Action, DecideContext } from './simulator/policy.js';
export { analyzeRuns, analyzeSession, type Analysis } from './analysis.js';
export { computeRunMetrics, summarizeVariant } from './metrics/run-metrics.js';
export { detectFriction, clusterFriction, DETECTORS } from './metrics/friction.js';
export { wilson, pairedBootstrap, signalLabel } from './metrics/stats.js';
export { compareVariants } from './comparison/compare.js';
export { DEFAULT_AUDITORS } from './auditors/rules.js';
export { buildConsensus } from './auditors/consensus.js';
export { prioritize, ROI_FORMULA } from './roi/roi.js';
export { calibrate, calibrationError } from './calibration/calibration.js';
export { writeReports } from './reports/index.js';
export { createProvider, detectProviders, MockProvider, CostMeter } from './providers/index.js';
export { startDemoStore } from './demo-store/server.js';
export { runPipeline, runDemo, resumeSession } from './workflow.js';
export { createMcpServer } from './mcp/server.js';

/* Evaluation control plane (v0.2). */
export {
  classifyHost,
  currentLedger,
  NetworkLedger,
  NetworkPolicyError,
  resolvePolicy,
  withNetworkScope,
  type NetworkLedgerV1,
  type NetworkMode,
  type NetworkPolicy,
} from './policy/network.js';
export {
  EvidenceEnvelopeV1Schema,
  makeEvidence,
  summarizeEvidence,
  type EvidenceEnvelopeV1,
} from './evidence/envelope.js';
export { readEvidence, writeEvidence } from './evidence/store.js';
export { INTEGRATIONS, getIntegration, listIntegrations } from './integrations/registry.js';
export type { Integration, IntegrationManifest } from './integrations/sdk.js';
export { loadCatalog, describeSpec, type Catalog, type ModelInfo } from './models/catalog.js';
export {
  route,
  runCascade,
  type ModelRequestProfile,
  type RoutingDecision,
  type RoutingPolicy,
} from './models/router.js';
export { ResponseCache } from './models/cache.js';
export { economyReport, type EconomyReport } from './models/economy.js';
export { AgentRunEnvelopeSchema, type AgentRunEnvelope } from './agent/envelope.js';
export { runAgentEval, compareAgentEvals, type AgentEvalReport } from './agent/eval.js';
export { buildGraph, evaluateGates, ReleaseGatesSchema, type LifecycleGraph } from './lifecycle/graph.js';
export { assessCalibration, type CalibrationState } from './calibration/metrics.js';
export { compareEnsemble } from './ensemble/disagreement.js';
export { launchChromium } from './core/browser.js';
