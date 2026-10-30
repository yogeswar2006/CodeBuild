import "dotenv/config";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../lib/prisma.js";
import { encrypt, decrypt } from "../lib/crypto.js";

const STATE_SECRET = () => process.env.JWT_SECRET + ":github-state"; // different from your login secret
const isProd = process.env.NODE_ENV === "production";

// POST /api/github/connect  -> { url }
const startConnect = async (req, res) => {
  const state = jwt.sign(
    { uid: req.user.id, n: crypto.randomBytes(8).toString("hex") },
    STATE_SECRET(),
    { expiresIn: "10m" }
  );

  // the same state is kept in a cookie: the callback must present both, which blocks CSRF
  res.cookie("gh_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    maxAge: 10 * 60 * 1000,
  });

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: process.env.GITHUB_REDIRECT_URI,
    scope: "repo",
    state,
  });
  res.json({ url: `https://github.com/login/oauth/authorize?${params}` });
};

// GET /api/github/callback  (GitHub redirects the browser here)
const handleCallback = async (req, res) => {
  const back = (status) => res.redirect(`${process.env.CLIENT_URL}/dashboard/?github=${status}`);

  try {
    const { code, state, error } = req.query;
    if (error) return back("denied");
    if (!code || !state || state !== req.cookies.gh_state) return back("error");
    res.clearCookie("gh_state");

    const { uid } = jwt.verify(state, STATE_SECRET());

    // 1. exchange the code for an access token
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: process.env.GITHUB_REDIRECT_URI,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return back("error");

    // 2. find out whose GitHub account this is
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/vnd.github+json",
      },
    });
    if (!userRes.ok) return back("error");
    const gh = await userRes.json();

    // one GitHub account can't be linked to two users
    const existing = await prisma.githubConnection.findUnique({
      where: { githubId: String(gh.id) },
    });
    if (existing && existing.userId !== uid) return back("in_use");

    // 3. save it, encrypted
    const data = {
      githubId: String(gh.id),
      username: gh.login,
      avatarUrl: gh.avatar_url,
      accessToken: encrypt(tokenData.access_token),
      scope: tokenData.scope ?? null,
    };
    await prisma.githubConnection.upsert({
      where: { userId: uid },
      create: { userId: uid, ...data },
      update: data,
    });

    return back("connected");
  } catch (err) {
    console.error("GitHub callback error:", err);
    return back("error");
  }
};

// GET /api/github/status
const getStatus = async (req, res) => {
  const row = await prisma.githubConnection.findUnique({
    where: { userId: req.user.id },
    select: { username: true, avatarUrl: true },
  });
  res.json({ connected: !!row, ...row });
};

// DELETE /api/github
const disconnect = async (req, res) => {
  const row = await prisma.githubConnection.findUnique({ where: { userId: req.user.id } });
  if (!row) return res.json({ message: "Not connected" });

  // best effort: also revoke the token on GitHub's side
  try {
    const basic = Buffer.from(
      `${process.env.GITHUB_CLIENT_ID}:${process.env.GITHUB_CLIENT_SECRET}`
    ).toString("base64");
    await fetch(`https://api.github.com/applications/${process.env.GITHUB_CLIENT_ID}/grant`, {
      method: "DELETE",
      headers: { Authorization: `Basic ${basic}`, Accept: "application/vnd.github+json" },
      body: JSON.stringify({ access_token: decrypt(row.accessToken) }),
    });
  } catch {
    /* ignore: we still delete our copy */
  }

  await prisma.githubConnection.delete({ where: { userId: req.user.id } });
  res.json({ message: "Disconnected" });
};

export default { startConnect, handleCallback, getStatus, disconnect };