import prisma from "./prisma.js";

const RANK = { VIEWER: 1, EDITOR: 2, OWNER: 3 };

// -> "OWNER" | "EDITOR" | "VIEWER" | null
export async function getAccess(projectId, userId) {
  const p = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true, members: { where: { userId }, select: { role: true } } },
  });
  if (!p) return null;
  if (p.ownerId === userId) return "OWNER";
  return p.members[0]?.role ?? null;
}

export const can = (access, min) => !!access && RANK[access] >= RANK[min];