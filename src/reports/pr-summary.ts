import type { AgentEvalReport } from '../agent/eval.js';
import type { Analysis } from '../analysis.js';
import { summarizeEvidence, type EvidenceEnvelopeV1 } from '../evidence/envelope.js';
import { economyReport } from '../models/economy.js';
import { describeLedger } from '../policy/network.js';
import { fmtDelta, fmtValue } from './format.js';

/**
 * Compact pull-request comment: a handful of lines, never a wall of text. Everything links
 * back to the full report. No secrets, no raw tool output, no prompts.
 */
export function renderPrSummary(o: {
  analysis?: Analysis;
  agentEval?: AgentEvalReport;
  evidence?: EvidenceEnvelopeV1[];
  baselineEvidence?: EvidenceEnvelopeV1[];
  reportUrl?: string;
  calibrationState?: string;
}): string {
  const L: string[] = ['### ▲ Buyer Arena'];
  const a = o.analysis;
  const cmp = a?.comparison;
  if (cmp) {
    const row = cmp.rows.find((r) => r.key === 'completion');
    if (row) {
      const ci = row.ci ? ` (95% ${fmtDelta(row.ci[0], row.unit)} … ${fmtDelta(row.ci[1], row.unit)})` : '';
      L.push(
        `**Synthetic goal completion** ${fmtValue(row.baseline, row.unit)} → ${fmtValue(row.candidate, row.unit)} · **${fmtDelta(row.delta, row.unit)}**${ci} · ${cmp.label} · n=${cmp.n_pairs}`,
      );
    }
    const added = cmp.friction.filter((f) => f.status === 'new').slice(0, 3);
    const fixed = cmp.friction.filter((f) => f.status === 'resolved').slice(0, 3);
    if (added.length)
      L.push(`🔴 **Regressions:** ${added.map((f) => `${f.title} (${f.candidate_affected})`).join(' · ')}`);
    if (fixed.length) L.push(`🟢 **Resolved friction:** ${fixed.map((f) => f.title).join(' · ')}`);
  }
  if (o.evidence) {
    const now = summarizeEvidence(o.evidence.filter((e) => e.categories.includes('security')));
    const before = o.baselineEvidence
      ? summarizeEvidence(o.baselineEvidence.filter((e) => e.categories.includes('security')))
      : undefined;
    const d = (k: 'critical' | 'high') =>
      before
        ? ` (${now.by_severity[k] - before.by_severity[k] >= 0 ? '+' : ''}${now.by_severity[k] - before.by_severity[k]})`
        : '';
    L.push(
      `🛡 **Security:** critical ${now.by_severity.critical}${d('critical')} · high ${now.by_severity.high}${d('high')}`,
    );
  }
  const ae = o.agentEval;
  if (ae) {
    const st = (s: string) => ae.graph.stages.find((x) => x.stage === s)?.status ?? 'N/A';
    L.push(
      `🧪 **Build** ${st('build')} · **Tests** ${st('test')} · **Code** ${st('code')} · output quality **${ae.quality.score}/100**${ae.graph.gates ? ` · gates **${ae.graph.gates.passed ? 'PASS' : 'FAIL'}**` : ''}`,
    );
  }
  const econ = a ? economyReport(a) : undefined;
  const tail: string[] = [];
  if (econ)
    tail.push(
      econ.deterministic_only ? 'cost $0 (deterministic)' : `model cost $${econ.model_cost_usd.toFixed(4)}`,
    );
  if (a?.session.network) tail.push(describeLedger(a.session.network));
  tail.push(`calibration: ${o.calibrationState ?? 'UNCALIBRATED'}`);
  L.push(`<sub>${tail.join(' · ')}${o.reportUrl ? ` · [full report](${o.reportUrl})` : ''}</sub>`);
  L.push('<sub>Synthetic buyers measure a conversion proxy on this change, not predicted revenue.</sub>');
  return L.join('\n');
}
