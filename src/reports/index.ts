import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Analysis } from '../analysis.js';
import { readJson, writeFileAtomic } from '../core/fs.js';
import type { Population } from '../core/types.js';
import { analysisToEvidence } from '../evidence/builtin.js';
import { writeEvidence } from '../evidence/store.js';
import { loadRuns } from '../simulator/session.js';
import { renderBacklog } from './backlog-md.js';
import { journeyViews, renderReport } from './html.js';

export interface ReportPaths {
  html: string;
  backlog: string;
}

export function writeReports(sessionDir: string, analysis: Analysis): ReportPaths {
  const runs = loadRuns(sessionDir);
  const popFile = join(sessionDir, 'population.json');
  const personas = existsSync(popFile) ? readJson<Population>(popFile).personas : [];
  const html = join(sessionDir, 'report.html');
  const backlog = join(sessionDir, 'ROI_BACKLOG.md');
  writeFileAtomic(html, renderReport(analysis, journeyViews(sessionDir, runs, personas)));
  writeFileAtomic(backlog, renderBacklog(analysis));
  // Portable evidence (Evidence Protocol v1) next to the human report.
  writeEvidence(join(sessionDir, 'evidence.jsonl'), analysisToEvidence(analysis));
  return { html, backlog };
}

export { renderBacklog, renderReport };
