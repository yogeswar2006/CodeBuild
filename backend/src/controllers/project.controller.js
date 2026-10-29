import prisma from "../lib/prisma.js"
import fs from "fs/promises";
import path from "path";
import {
  createWorkspace, deleteWorkspace, readTree, safeResolve,
} from "../lib/workspace.js";
import { searchProject, replaceInProject } from "../lib/search.js";


// ownership check used by every file route
const ownsProject = (projectId, userId) =>
  prisma.project.findFirst({
    where: { id: projectId, ownerId: userId },
    select: { id: true },
  });

  const fail = (res, error, msg) => {
     if (error.status === 400) return res.status(400).json({ message: error.message });
  // if (error.status === 400) return res.status(400).json({ message: "Invalid path" });
  if (error.code === "ENOENT") return res.status(404).json({ message: "Not found" });
  if (error.code === "EEXIST") return res.status(409).json({ message: "Already exists" });
  console.error(msg, error);
  return res.status(500).json({ message: msg });
};


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
};//done

const getAllCurrentUserProjects = async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      where: {
        ownerId: req.user.id
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    return res.status(200).json({
      message: 'Projects fetched successfully',
      projects
    });
  } catch (error) {
    console.error('Get projects error:', error);

    return res.status(500).json({
      message: 'Failed to fetch projects'
    });
  }
};

const getProjectById = async (req, res) => {
  try {
    const { projectId: id } = req.params;

    const project = await prisma.project.findFirst({
      where: {
        id,
        ownerId: req.user.id
      }
    });

    if (!project) {
      return res.status(404).json({
        message: 'Project not found'
      });
    }

    return res.status(200).json({
      message: 'Project fetched successfully',
      project
    });
  } catch (error) {
    console.error('Get project error:', error);

    return res.status(500).json({
      message: 'Failed to fetch project'
    });
  }
};

const updateProject = async (req, res) => {
  try {
    const { projectId: id  } = req.params;
    const { name, description } = req.body;

    if (name === undefined && description === undefined) {
      return res.status(400).json({
        message: 'Provide at least one field to update'
      });
    }

    const data = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({
          message: 'Project name cannot be empty'
        });
      }

      data.name = name.trim();
    }

    if (description !== undefined) {
      if (
        description !== null &&
        typeof description !== 'string'
      ) {
        return res.status(400).json({
          message: 'Description must be a string or null'
        });
      }

      data.description =
        typeof description === 'string'
          ? description.trim() || null
          : null;
    }

    const result = await prisma.project.updateMany({
      where: {
        id,
        ownerId: req.user.id
      },
      data
    });

    if (result.count === 0) {
      return res.status(404).json({
        message: 'Project not found'
      });
    }

    const project = await prisma.project.findFirst({
      where: {
        id,
        ownerId: req.user.id
      }
    });

    return res.status(200).json({
      message: 'Project updated successfully',
      project
    });
  } catch (error) {
    console.error('Update project error:', error);

    return res.status(500).json({
      message: 'Failed to update project'
    });
  }
};


const deleteProject = async (req, res) => {
  try {
    const { projectId: id  } = req.params;
    const result = await prisma.project.deleteMany({
      where: { id, ownerId: req.user.id },
    });
    if (result.count === 0)
      return res.status(404).json({ message: "Project not found" });

    await deleteWorkspace(id);
    return res.status(200).json({ message: "Project deleted successfully" });
  } catch (error) {
    return fail(res, error, "Failed to delete project");
  }
}; // done


// POST /projects/:projectId/nodes   body: { path, type, content? }
const createFileNode = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { path: rel, type, content = "" } = req.body;

    if (typeof rel !== "string" || !rel.trim() || !["FILE", "FOLDER"].includes(type))
      return res.status(400).json({ message: "Valid path and type are required" });
    if (typeof content !== "string")
      return res.status(400).json({ message: "Content must be a string" });
    if (!(await ownsProject(projectId, req.user.id)))
      return res.status(404).json({ message: "Project not found" });

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
};// done


// GET /projects/:projectId/tree
const getProjectHeirarchy = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!(await ownsProject(projectId, req.user.id)))
      return res.status(404).json({ message: "Project not found" });

    const tree = await readTree(await safeResolve(projectId));
    return res.status(200).json({ message: "Project hierarchy fetched successfully", tree });
  } catch (error) {
    return fail(res, error, "Failed to fetch project hierarchy");
  }
}; //done


// GET /projects/:projectId/file?path=src/App.jsx
const getFileContent = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!(await ownsProject(projectId, req.user.id)))
      return res.status(404).json({ message: "Project not found" });

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
}; // done

// PUT /projects/:projectId/file   body: { path, content }
const updateFileContent = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { path: rel, content } = req.body;

    if (typeof content !== "string")
      return res.status(400).json({ message: "Content must be a string" });
    if (!(await ownsProject(projectId, req.user.id)))
      return res.status(404).json({ message: "Project not found" });

    const full = await safeResolve(projectId, rel);
    await fs.stat(full); // must already exist (ENOENT -> 404)
    await fs.writeFile(full, content);

    return res.status(200).json({ message: "File saved successfully" });
  } catch (error) {
    return fail(res, error, "Failed to save file");
  }
};//done

// PATCH /projects/:projectId/nodes   body: { from, to }
const renameNode = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { from, to } = req.body;
    if (!(await ownsProject(projectId, req.user.id)))
      return res.status(404).json({ message: "Project not found" });

    const src = await safeResolve(projectId, from);
    const dst = await safeResolve(projectId, to);
    await fs.mkdir(path.dirname(dst), { recursive: true });
    await fs.rename(src, dst);
    return res.status(200).json({ message: "Renamed successfully" });
  } catch (error) {
    return fail(res, error, "Failed to rename");
  }
}; //done

// DELETE /projects/:projectId/nodes?path=src/old.js
const deleteNode = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!(await ownsProject(projectId, req.user.id)))
      return res.status(404).json({ message: "Project not found" });

    const full = await safeResolve(projectId, req.query.path);
    if (full === (await safeResolve(projectId)))
      return res.status(400).json({ message: "Cannot delete project root" });

    await fs.rm(full, { recursive: true });
    return res.status(200).json({ message: "Deleted successfully" });
  } catch (error) {
    return fail(res, error, "Failed to delete");
  }
};//done



const searchOptions = (body) => ({
  query: body.query,
  isRegex: !!body.isRegex,
  caseSensitive: !!body.caseSensitive,
  wholeWord: !!body.wholeWord,
});

// POST /projects/:projectId/search   body: { query, isRegex, caseSensitive, wholeWord }
const searchFiles = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!(await ownsProject(projectId, req.user.id)))
      return res.status(404).json({ message: "Project not found" });

    await safeResolve(projectId); // makes sure the folder exists
    const out = await searchProject(projectId, searchOptions(req.body));
    return res.status(200).json(out);
  } catch (error) {
    return fail(res, error, "Search failed");
  }
};

// POST /projects/:projectId/replace   body: { ...search options, replacement, paths? }
const replaceInFiles = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { replacement, paths } = req.body;

    if (paths !== undefined && paths !== null &&
        (!Array.isArray(paths) || !paths.every((p) => typeof p === "string")))
      return res.status(400).json({ message: "paths must be an array of strings" });

    if (!(await ownsProject(projectId, req.user.id)))
      return res.status(404).json({ message: "Project not found" });

    await safeResolve(projectId);
    const out = await replaceInProject(projectId, searchOptions(req.body), replacement, paths);
    return res.status(200).json(out);
  } catch (error) {
    return fail(res, error, "Replace failed");
  }
};


export default {
  createProject, getAllCurrentUserProjects,
  getProjectById, updateProject, deleteProject,
  getProjectHeirarchy, createFileNode,getFileContent,updateFileContent,renameNode,deleteNode,
  searchFiles , replaceInFiles
}