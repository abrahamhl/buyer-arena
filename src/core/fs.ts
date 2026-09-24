import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeSync,
} from 'node:fs';
import { dirname, extname } from 'node:path';
import YAML from 'yaml';

export function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

/** Write via temp file + rename so an interrupted process never leaves a half-written record. */
export function writeFileAtomic(path: string, content: string | Buffer): void {
  ensureDir(dirname(path));
  const tmp = `${path}.${process.pid}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  const fd = openSync(tmp, 'w');
  try {
    writeSync(fd, typeof content === 'string' ? Buffer.from(content) : content);
    fsyncSync(fd); // durable before it becomes visible
  } finally {
    closeSync(fd);
  }
  // Windows: antivirus/indexers briefly lock files; retry the rename instead of failing the run.
  for (let attempt = 0; ; attempt++) {
    try {
      renameSync(tmp, path);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (attempt >= 5 || !['EPERM', 'EBUSY', 'EACCES'].includes(code ?? '')) {
        rmSync(tmp, { force: true });
        throw err;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20 * 2 ** attempt);
    }
  }
}

export function writeJson(path: string, value: unknown): void {
  writeFileAtomic(path, JSON.stringify(value, null, 2));
}

export function readJson<T = unknown>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

/** Load YAML or JSON by extension. */
export function readStructured(path: string): unknown {
  const raw = readFileSync(path, 'utf8');
  return extname(path).toLowerCase() === '.json' ? JSON.parse(raw) : YAML.parse(raw);
}

export function writeStructured(path: string, value: unknown): void {
  const ext = extname(path).toLowerCase();
  writeFileAtomic(path, ext === '.json' ? JSON.stringify(value, null, 2) : YAML.stringify(value));
}

export { existsSync };
