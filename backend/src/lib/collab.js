import { WebSocketServer } from "ws";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import fs from "fs/promises";
import { watch } from "fs";
import path from "path";
import { getUserFromToken } from "./auth.js";
import { getAccess, can } from "./access.js";
import { safeResolve } from "./workspace.js";

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;
const SAVE_MS = 1500;
const MAX_SIZE = 2 * 1024 * 1024;

const rooms = new Map(); // absolute file path -> room

const send = (ws, msg) => ws.readyState === 1 && ws.send(msg);
const norm = (rel) => path.posix.normalize(String(rel)).replace(/^\/+/, "");

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
  console.log("Collab rejected:", code, why);
  socket.write(`HTTP/1.1 ${code} ${text}\r\n\r\n`);
  socket.destroy();
};

/* --------------------------- room lifecycle --------------------------- */

function createRoom(full, projectId, rel) {
  const doc = new Y.Doc();
  const text = doc.getText("content");
  const awareness = new awarenessProtocol.Awareness(doc);
  awareness.setLocalState(null); // the server has no cursor

  const room = {
    full, projectId, rel, doc, text, awareness,
    conns: new Map(), // ws -> { userId, ids:Set<clientId> }
    lastWritten: "", saveTimer: null, closeTimer: null, watchTimer: null, watcher: null, closed: false,
  };

  room.ready = (async () => {
    const content = await fs.readFile(full, "utf8");
    room.lastWritten = content;
    if (content) doc.transact(() => text.insert(0, content), "disk");
  })();

  // document changes -> everyone except the sender, then schedule a disk write
  doc.on("update", (update, origin) => {
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, MSG_SYNC);
    syncProtocol.writeUpdate(enc, update);
    const msg = encoding.toUint8Array(enc);
    room.conns.forEach((_, ws) => ws !== origin && send(ws, msg));
    if (origin !== "disk") scheduleSave(room);
  });

  // cursor / selection / name changes -> everyone
  awareness.on("update", ({ added, updated, removed }, origin) => {
    const meta = room.conns.get(origin);
    if (meta) {
      added.forEach((id) => meta.ids.add(id));
      removed.forEach((id) => meta.ids.delete(id));
    }
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, MSG_AWARENESS);
    encoding.writeVarUint8Array(
      enc,
      awarenessProtocol.encodeAwarenessUpdate(awareness, [...added, ...updated, ...removed])
    );
    const msg = encoding.toUint8Array(enc);
    room.conns.forEach((_, ws) => send(ws, msg));
  });

  // Watch the folder (not the file): git, sed -i and editors replace files, which kills a file watcher.
  // This is how terminal edits, git pull and replace-in-files reach people who have the file open.
  const dir = path.dirname(full);
  const name = path.basename(full);
  try {
    room.watcher = watch(dir, (_ev, changed) => {
      if (changed && changed !== name) return;
      clearTimeout(room.watchTimer);
      room.watchTimer = setTimeout(() => onDiskChange(room), 200);
    });
    room.watcher.on("error", () => {});
  } catch { /* directory vanished */ }

  rooms.set(full, room);
  return room;
}

function scheduleSave(room) {
  clearTimeout(room.saveTimer);
  room.saveTimer = setTimeout(() => save(room), SAVE_MS);
}

async function save(room) {
  clearTimeout(room.saveTimer);
  const s = room.text.toString();
  if (s === room.lastWritten) return;
  room.lastWritten = s; // set first, so our own write is ignored by the watcher
  try {
    await fs.writeFile(room.full, s);
  } catch (e) {
    console.error("Collab save failed:", e.message);
  }
}

async function onDiskChange(room) {
  if (room.closed) return;
  let content;
  try {
    content = await fs.readFile(room.full, "utf8");
  } catch {
    return closeRoom(room, 4004, "File deleted");
  }
  const current = room.text.toString();
  if (content === room.lastWritten || content === current) return;

  // apply only the changed middle part, so cursors of other people keep their places
  let s = 0;
  const m = Math.min(current.length, content.length);
  while (s < m && current[s] === content[s]) s++;
  let e = 0;
  while (e < m - s && current[current.length - 1 - e] === content[content.length - 1 - e]) e++;
  room.doc.transact(() => {
    if (current.length - s - e > 0) room.text.delete(s, current.length - s - e);
    const ins = content.slice(s, content.length - e);
    if (ins) room.text.insert(s, ins);
  }, "disk");
  room.lastWritten = content;
}

async function closeRoom(room, code = 1000, reason = "Room closed") {
  if (room.closed) return;
  room.closed = true;
  rooms.delete(room.full);
  clearTimeout(room.closeTimer);
  clearTimeout(room.watchTimer);
  room.watcher?.close();
  await save(room);
  room.conns.forEach((_, ws) => ws.close(code, reason));
  room.awareness.destroy();
  room.doc.destroy();
}

function join(room, ws, canWrite, userId) {
  clearTimeout(room.closeTimer);
  room.conns.set(ws, { userId, ids: new Set() });

  ws.on("message", (data) => {
    try {
      const decoder = decoding.createDecoder(new Uint8Array(data));
      const type = decoding.readVarUint(decoder);

      if (type === MSG_SYNC) {
        // Viewers may ask for the document (step 1) but their edits are dropped here.
        if (!canWrite && decoding.peekVarUint(decoder) !== 0) return;
        const enc = encoding.createEncoder();
        encoding.writeVarUint(enc, MSG_SYNC);
        syncProtocol.readSyncMessage(decoder, enc, room.doc, ws);
        if (encoding.length(enc) > 1) send(ws, encoding.toUint8Array(enc));
      } else if (type === MSG_AWARENESS) {
        awarenessProtocol.applyAwarenessUpdate(room.awareness, decoding.readVarUint8Array(decoder), ws);
      }
    } catch (err) {
      console.error("Collab message error:", err.message);
    }
  });

  ws.on("close", () => {
    const meta = room.conns.get(ws);
    room.conns.delete(ws);
    if (meta) awarenessProtocol.removeAwarenessStates(room.awareness, [...meta.ids], null);
    if (room.conns.size === 0) room.closeTimer = setTimeout(() => closeRoom(room), 5000);
  });
  ws.on("error", () => ws.close());

  // hand the newcomer the document and everyone's cursors
  const enc = encoding.createEncoder();
  encoding.writeVarUint(enc, MSG_SYNC);
  syncProtocol.writeSyncStep1(enc, room.doc);
  send(ws, encoding.toUint8Array(enc));

  const ids = [...room.awareness.getStates().keys()];
  if (ids.length) {
    const a = encoding.createEncoder();
    encoding.writeVarUint(a, MSG_AWARENESS);
    encoding.writeVarUint8Array(a, awarenessProtocol.encodeAwarenessUpdate(room.awareness, ids));
    send(ws, encoding.toUint8Array(a));
  }
}

/* --------------------- helpers other files call --------------------- */

// Is someone editing this file live right now?
export const hasRoom = async (projectId, rel) => {
  try { return rooms.has(await safeResolve(projectId, norm(rel))); } catch { return false; }
};

// File or folder renamed/deleted: close its rooms
export function closeRoomsUnder(projectId, rel) {
  const base = norm(rel);
  for (const room of [...rooms.values()]) {
    if (room.projectId === projectId && (room.rel === base || room.rel.startsWith(base + "/")))
      closeRoom(room, 4004, "File moved or deleted");
  }
}

// Access changed: drop that user's connections (they reconnect with their new role)
export function kickCollab(projectId, userId) {
  for (const room of rooms.values()) {
    if (room.projectId !== projectId) continue;
    room.conns.forEach((meta, ws) => meta.userId === userId && ws.close(4001, "Access changed"));
  }
}

/* ------------------------------ upgrade ------------------------------ */

export function attachCollab(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", async (req, socket, head) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (!url.pathname.startsWith("/collab")) return; // not ours (the terminal handles its own path)

      if (req.headers.origin !== process.env.CLIENT_URL)
        return reject(socket, 403, "Forbidden", `bad origin ${req.headers.origin}`);

      const user = await getUserFromToken(parseCookies(req.headers.cookie).jwt);
      if (!user) return reject(socket, 401, "Unauthorized", "no valid jwt cookie");

      const projectId = url.searchParams.get("projectId") ?? "";
      const access = await getAccess(projectId, user.id);
      if (!access) return reject(socket, 404, "Not Found", "no access to project");

      const rel = norm(url.searchParams.get("path") ?? "");
      const full = await safeResolve(projectId, rel); // blocks ../ and symlink escapes
      const stat = await fs.stat(full);
      if (!stat.isFile()) return reject(socket, 400, "Bad Request", "not a file");
      if (stat.size > MAX_SIZE) return reject(socket, 413, "Payload Too Large", "file too large");

      const room = rooms.get(full) ?? createRoom(full, projectId, rel);
      try {
        await room.ready;
      } catch {
        closeRoom(room);
        return reject(socket, 404, "Not Found", "cannot read file");
      }
      if (room.closed) return reject(socket, 503, "Service Unavailable", "room closing, retry");

      wss.handleUpgrade(req, socket, head, (ws) => join(room, ws, can(access, "EDITOR"), user.id));
    } catch (err) {
      if (err.code === "ENOENT") return reject(socket, 404, "Not Found", "file missing");
      console.error("Collab upgrade error:", err);
      socket.destroy();
    }
  });

  console.log("Collaboration WebSocket ready at /collab");
}