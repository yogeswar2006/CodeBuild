import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useProjectStore } from "../store/useProjectStore";

export const AUTOSAVE_MS = 5000;

// In this hook, a file's "id" is its relative path, e.g. "src/components/Button.jsx".
export default function useWorkspace() {
  const {
  projects, sharedProjects, loading, getProjects, createProject, getProjectTree,
  createFileNode, getFile, saveFile,
  renameNode: apiRenameNode,
  deleteNode: apiDeleteNode,
} = useProjectStore();

  const [reveal, setReveal] = useState(null); // { path, line, column, length, n }

  const [projectId, setProjectId] = useState(null);
  const [tree, setTree] = useState([]);
  const [tabs, setTabs] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [buffers, setBuffers] = useState({});

  const buffersRef = useRef({});
  const timers = useRef({});
  const loadingFiles = useRef(new Set());
  const projectIdRef = useRef(null);

  // Current project and my role in it: OWNER | EDITOR | VIEWER
  const project = [...projects, ...sharedProjects].find((p) => p.id === projectId) ?? null;
  const role = project?.role ?? null;
  const canEdit = role === "OWNER" || role === "EDITOR";
  const canEditRef = useRef(false);
  canEditRef.current = canEdit;

  const patch = useCallback((id, values, create = false) => {
    if (!create && !buffersRef.current[id]) return;
    buffersRef.current = {
      ...buffersRef.current,
      [id]: { ...buffersRef.current[id], ...values },
    };
    setBuffers(buffersRef.current);
  }, []);

  const save = useCallback(
    async (id) => {
      clearTimeout(timers.current[id]);
      delete timers.current[id];

      const buf = buffersRef.current[id];
      if (!buf || !buf.dirty || !buf.loaded) return;

      if (!buf.projectId) {
        patch(id, { status: "error" });
        toast.error(`Cannot save ${buf.name}: missing project ID`);
        return;
      }

      if (buf.saving) return; // avoid overlapping saves

      const snapshot = buf.content;
      patch(id, { saving: true, status: "saving" });

      try {
        await saveFile(buf.projectId, id, snapshot); // id === path

        const current = buffersRef.current[id];
        if (!current) return;

        if (current.content === snapshot) {
          patch(id, { dirty: false, saving: false, status: "saved" });
        } else {
          // user kept typing while the request was in flight
          patch(id, { saving: false, dirty: true, status: "unsaved" });
          timers.current[id] = setTimeout(() => save(id), AUTOSAVE_MS);
        }
      } catch (error) {
        patch(id, { saving: false, status: "error" });
        toast.error(error.response?.data?.message || `Could not save ${buf.name}`);
      }
    },
    [patch, saveFile]
  );

  const change = useCallback(
    (id, content) => {
      if (!canEditRef.current) return; // viewers never edit or autosave
      const buf = buffersRef.current[id];
      if (!buf || !buf.loaded || buf.content === content) return;

      patch(id, { content, dirty: true, status: "unsaved" });

      clearTimeout(timers.current[id]);
      timers.current[id] = setTimeout(() => save(id), AUTOSAVE_MS);
    },
    [patch, save]
  );

  const flushAll = useCallback(async () => {
    await Promise.all(Object.keys(buffersRef.current).map((id) => save(id)));
  }, [save]);

  // Load projects on mount.
 const LAST_KEY = "codespace-last-project";

useEffect(() => {
  let cancelled = false;
  (async () => {
    try {
      const list = await getProjects();
      if (cancelled || !Array.isArray(list) || !list.length) return;

      let saved = null;
      try { saved = localStorage.getItem(LAST_KEY); } catch { /* ignore */ }

      const pick = list.find((p) => p.id === saved) ?? list[0];
      projectIdRef.current = pick.id;
      setProjectId(pick.id);
    } catch {
      if (!cancelled) toast.error("Could not load projects");
    }
  })();
  return () => { cancelled = true; };
}, [getProjects]);

// remember the selection
useEffect(() => {
  if (!projectId) return;
  try { localStorage.setItem(LAST_KEY, projectId); } catch { /* ignore */ }
}, [projectId]);

  // (Re)load the file tree. Also used after the terminal changes files on disk.
  const refreshTree = useCallback(
    async (id = projectIdRef.current) => {
      if (!id) return;
      try {
        const nodes = await getProjectTree(id);
        if (projectIdRef.current === id) setTree(nodes); // ignore stale responses
      } catch {
        toast.error("Could not load files");
      }
    },
    [getProjectTree]
  );

  useEffect(() => {
    setTree([]);
    if (projectId) refreshTree(projectId);
  }, [projectId, refreshTree]);

  const selectProject = useCallback(
    async (id) => {
      if (id === projectIdRef.current) return;

      await flushAll();

      Object.values(timers.current).forEach(clearTimeout);
      timers.current = {};

      buffersRef.current = {};
      setBuffers({});
      setTabs([]);
      setActiveId(null);
      setTree([]);

      projectIdRef.current = id;
      setProjectId(id);
    },
    [flushAll]
  );

  const addProject = useCallback(
    async (data) => {
      try {
        const created = await createProject(data);
        if (!created?.id) throw new Error("Created project has no id");
        await selectProject(created.id);
        toast.success("Project created");
        return true;
      } catch {
        toast.error("Could not create project");
        return false;
      }
    },
    [createProject, selectProject]
  );

  const openFile = useCallback(
    async (node) => {
      if (!node || node.type !== "file" || !node.id || !projectId) {
        toast.error("Invalid file or project");
        return;
      }

      setTabs((current) => (current.includes(node.id) ? current : [...current, node.id]));
      setActiveId(node.id);

      if (buffersRef.current[node.id]?.loaded) return;
      if (loadingFiles.current.has(node.id)) return;

      loadingFiles.current.add(node.id);

      patch(
        node.id,
        {
          name: node.name,
          content: "",
          loaded: false,
          dirty: false,
          status: "saved",
          projectId,
        },
        true
      );

      try {
        const file = await getFile(projectId, node.id); // node.id === path

        if (!buffersRef.current[node.id]) return;

        patch(node.id, { content: file.content ?? "", loaded: true });
      } catch (error) {
        toast.error(error.response?.data?.message || `Could not open ${node.name}`);

        const { [node.id]: _removed, ...rest } = buffersRef.current;
        buffersRef.current = rest;
        setBuffers(rest);
        setTabs((current) => current.filter((id) => id !== node.id));
        setActiveId((current) => (current === node.id ? null : current));
      } finally {
        loadingFiles.current.delete(node.id);
      }
    },
    [getFile, patch, projectId]
  );

  // Open a file and jump to a match
  const openAt = useCallback(
    async (path, line = 1, column = 1, length = 0) => {
      await openFile({ id: path, name: path.split("/").pop(), type: "file" });
      setReveal({ path, line, column, length, n: Date.now() });
    },
    [openFile]
  );

  // After a replace-in-files or git pull, refresh open tabs whose files changed on disk
  const reloadFiles = useCallback(
    async (paths) => {
      const pid = projectIdRef.current;
      await Promise.all(
        paths
          .filter((p) => buffersRef.current[p])
          .map(async (p) => {
            clearTimeout(timers.current[p]);
            delete timers.current[p];
            try {
              const file = await getFile(pid, p);
              patch(p, { content: file.content ?? "", dirty: false, status: "saved" });
            } catch {
              /* file no longer exists */
            }
          })
      );
    },
    [getFile, patch]
  );

  const closeTab = useCallback(
    (id) => {
      save(id);

      const index = tabs.indexOf(id);
      const next = tabs.filter((tabId) => tabId !== id);
      setTabs(next);

      if (activeId === id) {
        setActiveId(next[index] ?? next[index - 1] ?? null);
      }
    },
    [tabs, activeId, save]
  );

  // parentId is the parent FOLDER'S PATH (or null for the project root)
  const createNode = useCallback(
    async (name, type, parentId = null) => {
      if (!projectId || !canEditRef.current) return null;

      const clean = name.trim();
      const path = parentId ? `${parentId}/${clean}` : clean;

      try {
        await createFileNode(projectId, { path, type });

        const node = {
          id: path,
          path,
          name: clean,
          parentId,
          type: type.toLowerCase(),
        };
        setTree((prev) => [...prev, node]);
        return node;
      } catch (error) {
        toast.error(error.response?.data?.message || "Could not create file or folder");
        return null;
      }
    },
    [projectId, createFileNode]
  );

  const isUnder = (p, base) => p === base || p.startsWith(base + "/");

// Rename or move a file/folder. Open tabs and buffers follow the new path.
const renameNode = useCallback(
  async (from, to) => {
    if (!projectId || !canEditRef.current) return false;
    try {
      await flushAll(); // save pending edits before the path changes
      await apiRenameNode(projectId, from, to);

      const remap = (id) => (isUnder(id, from) ? to + id.slice(from.length) : id);

      const next = {};
      for (const [id, buf] of Object.entries(buffersRef.current)) {
        const nid = remap(id);
        next[nid] = nid === id ? buf : { ...buf, name: nid.split("/").pop() };
      }
      buffersRef.current = next;
      setBuffers(next);
      setTabs((t) => t.map(remap));
      setActiveId((a) => (a ? remap(a) : a));

      await refreshTree();
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not rename");
      return false;
    }
  },
  [projectId, flushAll, apiRenameNode, refreshTree]
);

// Delete a file/folder and close any tabs inside it.
const deleteNode = useCallback(
  async (path) => {
    if (!projectId || !canEditRef.current) return false;
    try {
      await apiDeleteNode(projectId, path);

      const removed = Object.keys(buffersRef.current).filter((id) => isUnder(id, path));
      removed.forEach((id) => {
        clearTimeout(timers.current[id]);
        delete timers.current[id];
      });
      const rest = Object.fromEntries(
        Object.entries(buffersRef.current).filter(([id]) => !isUnder(id, path))
      );
      buffersRef.current = rest;
      setBuffers(rest);

      const remaining = tabs.filter((id) => !isUnder(id, path));
      setTabs(remaining);
      if (activeId && isUnder(activeId, path)) setActiveId(remaining[remaining.length - 1] ?? null);

      await refreshTree();
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not delete");
      return false;
    }
  },
  [projectId, apiDeleteNode, tabs, activeId, refreshTree]
);

  // Warn before leaving with unsaved changes and flush on unmount.
  useEffect(() => {
    const warn = (event) => {
      if (Object.values(buffersRef.current).some((buf) => buf.dirty)) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      flushAll();
    };
  }, [flushAll]);

  return {
    projects,
    sharedProjects,
    projectId,
    project,
    role,
    canEdit,
    tree,
    loading,
    tabs,
    activeId,
    setActiveId,
    buffers,
    selectProject,
    addProject,
    openFile,
    closeTab,
    change,
    save,
    createNode,
    refreshTree,
    reveal,
    openAt,
    reloadFiles,
    flushAll,
    renameNode,
    deleteNode,
  };
}