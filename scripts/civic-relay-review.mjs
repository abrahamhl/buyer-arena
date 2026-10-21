#!/usr/bin/env node
/* global document, innerWidth */
/**
 * Buyer Arena / Civic Relay consented public-demo browser exercise.
 * REAL Chromium actions performed by AUTOMATED ROLE SCENARIOS, NOT humans.
 * This file does not manufacture endorsements, rescue measurements or interviews.
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DEFAULT_URL = 'https://civic-relay-investor.vercel.app';
const origin = new URL(process.env.CIVIC_RELAY_URL || DEFAULT_URL);
if (origin.protocol !== 'https:' || !origin.hostname.endsWith('.vercel.app')) {
  throw new Error('Refusing target: explicit HTTPS Vercel demo required');
}
const output = resolve(process.env.CIVIC_AUDIT_ROOT || '.buyer-arena/civic-relay-audit');
mkdirSync(join(output, 'actors'), { recursive: true });
mkdirSync(join(output, 'screenshots'), { recursive: true });
const commit = process.env.CIVIC_RELAY_COMMIT || 'c18c6ac936c8b3c6560997b113e46b50cab51302';
const cases = [
  { id: '01-resident-es', role: 'Affected resident', lang: 'es', width: 390, mode: 'story' },
  { id: '02-responder-en', role: 'Civil protection responder', lang: 'en', width: 1440, mode: 'responder' },
  { id: '03-investor-en', role: 'Research grant evaluator', lang: 'en', width: 1280, mode: 'investor' },
  {
    id: '04-engineer-en',
    role: 'Offline routing software engineer',
    lang: 'en',
    width: 1440,
    mode: 'engineer',
  },
  { id: '05-privacy-nl', role: 'Dutch privacy reviewer', lang: 'nl', width: 390, mode: 'privacy' },
  { id: '06-volunteer-es', role: 'Field volunteer', lang: 'es', width: 768, mode: 'lab' },
  {
    id: '07-accessibility-en',
    role: 'Keyboard and reduced-motion evaluator',
    lang: 'en',
    width: 360,
    mode: 'accessibility',
  },
  { id: '08-partner-nl', role: 'Municipal innovation partner', lang: 'nl', width: 1280, mode: 'partner' },
];
const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
const actorReports = [];
try {
  for (const persona of cases) {
    const context = await browser.newContext({
      viewport: { width: persona.width, height: 850 },
      reducedMotion: 'reduce',
      acceptDownloads: true,
      colorScheme: 'dark',
    });
    const page = await context.newPage();
    const record = {
      schema: 'CIVIC_RELAY_SYNTHETIC_BROWSER_REVIEW_V1',
      actor_id: persona.id,
      professional_role: persona.role,
      persona_type: 'AUTOMATED_SYNTHETIC_ROLE_NOT_HUMAN',
      target: origin.origin,
      target_commit: commit,
      language: persona.lang,
      viewport_width: persona.width,
      mode: persona.mode,
      checks: [],
      console_errors: [],
      page_errors: [],
      network_origins: [],
      observations: [],
      recommendations: [],
      screenshot: null,
      confidence: 'direct Playwright browser observation, not human comprehension',
    };
    const external = new Set();
    page.on('request', (request) => {
      try {
        external.add(new URL(request.url()).origin);
      } catch {
        /* Ignore malformed third-party request URL in egress inventory. */
      }
    });
    page.on('pageerror', (e) => record.page_errors.push(String(e.message).slice(0, 280)));
    page.on('console', (message) => {
      if (message.type() === 'error') record.console_errors.push(message.text().slice(0, 260));
    });
    const check = (id, ok, detail, fix, critical = true) => {
      record.checks.push({ id, pass: !!ok, critical, observation: String(detail || '').slice(0, 700) });
      if (!ok && fix)
        record.recommendations.push({ source_check: id, priority: critical ? 'P1' : 'P2', fix });
    };
    const el = async (selector) => page.locator(selector).count();
    const clickAnchor = async (id) => {
      const button = page.locator('.oep-chapter-nav a[href="#' + id + '"]').first();
      try {
        if (await button.count()) {
          await button.scrollIntoViewIfNeeded();
          await button.click({ timeout: 7000 });
          await page.waitForTimeout(200);
          return new URL(page.url()).hash === '#' + id;
        }
        return false;
      } catch (e) {
        record.observations.push('Anchor ' + id + ': ' + String(e.message).slice(0, 200));
        return false;
      }
    };
    try {
      const sub = persona.lang === 'en' ? '/' : '/' + persona.lang + '/';
      const response = await page.goto(origin.origin + sub, {
        waitUntil: 'domcontentloaded',
        timeout: 50000,
      });
      await page.locator('h1').first().waitFor({ state: 'visible', timeout: 20000 });
      await page.waitForTimeout(250);
      check(
        'http-response',
        response && response.status() === 200,
        'HTTP ' + (response ? response.status() : 'no response') + ' at ' + page.url(),
        'Fix the deployed language route and monitor availability.',
      );
      check(
        'visible-hero',
        (await page.locator('h1').first().innerText()).trim().length > 15,
        (await page.locator('h1').first().innerText()).slice(0, 200),
        'Restore a readable hero heading.',
      );
      const sectionIds = [
        'what-oep-does',
        'architecture',
        'how-it-works',
        'routing-lab',
        'developer-stack',
        'evidence',
      ];
      const missing = [];
      for (const id of sectionIds) if (!(await el('#' + id))) missing.push(id);
      check(
        'six-sections',
        missing.length === 0,
        'Missing section anchors: ' + (missing.join(', ') || 'none'),
        'Keep all six chapter navigation targets present in the deployed site.',
      );
      const navCount = await el('.oep-chapter-nav a');
      check(
        'chapter-navigation',
        navCount === 6,
        'Chapter anchor count ' + navCount,
        'Restore navigation for all six major sections.',
      );
      const pageHasSafety =
        /(simulad|synthetic|gesimuleerd|geen echte|sin .{0,35}reales|not physically tested|not an emergency)/i.test(
          await page.locator('body').innerText(),
        );
      check(
        'truthful-simulation-label',
        pageHasSafety,
        'Visible synthetic/non-operational disclaimer present: ' + pageHasSafety,
        'Put a clear research-only safety statement near the first interaction.',
      );
      const overflow = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        window: innerWidth,
      }));
      check(
        'no-global-mobile-overflow',
        overflow.scroll <= overflow.window + 3,
        JSON.stringify(overflow),
        'Correct global horizontal overflow at this viewport; keep chapter strip locally scrollable.',
        false,
      );
      if (persona.mode === 'story') {
        const ok = await clickAnchor('what-oep-does');
        check(
          'resident-finds-function',
          ok,
          'Visited #what-oep-does via real chapter click',
          'Surface an immediate understandable explanation for affected people.',
        );
        const intro = (await page.locator('#what-oep-does').innerText()).slice(0, 850);
        check(
          'resident-brief-has-detail',
          intro.length > 150,
          'Brief text length ' + intro.length,
          'Explain opt-in and concrete human acknowledgement steps in everyday language.',
        );
        check(
          'resident-finds-lab',
          await clickAnchor('routing-lab'),
          'Chapter navigation -> live lab',
          'Make the lab discoverable without scrolling blindly.',
        );
      }
      if (persona.mode === 'responder') {
        check(
          'responder-finds-workflow',
          await clickAnchor('how-it-works'),
          'Clicked six-stage explanation',
          'Link engineering steps prominently from the responder entry point.',
        );
        const labels = await page.locator('.oep-system-node').count();
        check(
          'responder-six-decisions',
          labels === 6,
          'Six-state decision controls: ' + labels,
          'Expose six concrete coordination decisions and their input/output states.',
        );
        const safety = (await page.locator('#routing-lab .mer-warning').innerText()).slice(0, 500);
        check(
          'responder-no-false-dispatch',
          /(112|emergency service|satellit|real)/i.test(safety),
          safety,
          'Prevent the simulated acknowledgement from being mistaken for an actual dispatched alert.',
        );
      }
      if (persona.mode === 'investor' || persona.mode === 'partner') {
        const ok = await clickAnchor('evidence');
        check(
          'partner-finds-proof',
          ok,
          'Clicked #evidence from overview',
          'Expose independent evidence and limitations in top navigation.',
        );
        const cards = await page.locator('.oep-evidence-card').allInnerTexts();
        const hasZero = cards.some((t) => /(^|\n)0(\n|$)/.test(t) || /0\s*(proven|geverifieerde)/i.test(t));
        check(
          'zero-physical-proof',
          hasZero,
          'Evidence cards: ' + cards.map((x) => x.slice(0, 95)).join(' | '),
          'Distinguish zero validated real device transmissions from synthetic results.',
        );
        const links = await page
          .locator('#evidence a[href^="https://github.com/abrahamhl/civic-relay"]')
          .count();
        check(
          'link-to-source',
          links > 0,
          'GitHub evidence links ' + links,
          'Provide inspectable, publicly readable code/evidence references.',
        );
        if (persona.mode === 'investor') {
          check(
            'funding-section',
            (await el('#investment')) > 0,
            'Investment section exists',
            'Explain target partner, milestones, costs, risks and clear ask.',
          );
        }
      }
      if (persona.mode === 'engineer') {
        check(
          'engineer-navigation',
          await clickAnchor('how-it-works'),
          'Clicked engineering stage section',
          'Ensure how-it-works stage navigation is discoverable.',
        );
        const steps = page.locator('.oep-system-node');
        if ((await steps.count()) === 6) {
          const before = await page.locator('.oep-system-active h3').innerText();
          await steps.nth(5).click({ timeout: 7000 });
          await page.waitForTimeout(250);
          const after = await page.locator('.oep-system-active h3').innerText();
          check(
            'engineer-interactive-steps',
            before !== after,
            'Active stage: ' + before + ' -> ' + after,
            'Make state diagram buttons update the visible explanation.',
          );
        } else
          check('engineer-interactive-steps', false, 'Six interactive nodes missing', 'Restore six nodes.');
        const layers = await page.locator('#developer-stack .oep-layer').count();
        check(
          'engineer-six-layers',
          layers === 6,
          'Implementation layers ' + layers,
          'Show each actual technology layer with implementation status.',
        );
        const hrefs = await page
          .locator('#developer-stack .oep-layer a')
          .evaluateAll((as) => as.map((a) => a.href));
        check(
          'engineer-source-paths',
          hrefs.length === 6 && hrefs.every((x) => x.startsWith('https://github.com/abrahamhl/civic-relay/')),
          JSON.stringify(hrefs).slice(0, 450),
          'Link each technical layer to a real source file in this repository.',
        );
      }
      if (persona.mode === 'privacy') {
        check(
          'privacy-finds-lab',
          await clickAnchor('routing-lab'),
          'Clicked Dutch simulation lab',
          'Expose consent choices in Dutch before any hypothetical status request.',
        );
        const warning = (await page.locator('.mer-warning').innerText()).slice(0, 500);
        check(
          'privacy-radio-boundary',
          /(Bluetooth|Wi-Fi|112)/i.test(warning),
          warning,
          'Clarify that the page cannot turn on phone radios or send emergency alerts.',
        );
        const toggles = await page.locator('#routing-lab input[type=checkbox]').count();
        check(
          'permission-model-switches',
          toggles >= 3,
          'Radio/gateway assumption switches ' + toggles,
          'Make simulated radio and gateway settings inspectable.',
        );
      }
      if (persona.mode === 'lab' || persona.mode === 'responder') {
        const slider = page.locator('#routing-lab .mer-sliders input[type=range]').first();
        const before = await slider.inputValue();
        await slider.fill('20');
        await page.waitForTimeout(250);
        const after = await slider.inputValue();
        const displayed = await page
          .locator('#routing-lab .mer-sliders label')
          .first()
          .locator('strong')
          .innerText();
        check(
          'real-slider-mutates-model',
          before !== after && after === '20' && displayed.includes('20'),
          'Devices input ' + before + ' -> ' + after + '; displayed ' + displayed,
          'Bind the control to real calculated state, not a decorative slider.',
        );
        const downloadButton = page.locator('#routing-lab .mer-tools button').nth(2);
        try {
          const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 12000 }),
            downloadButton.click({ timeout: 7000 }),
          ]);
          const evidenceFile = join(output, 'actors', persona.id + '-synthetic-evidence.json');
          await download.saveAs(evidenceFile);
          const data = JSON.parse(readFileSync(evidenceFile, 'utf8'));
          check(
            'synthetic-json-download',
            data.kind === 'OEP_SYNTHETIC_EVIDENCE_EXPORT' &&
              String(data.warning).includes('NOT_PHYSICALLY_TESTED'),
            'Downloaded ' +
              download.suggestedFilename() +
              ' with ' +
              data.kind +
              '; simulation warning present',
            'Export verifiable seeded inputs AND prominently label results synthetic.',
          );
        } catch (e) {
          check(
            'synthetic-json-download',
            false,
            String(e.message).slice(0, 220),
            'Repair the evidence export control and test real browser download behavior.',
          );
        }
      }
      if (persona.mode === 'accessibility') {
        await page.keyboard.press('Tab');
        const focus = await page.evaluate(() => ({
          tag: document.activeElement?.tagName,
          name: document.activeElement?.getAttribute('aria-label') || '',
        }));
        check(
          'keyboard-focus',
          !!focus.tag && focus.tag !== 'BODY',
          JSON.stringify(focus),
          'Ensure keyboard tab focus reaches an actionable visible control.',
        );
        const systemButtons = await page.locator('#how-it-works button').count();
        check(
          'accessible-semantic-buttons',
          systemButtons >= 12,
          'Stage controls are native buttons: ' + systemButtons,
          'Use native buttons, labels and aria-pressed for system-stage interactions.',
        );
        const missingAlt = await page.locator('img:not([alt])').count();
        check(
          'images-have-alt',
          missingAlt === 0,
          'Images without alt ' + missingAlt,
          'Provide accessible image alternatives (empty alt for decorative images).',
          false,
        );
      }
      const shot = join(output, 'screenshots', persona.id + '.png');
      await page.screenshot({ path: shot, fullPage: false, timeout: 20000 });
      record.screenshot = 'screenshots/' + persona.id + '.png';
    } catch (e) {
      console.error(persona.id + ' browser exception: ' + String(e.stack || e).slice(0, 500));
      check(
        'browser-run-exception',
        false,
        String(e.stack || e).slice(0, 700),
        'Reproduce the failed Playwright step and repair the deployed demo.',
      );
      try {
        const shot = join(output, 'screenshots', persona.id + '-error.png');
        await page.screenshot({ path: shot, timeout: 15000 });
        record.screenshot = 'screenshots/' + persona.id + '-error.png';
      } catch {
        /* Screenshot errors are captured by the owning role check. */
      }
    } finally {
      record.network_origins = Array.from(external).sort();
      record.passed = record.checks.filter((x) => x.pass).length;
      record.failed = record.checks.filter((x) => !x.pass).length;
      record.critical_failures = record.checks.filter((x) => !x.pass && x.critical).length;
      record.verdict = record.critical_failures ? 'ACTION_REQUIRED' : 'AUTOMATED_BROWSER_CHECKS_PASSED';
      record.comment =
        'AUTOMATED TEST NOTE (' +
        persona.role +
        '): ' +
        record.passed +
        '/' +
        record.checks.length +
        ' observed checks passed. ' +
        (record.critical_failures
          ? record.critical_failures + ' critical failure(s); inspect check IDs and screenshots.'
          : 'No critical failure in scripted tasks; human comprehension remains untested.');
      record.observations.push(
        'Role scenario ' + persona.mode + ' executed in Chromium; actor is not a recruited tester.',
      );
      writeFileSync(join(output, 'actors', persona.id + '.json'), JSON.stringify(record, null, 2) + '\n');
      actorReports.push(record);
      console.log(persona.id + ' ' + record.verdict + ' ' + record.passed + '/' + record.checks.length);
      await context.close();
    }
  }
} finally {
  await browser.close();
}
const summary = {
  schema: 'CIVIC_RELAY_ARENA_AUDIT_V1',
  executed_at: new Date().toISOString(),
  target: origin.origin,
  target_commit: commit,
  real_browser: 'Playwright Chromium',
  synthetic_roles: cases.length,
  human_testers: 0,
  physical_emergency_relays: 0,
  checks: actorReports.reduce((n, a) => n + a.checks.length, 0),
  failed_checks: actorReports.reduce((n, a) => n + a.failed, 0),
  critical_failures: actorReports.reduce((n, a) => n + a.critical_failures, 0),
  roles: actorReports.map((a) => ({
    id: a.actor_id,
    role: a.professional_role,
    pass: a.passed,
    fail: a.failed,
    critical_failures: a.critical_failures,
    report: 'actors/' + a.actor_id + '.json',
    screenshot: a.screenshot,
  })),
  limitations: [
    'Automated web tests cannot establish human trust, emergency safety or field interoperability.',
    'No physical BLE, mesh, satellite, 112 or device-to-device emergency communication was tested.',
    'No actual human feedback is claimed.',
    'The Buyer Arena baseline-vs-candidate smoke is separate from these role-specific browser checks.',
  ],
};
writeFileSync(join(output, 'campaign-summary.json'), JSON.stringify(summary, null, 2) + '\n');
const md = [
  '# OEP / Civic Relay — evidence-backed synthetic role campaign',
  '',
  'Target deployment: ' + origin.origin + '; source SHA: ' + commit,
  '',
  '**Executed**: ' +
    summary.synthetic_roles +
    ' real Chromium role journeys. **People recruited**: 0. **Physical emergency links tested**: 0.',
  '',
  'Checks: ' +
    summary.checks +
    '; failed: ' +
    summary.failed_checks +
    '; critical: ' +
    summary.critical_failures +
    '.',
  '',
  '| Actor | Role | Passed | Failed | Critical | Evidence |',
  '|---|---|---:|---:|---:|---|',
  ...summary.roles.map(
    (x) =>
      '| ' +
      x.id +
      ' | ' +
      x.role +
      ' | ' +
      x.pass +
      ' | ' +
      x.fail +
      ' | ' +
      x.critical_failures +
      ' | ' +
      x.report +
      ' |',
  ),
  '',
  '## Reproducible backlog',
  ...actorReports.flatMap((a) =>
    a.recommendations.map(
      (r) => '- **' + r.priority + ' / ' + a.actor_id + ' / ' + r.source_check + '**: ' + r.fix,
    ),
  ),
  '',
  'Individual JSON files contain the observed check, an automatically generated comment, screenshot reference, error log and suggested fix. These are **not human testimonials**.',
];
writeFileSync(join(output, 'IMPROVEMENT_BACKLOG.md'), md.join('\n') + '\n');
console.log(
  'Civic Relay actual browser campaign: ' +
    JSON.stringify({
      roles: summary.synthetic_roles,
      checks: summary.checks,
      failed: summary.failed_checks,
      critical: summary.critical_failures,
    }),
);
if (summary.critical_failures > 0) process.exitCode = 1;
