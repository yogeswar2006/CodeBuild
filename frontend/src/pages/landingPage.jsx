import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Terminal, Users, GitBranch, Search, ShieldCheck, Code2, Play, Check } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import Lenis from "lenis";

/* Palette: aubergine ink, saffron, orchid, seafoam, lilac paper */
const C = { ink: "#170F24", deep: "#0E0818", saffron: "#FFC247", orchid: "#D86CFF", sea: "#4FE3B0", lilac: "#EDE6FA" };

/* Optional: drop a screen recording here (mp4) and it plays inside the terminal frame */
const DEMO_VIDEO = "";

const css = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=JetBrains+Mono:wght@400;600&display=swap');
.lp{font-family:'Bricolage Grotesque',sans-serif}
.mono{font-family:'JetBrains Mono',monospace}
@keyframes blink{50%{opacity:0}}
.caret{animation:blink 1s steps(1) infinite}
@keyframes floaty{50%{transform:translateY(-10px) rotate(var(--r))}}
.floaty{animation:floaty 6s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.caret,.floaty{animation:none}}
.lp a:focus-visible,.lp button:focus-visible{outline:3px solid ${C.sea};outline-offset:3px}
`;

/* scroll progress of a tall section: 0 at start, 1 when it ends */
function useProgress() {
    const ref = useRef(null);
    const [p, setP] = useState(0);
    useEffect(() => {
        let raf;
        const tick = () => {
            raf = 0;
            const el = ref.current;
            if (!el) return;
            const r = el.getBoundingClientRect();
            const total = r.height - window.innerHeight;
            setP(Math.min(1, Math.max(0, total > 0 ? -r.top / total : 0)));
        };
        const on = () => !raf && (raf = requestAnimationFrame(tick));
        on();
        window.addEventListener("scroll", on, { passive: true, capture: true });
        window.addEventListener("resize", on);
        return () => {
            window.removeEventListener("scroll", on, { capture: true });
            window.removeEventListener("resize", on);
            cancelAnimationFrame(raf);
        };
    }, []);
    return [ref, p];
}

function useScrollY() {
    const [y, setY] = useState(0);
    useEffect(() => {
        const on = (e) => {
            const t = e?.target;
            setY(t && t.scrollTop !== undefined ? t.scrollTop : window.scrollY);
        };
        on();
        window.addEventListener("scroll", on, { passive: true, capture: true });
        return () => window.removeEventListener("scroll", on, { capture: true });
    }, []);
    return y;
}


const goTo = (e, hash) => {
    e.preventDefault();
    if (window.lenis) window.lenis.scrollTo(hash, { offset: -20 });
    else document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" });
};


/* ---------------------------- Navbar ---------------------------- */
function Nav() {
    const authUser = useAuthStore((s) => s.authUser); // adjust if your store names it differently
    const y = useScrollY();
    const btn = "rounded-full px-5 py-2 text-sm font-semibold transition-transform hover:-translate-y-0.5";
    return (
        <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
            <nav
                className="flex w-full max-w-5xl items-center justify-between rounded-full border border-white/10 px-5 py-2.5 backdrop-blur-xl transition-all"
                style={{ background: y > 40 ? "rgba(23,15,36,.85)" : "rgba(23,15,36,.35)" }}
            >
                <Link to="/" className="flex items-center gap-2 text-lg font-extrabold text-white">
                    {/* <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: C.saffron, color: C.ink }}>
                        <Code2 size={18} strokeWidth={2.6} />
                    </span> */}
                    CodeSpace
                </Link>
                <div className="hidden gap-7 text-sm text-white/70 md:flex">
                    <a href="#features" onClick={(e) => goTo(e, "#features")} className="hover:text-white">Features</a>
                    <a href="#together" onClick={(e) => goTo(e, "#together")} className="hover:text-white">Live collaboration</a>
                    <a href="#free" onClick={(e) => goTo(e, "#free")} className="hover:text-white">Free</a>
                </div>
                <div className="flex items-center gap-2">
                    {authUser ? (
                        <Link to="/dashboard" className={btn} style={{ background: C.saffron, color: C.ink }}>
                            Workspace
                        </Link>
                    ) : (
                        <>
                            <Link to="/login" className={`${btn} text-white hover:bg-white/10`}>Login</Link>
                            <Link to="/register" className={btn} style={{ background: C.saffron, color: C.ink }}>Register</Link>
                        </>
                    )}
                </div>
            </nav>
        </header>
    );
}

/* ------------------------------ Hero ------------------------------ */
const MIRA = 'const room = sync.join("team-42");';
const DEV = 'room.on("edit", (file) => run(file));';
const TERM = ["$ node server.js", "listening on :3000", "Mira joined  Dev joined", "$ git push origin main"];

function Caret({ name, color, show }) {
    return (
        <span className="relative inline-block h-[1.1em] w-[2px] translate-y-[3px]" style={{ background: color }}>
            {show && (
                <span className="absolute -top-5 left-0 whitespace-nowrap rounded px-1.5 text-[10px] font-semibold" style={{ background: color, color: C.ink }}>
                    {name}
                </span>
            )}
        </span>
    );
}

function Hero() {
    const [t, setT] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setT((v) => (v > 110 ? 0 : v + 1)), 90);
        return () => clearInterval(id);
    }, []);
    const a = Math.min(MIRA.length, Math.max(0, t - 4));
    const b = Math.min(DEV.length, Math.max(0, t - 30));
    const term = Math.min(TERM.length, Math.max(0, Math.floor((t - 70) / 8)));

    return (
        <section className="relative overflow-hidden px-6 pb-24 pt-36" style={{ background: C.ink }}>
            <div className="pointer-events-none absolute -left-32 top-10 h-96 w-96 rounded-full blur-3xl" style={{ background: C.orchid, opacity: 0.18 }} />
            <div className="pointer-events-none absolute -right-20 bottom-0 h-96 w-96 rounded-full blur-3xl" style={{ background: C.saffron, opacity: 0.12 }} />
            <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
                <div>
                    <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-1.5 text-sm text-white/80">
                        <span  style={{ background: C.sea }} /> EXPLORE THE NEW WORKSPACE
                    </p>
                    <h1 className="text-[clamp(2.6rem,6.4vw,5.4rem)] font-extrabold leading-[0.98] tracking-tight text-white">
                        Write code with your team,
                        <span style={{ color: C.saffron }}> in the very same file.</span>
                    </h1>
                    <p className="mt-6 max-w-md text-lg leading-relaxed text-white/70">
                        A browser code editor with a real terminal, Git and GitHub built in, and live editing with the people you invite.
                    </p>
                    <div className="mt-9 flex flex-wrap gap-3">
                        <Link to="/register" className="rounded-full px-7 py-3.5 font-bold transition-transform hover:-translate-y-1" style={{ background: C.saffron, color: C.ink, boxShadow: `0 8px 0 ${C.orchid}` }}>
                            Start coding free
                        </Link>
                        <a href="#features" className="flex items-center gap-2 rounded-full border border-white/20 px-6 py-3.5 font-semibold text-white hover:bg-white/10">
                            <Play size={16} /> See what is inside
                        </a>
                    </div>
                </div>

                <div className="floaty relative" style={{ "--r": "-1deg", transform: "rotate(-1deg)" }}>
                    <div className="overflow-hidden rounded-2xl border border-white/10 shadow-2xl" style={{ background: C.deep }}>
                        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5 text-xs text-white/50">
                            <span className="h-3 w-3 rounded-full" style={{ background: C.saffron }} />
                            <span className="h-3 w-3 rounded-full" style={{ background: C.orchid }} />
                            <span className="h-3 w-3 rounded-full" style={{ background: C.sea }} />
                            <span className="mono ml-3">server.js</span>
                        </div>
                        <pre className="mono min-h-[170px] p-5 text-[13px] leading-8 text-white/85">
                            {`1  import { sync } from "codespace";
2
3  `}<span style={{ color: C.saffron }}>{MIRA.slice(0, a)}</span><Caret name="Mira" color={C.saffron} show={a < MIRA.length} />{`
4
5  `}<span style={{ color: C.orchid }}>{DEV.slice(0, b)}</span><Caret name="Dev" color={C.orchid} show={b > 0 && b < DEV.length} />
                        </pre>
                        <div className="border-t border-white/10 p-4" style={{ background: "#08050F" }}>
                            {DEMO_VIDEO ? (
                                <video src={DEMO_VIDEO} autoPlay loop muted playsInline className="w-full rounded" />
                            ) : (
                                <div className="mono min-h-[108px] text-[12px] leading-6" style={{ color: C.sea }}>
                                    {TERM.slice(0, term).map((l, i) => <div key={i}>{l}</div>)}
                                    <span className="caret">▍</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

/* --------------- Marquee: two rows that slide as you scroll --------------- */
const LANGS = ["JavaScript", "Python", "TypeScript", "Go", "Rust", "Java", "C++", "HTML", "CSS", "SQL", "Bash", "Markdown"];
function Marquee() {
    const y = useScrollY();
    const row = (rev) => (
        <div className="flex w-max gap-4 whitespace-nowrap" style={{ transform: `translateX(${rev ? y * 0.35 - 2600 : -y * 0.35}px)` }}>
            {Array.from({ length: 4 }, () => LANGS).flat().map((l, i) => (
                <span key={i} className="rounded-full border-2 px-5 py-1.5 text-xl font-extrabold" style={{ borderColor: C.ink, color: i % 3 === 0 ? C.saffron : C.ink, background: i % 3 === 0 ? C.ink : "transparent" }}>
                    {l}
                </span>
            ))}
        </div>
    );
    return (
        <div className="flex flex-col gap-3 overflow-hidden py-6" style={{ background: C.saffron }}>
            {row(false)}
            {row(true)}
        </div>
    );
}

/* ----- Features: vertical scroll drives a horizontal track ----- */
const FEATURES = [
    { icon: Code2, color: C.saffron, title: "An editor that feels like VS Code", text: "Syntax colors, autocomplete, find and replace with regex, and format on save. Opens in a tab, nothing to install." },
    { icon: Terminal, color: C.sea, title: "A real terminal, sandboxed", text: "Run npm, node, python and git in your project. Every user gets their own container, so projects stay private." },
    { icon: Users, color: C.orchid, title: "Share a project by username", text: "Give a teammate view or edit access, change it anytime, and remove it instantly. Their terminal closes when you do." },
    { icon: GitBranch, color: C.saffron, title: "Git and GitHub, one click", text: "Connect your GitHub account once. Stage, commit, push and pull from the Source Control panel." },
    { icon: Search, color: C.sea, title: "Search the whole project", text: "Find any text across every file, jump to the match, and replace everywhere with regex groups." },
    { icon: ShieldCheck, color: C.orchid, title: "Yours, and free", text: "No trial, no limits banner. Make an account and start building." },
];
function Features() {
    const [ref, p] = useProgress();
    const trackRef = useRef(null);
    const [shift, setShift] = useState(0);
    useEffect(() => {
        const m = () => trackRef.current && setShift(Math.max(0, trackRef.current.scrollWidth - window.innerWidth));
        m();
        window.addEventListener("resize", m);
        return () => window.removeEventListener("resize", m);
    }, []);
    return (
        <section id="features" ref={ref} className="relative" style={{ height: "420vh", background: C.deep }}>
            <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden">
                <h2 className="px-8 pb-10 text-[clamp(2rem,4.5vw,3.6rem)] font-extrabold text-white md:px-16">Everything a dev day needs, in one tab.</h2>
                <div ref={trackRef} className="flex w-max gap-6 px-8 md:px-16" style={{ transform: `translateX(${-p * shift}px)` }}>
                    {FEATURES.map((f, i) => (
                        <article key={f.title} className="flex h-[52vh] w-[min(78vw,430px)] shrink-0 flex-col justify-between rounded-[2rem] p-8" style={{ background: f.color, color: C.ink, transform: `translateY(${i % 2 ? 28 : 0}px) rotate(${i % 2 ? 1.2 : -1.2}deg)` }}>
                            <f.icon size={46} strokeWidth={2} />
                            <div>
                                <h3 className="mb-3 text-3xl font-extrabold leading-tight">{f.title}</h3>
                                <p className="text-base leading-relaxed opacity-80">{f.text}</p>
                            </div>
                        </article>
                    ))}
                </div>
                <div className="mx-8 mt-10 h-1 rounded bg-white/10 md:mx-16">
                    <div className="h-full rounded" style={{ width: `${p * 100}%`, background: C.saffron }} />
                </div>
            </div>
        </section>
    );
}

/* ----- Live collaboration: the file writes itself as you scroll ----- */
const LINES = [
    ["Mira", C.saffron, "function total(cart) {"],
    ["Mira", C.saffron, "  let sum = 0;"],
    ["Dev", C.orchid, "  for (const item of cart) {"],
    ["Dev", C.orchid, "    sum += item.price * item.qty;"],
    ["Sam", C.sea, "  }"],
    ["Sam", C.sea, "  return Math.round(sum * 100) / 100;"],
    ["Mira", C.saffron, "}"],
];
function Together() {
    const [ref, p] = useProgress();
    const shown = Math.floor(p * (LINES.length + 1));
    const last = {};
    LINES.slice(0, shown).forEach(([n], i) => (last[n] = i));
    return (
        <section id="together" ref={ref} style={{ height: "300vh", background: C.lilac, color: C.ink }}>
            <div className="sticky top-0 grid h-screen items-center gap-10 px-8 md:grid-cols-2 md:px-16">
                <div>
                    <h2 className="text-[clamp(2.2rem,5vw,4.4rem)] font-extrabold leading-[1]">Three people. One file. No merge conflicts.</h2>
                    <p className="mt-5 max-w-md text-lg leading-relaxed opacity-75">
                        Live collaboration is coming to every project. Everyone sees each other&apos;s cursor and every keystroke as it happens, and the editor merges edits even when two people type on the same line.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-2 text-sm font-semibold">
                        {["Owner: everything", "Editor: change code", "Viewer: read only"].map((r, i) => (
                            <span key={r} className="rounded-full px-4 py-1.5" style={{ background: [C.ink, C.saffron, C.sea][i], color: i ? C.ink : "#fff" }}>{r}</span>
                        ))}
                    </div>
                </div>
                <div className="rounded-2xl p-6 shadow-2xl" style={{ background: C.ink }}>
                    <div className="mono space-y-1 text-[13px] text-white/90 md:text-[15px]">
                        {LINES.map(([name, color, text], i) => (
                            <div key={i} className="flex min-h-[2rem] items-center border-l-4 pl-3 transition-all duration-300" style={{ borderColor: i < shown ? color : "transparent", opacity: i < shown ? 1 : 0.08, transform: `translateX(${i < shown ? 0 : -14}px)` }}>
                                <span className="whitespace-pre">{text}</span>
                                {last[name] === i && <span className="ml-2 rounded px-1.5 text-[10px] font-bold" style={{ background: color, color: C.ink }}>{name}</span>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}

/* ----- Steps: a line draws itself and steps zigzag along it ----- */
const STEPS = [
    ["Create a project", "Name it and start with a blank folder."],
    ["Invite by username", "Pick Can edit or Can view for each person."],
    ["Build together", "Edit, run the terminal and search the code."],
    ["Push to GitHub", "Use your own connected account, one click."],
];
function Steps() {
    const [ref, p] = useProgress();
    return (
        <section ref={ref} className="relative" style={{ height: "340vh", background: C.ink }}>
            <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden px-6">
                <svg className="absolute h-[80vh] w-full max-w-3xl" viewBox="0 0 400 600" preserveAspectRatio="none" fill="none">
                    <path d="M200 0 C 40 100, 360 160, 200 300 S 40 500, 200 600" stroke="#ffffff22" strokeWidth="3" />
                    <path d="M200 0 C 40 100, 360 160, 200 300 S 40 500, 200 600" stroke={C.sea} strokeWidth="5" strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - p} />
                </svg>
                <div className="relative grid w-full max-w-3xl gap-8">
                    {STEPS.map(([t, d], i) => {
                        const on = p > i / STEPS.length - 0.05;
                        return (
                            <div key={t} className={`max-w-[15rem] rounded-2xl p-5 transition-all duration-500 ${i % 2 ? "justify-self-end" : ""}`} style={{ background: [C.saffron, C.orchid, C.sea, C.lilac][i], color: C.ink, opacity: on ? 1 : 0.12, transform: `translateX(${on ? 0 : i % 2 ? 60 : -60}px)` }}>
                                <h3 className="text-xl font-extrabold">{t}</h3>
                                <p className="mt-1 text-sm opacity-80">{d}</p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

/* ----- Free: a ticket that tilts while you scroll past ----- */
function Free() {
    const [ref, p] = useProgress();
    const perks = ["Unlimited projects", "Sandboxed terminal", "Git and GitHub push and pull", "Share with teammates", "Live collaboration as it ships"];
    return (
        <section id="free" ref={ref} style={{ height: "170vh", background: C.saffron, color: C.ink }}>
            <div className="sticky top-0 grid h-screen place-items-center px-6">
                <div className="w-full max-w-md rounded-[2rem] border-4 p-9" style={{ borderColor: C.ink, background: C.lilac, transform: `rotate(${(0.5 - p) * 14}deg) scale(${0.9 + p * 0.1})` }}>
                    <p className="text-sm font-semibold opacity-70">The whole thing costs</p>
                    <p className="text-[7rem] font-extrabold leading-none">Free</p>
                    <ul className="my-6 space-y-2.5 border-y-2 border-dashed py-6" style={{ borderColor: C.ink }}>
                        {perks.map((x) => (
                            <li key={x} className="flex items-center gap-3 font-semibold">
                                <Check size={18} strokeWidth={3} /> {x}
                            </li>
                        ))}
                    </ul>
                    <Link to="/register" className="block rounded-full py-3.5 text-center font-extrabold text-white transition-transform hover:-translate-y-1" style={{ background: C.ink, boxShadow: `0 6px 0 ${C.orchid}` }}>
                        Create your free account
                    </Link>
                </div>
            </div>
        </section>
    );
}

function Footer() {
    const authUser = useAuthStore((s) => s.authUser);
    return (
        <footer className="px-6 py-20 text-center" style={{ background: C.deep }}>
            <h2 className="mx-auto max-w-3xl text-[clamp(2rem,5vw,4rem)] font-extrabold leading-tight text-white">Open a tab. Start a project. Invite your team.</h2>
            <Link to={authUser ? "/dashboard" : "/register"} className="mt-8 inline-block rounded-full px-8 py-4 font-bold" style={{ background: C.sea, color: C.ink }}>
                {authUser ? "Go to your workspace" : "Start coding free"}
            </Link>
            <p className="mt-14 text-sm text-white/40">CodeSpace. Built by developers, free for developers.</p>
        </footer>
    );
}

export default function Landing() {
    const wrapRef = useRef(null);
    const contentRef = useRef(null);

    useEffect(() => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        const lenis = new Lenis({
            wrapper: wrapRef.current,
            content: contentRef.current,
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            smoothWheel: true,
        });
        window.lenis = lenis; // used by the navbar links

        let raf = requestAnimationFrame(function loop(time) {
            lenis.raf(time);
            raf = requestAnimationFrame(loop);
        });

        return () => {
            cancelAnimationFrame(raf);
            lenis.destroy();
            delete window.lenis;
        };
    }, []);

    return (
        <div ref={wrapRef} className="lp fixed inset-0 overflow-y-auto overflow-x-hidden" style={{ overscrollBehavior: "contain" }}>
            <div ref={contentRef}>
                <style>{css}</style>
                <Nav />
                <Hero />
                <Marquee />
                <Features />
                <Together />
                <Steps />
                <Free />
                <Footer />
            </div>
        </div>
    );
}
