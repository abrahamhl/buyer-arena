import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, normalize } from 'node:path';
import { ensureDir, writeFileAtomic } from '../core/fs.js';
import { currentLedger } from '../policy/network.js';

/**
 * STATIC AUDIT of a public GitHub repository URL. NO CODE IS EXECUTED.
 *
 * github.com/owner/repo → bounded download of text files (metadata, docs, manifests,
 * workflows, source) into a throw-away directory, then the existing static launch-check
 * panels read them as data. Nothing is installed, built, imported or run. Hosted execution
 * of arbitrary repositories needs sandbox infrastructure and is future work.
 */
export const STATIC_LIMITS = {
  maxFiles: 150,
  maxFileBytes: 512 * 1024,
  maxTotalBytes: 6 * 1024 * 1024,
  timeoutMs: 15_000,
};

const WANT =
  /(^|\/)(README|LICENSE|LICENCE|NOTICE|SECURITY|CONTRIBUTING|CODE_OF_CONDUCT|CHANGELOG|AGENTS|CLAUDE|GEMINI)(\.\w+)?$|(^|\/)package\.json$|(^|\/)(pyproject\.toml|requirements\.txt|Cargo\.toml|go\.mod|Dockerfile)$|^\.github\/(workflows\/.+\.ya?ml|dependabot\.yml)$|\.mcp\.json$|^docs\/[^/]+\.mdx?$|\.(ts|tsx|js|mjs|cjs|py|go|rs)$/i;
const SKIP = /(^|\/)(node_modules|dist|build|vendor|\.git|coverage|fixtures?|__snapshots__)\//i;
const FALLBACK = [
  'README.md',
  'LICENSE',
  'SECURITY.md',
  'CONTRIBUTING.md',
  'package.json',
  'pyproject.toml',
  '.github/dependabot.yml',
];

export interface ParsedRepoUrl {
  owner: string;
  repo: string;
}

export function parseGithubUrl(input: string): ParsedRepoUrl {
  const m =
    /^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?\/?$/.exec(
      input.trim(),
    );
  if (!m) throw new Error(`not a GitHub repository URL: ${input} (expected github.com/owner/repo)`);
  return { owner: m[1] as string, repo: m[2] as string };
}

export interface StaticFetchResult {
  dir: string;
  source: string;
  default_branch: string | null;
  files: string[];
  bytes: number;
  skipped: number;
  method: 'api-tree' | 'raw-fallback';
  metadata: {
    stars?: number;
    license?: string | null;
    pushed_at?: string;
    archived?: boolean;
    visibility?: string;
  };
  no_code_executed: true;
  cleanup: () => void;
}

async function get(url: string, timeoutMs: number, accept = 'application/json'): Promise<Response | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // Unauthenticated on purpose: Buyer Arena's own tokens are never sent to fetch metadata.
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { accept, 'user-agent': 'buyer-arena-static-audit' },
      redirect: 'follow',
    });
    return res.ok ? res : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Only relative, normal paths inside the checkout: a hostile tree cannot write outside `dir`. */
function safePath(p: string): string | null {
  if (!p || p.startsWith('/') || p.includes('\\') || p.includes('\0')) return null;
  const n = normalize(p);
  return n.startsWith('..') || n.includes(`..${'/'}`) ? null : n;
}

export async function fetchStaticRepo(
  url: string,
  o: { apiBase?: string; rawBase?: string; limits?: Partial<typeof STATIC_LIMITS> } = {},
): Promise<StaticFetchResult> {
  const { owner, repo } = parseGithubUrl(url);
  const L = { ...STATIC_LIMITS, ...o.limits };
  const api = (o.apiBase ?? 'https://api.github.com').replace(/\/$/, '');
  const raw = (o.rawBase ?? 'https://raw.githubusercontent.com').replace(/\/$/, '');
  const ledger = currentLedger();
  ledger.check(`${api}/`, 'repo-metadata', { explicit: true });
  ledger.check(`${raw}/`, 'repo-metadata', { explicit: true });

  const dir = mkdtempSync(join(tmpdir(), 'ba-static-'));
  const cleanup = () => rmSync(dir, { recursive: true, force: true });
  const metadata: StaticFetchResult['metadata'] = {};
  let branch: string | null = null;
  let paths: string[] = [];
  let method: StaticFetchResult['method'] = 'raw-fallback';

  const meta = await get(`${api}/repos/${owner}/${repo}`, L.timeoutMs);
  if (meta) {
    const j = (await meta.json()) as {
      default_branch?: string;
      stargazers_count?: number;
      license?: { spdx_id?: string } | null;
      pushed_at?: string;
      archived?: boolean;
      visibility?: string;
    };
    branch = j.default_branch ?? null;
    Object.assign(metadata, {
      stars: j.stargazers_count,
      license: j.license?.spdx_id ?? null,
      pushed_at: j.pushed_at,
      archived: j.archived,
      visibility: j.visibility,
    });
    if (branch) {
      const tree = await get(
        `${api}/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
        L.timeoutMs,
      );
      if (tree) {
        const t = (await tree.json()) as { tree?: { path?: string; type?: string; size?: number }[] };
        paths = (t.tree ?? [])
          .filter(
            (x) =>
              x.type === 'blob' &&
              x.path &&
              WANT.test(x.path) &&
              !SKIP.test(x.path) &&
              (x.size ?? 0) <= L.maxFileBytes,
          )
          .map((x) => x.path as string);
        method = 'api-tree';
      }
    }
  }
  if (!paths.length) paths = FALLBACK;
  // Docs and manifests first, then source, so the budget keeps what the panels need most.
  const rank = (p: string) => (/\.(ts|tsx|js|mjs|cjs|py|go|rs)$/.test(p) ? 1 : 0);
  paths = [...new Set(paths)].sort((a, b) => rank(a) - rank(b) || a.length - b.length).slice(0, L.maxFiles);

  const files: string[] = [];
  let bytes = 0;
  let skipped = 0;
  const ref = branch ?? 'HEAD';
  for (const p of paths) {
    const rel = safePath(p);
    if (!rel) {
      skipped++;
      continue;
    }
    const res = await get(
      `${raw}/${owner}/${repo}/${encodeURIComponent(ref)}/${p.split('/').map(encodeURIComponent).join('/')}`,
      L.timeoutMs,
      'text/plain',
    );
    if (!res) {
      skipped++;
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > L.maxFileBytes || bytes + buf.length > L.maxTotalBytes) {
      skipped++;
      continue;
    }
    const target = join(dir, rel);
    ensureDir(dirname(target));
    writeFileAtomic(target, buf);
    files.push(rel);
    bytes += buf.length;
  }
  if (!files.length) {
    cleanup();
    throw new Error(
      `could not read any file from github.com/${owner}/${repo} (private, missing, or network policy/proxy blocked)`,
    );
  }
  return {
    dir,
    source: `github.com/${owner}/${repo}`,
    default_branch: branch,
    files,
    bytes,
    skipped,
    method,
    metadata,
    no_code_executed: true,
    cleanup,
  };
}
