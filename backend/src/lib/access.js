import prisma from "./prisma.js";
import { cached } from "./cache.js";

const RANK = { VIEWER: 1, EDITOR: 2, OWNER: 3 };
export const accessKey = (projectId, userId) => `access:${projectId}:${userId}`;

// -> "OWNER" | "EDITOR" | "VIEWER" | null
export const getAccess = (projectId, userId) =>
  cached(accessKey(projectId, userId), 30, async () => {
    const p = await prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true, members: { where: { userId }, select: { role: true } } },
    });
    if (!p) return null;
    if (p.ownerId === userId) return "OWNER";
    return p.members[0]?.role ?? null;
  });

export const can = (access, min) => !!access && RANK[access] >= RANK[min];