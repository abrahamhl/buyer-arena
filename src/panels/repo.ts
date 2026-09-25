import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Evidence } from './types.js';

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.buyer-arena',
  '.next',
  '.tmp',
  'test-results',
]);
const TEXT_EXT =
  /\.(md|mdx|txt|json|jsonc|ya?ml|toml|ts|tsx|js|mjs|cjs|jsx|py|go|rs|rb|java|sh|html|css|env\.example)$|(^|\/)(Dockerfile|LICENSE|NOTICE|README|SKILL|AGENTS|CLAUDE)(\.\w+)?$/i;

/** Read-only view over a repository: tracked files only when it is a git repo. Never executes anything. */
export class Repo {
  readonly files: string[];
  private cache = new Map<string, string>();

  constructor(readonly root: string) {
    this.files = listFiles(root);
  }

  has(re: RegExp): string[] {
    return this.files.filter((f) => re.test(f));
  }

  text(file: string): string {
    if (!this.cache.has(file)) {
      let t = '';
      try {
        const p = join(this.root, file);
        if (statSync(p).size <= 1_500_000) t = readFileSync(p, 'utf8');
      } catch {
        /* unreadable */
      }
      this.cache.set(file, t);
    }
    return this.cache.get(file) as string;
  }

  textFiles(filter: RegExp = TEXT_EXT): string[] {
    return this.files.filter((f) => filter.test(f));
  }

  /** Every match of `re` in the given files, as evidence with file:line. */
  grep(re: RegExp, files: string[] = this.textFiles(), max = 20): Evidence[] {
    const out: Evidence[] = [];
    const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
    for (const f of files) {
      const lines = this.text(f).split('\n');
      for (let i = 0; i < lines.length && out.length < max; i++) {
        const line = lines[i] as string;
        if (new RegExp(re.source, flags).test(line)) {
          out.push({ kind: 'file', ref: `${f}:${i + 1}`, excerpt: line.trim().slice(0, 160) });
        }
      }
      if (out.length >= max) break;
    }
    return out;
  }

  json<T = Record<string, unknown>>(file: string): T | undefined {
    try {
      return JSON.parse(this.text(file)) as T;
    } catch {
      return undefined;
    }
  }

  get readme(): string | undefined {
    return this.files.find((f) => /^readme(\.md|\.markdown|\.txt)?$/i.test(f));
  }
}

function listFiles(root: string): string[] {
  if (existsSync(join(root, '.git'))) {
    try {
      const out = execFileSync(
        'git',
        ['-C', root, 'ls-files', '--cached', '--others', '--exclude-standard'],
        {
          encoding: 'utf8',
          maxBuffer: 32 * 1024 * 1024,
        },
      );
      return out
        .split('\n')
        .filter(Boolean)
        .map((f) => f.replace(/\\/g, '/'));
    } catch {
      /* fall back to walking */
    }
  }
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (SKIP_DIRS.has(name)) continue;
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else out.push(relative(root, p).replace(/\\/g, '/'));
      if (out.length > 20_000) return;
    }
  };
  walk(root);
  return out;
}

/** Markdown code blocks tagged as shell, with their line numbers. */
export function shellBlocks(md: string): { line: number; cmd: string }[] {
  const out: { line: number; cmd: string }[] = [];
  const lines = md.split('\n');
  let inShell = false;
  let fence = '';
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i] as string;
    const m = l.match(/^\s*(```+|~~~+)\s*(\w*)/);
    if (m) {
      if (!fence) {
        fence = m[1] as string;
        inShell =
          /^(bash|sh|shell|zsh|console|powershell|ps1|cmd)?$/i.test(m[2] ?? '') && (m[2] ?? '') !== '';
      } else if (l.trim().startsWith(fence)) {
        fence = '';
        inShell = false;
      }
      continue;
    }
    if (fence && inShell) {
      const cmd = l
        .replace(/^\s*\$\s*/, '')
        .replace(/\s+#.*$/, '')
        .trim();
      if (cmd && !cmd.startsWith('#')) out.push({ line: i + 1, cmd });
    }
  }
  return out;
}
