import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EvidenceEnvelopeV1Schema } from '../../src/evidence/envelope.js';
import { garak, severityFromAsr } from '../../src/integrations/adapters/garak.js';
import { gitleaks } from '../../src/integrations/adapters/gitleaks.js';
import { nuclei, nucleiGuard, NUCLEI_FORBIDDEN_FLAGS } from '../../src/integrations/adapters/nuclei.js';
import { deepeval, inspectAi, lmEval, otel, pyrit } from '../../src/integrations/adapters/priority-b.js';
import { promptfoo } from '../../src/integrations/adapters/promptfoo.js';
import { trivy, trivyVersionProblem } from '../../src/integrations/adapters/trivy.js';
import { findExecutable, scrubbedEnv } from '../../src/integrations/exec.js';
import { getIntegration, INTEGRATIONS, listIntegrations } from '../../src/integrations/registry.js';
import { AdapterInputError, parseJsonOrLines } from '../../src/integrations/sdk.js';
import { parseOpenCodeEvents } from '../../src/providers/opencode.js';

const fx = (f: string) => readFileSync(join(__dirname, '..', 'fixtures', 'integrations', f), 'utf8');
const ctx = { target: { repo: 'demo' }, timestamp: '2026-09-25T00:00:00.000Z' };
const allValid = (list: unknown[]) => list.forEach((e) => EvidenceEnvelopeV1Schema.parse(e));
const text = (list: unknown[]) => JSON.stringify(list);

describe('integration registry and SDK', () => {
  it('every integration declares the full manifest contract', () => {
    const ids = new Set<string>();
    for (const i of INTEGRATIONS) {
      const m = i.manifest;
      expect(ids.has(m.id)).toBe(false);
      ids.add(m.id);
      expect(m.upstream.url).toMatch(/^https:\/\/github\.com\//);
      expect(m.upstream.license).toMatch(/MIT|Apache-2\.0/);
      expect(['none', 'low', 'medium', 'high']).toContain(m.execution_risk);
      expect(m.modes.length).toBeGreaterThan(0);
      expect(typeof i.detect).toBe('function');
      expect(typeof i.normalize).toBe('function');
    }
    expect(() => getIntegration('nope')).toThrow(/unknown integration/);
  });

  it('listing works without detection and without network', async () => {
    const rows = await listIntegrations({ detect: false });
    expect(rows.map((r) => r.id)).toEqual(
      expect.arrayContaining(['promptfoo', 'garak', 'gitleaks', 'trivy', 'nuclei', 'browser-use']),
    );
  });

  it('missing executables are reported, not thrown', async () => {
    expect(findExecutable(['definitely-not-a-real-binary-ba'])).toBeUndefined();
    const saved = process.env.PATH;
    process.env.PATH = '/nonexistent';
    try {
      expect((await gitleaks.detect()).installed).toBe(false);
      await expect(gitleaks.run!({ outDir: '/tmp', repo: '.' })).rejects.toThrow(/not installed/);
    } finally {
      process.env.PATH = saved;
    }
  });

  it('third-party tools never inherit Buyer Arena credentials', () => {
    process.env.ANTHROPIC_API_KEY = 'should-not-leak';
    process.env.GITHUB_TOKEN = 'nor-this';
    try {
      const env = scrubbedEnv();
      expect(env.ANTHROPIC_API_KEY).toBeUndefined();
      expect(env.GITHUB_TOKEN).toBeUndefined();
      expect(env.PATH).toBe(process.env.PATH);
    } finally {
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.GITHUB_TOKEN;
    }
  });

  it('JSON-lines parsing tolerates partial output but rejects garbage', () => {
    expect(parseJsonOrLines('x', '{"a":1}\nbroken\n{"b":2}')).toEqual({
      records: [{ a: 1 }, { b: 2 }],
      bad: 1,
    });
    expect(() => parseJsonOrLines('x', 'hello world')).toThrow(AdapterInputError);
  });
});

describe('Promptfoo bridge', () => {
  const ev = promptfoo.normalize(fx('promptfoo-results.json'), ctx);
  it('maps pass / fail / error and red-team severity', () => {
    allValid(ev);
    expect(ev).toHaveLength(3);
    const [ok, redteam, err] = ev;
    expect(ok).toMatchObject({
      passed: true,
      severity: 'info',
      finding_type: 'llm.eval.contains',
      source_version: '0.123.1',
    });
    expect(ok?.usage).toMatchObject({ input_tokens: 12, output_tokens: 5, estimated_cost_usd: 0.00002 });
    expect(redteam).toMatchObject({
      passed: false,
      severity: 'critical',
      finding_type: 'llm.redteam.harmful:hate',
    });
    expect(redteam?.categories).toContain('security');
    expect(err).toMatchObject({ passed: null, severity: 'low' });
    expect(ok?.target.model).toBe('openai:gpt-4.1-mini');
  });
  it('never copies prompts, vars or model outputs', () => {
    expect(text(ev)).not.toMatch(/CUSTOMER-SECRET-DATA|ignore previous instructions/);
  });
  it('is idempotent (content-addressed ids) and rejects malformed input', () => {
    expect(promptfoo.normalize(fx('promptfoo-results.json'), ctx).map((e) => e.id)).toEqual(
      ev.map((e) => e.id),
    );
    expect(() => promptfoo.normalize('not json', ctx)).toThrow(AdapterInputError);
    expect(() => promptfoo.normalize('{"results":{"version":2,"table":{}}}', ctx)).toThrow(
      /unsupported results format/,
    );
  });
});

describe('garak bridge', () => {
  const ev = garak.normalize(fx('garak.report.jsonl'), ctx);
  it('one envelope per probe × detector, with attack success rate', () => {
    allValid(ev);
    expect(ev).toHaveLength(3);
    expect(ev[0]).toMatchObject({ severity: 'low', passed: false, source_version: '0.17.0' });
    expect(ev[0]?.attributes).toMatchObject({
      probe: 'promptinject.HijackHateHumans',
      attack_success_rate: 0.03,
      fails: 3,
    });
    expect(ev[0]?.target.model).toBe('openai:gpt-4.1-mini');
    expect(ev[1]?.severity).toBe('high');
    expect(ev[2]).toMatchObject({ passed: true, severity: 'info' });
    expect(text(ev)).not.toMatch(/PROMPT TEXT THAT MUST NOT BE COPIED/);
  });
  it('severity mapping is monotonic in attack success rate', () => {
    expect([0, 0.05, 0.2, 0.7].map(severityFromAsr)).toEqual(['info', 'low', 'medium', 'high']);
    expect(() => garak.normalize('{"foo":1}', ctx)).toThrow(/no garak entries/);
  });
});

describe('Gitleaks bridge (secret redaction)', () => {
  const ev = gitleaks.normalize(fx('gitleaks.json'), ctx);
  it('keeps location, rule and fingerprint — never the secret, match or author', () => {
    allValid(ev);
    expect(ev).toHaveLength(2);
    expect(ev[0]).toMatchObject({
      location: 'auth.py:1',
      finding_type: 'secret.test-rule',
      severity: 'critical',
      passed: false,
    });
    expect(ev[0]?.attributes.fingerprint).toMatch(/^fp:[a-f0-9]{12}$/);
    const t = text(ev);
    expect(t).not.toMatch(/FAKE-SECRET-VALUE-123456/);
    expect(t).not.toMatch(/johndoe|John Doe|opps/);
    expect(ev[1]?.attributes.fingerprint).toMatch(/^fp:/);
  });
  it('rejects non-array input', () => {
    expect(() => gitleaks.normalize('{"a":1}', ctx)).toThrow(/array/);
  });
});

describe('Trivy bridge', () => {
  const ev = trivy.normalize(fx('trivy.json'), ctx);
  it('normalises vulnerabilities, failing misconfigurations and secrets', () => {
    allValid(ev);
    expect(ev.map((e) => e.finding_type)).toEqual([
      'vuln.CVE-2024-0001',
      'vuln.CVE-2024-0002',
      'misconfig.DS-0002',
      'secret.aws-access-key-id',
    ]);
    expect(ev[1]?.severity).toBe('critical');
    expect(ev[0]?.source_version).toBe('0.74.0');
    expect(text(ev)).not.toMatch(/AKIA_fake_value/);
  });
  it('refuses the known-malicious builds and bad schema', () => {
    expect(trivyVersionProblem('0.69.4')).toMatch(/malicious/);
    expect(trivyVersionProblem('0.74.0')).toBeNull();
    expect(() => trivy.normalize('{"SchemaVersion":1,"Results":[]}', ctx)).toThrow(/SchemaVersion/);
  });
});

describe('Nuclei bridge (import-only by default)', () => {
  it('imports JSONL findings', () => {
    const ev = nuclei.normalize(fx('nuclei.jsonl'), ctx);
    allValid(ev);
    expect(ev.map((e) => e.severity)).toEqual(['info', 'high']);
  });
  it('refuses active scans unless every guard is satisfied', () => {
    const t = __dirname; // an existing directory stands in for a template set
    expect(nucleiGuard('http://127.0.0.1:3000', '3.11.1', {})).toMatch(/disabled by default/);
    expect(nucleiGuard('http://127.0.0.1:3000', '3.11.1', { allowActive: true })).toMatch(/authorised/);
    expect(
      nucleiGuard('http://127.0.0.1:3000', '3.9.9', { allowActive: true, authorized: true, templates: t }),
    ).toMatch(/3\.10\.0/);
    expect(nucleiGuard('http://127.0.0.1:3000', '3.11.1', { allowActive: true, authorized: true })).toMatch(
      /templates/,
    );
    expect(
      nucleiGuard('https://example.com', '3.11.1', { allowActive: true, authorized: true, templates: t }),
    ).toMatch(/not an internet scanner/);
    expect(
      nucleiGuard('http://127.0.0.1:3000', '3.11.1', { allowActive: true, authorized: true, templates: t }),
    ).toBeNull();
    expect(NUCLEI_FORBIDDEN_FLAGS).toEqual(
      expect.arrayContaining(['-code', '-dast', '-lfa', '-env-vars', '-headless']),
    );
  });
});

describe('priority-B import contracts', () => {
  it('DeepEval metrics', () => {
    const ev = deepeval.normalize(fx('deepeval.json'), ctx);
    allValid(ev);
    expect(ev.map((e) => e.passed)).toEqual([true, false]);
  });
  it('Inspect AI EvalLog (stderr folded into the metric)', () => {
    const ev = inspectAi.normalize(fx('inspect.json'), ctx);
    allValid(ev);
    expect(ev).toHaveLength(1);
    expect(ev[0]?.attributes).toMatchObject({ value: 0.8, stderr: 0.13 });
    expect(() => inspectAi.normalize('PK\u0003\u0004binary', ctx)).toThrow(/inspect log dump/);
  });
  it('lm-evaluation-harness results', () => {
    const ev = lmEval.normalize(fx('lm-eval.json'), ctx);
    allValid(ev);
    expect(ev.map((e) => e.finding_type)).toEqual([
      'benchmark.hellaswag.acc',
      'benchmark.hellaswag.acc_norm',
    ]);
    expect(ev[0]?.attributes.stderr).toBe(0.0045);
  });
  it('PyRIT attack results (contract)', () => {
    const ev = pyrit.normalize(fx('pyrit.jsonl'), ctx);
    expect(ev.map((e) => [e.passed, e.severity])).toEqual([
      [false, 'high'],
      [true, 'info'],
    ]);
  });
  it('OpenTelemetry GenAI + OpenInference spans (non-LLM spans skipped)', () => {
    const ev = otel.normalize(fx('otel.json'), ctx);
    allValid(ev);
    expect(ev).toHaveLength(2);
    expect(ev[0]).toMatchObject({ duration_ms: 850, target: { model: 'openai:gpt-4.1-mini', repo: 'demo' } });
    expect(ev[0]?.usage).toMatchObject({ input_tokens: 1200, output_tokens: 35 });
    expect(ev[1]).toMatchObject({ passed: false, target: { model: 'ollama:llama3.1' } });
  });
});

describe('OpenCode JSON events', () => {
  it('concatenates text parts and sums tokens and cost from step_finish', () => {
    const p = parseOpenCodeEvents(fx('opencode.jsonl'));
    expect(p.text).toBe('{"action":"click","target":3}');
    expect(p).toMatchObject({
      input: 1200,
      output: 40,
      cached: 100,
      cost: 0.00042,
      steps: 1,
      tools: 1,
      errors: [],
    });
  });
});
