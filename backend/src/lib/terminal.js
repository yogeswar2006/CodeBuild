import { WebSocketServer } from "ws";
import pty from "node-pty";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import os from "os";
import prisma from "./prisma.js";
import { getUserFromToken } from "./auth.js";
import { getAccess, can } from "./access.js";
import { projectDir } from "./workspace.js";

const sh = promisify(execFile);
const IMAGE = process.env.SANDBOX_IMAGE || "codespace-sandbox";
const SANDBOX = process.env.SANDBOX !== "off"; // SANDBOX=off -> plain bash, local debugging only
const IDLE_MS = 10 * 60 * 1000;

const sockets = new Map(); // "projectId:userId" -> Set<ws>
const counts = new Map();  // container name -> open terminals
const idle = new Map();    // container name -> timer

const key = (projectId, userId) => `${projectId}:${userId}`;
const cname = (projectId, userId) => `cs_${userId.slice(0, 12)}_${projectId.slice(0, 12)}`;

function parseCookies(header = "") {
  const out = {};
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    try { out[k] = decodeURIComponent(part.slice(i + 1).trim()); } catch { out[k] = part.slice(i + 1).trim(); }
  }
  return out;
}

const reject = (socket, code, text, why) => {
  console.log("Terminal rejected:", code, why);
  socket.write(`HTTP/1.1 ${code} ${text}\r\n\r\n`);
  socket.destroy();
};

// One container per (user, project). It sees ONLY that project's folder, as /workspace.
async function ensureContainer(name, dir) {
  try {
    const { stdout } = await sh("docker", ["inspect", "-f", "{{.State.Running}}", name]);
    if (stdout.trim() === "true") return;
    await sh("docker", ["rm", "-f", name]);
  } catch { /* does not exist yet */ }

  try {
    await sh("docker", [
      "run", "-d", "--name", name, "--label", "codespace=1",
      "--user", `${process.getuid()}:${process.getgid()}`, // so files created inside match the host owner
      "--cap-drop", "ALL",
      "--security-opt", "no-new-privileges",
      "--pids-limit", "256",
      "--memory", "1g", "--memory-swap", "1g",
      "--cpus", "1",
      "--read-only",                                       // image filesystem is immutable
      "--tmpfs", "/tmp:rw,exec,size=512m",
      "-e", "HOME=/tmp",
      "-v", `${dir}:/workspace`,
      "-w", "/workspace",
      IMAGE, "sleep", "infinity",
    ]);
  } catch (e) {
    if (!/already in use/i.test(String(e.stderr))) throw e; // two tabs opened at once: fine
  }
}

const removeContainer = (name) => sh("docker", ["rm", "-f", name]).catch(() => {});

// Close a user's terminals and destroy their container (call on revoke / downgrade)
export function kickUser(projectId, userId) {
  for (const ws of sockets.get(key(projectId, userId)) ?? []) ws.close(4001, "Access changed");
  removeContainer(cname(projectId, userId));
}

export function attachTerminal(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", async (req, socket, head) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname !== "/terminal") return ;

      if (req.headers.origin !== process.env.CLIENT_URL)
        return reject(socket, 403, "Forbidden", `bad origin ${req.headers.origin}`);

      const user = await getUserFromToken(parseCookies(req.headers.cookie).jwt);
      if (!user) return reject(socket, 401, "Unauthorized", "no valid jwt cookie");

      const projectId = url.searchParams.get("projectId") ?? "";
      const access = await getAccess(projectId, user.id);
      if (!access) return reject(socket, 404, "Not Found", "no access to project");
      if (!can(access, "EDITOR")) return reject(socket, 403, "Forbidden", "viewers have no terminal");

      const dir = projectDir(projectId);
      await fs.mkdir(dir, { recursive: true });

      wss.handleUpgrade(req, socket, head, (ws) =>
        wss.emit("connection", ws, req, { dir, user, projectId })
      );
    } catch (err) {
      console.error("Terminal upgrade error:", err);
      socket.destroy();
    }
  });

  wss.on("connection", async (ws, req, { dir, user, projectId }) => {
    const name = cname(projectId, user.id);
    const k = key(projectId, user.id);

    let shell;
    try {
      if (SANDBOX) {
        await ensureContainer(name, dir);
        clearTimeout(idle.get(name));
        counts.set(name, (counts.get(name) ?? 0) + 1);

        shell = pty.spawn("docker", [
          "exec", "-it", "-w", "/workspace",
          "-e", "TERM=xterm-256color",
          "-e", `GIT_AUTHOR_NAME=${user.username}`, "-e", `GIT_AUTHOR_EMAIL=${user.email}`,
          "-e", `GIT_COMMITTER_NAME=${user.username}`, "-e", `GIT_COMMITTER_EMAIL=${user.email}`,
          name, "bash",
        ], {
          name: "xterm-256color", cols: 80, rows: 24,
          env: { PATH: process.env.PATH, HOME: os.homedir() }, // only for the docker CLI itself
        });
      } else {
        shell = pty.spawn("bash", [], {
          name: "xterm-256color", cols: 80, rows: 24, cwd: dir,
          env: { PATH: process.env.PATH, HOME: os.homedir(), TERM: "xterm-256color" },
        });
      }
    } catch (e) {
      console.error("Could not start terminal:", e);
      ws.send(JSON.stringify({ type: "output", data: "\r\n\x1b[31mCould not start the sandbox.\x1b[0m\r\n" }));
      return ws.close(1011, "Sandbox failed");
    }

    if (!sockets.has(k)) sockets.set(k, new Set());
    sockets.get(k).add(ws);

    const send = (obj) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(obj));
    shell.onData((data) => send({ type: "output", data }));
    shell.onExit(() => ws.close(1000, "Shell exited"));

    ws.on("message", (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (msg.type === "input" && typeof msg.data === "string") shell.write(msg.data);
      else if (msg.type === "resize")
        shell.resize(
          Math.max(2, Math.min(500, Number(msg.cols) || 80)),
          Math.max(2, Math.min(200, Number(msg.rows) || 24))
        );
    });

    const cleanup = () => {
      shell.kill();
      sockets.get(k)?.delete(ws);
      if (!SANDBOX) return;
      const left = (counts.get(name) ?? 1) - 1;
      counts.set(name, left);
      if (left <= 0) idle.set(name, setTimeout(() => removeContainer(name), IDLE_MS)); // stop idle containers
    };
    ws.once("close", cleanup);
    ws.on("error", () => ws.close());
  });

  console.log(`Terminal WebSocket ready at /terminal (sandbox: ${SANDBOX ? "docker" : "OFF"})`);
}