import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useProjectStore } from "../store/useProjectStore";
import { getFileIcon } from "../lib/fileTypes";

const Toggle = ({ on, onClick, title, children }) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${
      on ? "bg-[#007acc] text-white" : "text-[#9da5b4] hover:bg-[#3c3c3c]"
    }`}
  >
    {children}
  </button>
);

export default function SearchPanel({ ws, active }) {
  const { searchFiles, replaceInFiles } = useProjectStore();

  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [showReplace, setShowReplace] = useState(false);
  const [regex, setRegex] = useState(false);
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);

  const [data, setData] = useState(null); // { results, total, truncated }
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [refreshKey, setRefreshKey] = useState(0);

  const inputRef = useRef(null);
  const reqId = useRef(0);

  const opts = () => ({ query, isRegex: regex, caseSensitive: matchCase, wholeWord });

  useEffect(() => {
    if (active) inputRef.current?.focus();
  }, [active]);

  // Debounced search: runs 400ms after you stop typing or change an option
  useEffect(() => {
    if (!ws.projectId || !query) {
      setData(null);
      setError("");
      return;
    }

    const id = ++reqId.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        await ws.flushAll(); // so unsaved edits are searchable
        const out = await searchFiles(ws.projectId, opts());
        if (id !== reqId.current) return; // a newer search started
        setData(out);
        setError("");
      } catch (e) {
        if (id !== reqId.current) return;
        setData(null);
        setError(e.response?.data?.message || "Search failed");
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, regex, matchCase, wholeWord, ws.projectId, refreshKey]);

  const toggleFile = (path) =>
    setCollapsed((s) => {
      const next = new Set(s);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });

  // paths undefined = replace everywhere, [path] = replace in one file
  const doReplace = async (paths) => {
    if (
      !paths &&
      !window.confirm(
        `Replace ${data.truncated ? "all" : data.total} matches across the project with ${
          replacement ? `"${replacement}"` : "nothing"
        }? This cannot be undone.`
      )
    )
      return;

    try {
      await ws.flushAll();
      const out = await replaceInFiles(ws.projectId, opts(), replacement, paths);
      await ws.reloadFiles(out.changed.map((c) => c.path));
      toast.success(`Replaced ${out.replacements} in ${out.changed.length} file(s)`);
      setRefreshKey((k) => k + 1); // re-run the search
    } catch (e) {
      toast.error(e.response?.data?.message || "Replace failed");
    }
  };

  const inputClass =
    "min-w-0 flex-1 rounded-sm border border-[#3c3c3c] bg-[#3c3c3c] px-2 py-1 text-[13px] text-white outline-none focus:border-[#007acc]";

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ fontFamily: '"Inter", sans-serif' }}>
      <div className="space-y-1.5 p-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Toggle replace"
            onClick={() => setShowReplace((v) => !v)}
            className="shrink-0 text-[#9da5b4] hover:text-white"
          >
            {showReplace ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className={inputClass}
          />
        </div>

        <div className="flex justify-end gap-1">
          <Toggle on={matchCase} onClick={() => setMatchCase((v) => !v)} title="Match case">Aa</Toggle>
          <Toggle on={wholeWord} onClick={() => setWholeWord((v) => !v)} title="Match whole word">ab</Toggle>
          <Toggle on={regex} onClick={() => setRegex((v) => !v)} title="Use regular expression">.*</Toggle>
        </div>

        {showReplace && (
          <div className="flex items-center gap-1 pl-[18px]">
            <input
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              placeholder={regex ? "Replace (use $1, $2...)" : "Replace"}
              className={inputClass}
            />
            <button
              type="button"
              title="Replace all"
              disabled={!data?.total}
              onClick={() => doReplace()}
              className="shrink-0 rounded bg-[#0E4B52] px-2 py-1 text-[11px] text-white disabled:opacity-40"
            >
              Replace all
            </button>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        {!ws.projectId && <p className="px-3 text-xs text-[#6b7280]">Select a project first.</p>}
        {error && <p className="px-3 text-xs text-[#FF7F6E]">{error}</p>}
        {loading && <p className="px-3 text-xs text-[#6b7280]">Searching...</p>}

        {data && !error && (
          <>
            <p className="px-3 pb-1 text-xs text-[#9da5b4]">
              {data.total === 0
                ? "No results"
                : `${data.truncated ? `${data.total}+` : data.total} results in ${data.results.length} files${
                    data.truncated ? " (showing first 1000)" : ""
                  }`}
            </p>

            {data.results.map((file) => {
              const name = file.path.split("/").pop();
              const dir = file.path.includes("/") ? file.path.slice(0, file.path.lastIndexOf("/")) : "";
              const [Icon, color] = getFileIcon(name);
              const closed = collapsed.has(file.path);

              return (
                <div key={file.path}>
                  <div className="group flex items-center gap-1 px-2 py-[3px] text-[13px] hover:bg-[#2a2d2e]">
                    <button
                      type="button"
                      onClick={() => toggleFile(file.path)}
                      className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                    >
                      {closed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                      <Icon size={15} style={{ color }} className="shrink-0" />
                      <span className="truncate text-white">{name}</span>
                      {dir && <span className="truncate text-xs text-[#6b7280]">{dir}</span>}
                    </button>

                    {showReplace && (
                      <button
                        type="button"
                        title="Replace in this file"
                        onClick={() => doReplace([file.path])}
                        className="hidden shrink-0 rounded px-1 text-[11px] text-[#7BE5C4] hover:bg-[#3c3c3c] group-hover:block"
                      >
                        Replace
                      </button>
                    )}
                    <span className="shrink-0 rounded-full bg-[#3c3c3c] px-1.5 text-[11px] text-[#cccccc]">
                      {file.matches.length}
                    </span>
                  </div>

                  {!closed &&
                    file.matches.map((m) => (
                      <button
                        type="button"
                        key={`${m.line}:${m.column}`}
                        onClick={() => ws.openAt(file.path, m.line, m.column, m.length)}
                        className="block w-full truncate py-[2px] pl-8 pr-2 text-left font-mono text-xs text-[#9da5b4] hover:bg-[#2a2d2e]"
                        title={`Line ${m.line}`}
                      >
                        {m.preview.before}
                        <span className="rounded-sm bg-[#613214] text-[#f0c987]">{m.preview.match}</span>
                        {m.preview.after}
                      </button>
                    ))}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}