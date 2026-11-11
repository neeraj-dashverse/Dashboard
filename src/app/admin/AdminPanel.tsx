"use client";

import { useState } from "react";
import type { AllowedUser, Role } from "@/lib/auth/allowed-users";

export function AdminPanel({ users: initial, currentEmail }: { users: AllowedUser[]; currentEmail: string }) {
  const [users, setUsers] = useState(initial);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("viewer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/allowed-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, role }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not add user");
      const next = (await res.json()) as AllowedUser[];
      setUsers(next);
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add user");
    } finally {
      setBusy(false);
    }
  }

  async function removeUser(targetEmail: string) {
    if (!window.confirm(`Remove ${targetEmail}'s access?`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/allowed-users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not remove user");
      const next = (await res.json()) as AllowedUser[];
      setUsers(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove user");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-white">Admin · Access control</h1>
        <p className="mt-1 text-[12px] text-slate-400">
          Only people listed here can open this dashboard. Admins can edit everything; viewers can look but not
          change anything.
        </p>
      </div>

      <form onSubmit={addUser} className="flex flex-wrap items-end gap-2 rounded-xl border border-white/[0.08] bg-[#161a26] p-4">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="person@dashverse.ai"
            className="mt-1 w-full rounded-lg border border-white/[0.12] bg-[#222738] px-3 py-2 text-[13px] text-white outline-none placeholder:text-slate-500 focus:border-[#4361ee]"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="mt-1 rounded-lg border border-white/[0.12] bg-[#222738] px-3 py-2 text-[13px] text-white outline-none"
          >
            <option value="viewer">Viewer</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-[#4361ee] px-4 py-2 text-[12px] font-bold text-white hover:bg-[#5470f0] disabled:opacity-50"
        >
          Add
        </button>
      </form>
      {error && <p className="text-[12px] text-rose-300">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-white/[0.08]">
        <table className="min-w-full border-collapse text-left text-[12px]">
          <thead className="bg-[#222738] text-[10px] font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2.5">Email</th>
              <th className="px-3 py-2.5">Role</th>
              <th className="px-3 py-2.5">Added</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.email} className="border-t border-white/[0.06]">
                <td className="px-3 py-2.5 text-slate-200">
                  {u.email}
                  {u.email === currentEmail && <span className="ml-1.5 text-slate-500">(you)</span>}
                </td>
                <td className="px-3 py-2.5 text-slate-300">{u.role === "admin" ? "Admin" : "Viewer"}</td>
                <td className="px-3 py-2.5 text-slate-500">{new Date(u.added_at).toLocaleDateString()}</td>
                <td className="px-3 py-2.5 text-right">
                  {u.email !== currentEmail && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => removeUser(u.email)}
                      className="rounded-md bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-rose-300 hover:bg-white/[0.1]"
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
