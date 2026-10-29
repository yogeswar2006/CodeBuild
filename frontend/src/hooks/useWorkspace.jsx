import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useProjectStore } from "../store/useProjectStore";

export const AUTOSAVE_MS = 5000;

// In this hook, a file's "id" is its relative path, e.g. "src/components/Button.jsx".
export default function useWorkspace() {
  const {
    projects,
    loading,
    getProjects,
    createProject,
    getProjectTree,
    createFileNode,
    getFile,
    saveFile,
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
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getProjects();
        if (!cancelled && Array.isArray(list) && list.length) {
          projectIdRef.current = list[0].id;
          setProjectId(list[0].id);
        }
      } catch {
        if (!cancelled) toast.error("Could not load projects");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getProjects]);

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
        const project = await createProject(data);
        if (!project?.id) throw new Error("Created project has no id");
        await selectProject(project.id);
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

  // After a replace-in-files, refresh any open tabs whose files changed on disk
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
      if (!projectId) return null;

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

  const project = projects.find((item) => item.id === projectId) ?? null;

  return {
    projects,
    projectId,
    project,
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
    reveal, openAt, reloadFiles, flushAll,
  };
}