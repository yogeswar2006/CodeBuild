import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import os from "os";
import path from "path";

const run = promisify(execFile);

const fail = (message) => Object.assign(new Error(message), { status: 400 });

// Runs git inside a project folder. `token` is optional and only lives in this one process.
export async function git(cwd, args, { token, identity } = {}) {
  const env = {
    PATH: process.env.PATH,
    HOME: os.homedir(),
    LANG: "en_US.UTF-8",
    GIT_TERMINAL_PROMPT: "0",                    // never wait for a password prompt
    GIT_LITERAL_PATHSPECS: "1",                  // file names are never treated as patterns
    GIT_CEILING_DIRECTORIES: path.dirname(cwd),  // never climb into a parent repo (your backend repo!)
  };

  if (token) {
    // GitHub expects Basic auth with "x-access-token" as the username for git over HTTPS.
    // Env vars (not CLI args) keep the token out of `ps` output and out of .git/config.
    const basic = Buffer.from(`x-access-token:${token}`).toString("base64");
    env.GIT_CONFIG_COUNT = "1";
    env.GIT_CONFIG_KEY_0 = "http.https://github.com/.extraheader";
    env.GIT_CONFIG_VALUE_0 = `AUTHORIZATION: basic ${basic}`;
  }

  const pre = ["-c", "core.quotepath=false", "-c", "core.hooksPath=/dev/null"];
  if (identity) pre.push("-c", `user.name=${identity.name}`, "-c", `user.email=${identity.email}`);

  try {
    return await run("git", [...pre, ...args], {
      cwd, env, timeout: 60_000, maxBuffer: 10 * 1024 * 1024,
    });
  } catch (e) {
    if (e.code === "ENOENT") throw fail("Git is not installed on the server");

    const text = `${e.stderr || ""}${e.stdout || ""}`.trim() || e.message;
    if (/authentication failed|invalid username or token|could not read username|403|401/i.test(text))
      throw fail("GitHub rejected the saved token. Disconnect and reconnect GitHub, and make sure you have access to this repo.");
    throw fail(text.slice(0, 600));
  }
}

export async function isRepo(dir) {
  try {
    await fs.stat(path.join(dir, ".git")); // check the project's own folder, not parents
    return true;
  } catch {
    return false;
  }
}

// `git status --porcelain=v1 -z -b` -> { branch, upstream, ahead, behind, files }
export function parseStatus(out) {
  const parts = out.split("\0").filter(Boolean);
  const info = { branch: null, upstream: null, ahead: 0, behind: 0, files: [] };

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p.startsWith("## ")) {
      const m = p.slice(3).match(/^(?:No commits yet on )?(.+?)(?:\.\.\.(\S+))?(?: \[(.+)\])?$/);
      if (m) {
        info.branch = m[1];
        info.upstream = m[2] ?? null;
        info.ahead = Number(m[3]?.match(/ahead (\d+)/)?.[1] ?? 0);
        info.behind = Number(m[3]?.match(/behind (\d+)/)?.[1] ?? 0);
      }
      continue;
    }
    const x = p[0], y = p[1];
    if (x === "R" || x === "C") i++; // the next entry is the original path
    info.files.push({ path: p.slice(3), index: x, worktree: y });
  }
  return info;
}

export const GITHUB_URL = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+?(\.git)?$/;