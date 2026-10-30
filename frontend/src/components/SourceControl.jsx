import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ArrowDown, ArrowUp, Loader2, Minus, Plus, RefreshCw } from "lucide-react";
import { useProjectStore } from "../store/useProjectStore";

const BADGE = { M: ["M", "#e2c08d"], A: ["A", "#73c991"], D: ["D", "#c74e39"], R: ["R", "#73c991"], "?": ["U", "#73c991"] };

// Shown at the top of the panel while any git action is running
function Banner({ text }) {
  if (!text) return null;
  return (
    <div className="flex items-center gap-2 border-y border-[#0E4B52] bg-[#0E4B52]/30 px-3 py-1.5 text-xs text-[#7BE5C4]">
      <Loader2 size={13} className="shrink-0 animate-spin" />
      <span className="truncate">{text}</span>
    </div>
  );
}

function FileRow({ file, letter, onOpen, action, title, icon: Icon, disabled }) {
  const [text, color] = BADGE[letter] ?? [letter, "#9da5b4"];
  const name = file.path.split("/").pop();
  return (
    <div className="group flex items-center gap-2 px-3 py-[3px] text-[13px] hover:bg-[#2a2d2e]">
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 truncate text-left text-[#cccccc]" title={file.path}>
        {name} <span className="text-xs text-[#6b7280]">{file.path.includes("/") ? file.path.slice(0, file.path.lastIndexOf("/")) : ""}</span>
      </button>
      <button type="button" title={title} disabled={disabled} onClick={action} className="hidden text-[#9da5b4] hover:text-white disabled:opacity-40 group-hover:block">
        <Icon size={14} />
      </button>
      <span className="w-4 text-center text-xs font-bold" style={{ color }}>{text}</span>
    </div>
  );
}

export default function SourceControl({ ws, active }) {
  const s = useProjectStore();
  const id = ws.projectId;

  const [st, setSt] = useState(null);
  const [loaded, setLoaded] = useState(false); // first status fetch finished
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [remote, setRemote] = useState("");
  const [busy, setBusy] = useState(""); // "Push", "Pull", "Commit", ...

  // "yogeswar2006/test" from "https://github.com/yogeswar2006/test.git"
  const repo = st?.remote?.replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, "");

  const LABELS = {
    Init: "Initializing repository...",
    Remote: "Saving remote repository...",
    Stage: "Staging changes...",
    Unstage: "Unstaging changes...",
    Commit: `Committing ${st?.files?.filter((f) => f.index !== " " && f.index !== "?").length ?? ""} file(s) to ${st?.branch ?? "branch"}...`,
    Push: `Pushing ${st?.branch ?? "branch"} to GitHub (${repo ?? "remote"})...`,
    Pull: `Pulling ${st?.branch ?? "branch"} from GitHub (${repo ?? "remote"})...`,
  };
  const busyText = busy ? LABELS[busy] ?? `${busy}...` : "";

  const refresh = useCallback(async () => {
    if (!id) {
      setSt(null);
      return;
    }
    setRefreshing(true);
    try {
      await ws.flushAll();
      setSt(await s.gitStatus(id));
    } catch {
      setSt(null);
    } finally {
      setRefreshing(false);
      setLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // new project: show the loading state again until its status arrives
  useEffect(() => {
    setLoaded(false);
    setSt(null);
  }, [id]);

  useEffect(() => {
    if (active) refresh();
  }, [active, refresh]);

  // runs an action, shows the banner while it runs, then refreshes
  const act = async (name, fn, success) => {
    setBusy(name);
    try {
      const out = await fn();
      if (success) toast.success(success);
      await refresh();
      return out ?? true;
    } catch (e) {
      toast.error(e.response?.data?.message || `${name} failed`);
      return null;
    } finally {
      setBusy("");
    }
  };

  if (!id) return <p className="p-3 text-xs text-[#6b7280]">Select a project first.</p>;

  if (!loaded)
    return (
      <div className="flex items-center gap-2 p-3 text-xs text-[#9da5b4]">
        <Loader2 size={14} className="animate-spin" /> Checking repository...
      </div>
    );

  if (!st)
    return (
      <div className="p-3 text-xs text-[#FF7F6E]">
        Could not read Git status.{" "}
        <button onClick={refresh} className="underline">Retry</button>
      </div>
    );

  if (!st.isRepo)
    return (
      <div className="text-[13px]">
        <Banner text={busyText} />
        <div className="p-3">
          <p className="mb-3 text-[#9da5b4]">This project is not a Git repository.</p>
          <button
            disabled={!!busy}
            onClick={() => act("Init", () => s.gitInit(id), "Repository created")}
            className="flex w-full items-center justify-center gap-2 rounded bg-[#0E4B52] px-3 py-1.5 text-white disabled:opacity-50"
          >
            {busy === "Init" && <Loader2 size={14} className="animate-spin" />}
            Initialize repository
          </button>
        </div>
      </div>
    );

  const staged = st.files.filter((f) => f.index !== " " && f.index !== "?");
  const changes = st.files.filter((f) => f.index === "?" || f.worktree !== " ");
  const open = (f, letter) => letter !== "D" && ws.openAt(f.path);

  const sync = async (kind) => {
    const out = await act(
      kind,
      () => (kind === "Push" ? s.gitPush(id) : s.gitPull(id)),
      kind === "Push" ? `Pushed to ${repo}` : `Pulled from ${repo}`
    );
    if (kind === "Pull" && out) {
      await ws.refreshTree();
      await ws.reloadFiles(Object.keys(ws.buffers)); // open tabs may have changed on disk
    }
  };

  const doCommit = async () => {
    if (await act("Commit", () => s.gitCommit(id, message), "Committed")) setMessage("");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ fontFamily: '"Inter", sans-serif' }}>
      <div className="flex items-center justify-between px-3 py-2 text-xs text-[#9da5b4]">
        <span className="truncate">⎇ {st.branch}{st.ahead ? ` ↑${st.ahead}` : ""}{st.behind ? ` ↓${st.behind}` : ""}</span>
        <div className="flex gap-1">
          <button title="Pull" disabled={!!busy || !st.remote} onClick={() => sync("Pull")} className="rounded p-1 hover:bg-[#3c3c3c] disabled:opacity-40">
            {busy === "Pull" ? <Loader2 size={14} className="animate-spin text-[#7BE5C4]" /> : <ArrowDown size={14} />}
          </button>
          <button title="Push" disabled={!!busy || !st.remote} onClick={() => sync("Push")} className="rounded p-1 hover:bg-[#3c3c3c] disabled:opacity-40">
            {busy === "Push" ? <Loader2 size={14} className="animate-spin text-[#7BE5C4]" /> : <ArrowUp size={14} />}
          </button>
          <button title="Refresh" disabled={!!busy || refreshing} onClick={refresh} className="rounded p-1 hover:bg-[#3c3c3c] disabled:opacity-40">
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      <Banner text={busyText} />

      {!st.remote && (
        <div className="space-y-1.5 px-3 py-2">
          <input
            value={remote}
            onChange={(e) => setRemote(e.target.value)}
            placeholder="https://github.com/you/repo.git"
            className="w-full rounded-sm border border-[#3c3c3c] bg-[#3c3c3c] px-2 py-1 text-[13px] text-white outline-none focus:border-[#007acc]"
          />
          <button
            disabled={!!busy || !remote.trim()}
            onClick={() => act("Remote", () => s.gitSetRemote(id, remote.trim()), "Remote saved")}
            className="flex w-full items-center justify-center gap-2 rounded bg-[#2d2d2d] px-2 py-1 text-xs text-white hover:bg-[#3c3c3c] disabled:opacity-40"
          >
            {busy === "Remote" && <Loader2 size={12} className="animate-spin" />}
            Set remote
          </button>
          <p className="text-[11px] text-[#6b7280]">Create the empty repo on GitHub first.</p>
        </div>
      )}

      <div className="space-y-1.5 px-3 py-2">
        <textarea
          value={message}
          disabled={busy === "Commit"}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !busy && staged.length && message.trim()) doCommit();
          }}
          rows={2}
          placeholder="Message (Ctrl+Enter to commit)"
          className="w-full rounded-sm border border-[#3c3c3c] bg-[#3c3c3c] px-2 py-1 text-[13px] text-white outline-none focus:border-[#007acc] disabled:opacity-60"
        />
        <button
          disabled={!!busy || !staged.length || !message.trim()}
          onClick={doCommit}
          className="flex w-full items-center justify-center gap-2 rounded bg-[#0E4B52] px-2 py-1.5 text-[13px] text-white disabled:opacity-40"
        >
          {busy === "Commit" && <Loader2 size={14} className="animate-spin" />}
          {busy === "Commit" ? "Committing..." : `Commit${staged.length ? ` (${staged.length})` : ""}`}
        </button>
      </div>

      <div className={`min-h-0 flex-1 overflow-y-auto pb-4 ${busy ? "pointer-events-none opacity-60" : ""}`}>
        <div className="flex items-center justify-between px-3 py-1 text-[11px] font-bold uppercase text-[#9da5b4]">
          <span>Staged Changes ({staged.length})</span>
          {staged.length > 0 && <button title="Unstage all" onClick={() => act("Unstage", () => s.gitUnstage(id))}><Minus size={13} /></button>}
        </div>
        {staged.map((f) => (
          <FileRow key={"s" + f.path} file={f} letter={f.index} icon={Minus} title="Unstage" disabled={!!busy}
            onOpen={() => open(f, f.index)} action={() => act("Unstage", () => s.gitUnstage(id, [f.path]))} />
        ))}

        <div className="flex items-center justify-between px-3 py-1 pt-3 text-[11px] font-bold uppercase text-[#9da5b4]">
          <span>Changes ({changes.length})</span>
          {changes.length > 0 && <button title="Stage all" onClick={() => act("Stage", () => s.gitStage(id))}><Plus size={13} /></button>}
        </div>
        {changes.map((f) => (
          <FileRow key={"c" + f.path} file={f} letter={f.index === "?" ? "?" : f.worktree} icon={Plus} title="Stage" disabled={!!busy}
            onOpen={() => open(f, f.worktree)} action={() => act("Stage", () => s.gitStage(id, [f.path]))} />
        ))}

        {!staged.length && !changes.length && <p className="px-3 py-2 text-xs text-[#6b7280]">No changes.</p>}
      </div>
    </div>
  );
}