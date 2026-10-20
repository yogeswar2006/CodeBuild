import prisma from "../lib/prisma.js"



const createProject =async(req,res)=>{
    
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

export default {createProject,getAllCurrentUserProjects,getProjectById,updateProject,deleteProject}