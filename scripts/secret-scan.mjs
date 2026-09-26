// Minimal, dependency-free secret scan over files tracked (or staged) by git.
// Fails CI if anything that looks like a live credential is committed.
import { execSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

const PATTERNS = [
  ['Anthropic key', /sk-ant-[A-Za-z0-9_-]{20,}/],
  ['OpenAI key', /sk-(proj-)?[A-Za-z0-9]{32,}/],
  ['AWS access key', /AKIA[0-9A-Z]{16}/],
  ['GitHub token', /gh[pousr]_[A-Za-z0-9]{36,}/],
  ['Slack token', /xox[baprs]-[A-Za-z0-9-]{10,}/],
  ['Private key', /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['Generic assignment', /(api[_-]?key|secret|password|token)\s*[:=]\s*["'][A-Za-z0-9/+_-]{24,}["']/i],
];
const files = execSync('git ls-files --cached --others --exclude-standard', { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);
// Intentional negative-test fixtures: fake credentials that exist to verify redaction.
// A marker, not a file path, so a real key pasted next to one is still caught.
const ALLOWED_MARKERS = ['should-not-leak'];
const hits = [];
for (const f of files) {
  if (/package-lock\.json$|\.(png|jpe?g|zip|gif|ico)$/.test(f)) continue;
  let text;
  try {
    if (statSync(f).size > 2_000_000) continue;
    text = readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  text.split('\n').forEach((line, i) => {
    if (ALLOWED_MARKERS.some((m) => line.includes(m))) return;
    for (const [name, re] of PATTERNS) if (re.test(line)) hits.push(`${f}:${i + 1}  ${name}`);
  });
}
if (hits.length) {
  console.error(`secret-scan: ${hits.length} potential secret(s):\n${hits.join('\n')}`);
  process.exit(1);
}
console.log(`secret-scan: ${files.length} files clean`);
