import { useEffect, useMemo, useRef, useState } from "react";
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
  Share2,
} from "lucide-react";
import { getFileIcon } from "../lib/fileTypes";
import ShareDialog from "./ShareDialog";

const FOLDER_COLOR = "#dcb67a";

/* ------------------------- Inline text input ------------------------- */

function InlineInput({
  icon,
  color,
  depth,
  placeholder,
  onSubmit,
  onCancel,
  showDescription = false,
  initial = "",
  cancelOnBlur = false,
}) {
  const Icon = icon;
  const [name, setName] = useState(initial);
  const [description, setDescription] = useState("");
  const submitting = useRef(false);

  const handleSubmit = async () => {
    if (!name.trim()) return onCancel(); // empty name: just remove the input
    submitting.current = true;
    try {
      await onSubmit(name.trim(), showDescription ? description.trim() : undefined);
    } finally {
      submitting.current = false;
    }
  };

  return (
    <div className="flex flex-col gap-2 py-1 pr-2" style={{ paddingLeft: 12 + depth * 12 }}>
      <div className="flex items-center gap-1.5">
        <Icon size={16} style={{ color }} className="shrink-0" />

        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => {
            // rename: select the name without its extension
            if (initial) {
              const dot = initial.lastIndexOf(".");
              e.target.setSelectionRange(0, dot > 0 ? dot : initial.length);
            }
          }}
          onBlur={() => {
            if (cancelOnBlur && !submitting.current) onCancel();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (showDescription && name.trim()) {
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

/* --------------------------- Context menu --------------------------- */

function ContextMenu({ x, y, items, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  const visible = items.filter((i) => !i.hidden);
  const height = visible.reduce((h, i) => h + (i.separator ? 9 : 28), 8);
  const left = Math.min(x, window.innerWidth - 220);
  const top = Math.min(y, window.innerHeight - height - 8);

  return (
    <div
      className="fixed inset-0 z-40"
      onClick={onClose}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div
        className="absolute z-50 w-52 rounded-md border border-[#454545] bg-[#252526] py-1 text-[13px] shadow-xl"
        style={{ left, top }}
        onClick={(e) => e.stopPropagation()}
      >
        {visible.map((item, i) =>
          item.separator ? (
            <div key={i} className="my-1 border-t border-[#3c3c3c]" />
          ) : (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                onClose();
                item.onClick();
              }}
              className={`flex w-full items-center justify-between px-3 py-1 text-left hover:bg-[#04395e] ${
                item.danger ? "text-[#f48771]" : "text-[#cccccc]"
              }`}
            >
              <span>{item.label}</span>
              {item.shortcut && <span className="text-[11px] text-[#6b7280]">{item.shortcut}</span>}
            </button>
          )
        )}
      </div>
    </div>
  );
}

/* ------------------------------ Explorer ------------------------------ */

const isUnder = (p, base) => p === base || p.startsWith(base + "/");

export default function Explorer({ ws }) {
  const [expanded, setExpanded] = useState(() => new Set());
  const [selectedId, setSelectedId] = useState(null);
  const [creating, setCreating] = useState(null); // { parentId, type }
  const [renaming, setRenaming] = useState(null); // node id (path)
  const [menu, setMenu] = useState(null); // { x, y, node | null }
  const [newProject, setNewProject] = useState(false);
  const [sharing, setSharing] = useState(false);

  // parentId -> sorted children (folders first, then A-Z)
  const byParent = useMemo(() => {
    const map = {};
    ws.tree.forEach((n) => (map[n.parentId ?? "root"] ||= []).push(n));
    Object.values(map).forEach((list) =>
      list.sort((a, b) =>
        a.type === b.type ? a.name.localeCompare(b.name) : a.type === "folder" ? -1 : 1
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

  /* ----- create ----- */

  const beginCreate = (type, parentId) => {
    if (!ws.projectId || !ws.canEdit) return;
    setRenaming(null);
    if (parentId) setExpanded((s) => new Set(s).add(parentId));
    setCreating({ parentId: parentId ?? null, type });
  };

  // header buttons: create in the selected folder (or beside the selected file)
  const startCreate = (type) => {
    const sel = ws.tree.find((n) => n.id === selectedId);
    const parentId = !sel ? null : sel.type === "folder" ? sel.id : sel.parentId;
    beginCreate(type, parentId);
  };

  const validName = (name, parentId, ignoreId) => {
    if (/[\\/]/.test(name)) {
      toast.error("Names can't contain slashes.");
      return false;
    }
    const siblings = byParent[parentId ?? "root"] || [];
    if (siblings.some((n) => n.id !== ignoreId && n.name.toLowerCase() === name.toLowerCase())) {
      toast.error(`"${name}" already exists here.`);
      return false;
    }
    return true;
  };

  const submitCreate = async (name) => {
    if (!validName(name, creating.parentId)) return; // input stays open
    const created = await ws.createNode(name, creating.type, creating.parentId);
    if (created) setCreating(null);
  };

  /* ----- rename ----- */

  const submitRename = async (node, name) => {
    if (name === node.name) return setRenaming(null);
    if (!validName(name, node.parentId, node.id)) return;

    const to = node.parentId ? `${node.parentId}/${name}` : name;
    if (await ws.renameNode(node.id, to)) {
      setRenaming(null);
      // keep expanded folders and the selection pointing at the new path
      setExpanded((s) => new Set([...s].map((id) => (isUnder(id, node.id) ? to + id.slice(node.id.length) : id))));
      setSelectedId(to);
    }
  };

  /* ----- delete ----- */

  const doDelete = async (node) => {
    const what = node.type === "folder" ? `the folder "${node.name}" and everything in it` : `"${node.name}"`;
    if (!window.confirm(`Delete ${what}? This cannot be undone.`)) return;
    if (await ws.deleteNode(node.id)) setSelectedId(null);
  };

  /* ----- menu ----- */

  const copy = (text, label) =>
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success(`${label} copied`))
      .catch(() => toast.error("Could not copy"));

  const menuItems = (node) => {
    const canEdit = ws.canEdit;
    const parentForNew = !node ? null : node.type === "folder" ? node.id : node.parentId;

    return [
      { label: "Open", hidden: !node || node.type !== "file", onClick: () => ws.openFile(node) },
      { separator: true, hidden: !node || node.type !== "file" },
      { label: "New File", hidden: !canEdit, onClick: () => beginCreate("file", parentForNew) },
      { label: "New Folder", hidden: !canEdit, onClick: () => beginCreate("folder", parentForNew) },
      { separator: true, hidden: !node || !canEdit },
      { label: "Rename", shortcut: "F2", hidden: !node || !canEdit, onClick: () => { setCreating(null); setRenaming(node.id); } },
      { label: "Delete", shortcut: "Del", danger: true, hidden: !node || !canEdit, onClick: () => doDelete(node) },
      { separator: true, hidden: !node },
      { label: "Copy Path", hidden: !node, onClick: () => copy(node.id, "Path") },
      { label: "Copy Name", hidden: !node, onClick: () => copy(node.name, "Name") },
      { separator: true },
      { label: "Refresh", onClick: () => ws.refreshTree() },
    ];
  };

  const openMenu = (e, node) => {
    e.preventDefault();
    e.stopPropagation();
    if (!ws.projectId) return;
    setSelectedId(node?.id ?? null);
    setMenu({ x: e.clientX, y: e.clientY, node });
  };

  // F2 renames and Delete deletes the selected item (when the tree has focus)
  const onTreeKeyDown = (e) => {
    if (e.target.tagName === "INPUT" || !selectedId || !ws.canEdit) return;
    const node = ws.tree.find((n) => n.id === selectedId);
    if (!node) return;
    if (e.key === "F2") {
      e.preventDefault();
      setCreating(null);
      setRenaming(node.id);
    } else if (e.key === "Delete") {
      e.preventDefault();
      doDelete(node);
    }
  };

  /* ----- tree ----- */

  const renderLevel = (parentId, depth) => (
    <>
      {creating && (creating.parentId ?? null) === parentId && (
        <InlineInput
          depth={depth}
          icon={creating.type === "folder" ? Folder : getFileIcon("x.txt")[0]}
          color={creating.type === "folder" ? FOLDER_COLOR : "#9da5b4"}
          placeholder={creating.type === "folder" ? "Folder name" : "File name, e.g. main.py"}
          cancelOnBlur
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
            {renaming === n.id ? (
              <InlineInput
                depth={depth}
                icon={isFolder ? Folder : FileIcon}
                color={isFolder ? FOLDER_COLOR : fileColor}
                placeholder="New name"
                initial={n.name}
                cancelOnBlur
                onSubmit={(name) => submitRename(n, name)}
                onCancel={() => setRenaming(null)}
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSelectedId(n.id);
                  isFolder ? toggle(n.id) : ws.openFile(n);
                }}
                onContextMenu={(e) => openMenu(e, n)}
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
            )}
            {isFolder && open && renderLevel(n.id, depth + 1)}
          </div>
        );
      })}
    </>
  );

  const iconBtn = "rounded p-1 hover:bg-[#3c3c3c] hover:text-white";

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ fontFamily: '"Inter", sans-serif' }}>
      {/* All projects */}
      <div className="flex items-center justify-between px-3 pb-1 pt-3 text-xs font-bold text-[#9da5b4]">
        <span>Projects</span>
        <button type="button" onClick={() => setNewProject(true)} title="New project" className={iconBtn}>
          <Plus size={15} />
        </button>
      </div>

      <div className="max-h-48 shrink-0 overflow-y-auto pb-2">
        {newProject && (
          <InlineInput
            depth={0}
            icon={Layers}
            color="#7BE5C4"
            placeholder="Project name"
            onSubmit={(name, description) => {
              ws.addProject({ name, description });
              setNewProject(false);
            }}
            onCancel={() => setNewProject(false)}
          />
        )}

        {!ws.loading && ws.projects.length === 0 && ws.sharedProjects.length === 0 && !newProject && (
          <p className="px-3 py-2 text-xs text-[#6b7280]">No projects yet. Use + to create one.</p>
        )}

        {ws.projects.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => ws.selectProject(p.id)}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[14px] font-bold hover:bg-[#2a2d2e] ${
              p.id === ws.projectId ? "bg-[#37373d] text-white" : "text-[#cccccc]"
            }`}
          >
            <Layers size={15} className="shrink-0" style={{ color: p.id === ws.projectId ? "#7BE5C4" : "#6b7280" }} />
            <span className="truncate">{p.name}</span>
          </button>
        ))}

        {ws.sharedProjects.length > 0 && (
          <>
            <div className="px-3 pb-1 pt-3 text-xs font-bold text-[#9da5b4]">Shared with me</div>
            {ws.sharedProjects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => ws.selectProject(p.id)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[14px] hover:bg-[#2a2d2e] ${
                  p.id === ws.projectId ? "bg-[#37373d] text-white" : "text-[#cccccc]"
                }`}
              >
                <Layers size={15} className="shrink-0" style={{ color: p.id === ws.projectId ? "#7BE5C4" : "#6b7280" }} />
                <span className="truncate">{p.name}</span>
                <span className="ml-auto shrink-0 text-[10px] uppercase text-[#6b7280]">
                  {p.ownerName} · {p.role === "EDITOR" ? "edit" : "view"}
                </span>
              </button>
            ))}
          </>
        )}
      </div>

      {/* Selected project header */}
      <div className="flex items-center justify-between border-t border-[#3c3c3c] px-3 py-2">
        <span className="truncate text-[15px] font-bold text-white">{ws.project?.name || "Explorer"}</span>
        <div className="flex shrink-0 gap-0.5 text-[#9da5b4]">
          {ws.canEdit && (
            <>
              <button type="button" onClick={() => startCreate("file")} title="New file" className={iconBtn}>
                <FilePlus size={16} />
              </button>
              <button type="button" onClick={() => startCreate("folder")} title="New folder" className={iconBtn}>
                <FolderPlus size={16} />
              </button>
            </>
          )}
          <button type="button" onClick={() => ws.refreshTree()} title="Refresh" className={iconBtn}>
            <RefreshCw size={16} />
          </button>
          {ws.role === "OWNER" && (
            <button type="button" onClick={() => setSharing(true)} title="Share" className={iconBtn}>
              <Share2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* File tree */}
      <div
        tabIndex={0}
        className="min-h-0 flex-1 overflow-y-auto pb-4 outline-none"
        onKeyDown={onTreeKeyDown}
        onClick={(e) => e.target === e.currentTarget && setSelectedId(null)}
        onContextMenu={(e) => openMenu(e, null)}
      >
        {ws.projectId ? (
          renderLevel(null, 0)
        ) : (
          <p className="px-3 py-2 text-xs text-[#6b7280]">Select a project to see its files.</p>
        )}
        {ws.projectId && ws.tree.length === 0 && !creating && (
          <p className="px-3 py-2 text-xs text-[#6b7280]">
            {ws.canEdit
              ? "This project is empty. Use the icons above, or right-click here."
              : "This project is empty."}
          </p>
        )}
      </div>

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems(menu.node)} onClose={() => setMenu(null)} />}
      {sharing && <ShareDialog projectId={ws.projectId} onClose={() => setSharing(false)} />}
    </div>
  );
}