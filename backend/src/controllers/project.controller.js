import prisma from "../lib/prisma.js";
import fs from "fs/promises";
import path from "path";
import {
  createWorkspace, deleteWorkspace, readTree, safeResolve,
} from "../lib/workspace.js";
import { searchProject, replaceInProject } from "../lib/search.js";
import { getAccess, can } from "../lib/access.js";
import { hasRoom, closeRoomsUnder } from "../lib/collab.js";

import { invalidatePattern } from "../lib/cache.js";

// Throws 404 if the user has no access, 403 if their role is too low.
// Always call it inside a try block so `fail` can turn the error into a response.
const need = async (projectId, userId, min = "VIEWER") => {
  const access = await getAccess(projectId, userId);
  if (!access) throw Object.assign(new Error("Project not found"), { status: 404 });
  if (!can(access, min))
    throw Object.assign(new Error("You don't have permission to do that"), { status: 403 });
  return access;
};

const fail = (res, error, msg) => {
  if (error.status) return res.status(error.status).json({ message: error.message });
  if (error.code === "ENOENT") return res.status(404).json({ message: "Not found" });
  if (error.code === "EEXIST") return res.status(409).json({ message: "Already exists" });
  console.error(msg, error);
  return res.status(500).json({ message: msg });
};

/* ---------------------------- Projects ---------------------------- */

const createProject = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (typeof name !== "string" || !name.trim())
      return res.status(400).json({ message: "Project name is required" });

    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        description:
          typeof description === "string" && description.trim() ? description.trim() : null,
        ownerId: req.user.id,
      },
    });

    try {
      await createWorkspace(project.id);
    } catch (e) {
      // keep DB and disk consistent
      await prisma.project.delete({ where: { id: project.id } });
      throw e;
    }

    return res.status(201).json({ message: "Project created successfully", project });
  } catch (error) {
    return fail(res, error, "Failed to create project");
  }
};

const getAllCurrentUserProjects = async (req, res) => {
  try {
    const [owned, shared] = await Promise.all([
      prisma.project.findMany({ where: { ownerId: req.user.id }, orderBy: { updatedAt: "desc" } }),
      prisma.projectMember.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: "desc" },
        include: { project: { include: { owner: { select: { username: true } } } } },
      }),
    ]);
    return res.json({
      message: "Projects fetched successfully",
      projects: owned.map((p) => ({ ...p, role: "OWNER" })),
      shared: shared.map((m) => ({ ...m.project, role: m.role, ownerName: m.project.owner.username })),
    });
  } catch (error) {
    return fail(res, error, "Failed to fetch projects");
  }
};

const getProjectById = async (req, res) => {
  try {
    const role = await need(req.params.projectId, req.user.id, "VIEWER");
    const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
    return res.json({ message: "Project fetched successfully", project: { ...project, role } });
  } catch (error) {
    return fail(res, error, "Failed to fetch project");
  }
};

// Owner only (the query filters on ownerId)
const updateProject = async (req, res) => {
  try {
    const { projectId: id } = req.params;
    const { name, description } = req.body;

    if (name === undefined && description === undefined)
      return res.status(400).json({ message: "Provide at least one field to update" });

    const data = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim())
        return res.status(400).json({ message: "Project name cannot be empty" });
      data.name = name.trim();
    }

    if (description !== undefined) {
      if (description !== null && typeof description !== "string")
        return res.status(400).json({ message: "Description must be a string or null" });
      data.description = typeof description === "string" ? description.trim() || null : null;
    }

    const result = await prisma.project.updateMany({
      where: { id, ownerId: req.user.id },
      data,
    });
    if (result.count === 0) return res.status(404).json({ message: "Project not found" });

    const project = await prisma.project.findFirst({ where: { id, ownerId: req.user.id } });
    return res.status(200).json({ message: "Project updated successfully", project });
  } catch (error) {
    return fail(res, error, "Failed to update project");
  }
};

// Owner only (the query filters on ownerId)
const deleteProject = async (req, res) => {
  try {
    const { projectId: id } = req.params;
    const result = await prisma.project.deleteMany({
      where: { id, ownerId: req.user.id },
    });
    if (result.count === 0) return res.status(404).json({ message: "Project not found" });

    await invalidatePattern(`access:${id}:*`);

    await deleteWorkspace(id);
    return res.status(200).json({ message: "Project deleted successfully" });
  } catch (error) {
    return fail(res, error, "Failed to delete project");
  }
};

/* ------------------------- Files and folders ------------------------- */

// GET /projects/:projectId/tree          (VIEWER)
const getProjectHeirarchy = async (req, res) => {
  try {
    const { projectId } = req.params;
    await need(projectId, req.user.id, "VIEWER");

    const tree = await readTree(await safeResolve(projectId));
    return res.status(200).json({ message: "Project hierarchy fetched successfully", tree });
  } catch (error) {
    return fail(res, error, "Failed to fetch project hierarchy");
  }
};

// POST /projects/:projectId/nodes        (EDITOR)   body: { path, type, content? }
const createFileNode = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { path: rel, type, content = "" } = req.body;

    if (typeof rel !== "string" || !rel.trim() || !["FILE", "FOLDER"].includes(type))
      return res.status(400).json({ message: "Valid path and type are required" });
    if (typeof content !== "string")
      return res.status(400).json({ message: "Content must be a string" });

    await need(projectId, req.user.id, "EDITOR");

    const full = await safeResolve(projectId, rel);

    if (type === "FOLDER") {
      await fs.mkdir(full, { recursive: true });
    } else {
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, content, { flag: "wx" }); // error if it exists
    }
    return res.status(201).json({ message: "Created successfully", path: rel });
  } catch (error) {
    return fail(res, error, "Failed to create node");
  }
};

// GET /projects/:projectId/file?path=src/App.jsx          (VIEWER)
const getFileContent = async (req, res) => {
  try {
    const { projectId } = req.params;
    await need(projectId, req.user.id, "VIEWER");

    const full = await safeResolve(projectId, req.query.path);
    const stat = await fs.stat(full);
    if (!stat.isFile()) return res.status(400).json({ message: "Not a file" });
    if (stat.size > 2 * 1024 * 1024)
      return res.status(413).json({ message: "File too large to open" });

    const content = await fs.readFile(full, "utf8");
    return res.status(200).json({
      message: "File content fetched successfully",
      file: { path: req.query.path, content, updatedAt: stat.mtime },
    });
  } catch (error) {
    return fail(res, error, "Failed to fetch file content");
  }
};

// PUT /projects/:projectId/file          (EDITOR)   body: { path, content }
const updateFileContent = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { path: rel, content } = req.body;

    if (typeof content !== "string")
      return res.status(400).json({ message: "Content must be a string" });

    await need(projectId, req.user.id, "EDITOR");

    if (await hasRoom(projectId, rel))
       return res.status(409).json({ message: "This file is being edited live" });

    const full = await safeResolve(projectId, rel);
    await fs.stat(full); // must already exist (ENOENT -> 404)
    await fs.writeFile(full, content);

    return res.status(200).json({ message: "File saved successfully" });
  } catch (error) {
    return fail(res, error, "Failed to save file");
  }
};

// PATCH /projects/:projectId/nodes       (EDITOR)   body: { from, to }
const renameNode = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { from, to } = req.body;

    await need(projectId, req.user.id, "EDITOR");

    const src = await safeResolve(projectId, from);
    const dst = await safeResolve(projectId, to);
    await fs.mkdir(path.dirname(dst), { recursive: true });
    await fs.rename(src, dst);
    closeRoomsUnder(projectId, from);
    return res.status(200).json({ message: "Renamed successfully" });
  } catch (error) {
    return fail(res, error, "Failed to rename");
  }
};

// DELETE /projects/:projectId/nodes?path=src/old.js      (EDITOR)
const deleteNode = async (req, res) => {
  try {
    const { projectId } = req.params;
    await need(projectId, req.user.id, "EDITOR");

    const full = await safeResolve(projectId, req.query.path);
    if (full === (await safeResolve(projectId)))
      return res.status(400).json({ message: "Cannot delete project root" });

    await fs.rm(full, { recursive: true });
    closeRoomsUnder(projectId, req.query.path);
    return res.status(200).json({ message: "Deleted successfully" });
  } catch (error) {
    return fail(res, error, "Failed to delete");
  }
};

/* ------------------------ Search and replace ------------------------ */

const searchOptions = (body) => ({
  query: body.query,
  isRegex: !!body.isRegex,
  caseSensitive: !!body.caseSensitive,
  wholeWord: !!body.wholeWord,
});

// POST /projects/:projectId/search       (VIEWER)
const searchFiles = async (req, res) => {
  try {
    const { projectId } = req.params;
    await need(projectId, req.user.id, "VIEWER");

    await safeResolve(projectId); // makes sure the folder exists
    const out = await searchProject(projectId, searchOptions(req.body));
    return res.status(200).json(out);
  } catch (error) {
    return fail(res, error, "Search failed");
  }
};

// POST /projects/:projectId/replace      (EDITOR)   body: { ...search options, replacement, paths? }
const replaceInFiles = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { replacement, paths } = req.body;

    if (paths !== undefined && paths !== null &&
        (!Array.isArray(paths) || !paths.every((p) => typeof p === "string")))
      return res.status(400).json({ message: "paths must be an array of strings" });

    await need(projectId, req.user.id, "EDITOR");

    await safeResolve(projectId);
    const out = await replaceInProject(projectId, searchOptions(req.body), replacement, paths);
    return res.status(200).json(out);
  } catch (error) {
    return fail(res, error, "Replace failed");
  }
};

export default {
  createProject,
  getAllCurrentUserProjects,
  getProjectById,
  updateProject,
  deleteProject,
  getProjectHeirarchy,
  createFileNode,
  getFileContent,
  updateFileContent,
  renameNode,
  deleteNode,
  searchFiles,
  replaceInFiles,
};