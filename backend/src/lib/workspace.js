import fs from "fs/promises";
import path from "path";

const ROOT = path.resolve(process.env.WORKSPACES_DIR || "./workspaces");
const IGNORED = new Set(["node_modules", ".git"]);

export const projectDir = (projectId) => path.join(ROOT, projectId);

export async function createWorkspace(projectId) {
  const dir = projectDir(projectId);
  await fs.mkdir(dir, { recursive: true });
 // await fs.writeFile(path.join(dir, "index.js"), 'console.log("hello");\n');
}

export async function deleteWorkspace(projectId) {
  await fs.rm(projectDir(projectId), { recursive: true, force: true });
}

const bad = () => Object.assign(new Error("Invalid path"), { status: 400 });

// user-supplied relative path -> safe absolute path
export async function safeResolve(projectId, rel = "") {
  if (typeof rel !== "string") throw bad();
  const base = projectDir(projectId);
  const full = path.resolve(base, rel);
  if (full !== base && !full.startsWith(base + path.sep)) throw bad();

  // symlink check: the real location must also be inside the project
  const realBase = await fs.realpath(base);
  let check = full;
  while (true) {
    try {
      const real = await fs.realpath(check);
      if (real !== realBase && !real.startsWith(realBase + path.sep)) throw bad();
      break;
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
      check = path.dirname(check); // file doesn't exist yet, check its parent
    }
  }
  return full;
}

export async function readTree(dir, base = dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nodes = [];
  for (const e of entries) {
    if (IGNORED.has(e.name)) continue;
    const full = path.join(dir, e.name);
    const rel = path.relative(base, full);
    if (e.isDirectory())
      nodes.push({ name: e.name, path: rel, type: "FOLDER", children: await readTree(full, base) });
    else if (e.isFile())
      nodes.push({ name: e.name, path: rel, type: "FILE" });
  }
  return nodes.sort((a, b) =>
    a.type === b.type ? a.name.localeCompare(b.name) : a.type === "FOLDER" ? -1 : 1
  );
}