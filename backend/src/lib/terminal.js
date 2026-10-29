import { WebSocketServer } from "ws";
import pty from "node-pty";

import fs from "fs/promises";
import os from "os";
import prisma from "./prisma.js";
import { getUserFromToken } from "./auth.js";
import { projectDir } from "./workspace.js";

const SHELL = os.platform() === "win32" ? "powershell.exe" : "bash";

function parseCookies(header = "") {
  const out = {};
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const key = part.slice(0, i).trim();
    try {
      out[key] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      out[key] = part.slice(i + 1).trim();
    }
  }
  return out;
}

// Never pass process.env: the user could run `env` and read your secrets.
const shellEnv = () => ({
  PATH: process.env.PATH,
  HOME: os.homedir(),
  TERM: "xterm-256color",
  LANG: "en_US.UTF-8",
});

const reject = (socket, code, text, why) => {
  console.log("Terminal rejected:", code, why);
  socket.write(`HTTP/1.1 ${code} ${text}\r\n\r\n`);
  socket.destroy();
};

export function attachTerminal(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", async (req, socket, head) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname !== "/terminal") return socket.destroy();

      // Cookies are sent automatically on WebSocket handshakes, and WebSockets
      // are NOT protected by CORS. Without this check, any website the user
      // visits could open a shell on their behalf.
      if (req.headers.origin !== process.env.CLIENT_URL)
        return reject(socket, 403, "Forbidden", `bad origin ${req.headers.origin}`);

      const cookies = parseCookies(req.headers.cookie);
      const user = await getUserFromToken(cookies.jwt);
      if (!user) return reject(socket, 401, "Unauthorized", "no valid jwt cookie");

      const projectId = url.searchParams.get("projectId");
      const project = projectId && await prisma.project.findFirst({
        where: { id: projectId, ownerId: user.id },
        select: { id: true },
      });
      if (!project) return reject(socket, 404, "Not Found", "project not owned by user");

      const cwd = projectDir(project.id);
      await fs.mkdir(cwd, { recursive: true });

      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req, { cwd });
      });
    } catch (err) {
      console.error("Terminal upgrade error:", err);
      socket.destroy();
    }
  });

  wss.on("connection", (ws, req, { cwd }) => {
    const shell = pty.spawn(SHELL, [], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd,
      env: shellEnv(),
    });

    const send = (obj) => ws.readyState === ws.OPEN && ws.send(JSON.stringify(obj));

    shell.onData((data) => send({ type: "output", data }));
    shell.onExit(() => ws.close(1000, "Shell exited"));

    ws.on("message", (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }

      if (msg.type === "input" && typeof msg.data === "string") {
        shell.write(msg.data);
      } else if (msg.type === "resize") {
        const cols = Math.max(2, Math.min(500, Number(msg.cols) || 80));
        const rows = Math.max(2, Math.min(200, Number(msg.rows) || 24));
        shell.resize(cols, rows);
      }
    });

    ws.on("close", () => shell.kill());
    ws.on("error", () => shell.kill());
  });

  console.log("Terminal WebSocket ready at /terminal");
}