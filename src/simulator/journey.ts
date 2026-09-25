import { join } from 'node:path';
import { classifyHost, currentLedger } from '../policy/network.js';
import type { Browser, BrowserContext, Page } from 'playwright';
import { checkPage, type PageCheck } from '../browser/a11y.js';
import { observe, type ElementInfo, type Observation } from '../browser/observe.js';
import { BudgetExceededError, ProviderError } from '../core/errors.js';
import { ensureDir } from '../core/fs.js';
import { hashSeed } from '../core/rng.js';
import type {
  BuyerBrief,
  JourneyEvent,
  Milestone,
  RunRecord,
  RunStatus,
  Task,
  Usage,
} from '../core/types.js';
import { en_, type I18n } from '../i18n/messages.js';
import { KW } from './heuristic.js';
import {
  type Action,
  type BuyerPolicy,
  DISTRUST_RE,
  newMemory,
  pathOf,
  pricesIn,
  seenBlocks,
  TRUST_RE,
} from './policy.js';

export type TraceMode = 'off' | 'failed' | 'all';

export interface JourneyOptions {
  browser: Browser;
  brief: BuyerBrief;
  task: Task;
  policy: BuyerPolicy;
  runId: string;
  sessionId: string;
  variant: string;
  segment: string;
  archetype: string;
  outDir: string;
  maxSteps: number;
  timeoutMs: number;
  trace: TraceMode;
  screenshots: boolean;
  /** Returns usage accumulated for this run by an LLM policy (if any). */
  usage?: () => Usage | undefined;
  signal?: AbortSignal;
  /** Network emulation for segment runs (e.g. slow mobile connection). */
  network?: 'slow3g';
}

class Recorder {
  readonly events: JourneyEvent[] = [];
  readonly started = Date.now();
  step = 0;
  constructor(private readonly runId: string) {}
  add(
    type: JourneyEvent['type'],
    url: string,
    fields: Partial<Omit<JourneyEvent, 'id' | 'seq' | 't' | 'type' | 'url' | 'step'>> = {},
  ): JourneyEvent {
    const seq = this.events.length;
    const ev: JourneyEvent = {
      id: `${this.runId}:e${seq}`,
      seq,
      step: this.step,
      t: Date.now() - this.started,
      type,
      url,
      ...fields,
    };
    this.events.push(ev);
    return ev;
  }
}

const describe = (e?: ElementInfo) => (e ? `${e.kind}:"${e.text || e.label || e.name || e.idx}"` : undefined);

export async function runJourney(o: JourneyOptions): Promise<RunRecord> {
  const rec = new Recorder(o.runId);
  const startOrigin = new URL(o.brief.start_url).origin;
  const shotsDir = join(o.outDir, 'shots');
  if (o.screenshots) ensureDir(shotsDir);
  const memory = newMemory(hashSeed(o.runId));
  const milestones: Partial<Record<Milestone, number>> = {};
  const urlHistory: string[] = [];
  let status = 'step_limit' as RunStatus; // widened: assigned inside the per-step closure
  let abandonReason: string | undefined;
  let abandonI18n: I18n | undefined;
  let objection: string | undefined;
  let tracePath: string | undefined;
  let currentUrl = o.brief.start_url;
  let lastAlerts = '';
  let privacy: RunRecord['privacy'];

  const mark = (m: Milestone, url: string, detail?: string) => {
    if (milestones[m] !== undefined) return;
    milestones[m] = rec.step;
    rec.add('milestone', url, { target: m, detail });
  };

  const d = o.brief.persona.device;
  const context: BrowserContext = await o.browser.newContext({
    viewport: d.viewport,
    isMobile: d.kind === 'mobile',
    hasTouch: d.kind === 'mobile',
    locale: o.brief.persona.language,
    serviceWorkers: 'block',
  });
  // Safety: the buyer may only ever load the origin the user supplied (plus the origin the
  // start URL itself redirects to, e.g. http→https or apex→www).
  const allowed = new Set([startOrigin]);
  const ledger = currentLedger(); // captured: Playwright callbacks run outside our async scope
  let lastAllowedUrl = o.brief.start_url;
  const thirdParty = new Set<string>();
  const pageChecks: PageCheck[] = [];
  const checkedPaths = new Set<string>();
  let offsite: string | undefined;
  let offsiteCount = 0;
  await context.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
    const url = new URL(u);
    if (allowed.has(url.origin)) {
      ledger.contact(url.host, classifyHost(url.hostname), 'browser');
      return route.continue();
    }
    // Record (never load) every third-party host the page tries to call: privacy evidence.
    try {
      thirdParty.add(new URL(u).host);
    } catch {
      /* ignore */
    }
    if (route.request().isNavigationRequest())
      rec.add('blocked_offsite', currentUrl, { detail: new URL(u).origin });
    return route.abort('blockedbyclient');
  });
  if (o.trace !== 'off') await context.tracing.start({ screenshots: true, snapshots: true, title: o.runId });
  const page: Page = await context.newPage();
  page.setDefaultTimeout(5_000);
  if (o.network === 'slow3g') {
    // Chrome DevTools "Slow 3G"-like profile. Throttling adds waiting, not CPU load.
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 400,
      downloadThroughput: (400 * 1024) / 8,
      uploadThroughput: (400 * 1024) / 8,
    });
  }
  // Pop-ups / new tabs are never followed.
  context.on('page', (p) => {
    if (p === page) return;
    rec.add('blocked_offsite', currentUrl, { detail: 'popup window closed' });
    void p.close().catch(() => undefined);
  });

  page.on('console', (msg) => {
    // Resource-load failures are captured precisely by the response/requestfailed hooks.
    if (msg.type() === 'error' && !/^Failed to load resource/.test(msg.text()))
      rec.add('console_error', page.url(), { detail: msg.text().slice(0, 300) });
  });
  page.on('pageerror', (err) =>
    rec.add('page_error', page.url(), { detail: String(err.message).slice(0, 300) }),
  );
  page.on('requestfailed', (req) => {
    const failure = req.failure()?.errorText ?? 'failed';
    if (!/blockedbyclient|ERR_ABORTED/i.test(failure))
      rec.add('request_failed', page.url(), { detail: `${req.method()} ${req.url()} ${failure}` });
  });
  page.on('response', (res) => {
    // 4xx on a form POST is validation (captured as form_error); count server errors and dead links.
    const st = res.status();
    if (
      res.request().resourceType() === 'document' &&
      (st >= 500 || ((st === 404 || st === 410) && res.request().method() === 'GET'))
    ) {
      rec.add('http_error', res.url(), { detail: `HTTP ${res.status()}`, data: { status: res.status() } });
    }
  });
  page.on('framenavigated', (frame) => {
    if (frame !== page.mainFrame()) return;
    // Redirects are not seen by route(); catch any main-frame landing on a foreign origin.
    try {
      const origin = new URL(frame.url()).origin;
      if (!allowed.has(origin) && !frame.url().startsWith('about:')) {
        offsite = origin;
        rec.add('blocked_offsite', frame.url(), { detail: `redirected to ${origin}` });
        return;
      }
      lastAllowedUrl = frame.url();
    } catch {
      /* non-URL frames */
    }
    currentUrl = frame.url();
    urlHistory.push(currentUrl);
    memory.visited.push(pathOf(currentUrl));
    rec.add('navigate', currentUrl);
  });

  const shot = async (): Promise<string | undefined> => {
    if (!o.screenshots) return undefined;
    const file = `s${String(rec.step).padStart(2, '0')}-${rec.events.length}.jpg`;
    try {
      await page.screenshot({ path: join(shotsDir, file), type: 'jpeg', quality: 55 });
      return `shots/${file}`;
    } catch {
      return undefined;
    }
  };

  const deadline = rec.started + o.timeoutMs;
  const successRe = {
    url: o.task.success.url_pattern ? new RegExp(o.task.success.url_pattern, 'i') : undefined,
    text: o.task.success.text_pattern ? new RegExp(o.task.success.text_pattern, 'i') : undefined,
  };
  const checkoutRe = new RegExp(o.task.checkout_url_pattern, 'i');

  try {
    await page.goto(o.brief.start_url, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    let redirectAllowed = false;
    if (offsite && offsite !== startOrigin) {
      try {
        // Not "explicit": a redirect must fit the current policy (OFFLINE never follows
        // localhost → public), it cannot escalate it.
        ledger.check(offsite, 'browser');
        redirectAllowed = true;
      } catch (err) {
        rec.add('blocked_offsite', offsite, { detail: err instanceof Error ? err.message : String(err) });
      }
    }
    if (offsite && offsite !== startOrigin && redirectAllowed) {
      // The start URL itself redirected (e.g. http→https): that origin is part of the target.
      allowed.add(offsite);
      offsite = undefined;
      lastAllowedUrl = page.url();
      currentUrl = page.url();
      urlHistory.push(currentUrl);
      memory.visited.push(pathOf(currentUrl));
      rec.add('navigate', currentUrl);
    }
    mark('landed', page.url());

    for (rec.step = 1; rec.step <= o.maxSteps; rec.step++) {
      if (o.signal?.aborted) throw new Error('aborted');
      if (Date.now() > deadline) {
        status = 'timeout';
        rec.add('timeout', page.url(), { detail: `exceeded ${o.timeoutMs}ms` });
        break;
      }
      if (offsite) {
        if (++offsiteCount > 2) {
          status = 'abandoned';
          abandonI18n = { k: 'reason.offsite' };
          abandonReason = en_('reason.offsite');
          rec.add('abandon', lastAllowedUrl, { detail: abandonReason });
          break;
        }
        rec.add('back', lastAllowedUrl, { detail: `returned from ${offsite}` });
        offsite = undefined;
        await page
          .goto(lastAllowedUrl, { waitUntil: 'domcontentloaded', timeout: 10_000 })
          .catch(() => undefined);
      }
      // Every step races the journey deadline: a hung page or slow model cannot stall the session.
      const remaining = deadline - Date.now();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const outcome = await Promise.race([
        (async (): Promise<'continue' | 'break'> => {
          const obs = await observe(page);
          const p = pathOf(obs.url).split('?')[0] ?? '';
          if (!checkedPaths.has(p)) {
            checkedPaths.add(p);
            const pc = await checkPage(page);
            if (pc) pageChecks.push(pc);
          }
          const screenshot = await shot();
          const blocks = seenBlocks(obs, memory);
          const pageText = obs.blocks.map((b) => b.text).join('\n');
          rec.add('observe', obs.url, {
            detail: obs.title,
            screenshot,
            data: {
              headings: obs.headings.slice(0, 4),
              elements: obs.elements.length,
              modal: obs.modalOpen,
              scrollY: obs.scrollY,
              alerts: obs.alerts,
            },
          });
          const alertKey = obs.alerts.join('|');
          if (alertKey && alertKey !== lastAlerts)
            for (const a of obs.alerts) rec.add('form_error', obs.url, { detail: a });
          lastAlerts = alertKey;

          // Perception updates (what the buyer has now actually seen).
          const prices = pricesIn(blocks);
          if (prices.length) {
            memory.pricesSeen = [...new Set([...memory.pricesSeen, ...prices])];
            mark('pricing_found', obs.url, `saw ${[...new Set(prices)].join(', ')}`);
          }
          for (const b of blocks) {
            const tm = b.text.match(TRUST_RE)?.[0];
            if (tm && !memory.trustSeen.includes(tm)) memory.trustSeen.push(tm);
            const dm = b.text.match(DISTRUST_RE)?.[0];
            if (dm && !memory.distrustSeen.includes(dm)) memory.distrustSeen.push(dm);
          }
          const loginOnly = obs.elements.some((e) => e.kind === 'submit' && /sign ?in|log ?in/i.test(e.text));
          if (!loginOnly && obs.elements.some((e) => e.inputType === 'password' && !e.blocked))
            mark('signup_started', obs.url);
          if (
            checkoutRe.test(pathOf(obs.url)) ||
            obs.elements.some((e) => /card|cc-number/i.test(`${e.name} ${e.label}`))
          )
            mark('checkout_started', obs.url);

          if (
            (successRe.url && successRe.url.test(obs.url)) ||
            (successRe.text && successRe.text.test(pageText))
          ) {
            mark('goal_completed', obs.url);
            rec.add('goal_complete', obs.url, { screenshot });
            status = 'completed';
            return 'break';
          }

          const { action, meta } = await o.policy.decide({
            brief: o.brief,
            obs,
            memory,
            step: rec.step,
            maxSteps: o.maxSteps,
          });
          const target =
            'idx' in action && action.idx !== undefined
              ? obs.elements.find((e) => e.idx === action.idx)
              : undefined;
          rec.add('decision', obs.url, {
            target: describe(target),
            detail: action.reason,
            data: { action: action.kind, policy: o.policy.name, i18n: action.i18n, ...meta },
          });
          memory.actions.push({
            step: rec.step,
            kind: action.kind,
            target: describe(target),
            url: pathOf(obs.url),
          });

          if (action.kind === 'abandon') {
            status = 'abandoned';
            abandonReason = action.reason;
            abandonI18n = action.i18n;
            objection = action.objection;
            if (action.objection)
              rec.add('objection', obs.url, { target: action.objection, detail: action.reason });
            rec.add('abandon', obs.url, {
              detail: action.reason,
              screenshot,
              data: { objection: action.objection, i18n: action.i18n },
            });
            return 'break';
          }
          await execute(page, action, obs, rec, memory);
          if (action.kind === 'click' && target && KW.cta.test(target.text))
            mark('cta_discovered', obs.url, target.text);
          await page.waitForLoadState('domcontentloaded', { timeout: 5_000 }).catch(() => undefined);
          return 'continue';
        })(),
        new Promise<'deadline'>((r) => (timer = setTimeout(() => r('deadline'), Math.max(0, remaining)))),
      ]).finally(() => clearTimeout(timer));
      if (outcome === 'deadline') {
        status = 'timeout';
        rec.add('timeout', currentUrl, { detail: `exceeded ${o.timeoutMs}ms` });
        break;
      }
      if (outcome === 'break') break;
    }
    if (status === 'step_limit') {
      abandonI18n = { k: 'reason.patience', p: { n: o.maxSteps } };
      abandonReason = en_(abandonI18n.k, abandonI18n.p);
      rec.add('abandon', page.url(), { detail: abandonReason, screenshot: await shot() });
    }
  } catch (err) {
    if (err instanceof BudgetExceededError) {
      status = 'budget_exhausted';
      rec.add('error', page.url(), { detail: err.message });
    } else if (err instanceof ProviderError) {
      status = 'error';
      rec.add('provider_error', page.url(), { detail: err.message });
    } else {
      status = 'error';
      rec.add('error', page.url(), {
        detail: String(err instanceof Error ? err.message : err).slice(0, 400),
      });
    }
  } finally {
    rec.step = Math.min(rec.step, o.maxSteps);
    const keepTrace = o.trace === 'all' || (o.trace === 'failed' && status !== 'completed');
    if (o.trace !== 'off') {
      tracePath = keepTrace ? 'trace.zip' : undefined;
      await context.tracing
        .stop(keepTrace ? { path: join(o.outDir, 'trace.zip') } : undefined)
        .catch(() => undefined);
    }
    const cookies = await context.cookies().catch(() => []);
    privacy = {
      cookies: cookies.length,
      cookie_names: cookies.map((c) => c.name).slice(0, 20),
      insecure_cookies: cookies.filter((c) => !c.secure || !c.httpOnly).length,
      third_party_hosts: [...thirdParty].slice(0, 50),
    };
    await context.close().catch(() => undefined);
  }

  const usage = o.usage?.();
  return {
    run_id: o.runId,
    session_id: o.sessionId,
    variant: o.variant,
    persona_id: o.brief.persona.persona_id,
    segment: o.segment,
    archetype: o.archetype,
    policy: o.policy.name,
    status,
    goal_completed: status === 'completed',
    abandon_reason: status === 'completed' ? undefined : abandonReason,
    abandon_i18n: status === 'completed' ? undefined : abandonI18n,
    objection,
    steps: rec.step,
    elapsed_ms: Date.now() - rec.started,
    started_at: new Date(rec.started).toISOString(),
    final_url: currentUrl,
    url_history: urlHistory,
    milestones,
    events: rec.events,
    trace_path: tracePath,
    usage,
    page_checks: pageChecks,
    privacy,
    network: o.network,
  };
}

async function execute(
  page: Page,
  action: Action,
  obs: Observation,
  rec: Recorder,
  memory: ReturnType<typeof newMemory>,
): Promise<void> {
  const el = (idx: number) => page.locator(`[data-ba-idx="${idx}"]`).first();
  const path = pathOf(obs.url);
  switch (action.kind) {
    case 'click': {
      const info = obs.elements.find((e) => e.idx === action.idx);
      if (info?.expanded === false) memory.menuOpened[path] = true;
      rec.add('click', obs.url, { target: describe(info) });
      try {
        await el(action.idx).click({ timeout: 4_000 });
      } catch (err) {
        rec.add('error', obs.url, {
          target: describe(info),
          detail: `click failed: ${String(err instanceof Error ? err.message : err).split('\n')[0]}`,
        });
      }
      return;
    }
    case 'dismiss': {
      memory.modalsDismissed++;
      const info = action.idx !== undefined ? obs.elements.find((e) => e.idx === action.idx) : undefined;
      rec.add('dismiss_modal', obs.url, { target: describe(info), detail: obs.headings[0] });
      if (action.idx !== undefined)
        await el(action.idx)
          .click({ timeout: 4_000 })
          .catch(() => page.keyboard.press('Escape'));
      else await page.keyboard.press('Escape');
      return;
    }
    case 'scroll': {
      memory.scrolls[path] = (memory.scrolls[path] ?? 0) + 1;
      const y = await page.evaluate(
        `(() => { window.scrollBy(0, Math.round(innerHeight * 0.9)); return Math.round(scrollY); })()`,
      );
      memory.depth[path] = Math.max(memory.depth[path] ?? 0, Number(y));
      rec.add('scroll', obs.url, { data: { scrollY: y } });
      return;
    }
    case 'back': {
      memory.backs++;
      rec.add('back', obs.url);
      await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => undefined);
      return;
    }
    case 'fill_form': {
      for (const f of action.fields) {
        const info = obs.elements.find((e) => e.idx === f.idx);
        if (!info) continue;
        const isCard = /card|cc-number/i.test(`${info.name} ${info.label}`);
        // Guard: only a test card number printed by the site itself may ever be typed.
        const safeValue =
          isCard && !(info.hint ?? '').replace(/\D/g, '').includes(f.value.replace(/\D/g, '')) ? '' : f.value;
        const masked =
          info.inputType === 'password'
            ? '•'.repeat(Math.min(12, safeValue.length))
            : isCard
              ? '•••• test card'
              : safeValue;
        rec.add('fill', obs.url, {
          target: describe(info),
          detail: masked,
          data: {
            strongPassword:
              info.inputType === 'password'
                ? /[^A-Za-z0-9]/.test(safeValue) && safeValue.length >= 10
                : undefined,
          },
        });
        try {
          if (info.kind === 'select') await el(f.idx).selectOption({ label: safeValue });
          else if (info.kind === 'checkbox') await el(f.idx).check();
          else await el(f.idx).fill(safeValue);
        } catch (err) {
          rec.add('error', obs.url, {
            target: describe(info),
            detail: `fill failed: ${String(err instanceof Error ? err.message : err).split('\n')[0]}`,
          });
        }
      }
      const submit = obs.elements.find((e) => e.idx === action.submitIdx);
      rec.add('submit', obs.url, { target: describe(submit) });
      const before = obs.alerts.length;
      await el(action.submitIdx)
        .click({ timeout: 4_000 })
        .catch(() => undefined);
      await page.waitForLoadState('domcontentloaded', { timeout: 5_000 }).catch(() => undefined);
      const after = await page
        .locator('[role="alert"],.error')
        .count()
        .catch(() => 0);
      if (after > 0 && after >= before) memory.formErrors++;
      return;
    }
  }
}
