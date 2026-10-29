import jwt from "jsonwebtoken";
import "dotenv/config";
import prisma from "./prisma.js";

// Same checks as your middleware: verify the JWT, then load the user from the DB.
export async function getUserFromToken(token) {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return await prisma.user.findUnique({ where: { id: decoded.id } });
  } catch {
    return null;
  }
}