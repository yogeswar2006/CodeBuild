import {
  File,
  FileCode2,
  FileJson,
  FileText,
  FileType,
  Braces,
  Database,
  Terminal,
  Hash,
  Palette,
  Globe,
  Coffee,
  Cog,
} from "lucide-react";

export const getExt = (name = "") =>
  name.includes(".") ? name.split(".").pop().toLowerCase() : "";

// extension -> Monaco language id (drives syntax highlighting)
const LANGUAGES = {
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  ts: "typescript", tsx: "typescript",
  py: "python", java: "java", c: "c", h: "c", cpp: "cpp", cc: "cpp", hpp: "cpp",
  cs: "csharp", go: "go", rs: "rust", php: "php", rb: "ruby", sh: "shell",
  sql: "sql", json: "json", html: "html", css: "css", scss: "scss",
  md: "markdown", yml: "yaml", yaml: "yaml", xml: "xml", txt: "plaintext",
};

export const getLanguage = (name) => LANGUAGES[getExt(name)] || "plaintext";

// extension -> [icon, colour], close to what VS Code shows
const ICONS = {
  js: [FileCode2, "#f1e05a"], jsx: [FileCode2, "#61dafb"],
  ts: [FileCode2, "#3178c6"], tsx: [FileCode2, "#3b9eff"],
  py: [FileCode2, "#4b8bbe"], java: [Coffee, "#e76f51"],
  c: [Hash, "#7aa2f7"], cpp: [Hash, "#7aa2f7"], h: [Hash, "#a78bfa"],
  cs: [Hash, "#9b6bdf"], go: [FileCode2, "#00add8"], rs: [Cog, "#dea584"],
  php: [FileCode2, "#8892bf"], rb: [FileCode2, "#e0524d"],
  sh: [Terminal, "#89e051"], sql: [Database, "#e38c00"],
  json: [FileJson, "#cbcb41"], html: [Globe, "#e44d26"],
  css: [Palette, "#42a5f5"], scss: [Palette, "#cd6799"],
  md: [FileText, "#6cb6ff"], yml: [Braces, "#cb7676"], yaml: [Braces, "#cb7676"],
  xml: [FileType, "#e8a87c"], txt: [FileText, "#9da5b4"],
};

export const getFileIcon = (name) => ICONS[getExt(name)] || [File, "#9da5b4"];
