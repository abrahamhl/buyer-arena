#!/usr/bin/env node
/**
 * Publish a self-contained, privacy-reduced demo report without broken links.
 * Full Chromium traces remain available in the private CI evidence artifact.
 * This transformation is ONLY for the public static site copy, never raw evidence.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const target = process.argv[2];
if (!target || !target.endsWith('/report.html')) {
  console.error('Usage: node scripts/sanitize-public-report.mjs site/report/demo/report.html');
  process.exit(2);
}
const source = readFileSync(target, 'utf8');
let count = 0;
let cleaned = source.replace(
  /<a\b(?=[^>]*\bhref\s*=\s*["'][^"']*trace\.zip["'])[^>]*>[\s\S]*?<\/a>/gi,
  () => {
    count++;
    return '<span class="trace-in-ci" title="Trace available in CI evidence artifact">Browser trace: CI evidence artifact</span>';
  },
);
// Reports embed trace paths as JSON; the static public copy does not ship trace ZIPs.
const scrubbed = [...cleaned.matchAll(/"trace"\s*:\s*"[^"]*trace\.zip"/gi)].length;
cleaned = cleaned.replace(/"trace"\s*:\s*"[^"]*trace\.zip"/gi, '"trace":null');
const remaining = [...cleaned.matchAll(/<a\b[^>]*\bhref\s*=\s*["'][^"']*trace\.zip["']/gi)];
if (remaining.length) {
  console.error('Refusing to publish report with ' + remaining.length + ' unresolved trace ZIP hyperlinks');
  process.exit(1);
}
if (/trace\.zip/i.test(cleaned)) {
  console.error('Unresolved reference to CI-only trace ZIP remains in public report');
  process.exit(1);
}
writeFileSync(target, cleaned);
console.log(
  'Public report sanitized: ' + count + ' trace links replaced; full traces retained in CI artifact.',
);
