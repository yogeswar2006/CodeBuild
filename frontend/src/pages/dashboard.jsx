
import { useEffect, useRef, useState } from "react";
import SearchPanel from "../components/SearchPanel";

import TerminalPanel from "../components/TerminalPanel";
import {
  X,
  UserRound,
  Palette,
  Bell,
  Files,
  TerminalSquare,
  Search,
  Settings,
  PanelLeftClose,
  Code2,
  LogOut,
} from "lucide-react";
import useWorkspace from "../hooks/useWorkspace";
import Explorer from "../components/Explorer";
import EditorPane from "../components/EditorPane";
import { useAuthStore } from "../store/useAuthStore";

const MIN_WIDTH = 200;
const MAX_WIDTH = 500;
const DEFAULT_WIDTH = 260;
const STORAGE_KEY = "codespace-sidebar-width";

const clamp = (value) =>
  Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value));

const TERM_MIN = 100;
const TERM_DEFAULT = 280;
const TERM_KEY = "codespace-terminal-height";

const clampTerm = (v) =>
  Math.min(Math.max(TERM_MIN, v), Math.max(TERM_MIN, window.innerHeight - 200));



export default function Dashboard() {
  const ws = useWorkspace();
  const { logout } = useAuthStore();

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    return clamp(saved || DEFAULT_WIDTH);
  });

  const [toggleSettings, setToggleSettings] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [activeView, setActiveView] = useState("explorer");
  const [dragging, setDragging] = useState(false);

  const dragStartX = useRef(0);
  const dragStartWidth = useRef(DEFAULT_WIDTH);


  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(() =>
    clampTerm(Number(localStorage.getItem(TERM_KEY)) || TERM_DEFAULT)
  );
  const [termDragging, setTermDragging] = useState(false);

  const termStartY = useRef(0);
  const termStartH = useRef(TERM_DEFAULT);

  const handleSettings = () => {
    setToggleSettings(!toggleSettings);
  }

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === "KeyF") {
        e.preventDefault();
        setSidebarVisible(true);
        setActiveView("search");
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey && !e.altKey && !e.metaKey && e.code === "Backquote") {
        e.preventDefault();
        e.stopPropagation(); // keep xterm from sending it to the shell as a NUL character
        setTerminalOpen((v) => !v);
      }
    };
    // capture phase: runs before Monaco or xterm can swallow the key
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  // Drag-to-resize
  useEffect(() => {
    if (!termDragging) return;

    const onMove = (e) => {
      // dragging up (smaller clientY) makes the terminal taller
      setTerminalHeight(clampTerm(termStartH.current - (e.clientY - termStartY.current)));
    };
    const onUp = () => setTermDragging(false);

    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [termDragging]);


  useEffect(() => {
    localStorage.setItem(TERM_KEY, String(terminalHeight));
  }, [terminalHeight]);

  // If the window shrinks, keep the terminal from eating the editor
  useEffect(() => {
    const onResize = () => setTerminalHeight((h) => clampTerm(h));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const startTermResize = (e) => {
    e.preventDefault();
    termStartY.current = e.clientY;
    termStartH.current = terminalHeight;
    setTermDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;

    const onMove = (event) => {
      setSidebarWidth(
        clamp(
          dragStartWidth.current +
          event.clientX -
          dragStartX.current
        )
      );
    };

    const onUp = () => setDragging(false);

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  const startResize = (event) => {
    event.preventDefault();
    dragStartX.current = event.clientX;
    dragStartWidth.current = sidebarWidth;
    setDragging(true);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#1e1e1e] font-sans text-[#cccccc]">

      {/* Activity bar */}
      <aside className="flex w-12 shrink-0 flex-col items-center border-r border-[#333333] bg-[#181818]">
        <button
          type="button"
          title="Explorer"
          onClick={() => {
            setSidebarVisible(true);
            setActiveView("explorer");
          }}
          className={`flex h-12 w-full items-center justify-center border-l-2 ${activeView === "explorer"
            ? "border-[#007acc] text-white"
            : "border-transparent text-[#858585] hover:text-white"
            }`}
        >
          <Files size={22} strokeWidth={1.5} />
        </button>

        <button
          type="button"
          title="Search"
          onClick={() => {
            setSidebarVisible(true);
            setActiveView("search");
          }}
          className={`flex h-12 w-full items-center justify-center border-l-2 ${activeView === "search"
            ? "border-[#007acc] text-white"
            : "border-transparent text-[#858585] hover:text-white"
            }`}
        >
          <Search size={21} strokeWidth={1.5} />
        </button>

        <div className="flex-1" />

        <button
          type="button"
          title="Settings"
          className="flex h-12 w-full items-center justify-center text-[#858585] hover:text-white"
        >
          <div>
            <Settings onClick={handleSettings} size={21} strokeWidth={1.5} />
          </div>

          {toggleSettings && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center
               bg-black/60 backdrop-blur-md p-4"
              onClick={() => setToggleSettings(false)}
            >
              <div
                className="w-full max-w-md rounded-2xl border border-white/10
                 bg-[#181818]/95 p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold text-white">
                      Settings
                    </h2>
                    <p className="text-sm text-gray-400 mt-1">
                      Manage your preferences
                    </p>
                  </div>

                  <button
                    onClick={() => setToggleSettings(false)}
                    className="rounded-lg p-2 text-gray-400 hover:bg-white/10
                     hover:text-white transition"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Settings options */}
                <div className="space-y-2">

                  <button className="flex w-full items-center gap-3 rounded-xl
                           p-3 text-left text-gray-300
                           hover:bg-white/5 transition">
                    <UserRound size={20} />
                    <div>
                      <p className="text-sm font-medium text-white">Account</p>
                      <p className="text-xs text-gray-500">
                        Manage your profile
                      </p>
                    </div>
                  </button>

                  <button className="flex w-full items-center gap-3 rounded-xl
                           p-3 text-left text-gray-300
                           hover:bg-white/5 transition">
                    <Palette size={20} />
                    <div>
                      <p className="text-sm font-medium text-white">Appearance</p>
                      <p className="text-xs text-gray-500">
                        Customize your editor theme
                      </p>
                    </div>
                  </button>

                  <button className="flex w-full items-center gap-3 rounded-xl
                           p-3 text-left text-gray-300
                           hover:bg-white/5 transition">
                    <Bell size={20} />
                    <div>
                      <p className="text-sm font-medium text-white">Notifications</p>
                      <p className="text-xs text-gray-500">
                        Manage your alerts
                      </p>
                    </div>
                  </button>

                </div>

                {/* Divider */}
                <div className="my-5 border-t border-white/10" />

                {/* Logout */}
                <button
                  onClick={logout}
                  className="flex w-full items-center gap-3 rounded-xl
                   border border-red-500/20 bg-red-500/5 p-3
                   text-red-400 hover:bg-red-500/15 transition"
                >
                  <LogOut size={20} />
                  <div className="text-left">
                    <p className="text-sm font-medium">Logout</p>
                    <p className="text-xs text-red-400/60">
                      Sign out of your account
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

        </button>
      </aside>

      {/* Explorer sidebar */}
      {sidebarVisible && (
        <>
          <aside
            style={{ width: sidebarWidth }}
            className="flex shrink-0 flex-col rounded-2xl overflow-hidden border-r border-[#2b2b2b] bg-[#181818]"
          >
            <div className="flex h-[35px] shrink-0 items-center justify-between px-3">
              <span className="text-[12px] font-medium uppercase tracking-wide text-[#bbbbbb]">
                {activeView === "explorer" ? "Explorer" : "Search"}
              </span>

              <button
                type="button"
                title="Hide sidebar"
                onClick={() => setSidebarVisible(false)}
                className="rounded p-1 text-[#858585] hover:bg-[#3c3c3c] hover:text-white"
              >
                <PanelLeftClose size={15} />
              </button>
            </div>

            {activeView === "explorer" ? (
              <Explorer ws={ws} />
            ) : (
              <div className={activeView === "search" ? "contents" : "hidden"}>
                <SearchPanel ws={ws} active={activeView === "search" && sidebarVisible} />
              </div>
            )}
          </aside>

          {/* Resizable divider */}
          <div
            role="separator"
            aria-label="Resize sidebar"
            aria-orientation="vertical"
            aria-valuenow={sidebarWidth}
            aria-valuemin={MIN_WIDTH}
            aria-valuemax={MAX_WIDTH}
            tabIndex={0}
            onPointerDown={startResize}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft") {
                setSidebarWidth((width) => clamp(width - 10));
              }

              if (event.key === "ArrowRight") {
                setSidebarWidth((width) => clamp(width + 10));
              }
            }}
            onDoubleClick={() => setSidebarWidth(DEFAULT_WIDTH)}
            className={`relative z-10 w-1 shrink-0 cursor-col-resize ${dragging
              ? "bg-[#007acc]"
              : "bg-transparent hover:bg-[#007acc]"
              }`}
          />
        </>
      )}

      {/* Main workspace */}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#1e1e1e]">
        {/* Workspace header */}
        <header className="flex h-[35px] shrink-0 items-center border-b border-[#2b2b2b] bg-[#181818]">
          <button
            type="button"
            title="Toggle sidebar"
            onClick={() => setSidebarVisible((visible) => !visible)}
            className="flex h-full items-center px-3 text-[#858585] hover:text-white"
          >
            <PanelLeftClose size={15} />
          </button>

          <div className="flex items-center gap-2 text-xs text-[#858585]">
            <Code2 size={14} className="text-[#007acc]" />
            <span>{ws.project?.name || "Welcome"}</span>
            <button
              type="button"
              title="Toggle terminal"
              onClick={() => setTerminalOpen((v) => !v)}
              className="ml-auto flex h-full items-center px-3 text-[#858585] hover:text-white"
            >
              <TerminalSquare size={15} />
            </button>
          </div>
        </header>

        {/* Tabs, Monaco editor, welcome screen, and status bar */}
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <EditorPane ws={ws} />
          </div>

          {/* Drag handle: only shown while the terminal is open */}
          {ws.projectId && terminalOpen && (
            <div
              role="separator"
              aria-label="Resize terminal"
              aria-orientation="horizontal"
              onPointerDown={startTermResize}
              onDoubleClick={() => setTerminalHeight(clampTerm(TERM_DEFAULT))}
              className={`h-1 shrink-0 cursor-row-resize ${termDragging ? "bg-[#007acc]" : "bg-[#2b2b2b] hover:bg-[#007acc]"
                }`}
            />
          )}

          {/* Kept mounted (just collapsed) so the shell session survives toggling */}
          {ws.projectId && (
            <div
              className="shrink-0 overflow-hidden"
              style={{ height: terminalOpen ? terminalHeight : 0 }}
            >
              <TerminalPanel
                key={ws.projectId}
                projectId={ws.projectId}
                visible={terminalOpen}
                onCommandRun={ws.refreshTree}
              />
            </div>
          )}
        </div>
      </main>

    </div>
  );
}
