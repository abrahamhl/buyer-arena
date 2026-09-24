// Dev helper: run a full demo session and print a one-line summary per run.
import { startDemoStore } from '../src/demo-store/server.js';
import { generatePopulation } from '../src/personas/generate.js';
import { runSession } from '../src/simulator/session.js';

const [b, c] = await Promise.all([startDemoStore('baseline'), startDemoStore('candidate')]);
const pop = generatePopulation({ template: 'saas', size: Number(process.argv[2] ?? 20), seed: 42 });
const t0 = Date.now();
const res = await runSession({
  root: '.buyer-arena-dev',
  sessionId: 'smoke',
  population: pop,
  task: { id: 'start-trial', instruction: 'x', success: { text_pattern: 'trial is active' }, checkout_url_pattern: 'checkout' },
  variants: [{ name: 'baseline', url: b.url }, { name: 'candidate', url: c.url }],
  trace: 'off',
  screenshots: false,
});
for (const r of res.runs) console.log(r.variant.padEnd(10), r.persona_id, r.archetype.padEnd(15), r.status.padEnd(10), String(r.steps).padStart(2), Object.keys(r.milestones).join(','), '|', r.abandon_reason ?? '');
console.log('elapsed', Date.now() - t0, 'ms');
await b.close(); await c.close();
