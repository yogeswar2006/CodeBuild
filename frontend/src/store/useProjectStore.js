
import { create } from "zustand";
import api from "../lib/axios";

export const useProjectStore = create((set, get) => ({
  projects: [],
  loading: false,
  error: null,

  // GET: Fetch all projects belonging to the logged-in user
  getProjects: async () => {
    set({ loading: true, error: null });

    try {
      const res = await api.get("/projects/fetch");

      const projects = res.data.projects ?? res.data;

      set({ projects, loading: false });

      return projects;
    } catch (error) {
      set({
        loading: false,
        error: error.response?.data?.message || "Failed to fetch projects",
      });

      throw error;
    }
  },

  // POST: Create a project
  createProject: async (data) => {
    try {
      const res = await api.post("/projects/create", { name:data.name , description:data.description });

      const project = res.data.project ?? res.data;

      set((state) => ({
        projects: [...state.projects, project],
        error: null,
      }));

      return project;
    } catch (error) {
      set({
        error: error.response?.data?.message || "Failed to create project",
      });

      throw error;
    }
  },

  // GET: Fetch a project's complete file tree
 
getProjectTree: async (projectId) => {
  try {
    const res = await api.get(`/projects/${projectId}/tree`);

    const tree = res.data.tree ?? res.data;

    if (!Array.isArray(tree)) {
      throw new Error("Invalid project tree response");
    }

    // Convert nested children into the flat structure Explorer expects.
    const flattenTree = (nodes, parentId = null) => {
      const result = [];

      for (const node of nodes) {
        const { children = [], ...data } = node;

        result.push({
          ...data,
          id: node.id ?? node._id,
          parentId: node.parentId ?? parentId,
          type: node.type?.toLowerCase(),
        });

        if (Array.isArray(children) && children.length > 0) {
          result.push(...flattenTree(children, node.id ?? node._id));
        }
      }

      return result;
    };

    return flattenTree(tree);
  } catch (error) {
    set({
      error:
        error.response?.data?.message ||
        error.message ||
        "Failed to fetch project files",
    });

    throw error;
  }
},


  // POST: Create a file or folder inside a project
 createFileNode: async (
  projectId,
  { name, type, parentId = null, content = "" }
) => {
  try {
    const res = await api.post("projects/create/filenode", {
      name,
      type: type.toUpperCase(),
      projectId,
      parentId,
      content: type.toUpperCase() === "FILE" ? content : "",
    });

    return res.data.filenode;
  } catch (error) {
    set({
      error:
        error.response?.data?.message || "Failed to create file or folder",
    });
    throw error;
  }
},

  // GET: Fetch a file's content
 getFile: async (projectId, fileId) => {
  if (!projectId || !fileId) {
    throw new Error("Project ID and file ID are required");
  }

  try {
    const res = await api.get(
      `/projects/${projectId}/files/${fileId}`
    );

    return res.data.filenode ?? res.data.file ?? res.data;
  } catch (error) {
    console.error("Get file failed:", error.response?.data);
    throw error;
  }
},

  // PATCH: Save the latest file content


saveFile: async (fileId, content, projectId) => {
  if (!projectId || !fileId) {
    throw new Error("Project ID and file ID are required to save");
  }

  try {
    const res = await api.patch(
      `/projects/${projectId}/files/${fileId}`,
      { content }
    );

    return res.data.file;
  } catch (error) {
    console.error("Save API error:", {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });

    set({
      error: error.response?.data?.message || "Failed to save file",
    });

    throw error;
  }
},


}));
