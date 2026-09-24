import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, extname } from 'node:path';
import YAML from 'yaml';

export function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

/** Write via temp file + rename so an interrupted process never leaves a half-written record. */
export function writeFileAtomic(path: string, content: string | Buffer): void {
  ensureDir(dirname(path));
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, content);
  renameSync(tmp, path);
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
