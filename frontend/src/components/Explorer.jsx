import { useMemo, useState } from "react";
import toast from "react-hot-toast";

import {
  ChevronDown,
  ChevronRight,
  RefreshCw,
  FilePlus,
  FolderPlus,
  Folder,
  FolderOpen,
  Layers,
  Plus,
} from "lucide-react";
import { getFileIcon } from "../lib/fileTypes"

const FOLDER_COLOR = "#dcb67a";




function InlineInput({
  icon,
  color,
  depth,
  placeholder,
  onSubmit,
  onCancel,
  showDescription = false,
}) {
  const Icon = icon;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = () => {
    if (!name.trim()) return;

    onSubmit(
      name.trim(),
      showDescription ? description.trim() : undefined
    );
  };

  return (
    <div
      className="flex flex-col gap-2 py-2 pr-2"
      style={{ paddingLeft: 12 + depth * 12 }}
    >
      <div className="flex items-center gap-1.5">
        <Icon size={16} style={{ color }} className="shrink-0" />

        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (showDescription) {
                document.getElementById("project-description")?.focus();
              } else {
                handleSubmit();
              }
            }

            if (e.key === "Escape") onCancel();
          }}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-sm border border-[#7BE5C4] bg-[#3c3c3c] px-1.5 py-0.5 text-[13px] text-white outline-none"
        />
      </div>

      {showDescription && (
        <textarea
          id="project-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }

            if (e.key === "Escape") onCancel();
          }}
          placeholder="Project description (optional)"
          rows={2}
          className="min-w-0 rounded-sm border border-[#454545] bg-[#3c3c3c] px-2 py-1 text-[13px] text-white outline-none focus:border-[#7BE5C4]"
        />
      )}
    </div>
  );
}


export default function Explorer({ ws }) {
  const [expanded, setExpanded] = useState(() => new Set());
  const [selectedId, setSelectedId] = useState(null);
  const [creating, setCreating] = useState(null); // { parentId, type }
  const [newProject, setNewProject] = useState(false);

  // parentId -> sorted children (folders first, then A-Z)
  const byParent = useMemo(() => {
    const map = {};
    ws.tree.forEach((n) => (map[n.parentId ?? "root"] ||= []).push(n));
    Object.values(map).forEach((list) =>
      list.sort((a, b) =>
        a.type === b.type
          ? a.name.localeCompare(b.name)
          : a.type === "folder"
          ? -1
          : 1
      )
    );
    return map;
  }, [ws.tree]);

  const toggle = (id) =>
    setExpanded((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // Like VS Code: new items go in the selected folder (or beside the selected file)
  const startCreate = (type) => {
    if (!ws.projectId) return;
    const sel = ws.tree.find((n) => n.id === selectedId);
    const parentId = !sel ? null : sel.type === "folder" ? sel.id : sel.parentId;
    if (parentId) setExpanded((s) => new Set(s).add(parentId));
    setCreating({ parentId, type });
  };


const submitCreate = async (name) => {
  if (!name?.trim()) {
    setCreating(null);
    return;
  }

  const trimmedName = name.trim();

  if (/[\\/]/.test(trimmedName)) {
    return toast.error("Names can't contain slashes.");
  }

  const siblings = byParent[creating.parentId ?? "root"] || [];

  if (
    siblings.some(
      (n) => n.name.toLowerCase() === trimmedName.toLowerCase()
    )
  ) {
    return toast.error(`"${trimmedName}" already exists here.`);
  }

  const created = await ws.createNode(
    trimmedName,
    creating.type,
    creating.parentId
  );

  if (created) setCreating(null);
};


  const renderLevel = (parentId, depth) => (
    <>
      {creating && (creating.parentId ?? null) === parentId && (
        <InlineInput
          depth={depth}
          icon={creating.type === "folder" ? Folder : getFileIcon("x.txt")[0]}
          color={creating.type === "folder" ? FOLDER_COLOR : "#9da5b4"}
          placeholder={creating.type === "folder" ? "Folder name" : "File name, e.g. main.py"}
          onSubmit={submitCreate}
          onCancel={() => setCreating(null)}
        />
      )}

      {(byParent[parentId ?? "root"] || []).map((n) => {
        const isFolder = n.type === "folder";
        const open = expanded.has(n.id);
        const [FileIcon, fileColor] = getFileIcon(n.name);
        const active = ws.activeId === n.id;
        const selected = selectedId === n.id;

        return (
          <div key={n.id}>
            <button
              type="button"
              onClick={() => {
                setSelectedId(n.id);
                isFolder ? toggle(n.id) : ws.openFile(n);
              }}
              className={`flex w-full items-center gap-1.5 py-[3px] pr-2 text-left text-[13px] hover:bg-[#2a2d2e] ${
                active || selected ? "bg-[#37373d] text-white" : "text-[#cccccc]"
              }`}
              style={{ paddingLeft: 6 + depth * 12 }}
            >
              {isFolder ? (
                <>
                  {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  {open ? (
                    <FolderOpen size={16} style={{ color: FOLDER_COLOR }} />
                  ) : (
                    <Folder size={16} style={{ color: FOLDER_COLOR }} />
                  )}
                </>
              ) : (
                <>
                  <span className="w-[14px] shrink-0" />
                  <FileIcon size={16} style={{ color: fileColor }} className="shrink-0" />
                </>
              )}
              <span className="truncate">{n.name}</span>
            </button>
            {isFolder && open && renderLevel(n.id, depth + 1)}
          </div>
        );
      })}
    </>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col"
    style={{ fontFamily: '"Inter", sans-serif' }}
    >
      {/* All projects */}
      <div className="flex items-center justify-between px-3 pb-1 pt-3 text-xs font-bold text-[#9da5b4]">
        <span>Projects</span>
        <button
          type="button"
          onClick={() => setNewProject(true)}
          title="New project"
          className="rounded p-1 hover:bg-[#3c3c3c] hover:text-white"
        >
          <Plus size={15} />
        </button>
      </div>

      <div className="max-h-40 shrink-0 overflow-y-auto pb-2">
        {newProject && (
          <InlineInput
            depth={0}
            icon={Layers}
            color="#7BE5C4"
            placeholder="Project name"
            onSubmit={(name,description) => {
              if (name) ws.addProject({name,description});
              setNewProject(false);
            }}
            onCancel={() => setNewProject(false)}
          />
        )}
        {!ws.loading && ws.projects.length === 0 && !newProject && (
          <p className="px-3 py-2 text-xs text-[#6b7280]">
            No projects yet. Use + to create one.
          </p>
        )}
        {ws.projects.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => ws.selectProject(p.id)}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left font-bold text-[14px] hover:bg-[#2a2d2e] ${
              p.id === ws.projectId
                ? "bg-[#37373d] font-bold text-white"
                : "text-[#cccccc]"
            }`}
          >
            <Layers
              size={15}
              className="shrink-0"
              style={{ color: p.id === ws.projectId ? "#7BE5C4" : "#6b7280" }}
            />
            <span className="truncate">{p.name}</span>
          </button>
        ))}
      </div>

      {/* Selected project: name, then its folders and files */}
      <div className="flex items-center justify-between border-t border-[#3c3c3c] px-3 py-2">
        <span className="truncate text-[15px] font-bold text-white">
          {ws.project?.name || "Explorer"}
        </span>
        <div className="flex shrink-0 gap-0.5 text-[#9da5b4]">
          <button
            type="button"
            onClick={() => startCreate("file")}
            title="New file"
            className="rounded p-1 hover:bg-[#3c3c3c] hover:text-white"
          >
            <FilePlus size={16} />
          </button>
          <button
            type="button"
            onClick={() => startCreate("folder")}
            title="New folder"
            className="rounded p-1 hover:bg-[#3c3c3c] hover:text-white"
          >
            <FolderPlus size={16} />
          </button>
            {/* // inside the icon group: */}
          <button type="button" onClick={() => ws.refreshTree()} title="Refresh"
            className="rounded p-1 hover:bg-[#3c3c3c] hover:text-white">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto pb-4"
        onClick={(e) => e.target === e.currentTarget && setSelectedId(null)}
      >
        {ws.projectId ? (
          renderLevel(null, 0)
        ) : (
          <p className="px-3 py-2 text-xs text-[#6b7280]">
            Select a project to see its files.
          </p>
        )}
        {ws.projectId && ws.tree.length === 0 && !creating && (
          <p className="px-3 py-2 text-xs text-[#6b7280]">
            This project is empty. Use the icons above to add a file or folder.
          </p>
        )}
      </div>
    </div>
  );
}
