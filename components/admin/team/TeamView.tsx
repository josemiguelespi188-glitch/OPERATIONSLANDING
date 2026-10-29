"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminFetch } from "@/components/admin/AdminAuthContext";
import { InviteModal } from "./InviteModal";

interface TeamMember {
  id: string;
  email: string;
  fullName: string | null;
  role: "admin" | "super_admin";
  isActive: boolean;
  createdAt: string;
}

/**
 * Who has access to /admin, with a way to invite a new coworker (Oct
 * 2026) -- until now, a new admin had to be created by hand in the
 * Supabase dashboard (Auth + an admin_users row). Inviting goes through
 * Supabase Auth's own invite flow (see app/api/admin/team/invite), which
 * emails the invitee a single-use link to /accept-invite where they set
 * their own password.
 */
export function TeamView() {
  const adminFetch = useAdminFetch();
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [error, setError] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await adminFetch("/api/admin/team");
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not load the team.");
      setMembers(body.members ?? []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the team.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleInvite(email: string, fullName: string, role: "admin" | "super_admin") {
    const res = await adminFetch("/api/admin/team/invite", {
      method: "POST",
      body: JSON.stringify({ email, fullName, role }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? "Could not send the invite.");
    setShowInvite(false);
    await load();
  }

  async function toggleActive(member: TeamMember) {
    setTogglingId(member.id);
    try {
      const res = await adminFetch(`/api/admin/team/${member.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !member.isActive }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not update this member.");
      setMembers((prev) =>
        prev ? prev.map((m) => (m.id === member.id ? { ...m, isActive: !m.isActive } : m)) : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update this member.");
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-head text-2xl font-medium tracking-tight text-axis-core">Team</h1>
          <p className="mt-1 text-sm text-axis-core/55">Who can sign in to the Operations Hub admin.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowInvite(true)}
          className="shrink-0 rounded-[8px] bg-axis-core px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-axis-core/90"
        >
          Invite a coworker
        </button>
      </div>

      {error && <p className="mt-4 rounded-[8px] bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>}

      <div className="mt-6 overflow-hidden rounded-card border border-axis-base/30 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-axis-base/20 text-xs uppercase tracking-wide text-axis-core/45">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {members === null && !error && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-axis-core/40">
                  Loading...
                </td>
              </tr>
            )}
            {members?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-axis-core/40">
                  No team members yet.
                </td>
              </tr>
            )}
            {members?.map((member) => (
              <tr key={member.id} className="border-b border-axis-base/10 last:border-0">
                <td className="px-4 py-3 text-axis-core">{member.fullName || "—"}</td>
                <td className="px-4 py-3 text-axis-core/70">{member.email}</td>
                <td className="px-4 py-3 text-axis-core/70">
                  {member.role === "super_admin" ? "Super admin" : "Admin"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      member.isActive ? "bg-green-100 text-green-700" : "bg-axis-base/40 text-axis-core/50"
                    }`}
                  >
                    {member.isActive ? "Active" : "Deactivated"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => toggleActive(member)}
                    disabled={togglingId === member.id}
                    className="rounded-[6px] border border-axis-base/50 px-2.5 py-1 text-xs font-semibold text-axis-core transition-colors hover:border-axis-core disabled:opacity-50"
                  >
                    {togglingId === member.id ? "..." : member.isActive ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onInvite={handleInvite} />}
    </div>
  );
}
