#!/usr/bin/env node
/* global document, innerWidth */
/**
 * Buyer Arena / Civic Relay consented public-demo browser exercise.
 * REAL Chromium actions performed by AUTOMATED ROLE SCENARIOS, NOT humans.
 * This file does not manufacture endorsements, rescue measurements or interviews.
 */
import { chromium } from 'playwright';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DEFAULT_URL = 'https://civic-relay-investor.vercel.app';
const origin = new URL(process.env.CIVIC_RELAY_URL || DEFAULT_URL);
if (origin.protocol !== 'https:' && origin.hostname !== 'localhost' && origin.hostname !== '127.0.0.1') {
  throw new Error('Refusing target: explicit HTTPS demo or localhost required');
}
const output = resolve(process.env.CIVIC_AUDIT_ROOT || '.buyer-arena/civic-relay-audit');
const auditPersonasRoot = resolve(process.env.CIVIC_PERSONAS_DIR || join(output, 'personas'));
mkdirSync(join(output, 'actors'), { recursive: true });
mkdirSync(join(output, 'screenshots'), { recursive: true });
mkdirSync(auditPersonasRoot, { recursive: true });

const commit = process.env.CIVIC_RELAY_COMMIT || 'c18c6ac936c8b3c6560997b113e46b50cab51302';
const campaignMode = process.env.CIVIC_CAMPAIGN_MODE || 'SINGLE-VERSION SMOKE';
const cases = [
  {
    code: 'P01',
    id: '01-resident-es',
    role: 'Affected citizen, ES',
    objective: 'Understand purpose and human-status states',
    lang: 'es',
    width: 390,
    mode: 'story',
  },
  {
    code: 'P02',
    id: '02-responder-en',
    role: 'Emergency coordinator, EN',
    objective: 'Inspect message and routing semantics',
    lang: 'en',
    width: 1440,
    mode: 'responder',
  },
  {
    code: 'P03',
    id: '03-investor-en',
    role: 'Technology investor, EN',
    objective: 'Find evidence and funding proposition',
    lang: 'en',
    width: 1280,
    mode: 'investor',
  },
  {
    code: 'P04',
    id: '04-engineer-en',
    role: 'Network engineer, EN',
    objective: 'Examine architecture, interactions and source',
    lang: 'en',
    width: 1440,
    mode: 'engineer',
  },
  {
    code: 'P05',
    id: '05-privacy-nl',
    role: 'Privacy reviewer, NL',
    objective: 'Assess consent and permissions',
    lang: 'nl',
    width: 390,
    mode: 'privacy',
  },
  {
    code: 'P06',
    id: '06-volunteer-es',
    role: 'Field volunteer, ES',
    objective: 'Interact with simulator and export JSON',
    lang: 'es',
    width: 768,
    mode: 'lab',
  },
  {
    code: 'P07',
    id: '07-accessibility-en',
    role: 'Accessibility reviewer, EN',
    objective: 'Keyboard, mobile and reduced-motion flows',
    lang: 'en',
    width: 360,
    mode: 'accessibility',
  },
  {
    code: 'P08',
    id: '08-partner-nl',
    role: 'Municipal partner, NL',
    objective: 'Understand institutional value and integration limits',
    lang: 'nl',
    width: 1280,
    mode: 'partner',
  },
];

const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
const actorReports = [];
try {
  for (const persona of cases) {
    const startedAt = new Date().toISOString();
    const context = await browser.newContext({
      viewport: { width: persona.width, height: 850 },
      reducedMotion: 'reduce',
      acceptDownloads: true,
      colorScheme: 'dark',
    });
    const page = await context.newPage();
    const actionsPerformed = [];
    const selectorInteractions = [];
    const visitedUrls = [];
    const record = {
      schema: 'CIVIC_RELAY_SYNTHETIC_BROWSER_REVIEW_V1',
      persona_code: persona.code,
      actor_id: persona.id,
      professional_role: persona.role,
      test_objective: persona.objective,
      persona_type: 'AUTOMATED_SYNTHETIC_ROLE_NOT_HUMAN',
      persona_disclosure: 'AUTOMATED SYNTHETIC ROLE — NOT A RECRUITED HUMAN TESTER',
      campaign_mode: campaignMode,
      target: origin.origin,
      target_commit: commit,
      language: persona.lang,
      viewport_width: persona.width,
      mode: persona.mode,
      started_at: startedAt,
      completed_at: null,
      visited_urls: visitedUrls,
      actions_performed: actionsPerformed,
      selector_interactions: selectorInteractions,
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
    const check = (id, ok, detail, fix, critical = true, expected = 'check passes') => {
      record.checks.push({
        id,
        pass: !!ok,
        critical,
        expected,
        observation: String(detail || '').slice(0, 700),
        suggested_fix: fix,
      });
      if (!ok && fix)
        record.recommendations.push({ source_check: id, priority: critical ? 'P1' : 'P2', fix });
    };
    const el = async (selector) => {
      const count = await page.locator(selector).count();
      selectorInteractions.push({ selector, action: 'count', observed: count });
      return count;
    };
    const clickAnchor = async (id) => {
      const selector = '.oep-chapter-nav a[href="#' + id + '"]';
      const button = page.locator(selector).first();
      try {
        if (await button.count()) {
          await button.scrollIntoViewIfNeeded();
          await button.click({ timeout: 7000 });
          await page.waitForTimeout(200);
          const currentUrl = page.url();
          visitedUrls.push(currentUrl);
          actionsPerformed.push('click chapter anchor #' + id);
          selectorInteractions.push({ selector, action: 'click', result_url: currentUrl });
          return new URL(currentUrl).hash === '#' + id;
        }
        return false;
      } catch (e) {
        record.observations.push('Anchor ' + id + ': ' + String(e.message).slice(0, 200));
        return false;
      }
    };
    try {
      const sub = persona.lang === 'en' ? '/' : '/' + persona.lang + '/';
      const targetUrl = origin.origin + sub;
      actionsPerformed.push('goto ' + targetUrl);
      const response = await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 50000,
      });
      visitedUrls.push(page.url());
      await page.locator('h1').first().waitFor({ state: 'visible', timeout: 20000 });
      await page.waitForTimeout(250);
      check(
        'http-response',
        response && response.status() === 200,
        'HTTP ' + (response ? response.status() : 'no response') + ' at ' + page.url(),
        'Fix the deployed language route and monitor availability.',
        true,
        'HTTP 200 on language entry route',
      );
      const heroText = (await page.locator('h1').first().innerText()).trim();
      selectorInteractions.push({ selector: 'h1', action: 'innerText', observed: heroText.slice(0, 120) });
      check(
        'visible-hero',
        heroText.length > 15,
        heroText.slice(0, 200),
        'Restore a readable hero heading.',
        true,
        'Hero heading > 15 chars visible above fold',
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
        true,
        'All 6 architectural anchor sections exist in DOM',
      );
      const navCount = await el('.oep-chapter-nav a');
      check(
        'chapter-navigation',
        navCount === 6,
        'Chapter anchor count ' + navCount,
        'Restore navigation for all six major sections.',
        true,
        '6 sticky navigation chapter links present',
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
        true,
        'Explicit simulation-only disclaimer visible in body copy',
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
        'scrollWidth <= innerWidth + 3',
      );
      if (persona.mode === 'story') {
        const ok = await clickAnchor('what-oep-does');
        check(
          'resident-finds-function',
          ok,
          'Visited #what-oep-does via real chapter click',
          'Surface an immediate understandable explanation for affected people.',
          true,
          'Anchor navigation moves hash to #what-oep-does',
        );
        const intro = (await page.locator('#what-oep-does').innerText()).slice(0, 850);
        check(
          'resident-brief-has-detail',
          intro.length > 150,
          'Brief text length ' + intro.length,
          'Explain opt-in and concrete human acknowledgement steps in everyday language.',
          true,
          '#what-oep-does section contains > 150 chars of explanation',
        );
        check(
          'resident-finds-lab',
          await clickAnchor('routing-lab'),
          'Chapter navigation -> live lab',
          'Make the lab discoverable without scrolling blindly.',
          true,
          'Anchor navigation moves hash to #routing-lab',
        );
        const humanConsentCheckbox = page.locator('#routing-lab .mer-human input[type="checkbox"]').first();
        if (await humanConsentCheckbox.count()) {
          await humanConsentCheckbox.scrollIntoViewIfNeeded();
          await humanConsentCheckbox.check({ timeout: 5000 });
          actionsPerformed.push('check human status consent checkbox');
          const safeBtn = page.locator('#routing-lab .mer-safety-choices button').first();
          await safeBtn.click({ timeout: 5000 });
          actionsPerformed.push('click SAFE human status response button');
          const savedText = await page.locator('#routing-lab .mer-safety-record').innerText();
          selectorInteractions.push({
            selector: '#routing-lab .mer-safety-record',
            action: 'innerText',
            observed: savedText.slice(0, 120),
          });
          check(
            'resident-consented-human-status',
            savedText.includes('SAFE'),
            'Recorded human status after explicit consent: ' + savedText.replace(/\s+/g, ' ').slice(0, 160),
            'Require explicit consent before recording SAFE/SOS human status.',
            true,
            'Human status panel records SAFE after consent checkbox',
          );
        }
      }
      if (persona.mode === 'responder') {
        check(
          'responder-finds-workflow',
          await clickAnchor('how-it-works'),
          'Clicked six-stage explanation',
          'Link engineering steps prominently from the responder entry point.',
          true,
          'Navigate to #how-it-works',
        );
        const labels = await page.locator('.oep-system-node').count();
        check(
          'responder-six-decisions',
          labels === 6,
          'Six-state decision controls: ' + labels,
          'Expose six concrete coordination decisions and their input/output states.',
          true,
          '6 interactive decision stage controls present',
        );
        const safety = (await page.locator('#routing-lab p.mer-warning').innerText()).slice(0, 500);
        check(
          'responder-no-false-dispatch',
          /(112|emergency service|satellit|real)/i.test(safety),
          safety,
          'Prevent the simulated acknowledgement from being mistaken for an actual dispatched alert.',
          true,
          'Explicit warning that synthetic ACK is not 112 dispatch',
        );
      }
      if (persona.mode === 'investor' || persona.mode === 'partner') {
        const ok = await clickAnchor('evidence');
        check(
          'partner-finds-proof',
          ok,
          'Clicked #evidence from overview',
          'Expose independent evidence and limitations in top navigation.',
          true,
          'Navigate to #evidence',
        );
        const cards = await page.locator('.oep-evidence-card').allInnerTexts();
        const hasZero = cards.some((t) => /(^|\n)0(\n|$)/.test(t) || /0\s*(proven|geverifieerde)/i.test(t));
        check(
          'zero-physical-proof',
          hasZero,
          'Evidence cards: ' + cards.map((x) => x.slice(0, 95)).join(' | '),
          'Distinguish zero validated real device transmissions from synthetic results.',
          true,
          'Evidence board explicitly states 0 validated physical relays',
        );
        const links = await page
          .locator('#evidence a[href^="https://github.com/abrahamhl/civic-relay"]')
          .count();
        check(
          'link-to-source',
          links > 0,
          'GitHub evidence links ' + links,
          'Provide inspectable, publicly readable code/evidence references.',
          true,
          'Direct outbound links to GitHub repository evidence',
        );
        if (persona.mode === 'investor') {
          check(
            'funding-section',
            (await el('#investment')) > 0,
            'Investment section exists',
            'Explain target partner, milestones, costs, risks and clear ask.',
            true,
            '#investment section present',
          );
        }
      }
      if (persona.mode === 'engineer') {
        check(
          'engineer-navigation',
          await clickAnchor('how-it-works'),
          'Clicked engineering stage section',
          'Ensure how-it-works stage navigation is discoverable.',
          true,
          'Navigate to #how-it-works',
        );
        const steps = page.locator('.oep-system-node');
        if ((await steps.count()) === 6) {
          const before = await page.locator('.oep-system-active h3').innerText();
          await steps.nth(5).click({ timeout: 7000 });
          actionsPerformed.push('click 6th system stage button (.oep-system-node nth(5))');
          await page.waitForTimeout(250);
          const after = await page.locator('.oep-system-active h3').innerText();
          selectorInteractions.push({
            selector: '.oep-system-node:nth(5)',
            action: 'click',
            before,
            after,
          });
          check(
            'engineer-interactive-steps',
            before !== after,
            'Active stage: ' + before + ' -> ' + after,
            'Make state diagram buttons update the visible explanation.',
            true,
            'Clicking stage node updates active stage heading',
          );
        } else
          check('engineer-interactive-steps', false, 'Six interactive nodes missing', 'Restore six nodes.');
        const layers = await page.locator('#developer-stack .oep-layer').count();
        check(
          'engineer-six-layers',
          layers === 6,
          'Implementation layers ' + layers,
          'Show each actual technology layer with implementation status.',
          true,
          '6 developer architecture layers rendered',
        );
        const hrefs = await page
          .locator('#developer-stack .oep-layer a')
          .evaluateAll((as) => as.map((a) => a.href));
        check(
          'engineer-source-paths',
          hrefs.length === 6 && hrefs.every((x) => x.startsWith('https://github.com/abrahamhl/civic-relay/')),
          JSON.stringify(hrefs).slice(0, 450),
          'Link each technical layer to a real source file in this repository.',
          true,
          'All 6 developer stack layers link to GitHub source paths',
        );
      }
      if (persona.mode === 'privacy') {
        check(
          'privacy-finds-lab',
          await clickAnchor('routing-lab'),
          'Clicked Dutch simulation lab',
          'Expose consent choices in Dutch before any hypothetical status request.',
          true,
          'Navigate to #routing-lab in NL locale',
        );
        const warning = (await page.locator('#routing-lab p.mer-warning').innerText()).slice(0, 500);
        check(
          'privacy-radio-boundary',
          /(Bluetooth|Wi-Fi|112)/i.test(warning),
          warning,
          'Clarify that the page cannot turn on phone radios or send emergency alerts.',
          true,
          'Dutch radio/112 non-interference boundary stated',
        );
        const toggles = await page.locator('#routing-lab input[type=checkbox]').count();
        check(
          'permission-model-switches',
          toggles >= 3,
          'Radio/gateway assumption switches ' + toggles,
          'Make simulated radio and gateway settings inspectable.',
          true,
          '>= 3 consent/radio/gateway checkboxes inspectable',
        );
      }
      if (persona.mode === 'lab' || persona.mode === 'responder') {
        const slider = page.locator('#routing-lab .mer-sliders input[type=range]').first();
        await slider.scrollIntoViewIfNeeded();
        const before = await slider.inputValue();
        await slider.fill('20');
        actionsPerformed.push('set virtual devices range slider to 20');
        await page.waitForTimeout(250);
        const after = await slider.inputValue();
        const displayed = await page
          .locator('#routing-lab .mer-sliders label')
          .first()
          .locator('strong')
          .innerText();
        selectorInteractions.push({
          selector: '#routing-lab .mer-sliders input[type=range]:first',
          action: 'fill(20)',
          before,
          after,
          displayed,
        });
        check(
          'real-slider-mutates-model',
          before !== after && after === '20' && displayed.includes('20'),
          'Devices input ' + before + ' -> ' + after + '; displayed ' + displayed,
          'Bind the control to real calculated state, not a decorative slider.',
          true,
          'Changing virtual devices slider from 60 to 20 updates deterministic model state',
        );
        // Also exercise the Store-and-Forward sandbox button in .mer-forward-lab
        const sendSandboxBtn = page.locator('#routing-lab .mer-forward-lab .mer-tools button').first();
        if (await sendSandboxBtn.count()) {
          await sendSandboxBtn.scrollIntoViewIfNeeded();
          await sendSandboxBtn.click({ timeout: 5000 });
          actionsPerformed.push('click GENERATE SYNTHETIC SOS in Store & Forward sandbox');
          await page.waitForTimeout(200);
          const queueText = await page.locator('#routing-lab .mer-forward-results').innerText();
          selectorInteractions.push({
            selector: '#routing-lab .mer-forward-lab .mer-tools button:first',
            action: 'click',
            observed: queueText.replace(/\s+/g, ' ').slice(0, 160),
          });
          check(
            'store-forward-sandbox-enqueue',
            queueText.includes('EXERCISE_0001'),
            'Store & Forward sandbox state: ' + queueText.replace(/\s+/g, ' ').slice(0, 180),
            'Ensure Store & Forward sandbox dispatches and displays synthetic message status.',
            true,
            'Clicking GENERATE SYNTHETIC SOS creates EXERCISE_0001 in queue',
          );
        }
        // Target the scenario evidence export button inside .mer-controls .mer-tools (3rd button)
        const downloadButton = page.locator('#routing-lab .mer-controls .mer-tools button').nth(2);
        try {
          await downloadButton.scrollIntoViewIfNeeded();
          actionsPerformed.push('click EXPORT SYNTHETIC EVIDENCE JSON button');
          const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 12000 }),
            downloadButton.click({ timeout: 7000 }),
          ]);
          const evidenceFile = join(output, 'actors', persona.id + '-synthetic-evidence.json');
          await download.saveAs(evidenceFile);
          const data = JSON.parse(readFileSync(evidenceFile, 'utf8'));
          selectorInteractions.push({
            selector: '#routing-lab .mer-controls .mer-tools button:nth(2)',
            action: 'click+download',
            filename: download.suggestedFilename(),
            kind: data.kind,
          });
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
            true,
            'Downloads JSON with kind=OEP_SYNTHETIC_EVIDENCE_EXPORT and NOT_PHYSICALLY_TESTED warning',
          );
        } catch (e) {
          check(
            'synthetic-json-download',
            false,
            String(e.message).slice(0, 220),
            'Repair the evidence export control and test real browser download behavior.',
            true,
            'Downloads JSON with kind=OEP_SYNTHETIC_EVIDENCE_EXPORT',
          );
        }
      }
      if (persona.mode === 'accessibility') {
        await page.keyboard.press('Tab');
        actionsPerformed.push('press Tab key');
        const focus = await page.evaluate(() => ({
          tag: document.activeElement?.tagName,
          name: document.activeElement?.getAttribute('aria-label') || '',
        }));
        selectorInteractions.push({ selector: 'document.activeElement', action: 'Tab', observed: focus });
        check(
          'keyboard-focus',
          !!focus.tag && focus.tag !== 'BODY',
          JSON.stringify(focus),
          'Ensure keyboard tab focus reaches an actionable visible control.',
          true,
          'Keyboard Tab focuses an interactive element',
        );
        const systemButtons = await page.locator('#how-it-works button').count();
        check(
          'accessible-semantic-buttons',
          systemButtons >= 12,
          'Stage controls are native buttons: ' + systemButtons,
          'Use native buttons, labels and aria-pressed for system-stage interactions.',
          true,
          '>= 12 native buttons in #how-it-works',
        );
        const missingAlt = await page.locator('img:not([alt])').count();
        check(
          'images-have-alt',
          missingAlt === 0,
          'Images without alt ' + missingAlt,
          'Provide accessible image alternatives (empty alt for decorative images).',
          false,
          '0 images missing alt attribute',
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
      record.completed_at = new Date().toISOString();
      record.network_origins = Array.from(external).sort();
      record.passed = record.checks.filter((x) => x.pass).length;
      record.failed = record.checks.filter((x) => !x.pass).length;
      record.critical_failures = record.checks.filter((x) => !x.pass && x.critical).length;
      record.verdict = record.critical_failures ? 'ACTION_REQUIRED' : 'AUTOMATED_BROWSER_CHECKS_PASSED';
      record.comment =
        'AUTOMATED TEST NOTE (' +
        persona.code +
        ' / ' +
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

      // Also write standardized per-persona evidence bundle under personas/<code-and-id>
      for (const dirName of [persona.code, persona.id]) {
        const pDir = join(auditPersonasRoot, dirName);
        const pShots = join(pDir, 'screenshots');
        mkdirSync(pShots, { recursive: true });
        if (record.screenshot) {
          const srcShot = join(output, record.screenshot);
          const dstShot = join(pShots, persona.id + '.png');
          try {
            copyFileSync(srcShot, dstShot);
          } catch {
            /* Ignore copy error if screenshot failed */
          }
        }
        const downloadedJsonPath = join(output, 'actors', persona.id + '-synthetic-evidence.json');
        let downloadedExportSummary = null;
        try {
          const parsedExport = JSON.parse(readFileSync(downloadedJsonPath, 'utf8'));
          downloadedExportSummary = {
            file: 'actors/' + persona.id + '-synthetic-evidence.json',
            kind: parsedExport.kind,
            warning: parsedExport.warning,
            seed: parsedExport.result?.seed,
            summary: parsedExport.result?.summary,
          };
          copyFileSync(downloadedJsonPath, join(pDir, 'exported-scenario-evidence.json'));
        } catch {
          /* Only responder and volunteer trigger JSON download */
        }
        writeFileSync(
          join(pDir, 'run.json'),
          JSON.stringify(
            {
              schema: 'BUYER_ARENA_PERSONA_RUN_V1',
              actor_id: persona.code,
              legacy_id: persona.id,
              role: persona.role,
              objective: persona.objective,
              disclosure: 'AUTOMATED SYNTHETIC ROLE — NOT A RECRUITED HUMAN TESTER',
              campaign_mode: campaignMode,
              target_url: origin.origin,
              target_commit: commit,
              language: persona.lang,
              viewport: { width: persona.width, height: 850 },
              started_at: record.started_at,
              completed_at: record.completed_at,
              visited_urls: record.visited_urls,
              actions_performed: record.actions_performed,
              selector_interactions: record.selector_interactions,
              verdict: record.verdict,
              passed_checks: record.passed,
              failed_checks: record.failed,
              critical_failures: record.critical_failures,
            },
            null,
            2,
          ) + '\n',
        );
        writeFileSync(
          join(pDir, 'evidence.json'),
          JSON.stringify(
            {
              schema: 'BUYER_ARENA_PERSONA_EVIDENCE_V1',
              actor_id: persona.code,
              legacy_id: persona.id,
              disclosure: 'AUTOMATED SYNTHETIC ROLE — NOT A RECRUITED HUMAN TESTER',
              target_url: origin.origin,
              target_commit: commit,
              checks: record.checks,
              downloaded_scenario_export: downloadedExportSummary,
              console_errors: record.console_errors,
              page_errors: record.page_errors,
              network_origins: record.network_origins,
              screenshot: 'screenshots/' + persona.id + '.png',
            },
            null,
            2,
          ) + '\n',
        );
        writeFileSync(
          join(pDir, 'feedback.md'),
          [
            '# ' + persona.code + ' — ' + persona.role,
            '',
            '> **AUTOMATED SYNTHETIC ROLE — NOT A RECRUITED HUMAN TESTER**',
            '',
            '- **Objective:** ' + persona.objective,
            '- **Campaign Mode:** `' + campaignMode + '`',
            '- **Target URL:** `' + origin.origin + '` (commit `' + commit + '`)',
            '- **Locale & Viewport:** `' + persona.lang + '` @ `' + persona.width + 'x850`',
            '- **Verdict:** `' +
              record.verdict +
              '` (' +
              record.passed +
              '/' +
              record.checks.length +
              ' checks passed)',
            '',
            '## Actions Performed in Chromium',
            ...record.actions_performed.map((a) => '- ' + a),
            '',
            '## Observed Checks',
            ...record.checks.map(
              (c) =>
                '- **' +
                c.id +
                '** (`' +
                (c.pass ? 'PASS' : 'FAIL') +
                '`): Expected `' +
                c.expected +
                '` → Observed: `' +
                c.observation +
                '`',
            ),
            '',
            '## Summary Note',
            record.comment,
          ].join('\n') + '\n',
        );
        const failedChecks = record.checks.filter((c) => !c.pass);
        writeFileSync(
          join(pDir, 'issues.md'),
          [
            '# Issues — ' + persona.code + ' (' + persona.role + ')',
            '',
            '> **AUTOMATED SYNTHETIC ROLE — NOT A RECRUITED HUMAN TESTER**',
            '',
            ...(failedChecks.length === 0
              ? [
                  'No automated browser check failures observed in this run (`0` failed checks).',
                  '',
                  '## Residual Non-Browser Limitations',
                  '- Automated Playwright checks verify DOM state, interactive controls, and deterministic exports; they do not replace real human comprehension testing or physical Android radio trials.',
                ]
              : failedChecks.map(
                  (f) =>
                    '## Failed Check: `' +
                    f.id +
                    '`\n- **Severity:** ' +
                    (f.critical ? 'Critical (P1)' : 'Non-critical (P2)') +
                    '\n- **Expected:** ' +
                    f.expected +
                    '\n- **Observed:** ' +
                    f.observation +
                    '\n- **Suggested Fix:** ' +
                    f.suggested_fix +
                    '\n- **Reproduction:** Run `node scripts/civic-relay-review.mjs` targeting `' +
                    origin.origin +
                    '` in `' +
                    persona.lang +
                    '` at `' +
                    persona.width +
                    'px`.',
                )),
          ].join('\n') + '\n',
        );
        writeFileSync(
          join(pDir, 'recommendations.md'),
          [
            '# Recommendations — ' + persona.code + ' (' + persona.role + ')',
            '',
            '> **AUTOMATED SYNTHETIC ROLE — NOT A RECRUITED HUMAN TESTER**',
            '',
            ...(record.recommendations.length > 0
              ? record.recommendations.map(
                  (r) => '- **[' + r.priority + '] ' + r.source_check + ':** ' + r.fix,
                )
              : [
                  '- All scripted completion criteria passed (`' +
                    record.passed +
                    '/' +
                    record.checks.length +
                    '`).',
                  '- Maintain explicit simulation disclaimers and keep `data-testid` / `.mer-controls .mer-tools` selectors stable across future UI iterations.',
                ]),
            '',
            '## Evidence References',
            '- Run metadata: `run.json`',
            '- Check observations: `evidence.json`',
            '- Viewport capture: `screenshots/' + persona.id + '.png`',
          ].join('\n') + '\n',
        );
      }

      actorReports.push(record);
      console.log(
        persona.code +
          ' (' +
          persona.id +
          ') ' +
          record.verdict +
          ' ' +
          record.passed +
          '/' +
          record.checks.length,
      );
      for (const failed of record.checks.filter((c) => !c.pass)) {
        console.error(persona.id + ' FAILED ' + failed.id + ': ' + failed.observation);
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
}
const summary = {
  schema: 'CIVIC_RELAY_ARENA_AUDIT_V1',
  executed_at: new Date().toISOString(),
  campaign_mode: campaignMode,
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
    code: a.persona_code,
    id: a.actor_id,
    role: a.professional_role,
    objective: a.test_objective,
    pass: a.passed,
    fail: a.failed,
    critical_failures: a.critical_failures,
    report: 'actors/' + a.actor_id + '.json',
    persona_bundle: 'personas/' + a.persona_code + '/',
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
  'Target deployment: ' + origin.origin + '; source SHA: ' + commit + '; mode: `' + campaignMode + '`',
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
  '| Code | Actor | Role | Passed | Failed | Critical | Evidence |',
  '|---|---|---|---|---:|---:|---:|---|',
  ...summary.roles.map(
    (x) =>
      '| ' +
      x.code +
      ' | ' +
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
      x.persona_bundle +
      ' |',
  ),
  '',
  '## Reproducible backlog',
  ...(actorReports.flatMap((a) =>
    a.recommendations.map(
      (r) => '- **' + r.priority + ' / ' + a.actor_id + ' / ' + r.source_check + '**: ' + r.fix,
    ),
  ).length > 0
    ? actorReports.flatMap((a) =>
        a.recommendations.map(
          (r) => '- **' + r.priority + ' / ' + a.actor_id + ' / ' + r.source_check + '**: ' + r.fix,
        ),
      )
    : ['- 0 open critical browser defects across all 8 synthetic stakeholder journeys.']),
  '',
  'Individual JSON and Markdown files contain the observed check, an automatically generated comment, screenshot reference, error log and suggested fix. These are **not human testimonials** (`AUTOMATED SYNTHETIC ROLE — NOT A RECRUITED HUMAN TESTER`).',
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
