// tsc does not copy non-TS files: mirror the report assets (CSS, client JS, Inter font) into dist.
import { cpSync } from 'node:fs';
cpSync('src/reports/assets', 'dist/reports/assets', { recursive: true });
