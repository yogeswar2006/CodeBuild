import axios from "axios";

// If you already have an axios instance (e.g. lib/axios.js), import it here instead.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true,
});

// Backend ids can be `_id` (MongoDB) or `id`; the UI always uses `id`.
const node = (n) => ({
  id: n._id ?? n.id,
  name: n.name,
  type: n.type, // "file" | "folder"
  parentId: n.parentId ?? n.parent ?? null,
});

export const getProjects = () =>
  api.get("/projects").then((r) => r.data.map((p) => ({ id: p._id ?? p.id, name: p.name })));

export const createProject = (name) =>
  api.post("/projects", { name }).then((r) => ({ id: r.data._id ?? r.data.id, name: r.data.name }));

// Flat list of files and folders. The UI builds the tree from `parentId`.
export const getTree = (projectId) =>
  api.get(`/projects/${projectId}/files`).then((r) => r.data.map(node));

export const createNode = (projectId, body) =>
  api.post(`/projects/${projectId}/files`, body).then((r) => node(r.data));

export const getFile = (id) =>
  api.get(`/files/${id}`).then((r) => ({ content: r.data.content ?? "" }));

export const saveFile = (id, content) => api.put(`/files/${id}`, { content });
