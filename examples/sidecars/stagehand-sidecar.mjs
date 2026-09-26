#!/usr/bin/env node
/* global document -- page.evaluate() callbacks run in the browser */
// Buyer Arena reference sidecar for Stagehand v4 (https://github.com/browserbase/stagehand, MIT).
//
// STATUS: experimental reference. The option names are verified against @browserbasehq/stagehand
// 4.1.0's exported zod schemas (LocalBrowserLaunchOptions, StagehandCreateOptions) and the v4
// migration guide; it has NOT been executed end to end in Buyer Arena CI (it needs a model key).
//
// Contract (src/engines/external.ts): JSON request on stdin, one JSON result on stdout.
//   npm i @browserbasehq/stagehand@4 zod@4        # Node >= 22.18
//   STAGEHAND_MODEL=openai/gpt-4.1-mini OPENAI_API_KEY=… \
//   buyer-arena run --url http://localhost:3000 --success-url "/welcome" \
//     --engine-cmd "node examples/sidecars/stagehand-sidecar.mjs"
//
// Safety:
//   - Local browser only (localBrowser.launch); never a Browserbase browser, so no page content
//     goes to Browserbase. `model` always carries an explicit apiKey (otherwise v4 routes to the
//     Browserbase Model Gateway), and telemetry is off.
//   - Navigation outside the start origin is detected after every step and stops the journey.
//   - Success comes from the task's success patterns, never from the model's own claim.
import { readFileSync } from 'node:fs';

const req = JSON.parse(readFileSync(0, 'utf8'));
const startUrl = req.brief.start_url;
const origin = new URL(startUrl).origin;
const events = [{ type: 'navigate', url: startUrl, step: 0, t: 0 }];
const started = Date.now();
const out = (o) => process.stdout.write(JSON.stringify(o));

const modelName = process.env.STAGEHAND_MODEL ?? 'openai/gpt-4.1-mini';
const provider = modelName.split('/')[0];
const apiKey = process.env[`${provider.toUpperCase()}_API_KEY`];
if (!apiKey) {
  out({
    status: 'error',
    final_url: startUrl,
    abandon_reason: `set ${provider.toUpperCase()}_API_KEY (Stagehand needs an explicit model key)`,
    events,
  });
  process.exit(0);
}

let sh;
try {
  sh = await import('@browserbasehq/stagehand');
} catch {
  out({
    status: 'error',
    final_url: startUrl,
    abandon_reason: 'npm i @browserbasehq/stagehand@4 zod@4',
    events,
  });
  process.exit(0);
}

const success = req.task?.success ?? {};
const matches = async (page) => {
  if (success.url_pattern && new RegExp(success.url_pattern, 'i').test(page.url())) return true;
  if (success.text_pattern) {
    const text = await page.evaluate(() => document.body?.innerText ?? '').catch(() => '');
    return new RegExp(success.text_pattern, 'i').test(text);
  }
  return false;
};

const deadline = started + (req.timeout_ms ?? 60_000);
const browser = await sh.localBrowser.launch({
  headless: true,
  executablePath: process.env.BUYER_ARENA_CHROMIUM_PATH || undefined,
  chromiumSandbox: process.env.BA_SH_NO_SANDBOX !== '1',
});
let status = 'step_limit';
let reason;
try {
  const stagehand = await sh.Stagehand.create({ browser, model: { modelName, apiKey }, telemetry: false });
  const [page] = await browser.context.pages();
  await page.goto(startUrl);
  const persona = JSON.stringify(req.brief.persona ?? {});
  for (let step = 1; step <= (req.max_steps ?? 14); step++) {
    if (Date.now() > deadline) {
      status = 'timeout';
      break;
    }
    if (await matches(page)) {
      status = 'completed';
      break;
    }
    const instruction = `You are this prospective customer: ${persona}. ${req.brief.story ?? ''} Goal: ${req.brief.task}. Take ONE next step on this page, using only synthetic data (email buyer@buyers.example.test).`;
    const { data } = await stagehand.act(instruction);
    events.push({
      type: 'decision',
      url: page.url(),
      step,
      detail: String(data?.message ?? '').slice(0, 300),
    });
    for (const a of data?.actions ?? []) {
      const kind = /fill|type/i.test(a.method ?? '')
        ? 'fill'
        : /scroll/i.test(a.method ?? '')
          ? 'scroll'
          : 'click';
      events.push({ type: kind, url: page.url(), step, target: String(a.description ?? '').slice(0, 120) });
    }
    const now = page.url();
    if (new URL(now).origin !== origin) {
      events.push({ type: 'blocked_offsite', url: now, step, detail: `left ${origin}` });
      status = 'abandoned';
      reason = 'navigated off the target origin';
      break;
    }
    if (now !== events.filter((e) => e.type === 'navigate').at(-1)?.url)
      events.push({ type: 'navigate', url: now, step });
    if (data?.success === false) {
      status = 'abandoned';
      reason = String(data?.message ?? 'the model could not act').slice(0, 300);
      break;
    }
  }
  await stagehand.close();
  out({ status, final_url: page.url(), abandon_reason: status === 'completed' ? undefined : reason, events });
} catch (err) {
  out({
    status: 'error',
    final_url: startUrl,
    abandon_reason: String(err?.message ?? err).slice(0, 300),
    events,
  });
} finally {
  await browser.close().catch(() => {});
}
