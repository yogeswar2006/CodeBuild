
import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useProjectStore } from "../store/useProjectStore";

export const AUTOSAVE_MS = 5000;

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

    console.log("save() called", {
  id,
  dirty: buffersRef.current[id]?.dirty,
  loaded: buffersRef.current[id]?.loaded,
});

    if (!buf || !buf.dirty || !buf.loaded) return;
    

    if (!buf.projectId) {
      console.error("Cannot save: missing project ID", { id, buf });
      patch(id, { status: "error" });
      toast.error(`Cannot save ${buf.name}: missing project ID`);
      return;
    }

    // Avoid overlapping saves for the same file.
    if (buf.saving) return;

    const snapshot = buf.content;
    patch(id, { saving: true, status: "saving" });

    try {
      await saveFile(id, snapshot, buf.projectId);

      const current = buffersRef.current[id];
      if (!current) return;

      if (current.content === snapshot) {
        patch(id, {
          dirty: false,
          saving: false,
          status: "saved",
        });
      } else {
        patch(id, {
          saving: false,
          dirty: true,
          status: "unsaved",
        });

        timers.current[id] = setTimeout(
          () => save(id),
          AUTOSAVE_MS
        );
      }
    } catch (error) {
      console.error(
        "Save failed:",
        error.response?.status,
        error.response?.data || error
      );

      patch(id, { saving: false, status: "error" });

      toast.error(
        error.response?.data?.message || `Could not save ${buf.name}`
      );
    }
  },
  [patch, saveFile]
);



  const change = useCallback(
    (id, content) => {
      const buf = buffersRef.current[id];

      if (!buf || !buf.loaded || buf.content === content) return;

      patch(id, {
        content,
        dirty: true,
        status: "unsaved",
      });

      clearTimeout(timers.current[id]);
      timers.current[id] = setTimeout(
        () => save(id),
        AUTOSAVE_MS
      );
    },
    [patch, save]
  );

 const flushAll = useCallback(async () => {
  await Promise.all(
    Object.keys(buffersRef.current).map((id) => save(id))
  );
}, [save]);

  // Load projects on mount.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const list = await getProjects();

        if (!cancelled && Array.isArray(list) && list.length) {
          setProjectId(list[0].id);
          projectIdRef.current = list[0].id;
        }
      } catch {
        if (!cancelled) toast.error("Could not load projects");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getProjects]);

  // Load the selected project's file tree.
 useEffect(() => {
  if (!projectId) {
    setTree([]);
    return;
  }

  let cancelled = false;
  setTree([]);

  getProjectTree(projectId)
    .then((nodes) => {
      if (!cancelled) {
        setTree(
          nodes.map((node) => ({
            ...node,
            id: node.id ?? node._id,
            parentId: node.parentId ?? null,
            type: node.type?.toLowerCase(),
          }))
        );
      }
    })
    .catch(() => {
      if (!cancelled) toast.error("Could not load files");
    });

  return () => {
    cancelled = true;
  };
}, [projectId, getProjectTree]);

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
    async (name) => {
      try {
        const project = await createProject(name);

        if (!project?.id) {
          throw new Error("Created project has no id");
        }

        selectProject(project.id);
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
    if (!node || node.type?.toLowerCase() !== "file" || !node.id || !projectId) {
      toast.error("Invalid file or project ID");
      return;
    }

    setTabs((current) =>
      current.includes(node.id) ? current : [...current, node.id]
    );

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
      const file = await getFile(projectId, node.id);

      if (!buffersRef.current[node.id]) return;

      patch(node.id, {
        name: file.name ?? node.name,
        content: file.content ?? "",
        loaded: true,
      });
    } catch (error) {
      console.error("Could not open file:", error.response?.data || error);

      toast.error(
        error.response?.data?.message || `Could not open ${node.name}`
      );

      delete buffersRef.current[node.id];
      setBuffers({ ...buffersRef.current });

      setTabs((current) => current.filter((id) => id !== node.id));

      setActiveId((current) =>
        current === node.id ? null : current
      );
    } finally {
      loadingFiles.current.delete(node.id);
    }
  },
  [getFile, patch, projectId]
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

const createNode = useCallback(
  async (name, type, parentId = null) => {
    if (!projectId) return;

    try {
      const node = await createFileNode(projectId, {
        name: name.trim(),
        type: type.toUpperCase(),
        parentId, // Must be the selected folder's ID
        content: "",
      });

      const normalizedNode = {
        ...node,
        id: node.id ?? node._id,
        parentId: node.parentId ?? null,
        type: node.type.toLowerCase(),
      };

      setTree((prev) => [...prev, normalizedNode]);

      return normalizedNode;
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Could not create file or folder"
      );
      return null;
    }
  },
  [projectId, createFileNode]
);

  // Warn before leaving with unsaved changes and clean up timers.
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

  const project = projects.find(
    (item) => item.id === projectId
  ) ?? null;

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
  };
}
