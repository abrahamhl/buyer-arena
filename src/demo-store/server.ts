import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * Tallybird — a deliberately imperfect demo SaaS used to demonstrate Buyer Arena.
 *
 * BASELINE carries realistic friction:
 *   - pricing only linked from the footer ("Plans & billing"), not from nav or mobile menu
 *   - vague hero CTA ("Learn more"), no sign-up in the header
 *   - password rules revealed only after a failed submit
 *   - required phone + company fields, card required to start a free trial
 *   - no refund/guarantee information; a broken script throws on the pricing page
 *
 * CANDIDATE fixes those, but introduces one plausible regression:
 *   - a newsletter modal on first visit; on phones its artwork pushes the close button off-screen
 *
 * Nothing here knows about Buyer Arena; it is an ordinary website.
 */
export type DemoVariant = 'baseline' | 'candidate';

export interface DemoStore {
  url: string;
  variant: DemoVariant;
  close(): Promise<void>;
}

const PLANS = [
  { id: 'starter', name: 'Starter', price: 19, blurb: 'For freelancers. 20 invoices / month.' },
  { id: 'team', name: 'Team', price: 49, blurb: 'For small agencies. Unlimited invoices, 5 seats.' },
  { id: 'business', name: 'Business', price: null, blurb: 'For finance teams. SSO, audit log.' },
];

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function layout(v: DemoVariant, title: string, body: string, opts: { modal?: boolean; script?: string } = {}): string {
  const nav =
    v === 'baseline'
      ? `<a href="/features">Product</a><a href="/customers">Customers</a><a href="/resources">Resources</a><a href="/login">Sign in</a>`
      : `<a href="/features">Features</a><a href="/pricing">Pricing</a><a href="/customers">Customers</a><a href="/login">Sign in</a><a class="btn primary" href="/signup">Start free trial</a>`;
  const mobileMenu =
    v === 'baseline'
      ? `<a href="/features">Product</a><a href="/customers">Customers</a><a href="/resources">Resources</a><a href="/login">Sign in</a>`
      : `<a href="/pricing">Pricing</a><a href="/features">Features</a><a href="/signup">Start free trial</a><a href="/login">Sign in</a>`;
  const modal = opts.modal
    ? `<div class="overlay" id="nl"><div role="dialog" aria-modal="true" aria-labelledby="nlh" class="dialog">
        <h2 id="nlh">Get 10% off your first year</h2><div class="art" aria-hidden="true"></div><p>Join 20,000 finance nerds. One email a month.</p>
        <input type="email" placeholder="you@company.com" aria-label="Newsletter email"><button class="btn primary" type="button">Subscribe</button>
        <button type="button" class="close" aria-label="Close" onclick="document.getElementById('nl').remove();document.cookie='nl=1;path=/'">No thanks</button></div></div>`
    : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Tallybird</title><style>
*{box-sizing:border-box}body{margin:0;font:16px/1.5 system-ui,sans-serif;color:#1c2330;background:#fbfaf7}
header{display:flex;align-items:center;gap:24px;padding:14px 32px;border-bottom:1px solid #e6e2da;background:#fff}
header .logo{font-weight:800;color:#1c2330;text-decoration:none;margin-right:auto}header nav{display:flex;gap:20px;align-items:center}
header nav a{color:#46505f;text-decoration:none}.menu-btn{display:none;background:none;border:1px solid #ccc;border-radius:6px;padding:6px 10px}
#mobile-menu{display:none;flex-direction:column;padding:8px 20px;background:#fff;border-bottom:1px solid #eee}#mobile-menu.open{display:flex}#mobile-menu a{padding:10px 0;color:#1c2330}
main{max-width:980px;margin:0 auto;padding:48px 24px}h1{font-size:40px;line-height:1.1;margin:0 0 16px}.lead{font-size:19px;color:#4a5363;max-width:640px}
.btn{display:inline-block;padding:11px 18px;border-radius:8px;border:1px solid #c9c3b8;color:#1c2330;text-decoration:none;background:#fff;cursor:pointer;font:inherit}
.btn.primary{background:#2d5bff;color:#fff;border-color:#2d5bff}.muted{color:#7a8290;font-size:14px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px;margin:28px 0}.card{background:#fff;border:1px solid #e6e2da;border-radius:12px;padding:22px}
.price{font-size:30px;font-weight:800}form{display:grid;gap:14px;max-width:420px}label{display:grid;gap:4px;font-weight:600;font-size:14px}
input,select{padding:10px;border:1px solid #c9c3b8;border-radius:8px;font:inherit}.hint{font-weight:400;color:#6a7280;font-size:13px}
.error{background:#fff0f0;border:1px solid #f3b8b8;color:#a01919;padding:10px 12px;border-radius:8px}.trust{display:flex;gap:18px;flex-wrap:wrap;color:#1e7a45;font-weight:600;margin:10px 0 0}
.spacer{height:1400px}footer{border-top:1px solid #e6e2da;padding:28px 32px;display:flex;gap:22px;flex-wrap:wrap;font-size:14px}footer a{color:#7a8290}
.overlay{position:fixed;inset:0;background:rgba(20,24,32,.55);display:grid;place-items:center;z-index:10}.dialog{background:#fff;padding:28px;border-radius:14px;max-width:380px;display:grid;gap:10px}
.close{background:none;border:none;color:#6a7280;text-decoration:underline;cursor:pointer;font:inherit}.art{height:220px;border-radius:10px;background:linear-gradient(135deg,#dfe6ff,#f4e9ff)}
@media(max-width:720px){header nav{display:none}.menu-btn{display:block}h1{font-size:30px}main{padding:28px 18px}.overlay{place-items:start center;overflow:auto}.dialog{margin:16px}.art{height:80vh}}
</style></head><body>
<header><a class="logo" href="/">▲ Tallybird</a><nav aria-label="Main">${nav}</nav>
<button class="menu-btn" aria-label="Menu" aria-expanded="false" onclick="var m=document.getElementById('mobile-menu');m.classList.toggle('open');this.setAttribute('aria-expanded',m.classList.contains('open'))">☰ Menu</button></header>
<div id="mobile-menu">${mobileMenu}</div>
<main>${body}</main>
<footer><a href="/pricing">${v === 'baseline' ? 'Plans &amp; billing' : 'Pricing'}</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/customers">Customers</a><span class="muted">© Tallybird demo — fictional product</span></footer>
${modal}${opts.script ? `<script>${opts.script}</script>` : ''}</body></html>`;
}

function page(v: DemoVariant, path: string, q: URLSearchParams, form: URLSearchParams | null, cookie: string): { status: number; html: string } {
  const planOptions = (selected: string) =>
    PLANS.filter((p) => p.price !== null)
      .map((p) => `<option value="${p.id}"${p.id === selected ? ' selected' : ''}>${p.name} — €${p.price}/month</option>`)
      .join('');

  switch (path) {
    case '/': {
      const hero =
        v === 'baseline'
          ? `<h1>The operating layer for modern finance workflows</h1>
             <p class="lead">Tallybird unifies receivables orchestration, reconciliation primitives and revenue intelligence in a single composable platform.</p>
             <p><a class="btn" href="/features">Learn more</a></p>`
          : `<h1>Send invoices in 2 minutes. Get paid faster.</h1>
             <p class="lead">Tallybird creates, sends and chases invoices for freelancers and small agencies.</p>
             <p><a class="btn primary" href="/signup">Start free trial</a> <a class="btn" href="/pricing">See pricing</a></p>
             <p class="muted">From €19/month · No card required · Cancel anytime</p>`;
      const body = `${hero}<div class="grid">
        <div class="card"><h3>Automatic reminders</h3><p>Stop chasing late payers by hand.</p></div>
        <div class="card"><h3>Branded invoices</h3><p>Look professional from day one.</p></div>
        <div class="card"><h3>Accountant export</h3><p>One-click export for your bookkeeper.</p></div></div><div class="spacer"></div>`;
      return { status: 200, html: layout(v, 'Home', body, { modal: v === 'candidate' && !/nl=1/.test(cookie) }) };
    }
    case '/features': {
      const body =
        v === 'baseline'
          ? `<h1>Platform capabilities</h1><p class="lead">Composable receivables, automated dunning, multi-entity ledgers and an extensible API.</p>
             <div class="grid"><div class="card"><h3>Receivables engine</h3><p>Event-driven invoice lifecycle.</p></div>
             <div class="card"><h3>Dunning workflows</h3><p>Configurable escalation policies.</p></div>
             <div class="card"><h3>Ledger sync</h3><p>Bi-directional reconciliation.</p></div></div>
             <p><a class="btn" href="/demo">Request a demo</a></p><div class="spacer"></div>
             <p class="muted">Ready? <a href="/signup">Create an account</a></p>`
          : `<h1>Everything you need to get paid</h1><div class="grid"><div class="card"><h3>Reminders</h3><p>Automatic, polite, effective.</p></div>
             <div class="card"><h3>Templates</h3><p>Your logo, your colours.</p></div><div class="card"><h3>Exports</h3><p>CSV and accounting software.</p></div></div>
             <p><a class="btn primary" href="/signup">Start free trial</a> <a class="btn" href="/pricing">See pricing</a></p>`;
      return { status: 200, html: layout(v, 'Features', body) };
    }
    case '/pricing': {
      const cards = PLANS.map(
        (p) => `<div class="card"><h3>${p.name}</h3><div class="price">${p.price === null ? 'Contact sales' : `€${p.price}<span class="muted">/month</span>`}</div>
          <p>${p.blurb}</p>${p.price === null ? `<a class="btn" href="/demo">Talk to sales</a>` : `<a class="btn${v === 'candidate' ? ' primary' : ''}" href="/signup?plan=${p.id}">${v === 'baseline' ? 'Select' : `Start free trial`}</a>`}</div>`,
      ).join('');
      const trust =
        v === 'candidate'
          ? `<div class="trust"><span>✓ 30-day money-back guarantee</span><span>✓ Cancel anytime</span><span>✓ No card required for the trial</span></div>`
          : '';
      const script =
        v === 'baseline'
          ? `var cfg=window.__pricingConfig;document.querySelectorAll('.price').forEach(function(el){el.dataset.c=cfg.currency.code});`
          : undefined;
      return { status: 200, html: layout(v, 'Pricing', `<h1>${v === 'baseline' ? 'Plans &amp; billing' : 'Simple pricing'}</h1>${trust}<div class="grid">${cards}</div>`, { script }) };
    }
    case '/signup': {
      const plan = form?.get('plan') ?? q.get('plan') ?? 'starter';
      const errors: string[] = [];
      if (form) {
        const email = form.get('email') ?? '';
        const pw = form.get('password') ?? '';
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push('Please enter a valid email address.');
        if (pw.length < 10 || !/\d/.test(pw) || !/[^A-Za-z0-9]/.test(pw)) errors.push('Password must be at least 10 characters and include a number and a symbol.');
        if (v === 'baseline' && !(form.get('company') ?? '').trim()) errors.push('Company name is required.');
        if (v === 'baseline' && !(form.get('phone') ?? '').trim()) errors.push('Phone number is required.');
        if (errors.length === 0) {
          return { status: 303, html: v === 'baseline' ? `/checkout?plan=${encodeURIComponent(plan)}` : `/success?plan=${encodeURIComponent(plan)}` };
        }
      }
      const errorBox = errors.length ? `<div class="error" role="alert">${errors.map(esc).join('<br>')}</div>` : '';
      const fields =
        v === 'baseline'
          ? `<label>Work email<input name="email" type="email" required></label>
             <label>Password<input name="password" type="password" required></label>
             <label>Company name *<input name="company" required></label>
             <label>Phone number *<input name="phone" type="tel" required></label>
             <label>Plan<select name="plan">${planOptions(plan)}</select></label>
             <button class="btn primary" type="submit">Continue</button>`
          : `<label>Email<input name="email" type="email" required></label>
             <label>Password<span class="hint" id="pwhint">At least 10 characters, including a number and a symbol.</span><input name="password" type="password" aria-describedby="pwhint" required></label>
             <label>Company <span class="hint">(optional)</span><input name="company"></label>
             <label>Plan<select name="plan">${planOptions(plan)}</select></label>
             <button class="btn primary" type="submit">Start my free trial</button>
             <p class="muted">No card required · Cancel anytime</p>`;
      return {
        status: errors.length ? 422 : 200,
        html: layout(v, 'Sign up', `<h1>${v === 'baseline' ? 'Create your account' : 'Start your 14-day free trial'}</h1>${errorBox}<form method="post" action="/signup" novalidate>${fields}</form>`),
      };
    }
    case '/checkout': {
      const plan = form?.get('plan') ?? q.get('plan') ?? 'starter';
      if (form) {
        const card = (form.get('card') ?? '').replace(/\s/g, '');
        if (card === '4242424242424242') return { status: 303, html: `/success?plan=${encodeURIComponent(plan)}` };
        return { status: 422, html: layout(v, 'Payment', `<h1>Payment details</h1><div class="error" role="alert">Card was declined.</div><p><a href="/checkout?plan=${esc(plan)}">Try again</a></p>`) };
      }
      return {
        status: 200,
        html: layout(
          v,
          'Payment',
          `<h1>Payment details</h1><p class="lead">Your 14-day trial starts today. We'll charge your card when it ends.</p>
           <form method="post" action="/checkout" novalidate><input type="hidden" name="plan" value="${esc(plan)}">
           <label>Card number<span class="hint">Demo store: use test card 4242 4242 4242 4242</span><input name="card" inputmode="numeric" autocomplete="cc-number" required></label>
           <label>Expiry<input name="exp" placeholder="MM/YY" required></label><label>CVC<input name="cvc" required></label>
           <button class="btn primary" type="submit">Start trial</button></form>`,
        ),
      };
    }
    case '/success':
      return { status: 200, html: layout(v, 'Welcome', `<h1>You're all set 🎉</h1><p class="lead">Your trial is active. Send your first invoice in under two minutes.</p>`) };
    case '/demo': {
      if (form) return { status: 200, html: layout(v, 'Demo requested', `<h1>Thanks!</h1><p>Our sales team will contact you within 3 business days.</p>`) };
      return {
        status: 200,
        html: layout(v, 'Request a demo', `<h1>Talk to our sales team</h1><form method="post" action="/demo" novalidate>
          <label>Work email<input name="email" type="email" required></label><label>Phone number *<input name="phone" type="tel" required></label>
          <label>Company size<select name="size"><option>1-10</option><option>11-50</option><option>51+</option></select></label>
          <button class="btn" type="submit">Request demo</button></form>`),
      };
    }
    case '/customers':
      return { status: 200, html: layout(v, 'Customers', `<h1>Customers</h1><p class="lead">Studios, freelancers and agencies across Europe use Tallybird.</p><div class="grid"><div class="card">“We stopped chasing invoices.” — a design studio</div><div class="card">“Setup took an afternoon.” — a consultancy</div></div>`) };
    case '/resources':
      return { status: 200, html: layout(v, 'Resources', `<h1>Resources</h1><ul><li><a href="/resources/guide">Guide: invoicing basics</a></li><li><a href="/resources/api">API reference</a></li></ul>`) };
    case '/privacy':
    case '/terms':
      return {
        status: 200,
        html: layout(v, path.slice(1), `<h1>${path === '/terms' ? 'Terms of service' : 'Privacy policy'}</h1><p>This fictional demo store stores nothing. ${v === 'candidate' && path === '/terms' ? 'Paid plans include a 30-day money-back guarantee.' : 'Fees are non-refundable except where required by law.'}</p>`),
      };
    case '/login':
      return { status: 200, html: layout(v, 'Sign in', `<h1>Sign in</h1><form method="post" action="/login" novalidate><label>Email<input name="email" type="email"></label><label>Password<input name="password" type="password"></label><button class="btn" type="submit">Sign in</button></form><p class="muted">New here? <a href="/signup">Create an account</a></p>`) };
    default:
      return { status: 404, html: layout(v, 'Not found', `<h1>Page not found</h1><p><a href="/">Go home</a></p>`) };
  }
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > 64_000) break;
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function createDemoHandler(variant: DemoVariant) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const form = req.method === 'POST' ? new URLSearchParams(await readBody(req)) : null;
    if (url.pathname === '/login' && form) {
      res.writeHead(303, { location: '/login' }).end();
      return;
    }
    const out = page(variant, url.pathname, url.searchParams, form, req.headers.cookie ?? '');
    if (out.status === 303) {
      res.writeHead(303, { location: out.html }).end();
      return;
    }
    res.writeHead(out.status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(out.html);
  };
}

/** Start a demo store bound to 127.0.0.1 only (never exposed publicly). Port 0 = ephemeral. */
export async function startDemoStore(variant: DemoVariant, port = 0): Promise<DemoStore> {
  const server: Server = createServer((req, res) => {
    createDemoHandler(variant)(req, res).catch(() => res.writeHead(500).end('error'));
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });
  const addr = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${addr.port}`,
    variant,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}
