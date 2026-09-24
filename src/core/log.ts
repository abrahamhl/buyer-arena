const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const wrap = (code: string) => (s: string | number) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s));

export const c = {
  dim: wrap('2'),
  bold: wrap('1'),
  green: wrap('32'),
  red: wrap('31'),
  yellow: wrap('33'),
  cyan: wrap('36'),
  magenta: wrap('35'),
};

let quiet = false;
export function setQuiet(q: boolean): void {
  quiet = q;
}
export function log(...args: unknown[]): void {
  if (!quiet) console.log(...args);
}
