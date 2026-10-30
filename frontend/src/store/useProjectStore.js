import { create } from "zustand";
import api from "../lib/axios";

const msg = (error, fallback) => error.response?.data?.message || fallback;

// Backend returns a nested tree: { name, path, type: "FILE"|"FOLDER", children }.
// Explorer wants a flat list, so: id = path, parentId = parent folder's path.
const flattenTree = (nodes, parentId = null) =>
  nodes.flatMap(({ children = [], ...node }) => [
    { ...node, id: node.path, parentId, type: node.type.toLowerCase() },
    ...flattenTree(children, node.path),
  ]);

export const useProjectStore = create((set) => ({
  projects: [],
  loading: false,
  error: null,

  // GET /projects
  getProjects: async () => {
    set({ loading: true, error: null });
    try {
      const res = await api.get("/projects");
      const projects = res.data.projects ?? [];
      set({ projects, loading: false });
      return projects;
    } catch (error) {
      set({ loading: false, error: msg(error, "Failed to fetch projects") });
      throw error;
    }
  },

  // POST /projects
  createProject: async ({ name, description }) => {
    try {
      const res = await api.post("/projects", { name, description });
      const project = res.data.project;
      set((state) => ({ projects: [project, ...state.projects], error: null }));
      return project;
    } catch (error) {
      set({ error: msg(error, "Failed to create project") });
      throw error;
    }
  },

  // GET /projects/:projectId/tree
  getProjectTree: async (projectId) => {
    try {
      const res = await api.get(`/projects/${projectId}/tree`);
      if (!Array.isArray(res.data.tree)) throw new Error("Invalid tree response");
      return flattenTree(res.data.tree);
    } catch (error) {
      set({ error: msg(error, "Failed to fetch project files") });
      throw error;
    }
  },

  // POST /projects/:projectId/nodes   body: { path, type, content }
  createFileNode: async (projectId, { path, type, content = "" }) => {
    try {
      await api.post(`/projects/${projectId}/nodes`, {
        path,
        type: type.toUpperCase(),
        content: type.toUpperCase() === "FILE" ? content : "",
      });
    } catch (error) {
      set({ error: msg(error, "Failed to create file or folder") });
      throw error;
    }
  },

  // PATCH /projects/:projectId/nodes   body: { from, to }
  renameNode: async (projectId, from, to) => {
    await api.patch(`/projects/${projectId}/nodes`, { from, to });
  },

  // DELETE /projects/:projectId/nodes?path=...
  deleteNode: async (projectId, path) => {
    await api.delete(`/projects/${projectId}/nodes`, { params: { path } });
  },

  // GET /projects/:projectId/file?path=...   -> { path, content, updatedAt }
  getFile: async (projectId, path) => {
    if (!projectId || !path) throw new Error("Project ID and path are required");
    const res = await api.get(`/projects/${projectId}/file`, { params: { path } });
    return res.data.file;
  },

  // PUT /projects/:projectId/file   body: { path, content }
  saveFile: async (projectId, path, content) => {
    if (!projectId || !path) throw new Error("Project ID and path are required");
    try {
      await api.put(`/projects/${projectId}/file`, { path, content });
    } catch (error) {
      set({ error: msg(error, "Failed to save file") });
      throw error;
    }
  },

  // POST /projects/:projectId/search -> { results: [{ path, matches }], total, truncated }
  searchFiles: async (projectId, opts) => {
    const res = await api.post(`/projects/${projectId}/search`, opts);
    return res.data;
  },

  // POST /projects/:projectId/replace -> { changed: [{ path, count }], replacements }
  replaceInFiles: async (projectId, opts, replacement, paths) => {
    const res = await api.post(`/projects/${projectId}/replace`, { ...opts, replacement, paths });
    return res.data;
  },



  gitStatus: async (id) => (await api.get(`/projects/${id}/git/status`)).data,
  gitInit: (id) => api.post(`/projects/${id}/git/init`),
  gitStage: (id, paths = []) => api.post(`/projects/${id}/git/stage`, { paths }),
  gitUnstage: (id, paths = []) => api.post(`/projects/${id}/git/unstage`, { paths }),
  gitCommit: (id, message) => api.post(`/projects/${id}/git/commit`, { message }),
  gitSetRemote: (id, url) => api.put(`/projects/${id}/git/remote`, { url }),
  gitPush: async (id) => (await api.post(`/projects/${id}/git/push`)).data,
  gitPull: async (id) => (await api.post(`/projects/${id}/git/pull`)).data,

}));