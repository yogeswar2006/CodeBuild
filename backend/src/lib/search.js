import fs from "fs/promises";
import path from "path";
import { projectDir } from "./workspace.js";

const IGNORED = new Set(["node_modules", ".git", "dist", "build", ".next"]);
const MAX_FILE_SIZE = 1024 * 1024; // skip files over 1 MB
const MAX_MATCHES = 1000;

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

export function buildRegex({ query, isRegex, caseSensitive, wholeWord }) {
  if (typeof query !== "string" || !query) throw badRequest("Enter something to search for");
  if (query.length > 500) throw badRequest("Search text is too long");

  let src = isRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (wholeWord) src = `\\b(?:${src})\\b`;

  let re;
  try {
    re = new RegExp(src, "gm" + (caseSensitive ? "" : "i"));
  } catch (e) {
    throw badRequest("Invalid regular expression: " + e.message);
  }
  if (re.test("")) throw badRequest("Pattern must not match empty text");
  re.lastIndex = 0;
  return re;
}

// Yields every regular file in the project. Dirent.isDirectory()/isFile() don't
// follow symlinks, so a symlink created in the terminal is never walked.
async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (IGNORED.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else if (e.isFile()) yield full;
  }
}

async function readText(file) {
  try {
    const stat = await fs.stat(file);
    if (stat.size > MAX_FILE_SIZE) return null;
    const buf = await fs.readFile(file);
    if (buf.includes(0)) return null; // binary file
    return buf.toString("utf8");
  } catch {
    return null;
  }
}

const lineStarts = (text) => {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
  return starts;
};

const lineOf = (starts, index) => {
  let lo = 0, hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= index) lo = mid;
    else hi = mid - 1;
  }
  return lo;
};

const toRel = (base, file) => path.relative(base, file).split(path.sep).join("/");

export async function searchProject(projectId, opts) {
  const re = buildRegex(opts);
  const base = projectDir(projectId);
  const results = [];
  let total = 0;
  let truncated = false;

  for await (const file of walk(base)) {
    const text = await readText(file);
    if (text === null) continue;

    const starts = lineStarts(text);
    const matches = [];

    for (const m of text.matchAll(re)) {
      if (!m[0].length) continue;
      const line = lineOf(starts, m.index);
      const col = m.index - starts[line];
      const lineText = text
        .slice(starts[line], starts[line + 1] ?? text.length)
        .replace(/\r?\n$/, "");
      const matchText = m[0].split(/\r?\n/)[0].slice(0, 120);

      matches.push({
        line: line + 1,
        column: col + 1,
        length: m[0].length,
        preview: {
          before: lineText.slice(Math.max(0, col - 30), col).trimStart(),
          match: matchText,
          after: lineText.slice(col + matchText.length, col + matchText.length + 80),
        },
      });

      if (++total >= MAX_MATCHES) {
        truncated = true;
        break;
      }
    }

    if (matches.length) results.push({ path: toRel(base, file), matches });
    if (truncated) break;
  }

  return { results, total, truncated };
}

// onlyPaths: optional array of relative paths (e.g. replace in one file)
export async function replaceInProject(projectId, opts, replacement, onlyPaths) {
  if (typeof replacement !== "string") throw badRequest("Replacement must be a string");
  const re = buildRegex(opts);
  const base = projectDir(projectId);
  const allow = Array.isArray(onlyPaths) ? new Set(onlyPaths) : null;
  // regex mode supports $1, $&; literal mode inserts the text exactly as typed
  const replacer = opts.isRegex ? replacement : () => replacement;

  const changed = [];
  let replacements = 0;

  for await (const file of walk(base)) {
    const rel = toRel(base, file);
    if (allow && !allow.has(rel)) continue;

    const text = await readText(file);
    if (text === null) continue;

    const count = [...text.matchAll(re)].filter((m) => m[0].length).length;
    if (!count) continue;

    await fs.writeFile(file, text.replace(re, replacer));
    changed.push({ path: rel, count });
    replacements += count;
  }

  return { changed, replacements };
}