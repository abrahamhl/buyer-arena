import { existsSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { ensureDir, writeFileAtomic } from '../core/fs.js';
import { EvidenceEnvelopeV1Schema, type EvidenceEnvelopeV1 } from './envelope.js';

/**
 * Evidence is stored as JSON Lines (`evidence.jsonl`): one validated envelope per line.
 * Appends are idempotent by envelope id, so re-importing the same tool output never
 * duplicates evidence.
 */
export function readEvidence(file: string): EvidenceEnvelopeV1[] {
  if (!existsSync(file)) return [];
  const out: EvidenceEnvelopeV1[] = [];
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const r = EvidenceEnvelopeV1Schema.safeParse(JSON.parse(line));
    if (r.success) out.push(r.data);
  }
  return out;
}

export function writeEvidence(file: string, add: EvidenceEnvelopeV1[]): { added: number; total: number } {
  const current = readEvidence(file);
  const seen = new Set(current.map((e) => e.id));
  const fresh = add.filter((e) => !seen.has(e.id) && (seen.add(e.id), true));
  const all = [...current, ...fresh];
  ensureDir(dirname(file));
  writeFileAtomic(file, all.map((e) => JSON.stringify(e)).join('\n') + (all.length ? '\n' : ''));
  return { added: fresh.length, total: all.length };
}
