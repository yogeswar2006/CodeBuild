import { useRef } from "react";
import Editor from "@monaco-editor/react";
import { Code2, X } from "lucide-react";
import { getFileIcon, getLanguage } from "../lib/fileTypes";
import { AUTOSAVE_MS } from "../hooks/useWorkspace";

/* ---------- Monaco setup (runs once) ---------- */

// Monaco only ships rich completions for JS/TS/JSON/HTML/CSS.
// These keyword lists add suggestions for other languages;
// words already in your open files are suggested too (wordBasedSuggestions).
const KEYWORDS = {
  python: "def class import from return if elif else for while try except finally with as lambda yield pass break continue raise async await print len range enumerate self None True False and or not in is isinstance dict list set tuple str int float".split(" "),
  java: "public private protected class interface extends implements static final void int long double boolean String new return if else for while switch case try catch finally throw throws import package this super null true false System.out.println".split(" "),
  cpp: "include using namespace std class struct template typename public private protected virtual const static void int long double bool char auto return if else for while switch case try catch throw new delete nullptr true false cout cin endl vector string".split(" "),
  c: "include define struct typedef enum union const static void int long double char float return if else for while switch case break continue sizeof NULL printf scanf malloc free".split(" "),
  go: "package import func return var const type struct interface map chan go defer select range if else for switch case break continue make new len cap append nil true false fmt.Println".split(" "),
  rust: "fn let mut const struct enum impl trait pub use mod match if else for while loop return self Self Some None Ok Err Vec String Option Result println! true false".split(" "),
};

let configured = false;
function configureMonaco(monaco) {
  if (configured) return;
  configured = true;

  const ts = monaco.languages.typescript;
  if (ts) {
    [ts.javascriptDefaults, ts.typescriptDefaults].forEach((defaults) => {
      defaults.setCompilerOptions({
        jsx: ts.JsxEmit.Preserve, // so .jsx / .tsx highlight correctly
        target: ts.ScriptTarget.ESNext,
        allowNonTsExtensions: true,
        allowJs: true,
      });
      // No red squiggles for imports the browser editor can't resolve
      defaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: false,
      });
    });
  }

  Object.entries(KEYWORDS).forEach(([language, words]) => {
    monaco.languages.registerCompletionItemProvider(language, {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };
        return {
          suggestions: words.map((label) => ({
            label,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: label,
            range,
          })),
        };
      },
    });
  });
}

const EDITOR_OPTIONS = {
  fontSize: 14,
  fontFamily: "'Cascadia Code', 'Fira Code', Menlo, Consolas, monospace",
  fontLigatures: true,
  minimap: { enabled: true },
  automaticLayout: true, // follows the sidebar being resized
  scrollBeyondLastLine: false,
  smoothScrolling: true,
  cursorBlinking: "smooth",
  padding: { top: 12 },
  bracketPairColorization: { enabled: true },
  quickSuggestions: { other: true, comments: false, strings: true },
  suggestOnTriggerCharacters: true,
  wordBasedSuggestions: "allDocuments",
  tabCompletion: "on",
  acceptSuggestionOnEnter: "on",
  snippetSuggestions: "inline",
};

/* ---------- Welcome screen (plain text, no editor) ---------- */

const SHORTCUTS = [
  ["Save now", "Ctrl + S"],
  ["Show suggestions", "Ctrl + Space"],
  ["Find in file", "Ctrl + F"],
  ["Toggle comment", "Ctrl + /"],
  ["Command palette", "F1"],
];

function Welcome({ hasProject }) {
  return (
    <div className="flex h-full items-center justify-center overflow-y-auto p-8">
      <div className="w-full max-w-md">
        <Code2 size={72} strokeWidth={1.2} className="mb-6 text-[#7BE5C4]/25" />
        <h2 className="text-2xl font-light text-[#e7e7e7]">CodeSpace</h2>
        <p className="mt-1 text-sm text-[#8b949e]">Your code, saved as you type.</p>

        <h3 className="mb-2 mt-9 text-sm font-medium text-[#cccccc]">Start</h3>
        <ul className="space-y-1.5 text-sm text-[#7BE5C4]">
          <li>{hasProject ? "Pick a file in the explorer to open it" : "Create or select a project on the left"}</li>
          <li>Use the file and folder icons above the tree to add new items</li>
          <li>Select a folder first to create inside it</li>
        </ul>

        <h3 className="mb-2 mt-8 text-sm font-medium text-[#cccccc]">Shortcuts</h3>
        <dl className="space-y-1.5 text-sm">
          {SHORTCUTS.map(([action, keys]) => (
            <div key={action} className="flex items-center justify-between">
              <dt className="text-[#9da5b4]">{action}</dt>
              <dd>
                <kbd className="rounded border border-[#3c3c3c] bg-[#2d2d2d] px-1.5 py-0.5 font-mono text-xs text-[#cccccc]">
                  {keys}
                </kbd>
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-8 text-xs leading-5 text-[#6b7280]">
          Changes are saved automatically after {AUTOSAVE_MS / 1000} seconds without typing.
        </p>
      </div>
    </div>
  );
}

/* ---------- Pane ---------- */

const STATUS = {
  saved: ["Saved", "#7BE5C4"],
  unsaved: [`Unsaved, saving after ${AUTOSAVE_MS / 1000}s idle`, "#F6B94A"],
  saving: ["Saving...", "#79B8FF"],
  error: ["Save failed", "#FF7F6E"],
};

export default function EditorPane({ ws }) { 
  const saveRef = useRef(() => {});
  const buf = ws.buffers[ws.activeId];
  saveRef.current = () => ws.activeId && ws.save(ws.activeId);

  const handleMount = (editor, monaco) => {
  editor.addCommand(
    monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
    () => {
      console.log("Ctrl+S triggered", {
        activeId: ws.activeId,
        buffer: ws.buffers[ws.activeId],
      });

      if (ws.activeId) {
        ws.save(ws.activeId);
      }
    }
  );
};

  const [statusText, statusColor] = (buf && STATUS[buf.status]) || [];

  return (
    <div className="flex h-full min-w-0 flex-col bg-[#1e1e1e]">
      {/* Tabs */}
      {ws.tabs.length > 0 && (
        <div className="flex h-9 shrink-0 overflow-x-auto bg-[#252526]">
          {ws.tabs.map((id) => {
            const b = ws.buffers[id];
            if (!b) return null;
            const [Icon, color] = getFileIcon(b.name);
            const active = id === ws.activeId;
            return (
              <div
                key={id}
                onClick={() => ws.setActiveId(id)}
                onAuxClick={() => ws.closeTab(id)}
                className={`group flex min-w-[120px] max-w-[220px] cursor-pointer items-center gap-2 border-r border-[#1e1e1e] px-3 text-[13px] ${
                  active
                    ? "border-t-2 border-t-[#7BE5C4] bg-[#1e1e1e] text-white"
                    : "border-t-2 border-t-transparent bg-[#2d2d2d] text-[#9da5b4] hover:bg-[#2a2d2e]"
                }`}
              >
                <Icon size={15} style={{ color }} className="shrink-0" />
                <span className="truncate">{b.name}</span>
                <button
                  type="button"
                  aria-label={`Close ${b.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    ws.closeTab(id);
                  }}
                  className="ml-auto rounded p-0.5 hover:bg-[#3c3c3c]"
                >
                  {b.dirty ? (
                    <span className="block h-2 w-2 rounded-full bg-[#cccccc] group-hover:hidden" />
                  ) : null}
                  <X size={14} className={b.dirty ? "hidden group-hover:block" : ""} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Editor or welcome */}
      <div className="min-h-0 flex-1">
        {buf ? (
          buf.loaded ? (
            <Editor
              // One model per file: undo history, cursor and scroll survive tab switches
              path={`${ws.activeId}/${buf.name}`}
              language={getLanguage(buf.name)}
              value={buf.content}
              onChange={(value) => ws.change(ws.activeId, value ?? "")}
              theme="vs-dark"
              options={EDITOR_OPTIONS}
              beforeMount={configureMonaco}
              onMount={handleMount}
              keepCurrentModel
              loading={<span className="text-sm text-[#8b949e]">Starting editor...</span>}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-[#8b949e]">
              Opening {buf.name}...
            </div>
          )
        ) : (
          <Welcome hasProject={Boolean(ws.projectId)} />
        )}
      </div>

      {/* Status bar */}
      <div className="flex h-6 shrink-0 items-center justify-between bg-[#0E4B52] px-3 text-xs text-white/90">
        <span className="truncate">{ws.project?.name || "No project selected"}</span>
        <span className="flex items-center gap-4">
          {buf && <span>{getLanguage(buf.name)}</span>}
          {statusText && (
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
              {statusText}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
