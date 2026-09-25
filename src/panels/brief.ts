import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { readStructured } from '../core/fs.js';
import { Repo } from './repo.js';
import type { Evidence } from './types.js';

/**
 * "Promised vs built": a brief is a list of commitments, each with automatic probes.
 * An item is DONE when every probe finds evidence, PARTIAL when some do, MISSING otherwise.
 */
const Probe = z.union([
  z.object({ file: z.string() }),
  z.object({ script: z.string() }),
  z.object({ grep: z.string(), in: z.string().optional() }),
]);
const Item = z.object({
  id: z.string(),
  area: z.string(),
  text: z.object({ es: z.string(), en: z.string(), nl: z.string() }),
  probes: z.array(Probe).min(1),
});
export const BriefSchema = z.object({
  title: z.string(),
  source: z.string().optional(),
  items: z.array(Item),
});

export interface BriefItemResult {
  id: string;
  area: string;
  text: { es: string; en: string; nl: string };
  status: 'done' | 'partial' | 'missing';
  evidence: Evidence[];
}
export interface BriefResult {
  title: string;
  coverage: number;
  items: BriefItemResult[];
}

export function evaluateBrief(repoDir: string, file?: string): BriefResult | undefined {
  const path = file ?? join(repoDir, 'docs', 'project', 'brief.yaml');
  if (!existsSync(path)) return undefined;
  const brief = BriefSchema.parse(readStructured(path));
  const repo = new Repo(repoDir);
  const scripts = repo.json<{ scripts?: Record<string, string> }>('package.json')?.scripts ?? {};
  const items = brief.items.map((it) => {
    const evidence: Evidence[] = [];
    let hits = 0;
    for (const p of it.probes) {
      if ('file' in p) {
        const re = new RegExp(p.file);
        const f = repo.files.find((x) => re.test(x));
        if (f) {
          hits++;
          evidence.push({ kind: 'file', ref: f });
        }
      } else if ('script' in p) {
        if (scripts[p.script]) {
          hits++;
          evidence.push({
            kind: 'file',
            ref: 'package.json',
            excerpt: `"${p.script}": "${scripts[p.script]}"`,
          });
        }
      } else {
        const files = p.in ? repo.files.filter((x) => new RegExp(p.in as string).test(x)) : repo.textFiles();
        const e = repo.grep(new RegExp(p.grep, 'i'), files, 1);
        if (e.length) {
          hits++;
          evidence.push(e[0] as Evidence);
        }
      }
    }
    const status: BriefItemResult['status'] =
      hits === it.probes.length ? 'done' : hits ? 'partial' : 'missing';
    return { id: it.id, area: it.area, text: it.text, status, evidence };
  });
  const score = items.reduce((s, i) => s + (i.status === 'done' ? 1 : i.status === 'partial' ? 0.5 : 0), 0);
  return { title: brief.title, coverage: items.length ? Math.round((score / items.length) * 100) : 0, items };
}
