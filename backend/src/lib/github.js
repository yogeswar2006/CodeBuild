import prisma from "./prisma.js";
import { decrypt } from "./crypto.js";

// Returns the user's GitHub token, or null if they haven't connected.
export async function getGithubToken(userId) {
  const row = await prisma.githubConnection.findUnique({ where: { userId } });
  return row ? decrypt(row.accessToken) : null;
}