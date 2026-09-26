import { execFile } from 'node:child_process';
import { hashSeed, Rng } from '../core/rng.js';
import type { RunRecord } from '../core/types.js';
import { runArgus } from './argus.js';
import { Repo } from './repo.js';
import {
  check,
  clamp,
  panelScore,
  stars,
  type Check,
  type Emit,
  type Evidence,
  type PanelResult,
  type Reviewer,
} from './types.js';

export interface SecOptions {
  repo?: string;
  url?: string;
  participants: number;
  level: number;
  seed: number;
  emit: Emit;
  argus?: string;
  /** Journeys from the users panel (privacy evidence: cookies, third-party calls). */
  runs?: RunRecord[];
}

export const SECRET_PATTERNS: [string, RegExp][] = [
  ['anthropic_key', /sk-ant-[A-Za-z0-9_-]{20,}/],
  ['openai_key', /sk-(proj-)?[A-Za-z0-9]{32,}/],
  ['aws_key', /AKIA[0-9A-Z]{16}/],
  ['github_token', /gh[pousr]_[A-Za-z0-9]{36,}/],
  ['slack_token', /xox[baprs]-[A-Za-z0-9-]{10,}/],
  ['private_key', /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['generic_secret', /(api[_-]?key|secret|password|token)\s*[:=]\s*["'][A-Za-z0-9/+_-]{24,}["']/i],
];

/** A line that defines a detection rule (a regex literal), e.g. `const X = /pattern/;`. */
const RULE_LINE =
  /(^\s*|[=(,:!&|?]\s*)\/(?![/*\s])(?:\[(?:[^\]\\\n]|\\.)*\]|[^/\\\n[]|\\.)+\/[dgimsuy]*\s*(?:[,);.]|$)/;
/** An option like shell:true that only appears inside a string (documentation, advice). */
const QUOTED_OPT = /['"`][^'"`]*shell:\s*true/;
const COMMENT = /^\s*(\/\/|\/\*|\*|#)/;
/** Phrases that try to take over an AI agent that reads the file (prompt injection / tool poisoning). */
export const INJECTION =
  /ignore (all |any )?(the )?(previous|prior|above|earlier) (instructions|messages|rules)|disregard (the |all )?(system|previous|prior) (prompt|instructions)|you are now (a|an|in)\b|new (system )?instructions\s*:|do not (tell|inform|mention (this )?to|reveal (this )?to) the user|without (asking|telling|informing) the user|<\s*\/?\s*(system|important|instructions?)\s*>|before using this tool,? (you must|always|first)|exfiltrat\w*|(send|post|upload) (the |all |your )?(secrets?|tokens?|keys?|credentials|\.env|ssh)/i;
/** Zero-width, bidi-override and Unicode "tag" characters that hide text from humans but not from models. */
export const HIDDEN_UNICODE =
  /[\u200B-\u200F\u2060-\u2064\uFEFF\u202A-\u202E\u2066-\u2069]|\uDB40[\uDC00-\uDC7F]/;
const AGENT_FILES =
  /(^|\/)(SKILL|AGENTS|CLAUDE|GEMINI|CONVENTIONS)\.md$|\.cursorrules$|(^|\/)\.cursor\/|copilot-instructions\.md$|\.prompt(\.md)?$|(^|\/)prompts?\/|(^|\/)\.claude\/|(^|\/)skills?\/.+\.md$|\.mcp\.json$|\.(md|mdx|txt)$/i;

const mask = (s: string) => s.replace(/([A-Za-z0-9_-]{4})[A-Za-z0-9/+_-]{8,}/g, '$1••••');

function npmAudit(cwd: string): Promise<Record<string, number> | null> {
  return new Promise((resolve) =>
    execFile(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['audit', '--json', '--omit=dev'],
      { cwd, timeout: 60_000, shell: process.platform === 'win32', maxBuffer: 16 * 1024 * 1024 },
      (_err, stdout) => {
        try {
          const j = JSON.parse(stdout) as { metadata?: { vulnerabilities?: Record<string, number> } };
          resolve(j.metadata?.vulnerabilities ?? null);
        } catch {
          resolve(null);
        }
      },
    ),
  );
}

export async function runSecurity(o: SecOptions): Promise<PanelResult> {
  const t0 = Date.now();
  const P = 'security' as const;
  const checks: Check[] = [];
  const total = 11;
  let n = 0;
  const tick = (label: string) => o.emit({ type: 'progress', panel: P, done: ++n, total, label });
  const repo = o.repo ? new Repo(o.repo) : undefined;
  const threats: { id: string; status: 'found' | 'mitigated' | 'clear' | 'na'; evidence: number }[] = [];
  const threat = (id: string, found: number, mitigated: boolean, applicable = true) =>
    threats.push({
      id,
      status: !applicable ? 'na' : found ? (mitigated ? 'mitigated' : 'found') : 'clear',
      evidence: found,
    });

  if (repo) {
    // 1 Secrets committed to the repository (values are masked in the evidence).
    const text = repo.textFiles().filter((f) => !/package-lock|pnpm-lock|yarn\.lock/.test(f));
    const secrets: Evidence[] = [];
    for (const [name, re] of SECRET_PATTERNS)
      for (const e of repo.grep(re, text, 5))
        secrets.push({ ...e, excerpt: `${name}: ${mask(e.excerpt ?? '')}` });
    checks.push(check(P, 'sec.secrets', secrets.length ? 0 : 100, 5, secrets, { found: secrets.length }));
    threat('secrets_leak', secrets.length, false);
    tick('Secrets');

    // 2 Known-vulnerable dependencies (npm audit reads the lockfile; nothing is installed).
    if (o.level >= 2 && repo.files.includes('package-lock.json')) {
      o.emit({ type: 'log', panel: P, line: '$ npm audit --json --omit=dev' });
      const v = await npmAudit(o.repo as string);
      if (v) {
        const bad = (v.critical ?? 0) * 40 + (v.high ?? 0) * 20 + (v.moderate ?? 0) * 5 + (v.low ?? 0);
        checks.push(
          check(
            P,
            'sec.dependencies',
            100 - bad,
            3,
            [{ kind: 'command', ref: 'npm audit --omit=dev', excerpt: JSON.stringify(v) }],
            { critical: v.critical ?? 0, high: v.high ?? 0 },
          ),
        );
        threat('dependency_vulns', (v.critical ?? 0) + (v.high ?? 0), false);
      } else checks.push(check(P, 'sec.dependencies', null, 3, [], { critical: 0, high: 0 }));
    } else checks.push(check(P, 'sec.dependencies', null, 3, [], { critical: 0, high: 0 }));
    tick('Dependencies');

    // 3 Code that runs automatically on install.
    const pkg = repo.json<{ scripts?: Record<string, string> }>('package.json');
    const hooks = Object.entries(pkg?.scripts ?? {}).filter(([k]) =>
      /^(preinstall|install|postinstall)$/.test(k),
    );
    checks.push(
      check(
        P,
        'sec.install_scripts',
        hooks.length ? 40 : 100,
        2,
        hooks.map(([k, v]) => ({ kind: 'file', ref: 'package.json', excerpt: `${k}: ${v}` })),
        { hooks: hooks.length },
      ),
    );
    threat('supply_chain_install_scripts', hooks.length, false);
    tick('Install scripts');

    // 4 CI workflows: least privilege, no script injection, no untrusted PR code with secrets.
    const wfs = repo.has(/^\.github\/workflows\/.+\.ya?ml$/);
    const inj = wfs.flatMap((f) =>
      repo.grep(/run:.*\$\{\{\s*(github\.event\.|inputs\.|github\.head_ref)/, [f], 5),
    );
    const prt = wfs.flatMap((f) => repo.grep(/pull_request_target/, [f], 2));
    const noPerms = wfs.filter((f) => !/^\s*permissions\s*:/m.test(repo.text(f)));
    const unpinned = wfs.flatMap((f) => repo.grep(/uses:\s*[\w.-]+\/[\w.-]+@v\d/, [f], 20)).length;
    const ciScore = !wfs.length
      ? null
      : 100 - inj.length * 35 - prt.length * 25 - noPerms.length * 15 - Math.min(10, unpinned);
    checks.push(
      check(
        P,
        'sec.ci',
        ciScore,
        3,
        [
          ...inj,
          ...prt,
          ...noPerms.map((f) => ({ kind: 'file' as const, ref: f, excerpt: 'no permissions: block' })),
        ],
        { injection: inj.length, unpinned },
      ),
    );
    threat('ci_script_injection', inj.length + prt.length, false, wfs.length > 0);
    tick('CI');

    // 5 Prompt injection / hidden instructions in files AI agents read (skills, AGENTS.md, docs, prompts).
    const agentFiles = repo.files.filter((f) => AGENT_FILES.test(f) && !/node_modules|CHANGELOG/.test(f));
    const injHits = repo.grep(INJECTION, agentFiles, 10);
    const hidden = repo
      .grep(HIDDEN_UNICODE, agentFiles, 10)
      .map((e) => ({ ...e, excerpt: `hidden unicode: ${JSON.stringify(e.excerpt).slice(0, 80)}` }));
    const comments = agentFiles
      .filter((f) => /\.(md|mdx)$/i.test(f))
      .flatMap((f) =>
        repo.grep(
          /<!--[^>]*\b(assistant|agent|ai|model|llm|claude|gpt)\b[^>]*(must|should|always|never|ignore|do not)/i,
          [f],
          3,
        ),
      );
    const found5 = injHits.length + hidden.length + comments.length;
    checks.push(
      check(P, 'sec.agent_instructions', 100 - found5 * 25, 5, [...injHits, ...hidden, ...comments], {
        files: agentFiles.length,
        found: found5,
      }),
    );
    threat('prompt_injection_files', found5, false, agentFiles.length > 0);
    tick('Agent instructions');

    // 6 MCP servers: tools with dangerous capabilities and their guards; tool-description poisoning.
    // Detection rules (regex literals) and translated strings are data, not behaviour: a scanner
    // must not flag its own patterns, so those lines are left out of code checks.
    const src = repo
      .textFiles(/\.(ts|js|mjs|cjs|py)$/)
      .filter((f) => !/(\.test\.|\.spec\.|(^|\/)tests?\/|(^|\/)i18n\/)/.test(f));
    const code = (f: string) =>
      repo
        .text(f)
        .split('\n')
        .filter((l) => !RULE_LINE.test(l) && !COMMENT.test(l))
        .join('\n');
    const codeGrep = (re: RegExp, files: string[], max: number) =>
      repo
        .grep(re, files, max * 3)
        .filter(
          (e) =>
            !RULE_LINE.test(e.excerpt ?? '') &&
            !QUOTED_OPT.test(e.excerpt ?? '') &&
            !COMMENT.test(e.excerpt ?? ''),
        )
        .slice(0, max);
    const mcpFiles = src.filter((f) =>
      /@modelcontextprotocol\/sdk|registerTool\(|server\.tool\(|FastMCP|mcp\.server/.test(code(f)),
    );
    if (mcpFiles.length) {
      const tools = mcpFiles.flatMap((f) => codeGrep(/registerTool\(|server\.tool\(|@mcp\.tool/, [f], 40));
      const danger = mcpFiles.flatMap((f) =>
        codeGrep(/child_process|\bexecSync?\(|\bspawn\(|writeFile|unlink|rmSync|eval\(/, [f], 10),
      );
      const guards = mcpFiles.flatMap((f) =>
        codeGrep(/localOnly|allowlist|assertTarget|ALLOW_REMOTE|z\.(string|number|object)\(/, [f], 10),
      );
      const poison = mcpFiles.flatMap((f) => codeGrep(INJECTION, [f], 5));
      const s6 = 100 - danger.length * 20 - poison.length * 40 + Math.min(20, guards.length * 3);
      checks.push(
        check(P, 'sec.mcp', s6, 4, [...danger, ...poison, ...guards.slice(0, 3), ...tools.slice(0, 2)], {
          tools: tools.length,
          dangerous: danger.length,
          guards: guards.length,
        }),
      );
      threat('mcp_tool_capabilities', danger.length, guards.length > 0);
      threat('mcp_tool_poisoning', poison.length, false);
    } else {
      checks.push(check(P, 'sec.mcp', null, 4, [], { tools: 0, dangerous: 0, guards: 0 }));
      threat('mcp_tool_capabilities', 0, false, false);
      threat('mcp_tool_poisoning', 0, false, false);
    }
    tick('MCP');

    // 7 Agent permissions: broad auto-approval in agent configs or docs.
    const cfg = repo.files.filter((f) =>
      /(^|\/)\.claude\/settings.*\.json$|(^|\/)\.cursor\/|\.mcp\.json$/.test(f),
    );
    const broad = [
      ...repo.grep(
        /"Bash(\(\*\))?"|"allow"\s*:\s*\[\s*"\*"|dangerouslySkipPermissions|"autoApprove"\s*:\s*true/,
        cfg,
        5,
      ),
      ...repo.grep(
        /--dangerously-skip-permissions|--yolo\b|auto-?approve all/i,
        repo.textFiles(/\.(md|sh|json|ya?ml)$/),
        5,
      ),
      ...repo.grep(
        /curl [^|\n]*\|\s*(sudo\s+)?(ba)?sh|iwr [^|\n]*\|\s*iex/i,
        repo.textFiles(/\.(md|sh)$/),
        5,
      ),
    ];
    checks.push(
      check(P, 'sec.agent_permissions', 100 - broad.length * 30, 3, broad, { found: broad.length }),
    );
    threat('agent_overbroad_permissions', broad.length, false);
    tick('Agent permissions');

    // 8 Untrusted web content → LLM: is the model's output validated before it acts?
    const llmFiles = src.filter((f) =>
      /api\.anthropic\.com|\/v1\/messages|chat\/completions|openai|generateContent/.test(code(f)),
    );
    const webIn = llmFiles.filter((f) => /innerText|page\.|html|fetch\(|observe|scrape/i.test(code(f)));
    const validated = src.filter(
      (f) =>
        /safeParse|z\.object|parseAction|schema\.parse/.test(repo.text(f)) && /llm|model|provider/i.test(f),
    );
    if (llmFiles.length) {
      const s8 = webIn.length === 0 ? 90 : validated.length ? 80 : 30;
      checks.push(
        check(
          P,
          'sec.llm_input',
          s8,
          4,
          [
            ...llmFiles
              .slice(0, 2)
              .map((f) => ({ kind: 'file' as const, ref: f, excerpt: 'calls an LLM API' })),
            ...validated
              .slice(0, 2)
              .map((f) => ({ kind: 'file' as const, ref: f, excerpt: 'model output schema-validated' })),
          ],
          { models: llmFiles.length, validated: validated.length },
        ),
      );
      threat('untrusted_web_to_llm', webIn.length, validated.length > 0);
    } else {
      checks.push(check(P, 'sec.llm_input', null, 4, [], { models: 0, validated: 0 }));
      threat('untrusted_web_to_llm', 0, false, false);
    }
    tick('LLM input');

    // 9 Shell execution in shipped code.
    const shell = src.flatMap((f) => codeGrep(/shell:\s*true|\bexecSync?\(\s*[`'"]/, [f], 5)).slice(0, 12);
    checks.push(check(P, 'sec.shell', 100 - shell.length * 8, 2, shell, { found: shell.length }));
    tick('Shell');
  }

  // 10 Web surface via Argus (public URLs only).
  const local = !o.url || /localhost|127\.0\.0\.1|\[::1\]/.test(o.url);
  if (o.url && o.argus && !local && o.level >= 2) {
    o.emit({ type: 'log', panel: P, line: `argus audit ${o.url}` });
    const a = await runArgus(o.argus, o.url);
    if (a.ok) {
      // Argus severities: critical · review · informational (plus classic high/medium/low).
      const w: Record<string, number> = {
        critical: 30,
        high: 15,
        review: 6,
        medium: 6,
        low: 2,
        informational: 1,
        info: 1,
      };
      const pen = a.findings.reduce((s, f) => s + (w[f.severity] ?? 3), 0);
      checks.push(
        check(
          P,
          'sec.web',
          100 - pen,
          3,
          a.findings.slice(0, 8).map((f) => ({
            kind: 'url' as const,
            ref: `argus:${f.id}`,
            excerpt: `${f.severity} · ${f.title}`,
          })),
          { findings: a.findings.length },
        ),
      );
      threat(
        'web_surface',
        a.findings.filter((f) => /critical|high|medium|review/.test(f.severity)).length,
        false,
      );
    } else {
      o.emit({ type: 'log', panel: P, line: `argus skipped: ${a.error}` });
      checks.push(check(P, 'sec.web', null, 3, [], { findings: 0 }));
    }
  } else checks.push(check(P, 'sec.web', null, 3, [], { findings: 0 }));
  tick('Web (Argus)');

  // 11 Privacy: cookies and third-party calls observed during the buyers' journeys.
  const runs = o.runs ?? [];
  if (runs.length) {
    const hosts = new Set(runs.flatMap((r) => r.privacy?.third_party_hosts ?? []));
    const cookies = Math.max(0, ...runs.map((r) => r.privacy?.cookies ?? 0));
    const insecure = Math.max(0, ...runs.map((r) => r.privacy?.insecure_cookies ?? 0));
    checks.push(
      check(
        P,
        'sec.privacy',
        100 - hosts.size * 12 - insecure * 10 - Math.max(0, cookies - 2) * 5,
        3,
        [
          ...[...hosts].slice(0, 6).map((h) => ({
            kind: 'url' as const,
            ref: h,
            excerpt: 'third-party call attempted (blocked by Buyer Arena)',
          })),
          {
            kind: 'metric',
            ref: 'cookies',
            excerpt: `${cookies} cookies, ${insecure} without Secure/HttpOnly`,
          },
        ],
        { hosts: hosts.size, cookies },
      ),
    );
    threat('tracking_third_parties', hosts.size, false);
  } else checks.push(check(P, 'sec.privacy', null, 3, [], { hosts: 0, cookies: 0 }));
  tick('Privacy');

  // A weighted mean dilutes a single critical hole, so open critical/high threats cap the score:
  // one critical finding can never look "fine" because everything else is clean.
  const open = (ids: string[]) => threats.filter((t) => t.status === 'found' && ids.includes(t.id)).length;
  const CRITICAL = [
    'secrets_leak',
    'prompt_injection_files',
    'mcp_tool_poisoning',
    'ci_script_injection',
    'agent_overbroad_permissions',
    'dependency_vulns',
  ];
  const HIGH = ['supply_chain_install_scripts', 'mcp_tool_capabilities', 'untrusted_web_to_llm'];
  const cap = (s: number | null, crit: number, high: number) =>
    s === null ? null : Math.min(s, crit >= 2 ? 35 : crit === 1 ? 55 : high ? 70 : 100);
  const score = cap(panelScore(checks), open(CRITICAL), open(HIGH));
  const W: Record<string, Record<string, number>> = {
    appsec: { 'sec.secrets': 5, 'sec.shell': 3, 'sec.web': 4, 'sec.ci': 3, 'sec.dependencies': 3 },
    supply_chain: { 'sec.dependencies': 5, 'sec.install_scripts': 5, 'sec.ci': 4, 'sec.secrets': 3 },
    ai_agent: {
      'sec.agent_instructions': 5,
      'sec.mcp': 5,
      'sec.llm_input': 5,
      'sec.agent_permissions': 4,
      'sec.shell': 2,
    },
    privacy_legal: { 'sec.privacy': 5, 'sec.web': 3, 'sec.secrets': 2 },
  };
  const reviewers: Reviewer[] = [];
  const kinds = Object.keys(W);
  for (let i = 0; i < Math.max(4, o.participants); i++) {
    const kind = kinds[i % kinds.length] as string;
    const rng = new Rng(hashSeed(o.seed, 'sec', i));
    const w = Object.fromEntries(
      Object.entries(W[kind] as Record<string, number>).map(([k, v]) => [k, v * (0.7 + rng.next() * 0.6)]),
    );
    const ran = checks.filter((x) => x.score !== null && w[x.id] !== undefined);
    const tw = ran.reduce((s, x) => s + (w[x.id] as number), 0);
    reviewers.push({
      id: `sec-${i + 1}`,
      archetype: kind,
      score: tw ? Math.round(ran.reduce((s, x) => s + (x.score as number) * (w[x.id] as number), 0) / tw) : 0,
    });
  }
  const risk = score === null ? null : clamp(100 - score);
  const agentChecks = checks.filter((c) =>
    ['sec.agent_instructions', 'sec.mcp', 'sec.llm_input', 'sec.agent_permissions'].includes(c.id),
  );
  const AGENT_CRIT = ['prompt_injection_files', 'mcp_tool_poisoning', 'agent_overbroad_permissions'];
  const agentScore = cap(
    panelScore(agentChecks),
    open(AGENT_CRIT),
    open(['mcp_tool_capabilities', 'untrusted_web_to_llm']),
  );
  return {
    id: P,
    score,
    stars: stars(score),
    share: 0,
    reviewers,
    checks,
    duration_ms: Date.now() - t0,
    extra: {
      risk,
      criticity:
        risk === null ? 'na' : risk < 20 ? 'low' : risk < 40 ? 'moderate' : risk < 60 ? 'high' : 'critical',
      agent_risk: agentScore === null ? null : clamp(100 - agentScore),
      threats,
      argus: Boolean(o.argus),
    },
  };
}
