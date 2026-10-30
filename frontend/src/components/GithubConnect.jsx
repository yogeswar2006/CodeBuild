import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { FaGithub } from "react-icons/fa";
import api from "../lib/axios";

const MESSAGES = {
    connected: ["success", "GitHub connected"],
    denied: ["error", "You cancelled the GitHub connection"],
    in_use: ["error", "That GitHub account is already linked to another user"],
    error: ["error", "Could not connect GitHub, please try again"],
};

export default function GithubConnect() {
    const [status, setStatus] = useState(null); // { connected, username, avatarUrl }
    const [busy, setBusy] = useState(false);

    const load = () =>
        api.get("/github/status").then((r) => setStatus(r.data)).catch(() => setStatus({ connected: false }));

    useEffect(() => {
        // coming back from GitHub: /?github=connected
        const params = new URLSearchParams(window.location.search);
        const result = params.get("github");
        if (result && MESSAGES[result]) {
            const [kind, text] = MESSAGES[result];
            toast[kind](text);
            params.delete("github");
            const qs = params.toString();
            window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
        }
        load();
    }, []);

    const connect = async () => {
        setBusy(true);
        try {
            const { data } = await api.post("/github/connect");
            window.location.href = data.url; // leave the app, GitHub redirects back afterwards
        } catch {
            toast.error("Could not start GitHub connection");
            setBusy(false);
        }
    };

    const disconnect = async () => {
        if (!window.confirm("Disconnect GitHub?")) return;
        await api.delete("/github");
        toast.success("GitHub disconnected");
        load();
    };

    if (!status) return null;

    return (
        <div className=" p-3 text-[13px]">
            {status.connected ? (
                <div className="relative inline-flex items-center group">
                    {status.avatarUrl && (
                        <img
                            src={status.avatarUrl}
                            alt=""
                            className="h-6 w-6 rounded-full"
                        />
                    )}

                    <div
                        className="absolute left-0 top-full z-50 pt-2
               invisible opacity-0
               group-hover:visible group-hover:opacity-100
               transition-opacity duration-150"
                    >
                        <button
                            onClick={disconnect}
                            className="whitespace-nowrap rounded-md border border-[#3c3c3c]
                 bg-[#252526] px-3 py-2 text-xs text-[#FF7F6E]
                 shadow-lg hover:bg-[#333333]"
                        >
                            Disconnect
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    onClick={connect}
                    disabled={busy}
                    className="flex w-full items-center justify-center gap-2 rounded  px-3 py-2 text-white hover:bg-[#3c3c3c] disabled:opacity-50"
                >
                    <FaGithub size={21} />

                </button>
            )}
        </div>
    );
}