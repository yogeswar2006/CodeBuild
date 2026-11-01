import prisma from "../lib/prisma.js";
import { getAccess, can } from "../lib/access.js";
import { kickUser } from "../lib/terminal.js";
import { kickCollab } from "../lib/collab.js"

const ROLES = ["VIEWER", "EDITOR"];
const err = (status, message) => Object.assign(new Error(message), { status });

const guard = (min, fn, fallback) => async (req, res) => {
  try {
    const { projectId } = req.params;
    const access = await getAccess(projectId, req.user.id);
    if (!access) throw err(404, "Project not found");
    if (!can(access, min)) throw err(403, "Only the project owner can do that");
    res.json(await fn({ req, projectId, access }));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    console.error(fallback, e);
    res.status(500).json({ message: fallback });
  }
};

// GET /projects/:projectId/members
const list = guard("VIEWER", async ({ projectId }) => {
  const p = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      owner: { select: { id: true, username: true } },
      members: {
        orderBy: { createdAt: "asc" },
        select: { userId: true, role: true, user: { select: { username: true } } },
      },
    },
  });
  return {
    owner: p.owner,
    members: p.members.map((m) => ({ userId: m.userId, username: m.user.username, role: m.role })),
  };
}, "Failed to load members");

// POST /projects/:projectId/members   body: { username, role }
const add = guard("OWNER", async ({ req, projectId }) => {
  const username = String(req.body.username ?? "").trim();
  const role = req.body.role ?? "EDITOR";
  if (!username) throw err(400, "Username is required");
  if (!ROLES.includes(role)) throw err(400, "Role must be VIEWER or EDITOR");

  const target = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
    select: { id: true, username: true },
  });
  if (!target) throw err(404, "No user with that username");
  if (target.id === req.user.id) throw err(400, "You already own this project");

  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId: target.id } },
    create: { projectId, userId: target.id, role, invitedById: req.user.id },
    update: { role },
  });
   kickCollab(projectId, target.id);  
  if (role === "VIEWER") kickUser(projectId, target.id); // viewers get no terminal
  return { member: { userId: target.id, username: target.username, role } };
}, "Failed to add member");

// PATCH /projects/:projectId/members/:userId   body: { role }
const update = guard("OWNER", async ({ req, projectId }) => {
  const { role } = req.body;
  if (!ROLES.includes(role)) throw err(400, "Role must be VIEWER or EDITOR");

  const r = await prisma.projectMember.updateMany({
    where: { projectId, userId: req.params.userId },
    data: { role },
  });
  if (!r.count) throw err(404, "Member not found");
  kickCollab(projectId, req.params.userId);  
  if (role === "VIEWER") kickUser(projectId, req.params.userId);
  return { ok: true };
}, "Failed to update member");

// DELETE /projects/:projectId/members/:userId   (owner removes anyone; a member can remove themselves)
const remove = guard("VIEWER", async ({ req, projectId, access }) => {
  const { userId } = req.params;
  if (userId !== req.user.id && access !== "OWNER") throw err(403, "Only the project owner can do that");

  const r = await prisma.projectMember.deleteMany({ where: { projectId, userId } });
  if (!r.count) throw err(404, "Member not found");
  kickCollab(projectId, userId);
  kickUser(projectId, userId); // closes their terminal immediately
  return { ok: true };
}, "Failed to remove member");

export default { list, add, update, remove };