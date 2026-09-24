import { analyzeSession } from '../src/analysis.js';
const a = await analyzeSession('.buyer-arena-dev/sessions/smoke');
for (const s of a.summaries) console.log(s.variant, s.completion, s.median_steps, s.funnel.map((f) => `${f.stage}:${f.count}`).join(' '));
console.log(a.comparison?.label, a.comparison?.headline);
for (const r of a.comparison?.rows ?? []) console.log(r.metric.padEnd(28), r.baseline, r.candidate, r.delta, r.ci, r.verdict);
for (const [v, au] of Object.entries(a.audits)) {
  console.log('==', v, 'findings', au.findings.length, 'rejected', au.rejected.length);
  for (const c of au.consensus) console.log(c.id, c.topic, c.claim, c.severity, c.confidence, c.supporters.join('+'), c.challenges.length, '|', c.observed_fact);
}
for (const o of a.backlog) console.log('#' + o.rank, o.title, o.score, o.leverage, o.affected, o.status);
console.log(a.resolved);
