import { useEffect, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Git history drawn like a transit map, used as a page background.   */
/*  Usage: put <GitBackground /> as the first child of a `relative`    */
/*  container, then put your content in a `relative z-10` wrapper.     */
/* ------------------------------------------------------------------ */

const COLORS = {
  main: "#7BE5C4",
  auth: "#F6B94A",
  editor: "#FF7F6E",
  share: "#79B8FF",
  fix: "#F58BB5",
};

// Each lane is one branch, drawn in a 1600x900 space.
const LANES = [
  { d: "M-40 450 H1700", color: COLORS.main, delay: 0 },
  {
    d: "M700 450 C750 450 750 250 810 250 H1150 C1210 250 1210 450 1270 450",
    color: COLORS.auth,
    delay: 0.9,
  },
  {
    d: "M840 450 C890 450 890 650 950 650 H1350 C1410 650 1410 450 1470 450",
    color: COLORS.editor,
    delay: 1.2,
  },
  {
    d: "M900 250 C940 250 940 120 1000 120 H1700",
    color: COLORS.share,
    delay: 1.6,
  },
  {
    d: "M1130 450 C1170 450 1170 790 1230 790 H1700",
    color: COLORS.fix,
    delay: 1.9,
  },
];

// Commits. `up` puts the message above the line, otherwise below.
const COMMITS = [
  { x: 560, y: 450, c: COLORS.main, msg: "init workspace" },
  { x: 1000, y: 450, c: COLORS.main, msg: "bump dependencies", up: true },
  { x: 1270, y: 450, c: COLORS.main, msg: "merge feature/auth", up: true, merge: true },
  { x: 1470, y: 450, c: COLORS.main, msg: "v1.0", up: true, merge: true },
  { x: 860, y: 250, c: COLORS.auth, msg: "add oauth callback", up: true },
  { x: 1010, y: 250, c: COLORS.auth, msg: "fix token refresh", up: true },
  { x: 1000, y: 650, c: COLORS.editor, msg: "refactor editor state" },
  { x: 1160, y: 650, c: COLORS.editor, msg: "file tree search" },
  { x: 1300, y: 650, c: COLORS.editor, msg: "terminal resize test" },
  { x: 1060, y: 120, c: COLORS.share, msg: "wip: live cursors" },
  { x: 1260, y: 120, c: COLORS.share, msg: "wip: presence colors" },
  { x: 1290, y: 790, c: COLORS.fix, msg: "limit /run requests" },
];

const BRANCH_NAMES = [
  { x: 820, y: 276, c: COLORS.auth, t: "feature/auth" },
  { x: 958, y: 628, c: COLORS.editor, t: "feature/editor" },
  { x: 1008, y: 100, c: COLORS.share, t: "feature/live-share" },
  { x: 1238, y: 768, c: COLORS.fix, t: "fix/run-limit" },
];

export default function GitBackground() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = (e) => setReduceMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden bg-[#0A2A31]"
    >
      {/* Faint dot grid */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "radial-gradient(rgba(123,229,196,0.10) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        {LANES.map((lane, i) => (
          <path
            key={i}
            d={lane.d}
            pathLength="1"
            className="lane"
            stroke={lane.color}
            strokeWidth="5"
            strokeLinecap="butt"
            strokeLinejoin="round"
            style={{ "--d": `${lane.delay}s` }}
          />
        ))}

        {COMMITS.map((n, i) => (
          <g
            key={i}
            className="node"
            style={{ "--d": `${0.6 + (n.x / 1600) * 2.4}s` }}
          >
            <circle
              cx={n.x}
              cy={n.y}
              r={n.merge ? 11 : 8}
              fill="#0A2A31"
              stroke={n.c}
              strokeWidth="4"
            />
            {n.merge && <circle cx={n.x} cy={n.y} r="3.5" fill={n.c} />}
            <text
              x={n.x + 14}
              y={n.up ? n.y - 18 : n.y + 28}
              fill="#B9D3D2"
              fillOpacity="0.8"
              fontSize="14"
              className="font-code"
            >
              {n.msg}
            </text>
          </g>
        ))}

        {BRANCH_NAMES.map((b) => (
          <text
            key={b.t}
            x={b.x}
            y={b.y}
            fill={b.c}
            fontSize="13"
            fontWeight="500"
            className="font-code node"
            style={{ "--d": "2.6s" }}
          >
            {b.t}
          </text>
        ))}

        {!reduceMotion && (
          <g>
            <animateMotion
              dur="18s"
              repeatCount="indefinite"
              path="M-40 450 H1700"
            />
            <circle r="16" fill={COLORS.main} fillOpacity="0.18" />
            <circle r="6" fill="#EFFFFA" />
            <text
              y="-22"
              x="-18"
              fill="#EFFFFA"
              fontSize="12"
              fontWeight="500"
              className="font-code"
            >
              HEAD
            </text>
          </g>
        )}
      </svg>

      {/* Fades the branches out behind the content on the left */}
      <div className="absolute inset-0 bg-[#061B20]/75 lg:hidden" />
      <div className="absolute inset-0 hidden bg-[linear-gradient(90deg,#061B20_0%,#061B20_30%,rgba(6,27,32,0.88)_44%,rgba(6,27,32,0)_66%)] lg:block" />

      <style>{`
        @import url("https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=IBM+Plex+Mono:wght@400;500&display=swap");

        .font-display { font-family: "Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif; }
        .font-code { font-family: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace; }

        .lane {
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
          animation: git-draw 2.6s cubic-bezier(0.55, 0.1, 0.2, 1) forwards;
          animation-delay: var(--d, 0s);
        }
        .node {
          opacity: 0;
          animation: git-appear 0.6s ease-out forwards;
          animation-delay: var(--d, 0s);
        }

        @keyframes git-draw { to { stroke-dashoffset: 0; } }
        @keyframes git-appear { to { opacity: 1; } }

        @media (prefers-reduced-motion: reduce) {
          .lane { animation: none; stroke-dashoffset: 0; }
          .node { animation: none; opacity: 1; }
        }
      `}</style>
    </div>
  );
}
