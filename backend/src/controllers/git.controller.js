import fs from "fs/promises";
import path from "path";
import prisma from "../lib/prisma.js";
import { safeResolve } from "../lib/workspace.js";
import { getGithubToken } from "../lib/github.js";
import { git, isRepo, parseStatus, GITHUB_URL } from "../lib/git.js";

const bad = (message) => Object.assign(new Error(message), { status: 400 });

// Wraps each handler: auth ownership, resolve the project folder, catch errors.
const handle = (fn, fallback) => async (req, res) => {
  try {
    const { projectId } = req.params;
    const owned = await prisma.project.findFirst({
      where: { id: projectId, ownerId: req.user.id },
      select: { id: true },
    });
    if (!owned) return res.status(404).json({ message: "Project not found" });

    const dir = await safeResolve(projectId);
    res.json(await fn({ req, dir, projectId }));
  } catch (error) {
    if (error.status === 400) return res.status(400).json({ message: error.message });
    console.error(fallback, error);
    res.status(500).json({ message: fallback });
  }
};

const needRepo = async (dir) => {
  if (!(await isRepo(dir))) throw bad("This project is not a Git repository yet");
};

// every path goes through safeResolve, so `../` and symlink tricks are rejected
const cleanPaths = async (projectId, paths) => {
  if (!Array.isArray(paths) || !paths.every((p) => typeof p === "string"))
    throw bad("paths must be an array of strings");
  await Promise.all(paths.map((p) => safeResolve(projectId, p)));
  return paths;
};

const identityFor = async (req) => {
  const gh = await prisma.githubConnection.findUnique({ where: { userId: req.user.id } });
  return gh
    ? { name: gh.username, email: `${gh.githubId}+${gh.username}@users.noreply.github.com` }
    : { name: req.user.username, email: req.user.email };
};

const currentBranch = async (dir) =>
  (await git(dir, ["symbolic-ref", "--short", "HEAD"])).stdout.trim();

const remoteUrl = async (dir) => {
  try {
    return (await git(dir, ["remote", "get-url", "origin"])).stdout.trim();
  } catch {
    return null;
  }
};

// GET .../git/status
const status = handle(async ({ dir }) => {
  if (!(await isRepo(dir))) return { isRepo: false };
  const out = await git(dir, ["status", "--porcelain=v1", "-z", "-b", "-uall"]);
  return { isRepo: true, remote: await remoteUrl(dir), ...parseStatus(out.stdout) };
}, "Failed to read git status");

// POST .../git/init
const init = handle(async ({ dir }) => {
  if (await isRepo(dir)) throw bad("Already a Git repository");
  await git(dir, ["init", "-b", "main"]);
  try {
    await fs.writeFile(path.join(dir, ".gitignore"), "node_modules\n.env\n", { flag: "wx" });
  } catch { /* already has one */ }
  return { ok: true };
}, "Failed to initialise repository");

// POST .../git/stage   body: { paths: [] }   (empty = everything)
const stage = handle(async ({ req, dir, projectId }) => {
  await needRepo(dir);
  const paths = await cleanPaths(projectId, req.body.paths ?? []);
  await git(dir, paths.length ? ["add", "-A", "--", ...paths] : ["add", "-A"]);
  return { ok: true };
}, "Failed to stage files");

// POST .../git/unstage   body: { paths: [] }
const unstage = handle(async ({ req, dir, projectId }) => {
  await needRepo(dir);
  const paths = await cleanPaths(projectId, req.body.paths ?? []);
  await git(dir, paths.length ? ["reset", "-q", "--", ...paths] : ["reset", "-q"]);
  return { ok: true };
}, "Failed to unstage files");

// POST .../git/commit   body: { message }
const commit = handle(async ({ req, dir }) => {
  await needRepo(dir);
  const message = req.body.message;
  if (typeof message !== "string" || !message.trim()) throw bad("Commit message is required");
  if (message.length > 2000) throw bad("Commit message is too long");

  await git(dir, ["commit", "-m", message.trim()], { identity: await identityFor(req) });
  return { ok: true };
}, "Failed to commit");

// PUT .../git/remote   body: { url }
const setRemote = handle(async ({ req, dir }) => {
  await needRepo(dir);
  const url = String(req.body.url ?? "").trim();
  if (!GITHUB_URL.test(url)) throw bad("Use a URL like https://github.com/owner/repo.git");

  await git(dir, (await remoteUrl(dir)) ? ["remote", "set-url", "origin", url] : ["remote", "add", "origin", url]);
  return { ok: true, remote: url };
}, "Failed to set remote");

// POST .../git/push
const push = handle(async ({ req, dir }) => {
  await needRepo(dir);
  if (!(await remoteUrl(dir))) throw bad("Set a remote repository first");

  const token = await getGithubToken(req.user.id);
  if (!token) throw bad("Connect your GitHub account first");

  const branch = await currentBranch(dir);
  const out = await git(dir, ["push", "-u", "origin", branch], { token });
  return { ok: true, output: `${out.stdout}${out.stderr}`.trim() };
}, "Failed to push");

// POST .../git/pull
const pull = handle(async ({ req, dir }) => {
  await needRepo(dir);
  if (!(await remoteUrl(dir))) throw bad("Set a remote repository first");

  const token = await getGithubToken(req.user.id);
  if (!token) throw bad("Connect your GitHub account first");

  const branch = await currentBranch(dir);
  const out = await git(dir, ["pull", "--ff-only", "origin", branch], { token });
  return { ok: true, output: `${out.stdout}${out.stderr}`.trim() };
}, "Failed to pull");

export default { status, init, stage, unstage, commit, setRemote, push, pull };