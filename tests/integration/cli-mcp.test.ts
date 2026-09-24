import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';
import { createMcpServer } from '../../src/mcp/server.js';
import { assertTarget } from '../../src/workflow.js';
import { tmp } from '../helpers.js';

const CLI = resolve('dist/cli/main.js');
const cli = (args: string[], cwd = process.cwd()) =>
  execFileSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
    timeout: 180_000,
  });

describe('CLI smoke tests (built binary)', () => {
  it('is built', () => expect(existsSync(CLI)).toBe(true));

  it('--help lists every required command', () => {
    const out = cli(['--help']);
    for (const c of [
      'init',
      'doctor',
      'population',
      'run',
      'compare',
      'report',
      'replay',
      'audit',
      'demo',
      'status',
      'mcp',
    ])
      expect(out).toContain(c);
  });

  it('population generate is reproducible and writes files', () => {
    const dir = tmp();
    cli(['population', 'generate', '--size', '10', '--seed', '7', '-o', join(dir, 'a.yaml')]);
    cli(['population', 'generate', '--size', '10', '--seed', '7', '-o', join(dir, 'b.yaml')]);
    expect(readFileSync(join(dir, 'a.yaml'), 'utf8')).toBe(readFileSync(join(dir, 'b.yaml'), 'utf8'));
  });

  it('doctor runs without network or spend', () => {
    expect(cli(['doctor'])).toMatch(/Playwright Chromium/);
  });

  it('init scaffolds a usable config', () => {
    const dir = tmp();
    cli(['init'], dir);
    for (const f of ['buyer-arena.yaml', 'tasks/start-trial.yaml', 'populations/buyers.yaml'])
      expect(existsSync(join(dir, f))).toBe(true);
  });

  it('demo → status → replay → report works end to end', () => {
    const dir = tmp();
    const out = cli(['demo', '--size', '5', '--no-screenshots', '--root', join(dir, '.ba')], dir);
    expect(out).toContain('BASELINE → CANDIDATE');
    expect(out).toContain('EXPLORATORY SIGNAL');
    expect(cli(['status', '--root', join(dir, '.ba')], dir)).toMatch(/complete\s+10\/10/);
    expect(cli(['replay', 'candidate-p-004', '--root', join(dir, '.ba')], dir)).toMatch(/pop-up/i);
    expect(cli(['report', '--root', join(dir, '.ba')], dir)).toContain('ROI backlog');
    expect(cli(['audit', '--root', join(dir, '.ba')], dir)).toContain('OBSERVED FACT');
  });

  it('fails clearly when a goal cannot be measured', () => {
    expect(() => cli(['run', '--url', 'http://127.0.0.1:9', '--size', '1'])).toThrow(/success-text/);
  });
});

describe('MCP server (in-memory transport)', () => {
  it('exposes compact tools and runs the demo vertical slice', async () => {
    const root = tmp();
    const server = createMcpServer(join(root, '.ba'));
    const [a, b] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test', version: '0' });
    await Promise.all([server.connect(a), client.connect(b)]);

    const tools = (await client.listTools()).tools.map((t) => t.name);
    for (const t of [
      'create_population',
      'run_simulation',
      'compare_variants',
      'inspect_run',
      'generate_report',
      'get_findings',
    ])
      expect(tools).toContain(t);

    const pop = await client.callTool({ name: 'create_population', arguments: { size: 5, seed: 1 } });
    expect(JSON.stringify(pop)).toContain('p-005');

    const demo = await client.callTool({ name: 'run_demo', arguments: { size: 5 } });
    const summary = JSON.parse((demo.content as { text: string }[])[0]!.text);
    expect(summary.comparison.note).toContain('CONVERSION PROXY');
    expect(summary.backlog.length).toBeGreaterThan(0);

    const findings = await client.callTool({ name: 'get_findings', arguments: {} });
    expect((findings.content as { text: string }[])[0]!.text).toContain('observed_fact');

    const run = await client.callTool({ name: 'inspect_run', arguments: { run_id: 'baseline-p-001' } });
    expect((run.content as { text: string }[])[0]!.text).toContain('timeline');

    // An MCP client (an LLM) may not point buyers at arbitrary remote sites.
    const remote = await client.callTool({
      name: 'run_simulation',
      arguments: { url: 'https://example.com', success_text: 'x', size: 1 },
    });
    expect(remote.isError).toBe(true);
    expect(JSON.stringify(remote.content)).toMatch(/local-only/);
    await client.close();
  });

  it('target guard only allows explicit http(s) targets', () => {
    expect(() => assertTarget('file:///etc/passwd')).toThrow();
    expect(() => assertTarget('javascript:alert(1)')).toThrow();
    expect(assertTarget('http://localhost:3000')).toBe('http://localhost:3000/');
    expect(() => assertTarget('https://example.com', { localOnly: true })).toThrow(/local-only/);
  });
});
