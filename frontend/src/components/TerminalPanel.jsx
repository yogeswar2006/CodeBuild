import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

// Replace with however you store the JWT (localStorage, zustand auth store, ...)
const getToken = () => localStorage.getItem("token");

export default function TerminalPanel({ projectId, visible, onCommandRun }) {
  const boxRef = useRef(null);
  const fitRef = useRef(null);
  const wsRef = useRef(null);
  const termRef = useRef(null);

  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', monospace",
      theme: { background: "#0A0E14", foreground: "#BFBDB6", cursor: "#FFCC66" },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(boxRef.current);
    termRef.current = term;
    fitRef.current = fit;
    //const url = `${import.meta.env.VITE_WS_URL}/terminal?projectId=${projectId}&token=${encodeURIComponent(getToken() ?? "")}`;
    const url = `${import.meta.env.VITE_WS_URL}/terminal?projectId=${projectId}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    const sendResize = () => {
      if (ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
    };

    ws.onopen = () => { fit.fit(); sendResize(); };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "output") term.write(msg.data);
    };
    ws.onclose = () => term.write("\r\n\x1b[31m[disconnected]\x1b[0m\r\n");

    let refreshTimer;
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify({ type: "input", data }));

      // After Enter, refresh the file explorer shortly after (catches touch, mkdir, npm init...)
      if (data.includes("\r")) {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => onCommandRun?.(), 1500);
      }
    });

    // Refit whenever the container size changes (window resize, panel toggle)
    const observer = new ResizeObserver(() => {
      if (!boxRef.current?.clientHeight) return; // hidden: skip
      fit.fit();
      sendResize();
    });
    observer.observe(boxRef.current);

    return () => {
      clearTimeout(refreshTimer);
      observer.disconnect();
      ws.close();
      term.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Focus when the panel is opened
  useEffect(() => {
    if (visible) termRef.current?.focus();
  }, [visible]);

  return (
    <div className="h-full w-full bg-[#0A0E14] p-2">
      <div ref={boxRef} className="h-full w-full" />
    </div>
  );
}