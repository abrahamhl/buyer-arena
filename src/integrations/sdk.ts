import { readFileSync, statSync } from 'node:fs';
import type { EvidenceEnvelopeV1 } from '../evidence/envelope.js';
import { findExecutable, probeVersion } from './exec.js';

/**
 * Integration SDK.
 *
 * External tools produce observations; an integration turns them into EvidenceEnvelopeV1.
 * No integration is a runtime dependency of Buyer Arena: tools are detected on PATH
 * (native), talked to over a process boundary (sidecar), read from their own output files
 * (import) or received as OpenTelemetry traces (otel).
 */
export type IntegrationMode = 'native' | 'sidecar' | 'import' | 'otel';
export type IntegrationStatus = 'builtin' | 'supported' | 'adapter' | 'experimental' | 'planned';
export type ExecutionRisk = 'none' | 'low' | 'medium' | 'high';
export type Capability =
  | 'llm-eval'
  | 'red-team'
  | 'secrets'
  | 'dependencies'
  | 'sbom'
  | 'misconfig'
  | 'license'
  | 'browser-engine'
  | 'dast'
  | 'model-gateway'
  | 'coding-agent'
  | 'traces'
  | 'benchmark';

export interface IntegrationManifest {
  id: string;
  name: string;
  /** Version of THIS adapter (bumped when its normalisation changes). */
  version: string;
  status: IntegrationStatus;
  modes: IntegrationMode[];
  capabilities: Capability[];
  /** Safe to use with network policy OFFLINE (import is always offline). */
  offline_safe: boolean;
  /** The tool itself needs network to do its job (e.g. calls an LLM, downloads a DB). */
  network_required: boolean;
  /** What running the tool can do to the machine/targets. Import-only adapters are 'none'. */
  execution_risk: ExecutionRisk;
  upstream: { url: string; license: string; method: string };
  /** Candidate executable names for detection. */
  executables?: string[];
  /** Human description of accepted import files. */
  import_formats?: string[];
  notes?: string;
}

export interface DetectResult {
  installed: boolean;
  path?: string;
  version: string | null;
  note?: string;
}

export interface DoctorCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface NormalizeContext {
  target?: { repo?: string; commit?: string; url?: string; model?: string; agent?: string; run?: string };
  tool_version?: string | null;
  config_digest?: string | null;
  /** Was the raw output produced without network access? (import: unknown → false by default) */
  offline?: boolean;
  network_accessed?: boolean;
  /** Where the raw artifact lives (kept as artifact_refs, never inlined). */
  artifact?: string;
  timestamp?: string;
}

export interface RunContext extends NormalizeContext {
  repo?: string;
  url?: string;
  outDir: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface RunOutput {
  evidence: EvidenceEnvelopeV1[];
  raw_path?: string;
  duration_ms: number;
  exit_code: number | null;
  tool_version: string | null;
}

export interface Integration {
  manifest: IntegrationManifest;
  detect(): Promise<DetectResult>;
  doctor?(): Promise<DoctorCheck[]>;
  /** Optional: execute the tool. Must respect the network policy and never use a shell. */
  run?(ctx: RunContext): Promise<RunOutput>;
  /** Parse the tool's own output format (text of the file) into evidence. */
  normalize(text: string, ctx: NormalizeContext): EvidenceEnvelopeV1[];
}

export class AdapterInputError extends Error {
  constructor(adapter: string, message: string) {
    super(`${adapter}: ${message}`);
    this.name = 'AdapterInputError';
  }
}

/** Detection shared by adapters: find on PATH, ask for the version, never touch the network. */
export async function detectOnPath(
  names: string[],
  versionArgs: string[] = ['--version'],
): Promise<DetectResult> {
  const path = findExecutable(names);
  if (!path) return { installed: false, version: null, note: `not on PATH (${names.join(', ')})` };
  return { installed: true, path, version: await probeVersion(path, versionArgs) };
}

export const importOnly = async (): Promise<DetectResult> => ({
  installed: false,
  version: null,
  note: 'import-only: reads files the tool already wrote',
});

/** Read an import file with a size cap (adapters parse untrusted input). */
export function readImportFile(file: string, maxBytes = 256 * 1024 * 1024): string {
  const size = statSync(file).size;
  if (size > maxBytes) throw new Error(`${file} is ${size} bytes; import limit is ${maxBytes}`);
  return readFileSync(file, 'utf8');
}

/** Parse JSON or JSON Lines. Invalid lines are counted, not fatal (partial tool output). */
export function parseJsonOrLines(adapter: string, text: string): { records: unknown[]; bad: number } {
  const t = text.trim();
  if (!t) return { records: [], bad: 0 };
  if (t.startsWith('[') || (t.startsWith('{') && !t.includes('}\n{'))) {
    try {
      const v = JSON.parse(t) as unknown;
      return { records: Array.isArray(v) ? v : [v], bad: 0 };
    } catch {
      /* fall through to JSONL */
    }
  }
  const records: unknown[] = [];
  let bad = 0;
  for (const line of t.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line));
    } catch {
      bad++;
    }
  }
  if (!records.length) throw new AdapterInputError(adapter, 'input is neither JSON nor JSON Lines');
  return { records, bad };
}

export const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
export const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
export const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;
