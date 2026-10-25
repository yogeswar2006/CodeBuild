import prisma from "../lib/prisma.js"



const createProject = async (req, res) => {

  try { 
    const { name, description } = req.body;

    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        message: 'Project name is required'
      });
    }

    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        description:
          typeof description === 'string' && description.trim()
            ? description.trim()
            : null,
        ownerId: req.user.id
      }
    });

    return res.status(201).json({
      message: 'Project created successfully',
      project
    });
  } catch (error) {
    console.error('Project creation error:', error);

    return res.status(500).json({
      message: 'Failed to create project'
    });
  }
}

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
    const { id } = req.params;

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
    const { id } = req.params;
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
    const { id } = req.params;

    const result = await prisma.project.deleteMany({
      where: {
        id,
        ownerId: req.user.id
      }
    });

    if (result.count === 0) {
      return res.status(404).json({
        message: 'Project not found'
      });
    }

    return res.status(200).json({
      message: 'Project deleted successfully'
    });
  } catch (error) {
    console.error('Delete project error:', error);

    return res.status(500).json({
      message: 'Failed to delete project'
    });
  }
};


const createFileNode = async (req, res) => {
  try {
    const { name, type, projectId, parentId = null } = req.body;
    let { content = "" } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      !["FILE", "FOLDER"].includes(type) ||
      !projectId
    ) {
      return res.status(400).json({
        message: "Valid name, type, and projectId are required"
      });
    }

    if (typeof content !== "string") {
      return res.status(400).json({
        message: "Content must be a string"
      });
    }

    if (type === "FOLDER" && content.trim()) {
      return res.status(400).json({
        message: "Folders cannot have content"
      });
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ownerId: req.user.id
      },
      select: { id: true }
    });

    if (!project) {
      return res.status(404).json({
        message: "Project not found"
      });
    }

    let validParentId = parentId;

    if (validParentId !== null) {
      if (
        typeof validParentId !== "string" ||
        !validParentId.trim()
      ) {
        return res.status(400).json({
          message: "Invalid parentId"
        });
      }

      const parent = await prisma.fileNode.findFirst({
        where: {
          id: validParentId,
          projectId,
          type: "FOLDER"
        },
        select: { id: true }
      });

      if (!parent) {
        return res.status(400).json({
          message: "Parent folder not found in this project"
        });
      }
    }

    const filenode = await prisma.fileNode.create({
      data: {
        name: name.trim(),
        type,
        content: type === "FILE" ? content : null,
        projectId,
        parentId: validParentId
      }
    });

    return res.status(201).json({
      message: "FileNode created successfully",
      filenode
    });
  } catch (error) {
    console.error("Error creating FileNode:", error);

    return res.status(500).json({
      message: "Failed to create FileNode"
    });
  }
};


const getProjectHeirarchy = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ownerId: req.user.id
      },
      select: { id: true }
    });

    if (!project) {
      return res.status(404).json({
        message: "Project not found"
      });
    }

    const nodes = await prisma.fileNode.findMany({
      where: { projectId },
      select: {
        id: true,
        name: true,
        type: true,
        parentId: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        name: "asc"
      }
    });

    const nodeMap = new Map();

    for (const node of nodes) {
      nodeMap.set(node.id, {
        ...node,
        children: []
      });
    }

    const rootNodes = [];

    for (const node of nodeMap.values()) {
      if (node.parentId === null) {
        rootNodes.push(node);
      } else {
        const parent = nodeMap.get(node.parentId);

        if (parent) {
          parent.children.push(node);
        }
      }
    }

    return res.status(200).json({
      message: "Project hierarchy fetched successfully",
      tree: rootNodes
    });
  } catch (error) {
    console.error("Error fetching project hierarchy:", error);

    return res.status(500).json({
      message: "Failed to fetch project hierarchy"
    });
  }
};


const getFileContent = async (req, res) => {
  try {
    const { projectId, fileId } = req.params;

    const file = await prisma.fileNode.findFirst({
      where: {
        id: fileId,
        projectId,
        type: "FILE",
        project: {
          ownerId: req.user.id
        }
      },
      select: {
        id: true,
        name: true,
        type: true,
        content: true,
        projectId: true,
        parentId: true,
        updatedAt: true
      }
    });

    if (!file) {
      return res.status(404).json({
        message: "File not found"
      });
    }

    return res.status(200).json({
      message: "File content fetched successfully",
      file
    });
  } catch (error) {
    console.error("Error fetching file content:", error);

    return res.status(500).json({
      message: "Failed to fetch file content"
    });
  }
};

const updateFileContent = async (req, res) => {
  try {
    const { projectId, fileId } = req.params;
    const { content } = req.body;

    if (typeof content !== "string") {
      return res.status(400).json({
        message: "Content must be a string"
      });
    }

    const result = await prisma.fileNode.updateMany({
      where: {
        id: fileId,
        projectId,
        type: "FILE",
        project: {
          ownerId: req.user.id
        }
      },
      data: { content }
    });

    if (result.count === 0) {
      return res.status(404).json({
        message: "File not found"
      });
    }

     const file = await prisma.fileNode.findFirst({
      where: {
        id: fileId,
        projectId,
        type: "FILE",
        project: {
          ownerId: req.user.id
        }
      },
      select: {
        id: true,
        name: true,
        type: true,
        content: true,
        projectId: true,
        parentId: true,
        updatedAt: true
      }
    });

    return res.status(200).json({
      message: "File saved successfully",
      file
    });
  } catch (error) {
    console.error("Error saving file:", error);

    return res.status(500).json({
      message: "Failed to save file"
    });
  }
};



export default {
  createProject, getAllCurrentUserProjects,
  getProjectById, updateProject, deleteProject,
  getProjectHeirarchy, createFileNode,getFileContent,updateFileContent
}