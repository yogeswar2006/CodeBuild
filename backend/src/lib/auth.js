import jwt from "jsonwebtoken";
import "dotenv/config";
import prisma from "./prisma.js";
import { cached } from "./cache.js";

export async function getUserFromToken(token) {
  if (!token) return null;

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    console.log("JWT rejected:", e.message);
    return null;
  }

  try {
    const user = await cached(`user:${decoded.id}`, 60, () =>
      prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, username: true, email: true, createdAt: true, updatedAt: true },
      }),
      { skipNull: true }
    );
    if (!user) console.log("JWT valid, but no user row for id", decoded.id);
    return user;
  } catch (e) {
    console.error("User lookup failed:", e.message);
    return null;
  }
}