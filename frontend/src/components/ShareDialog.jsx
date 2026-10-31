import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { X } from "lucide-react";
import { useProjectStore } from "../store/useProjectStore";

export default function ShareDialog({ projectId, onClose }) {
  const s = useProjectStore();
  const [data, setData] = useState(null); // { owner, members }
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("EDITOR");
  const [busy, setBusy] = useState(false);

  const load = () => s.getMembers(projectId).then(setData).catch(() => toast.error("Could not load members"));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [projectId]);

  const run = async (fn, ok) => {
    setBusy(true);
    try { await fn(); if (ok) toast.success(ok); await load(); }
    catch (e) { toast.error(e.response?.data?.message || "Something went wrong"); }
    finally { setBusy(false); }
  };

  const add = () =>
    run(async () => { await s.addMember(projectId, username.trim(), role); setUsername(""); }, "Access granted");

  const field = "rounded-sm border border-[#3c3c3c] bg-[#3c3c3c] px-2 py-1 text-[13px] text-white outline-none focus:border-[#007acc]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-[420px] rounded-lg border border-[#3c3c3c] bg-[#1e1e1e] p-4 text-[#cccccc]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold text-white">Share project</h3>
          <button onClick={onClose}><X size={16} /></button>
        </div>

        <div className="mb-4 flex gap-2">
          <input value={username} onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && username.trim() && add()}
            placeholder="Username" className={`${field} min-w-0 flex-1`} />
          <select value={role} onChange={(e) => setRole(e.target.value)} className={field}>
            <option value="EDITOR">Can edit</option>
            <option value="VIEWER">Can view</option>
          </select>
          <button disabled={busy || !username.trim()} onClick={add}
            className="rounded bg-[#0E4B52] px-3 text-[13px] text-white disabled:opacity-40">Add</button>
        </div>

        <div className="max-h-64 space-y-1 overflow-y-auto text-[13px]">
          {data && (
            <div className="flex items-center justify-between py-1">
              <span>{data.owner.username}</span>
              <span className="text-xs text-[#7BE5C4]">Owner</span>
            </div>
          )}
          {data?.members.map((m) => (
            <div key={m.userId} className="flex items-center gap-2 py-1">
              <span className="min-w-0 flex-1 truncate">{m.username}</span>
              <select value={m.role} disabled={busy}
                onChange={(e) => run(() => s.updateMember(projectId, m.userId, e.target.value), "Role updated")}
                className={field}>
                <option value="EDITOR">Can edit</option>
                <option value="VIEWER">Can view</option>
              </select>
              <button title="Remove access" disabled={busy}
                onClick={() => run(() => s.removeMember(projectId, m.userId), "Access removed")}
                className="text-[#FF7F6E]"><X size={14} /></button>
            </div>
          ))}
          {data && data.members.length === 0 && <p className="text-xs text-[#6b7280]">Not shared with anyone yet.</p>}
        </div>
      </div>
    </div>
  );
}