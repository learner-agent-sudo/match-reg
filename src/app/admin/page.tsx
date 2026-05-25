"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface Team {
  id: string;
  name: string;
  payment_status: string;
  invite_code: string;
  tournament: { name: string };
}

interface Member {
  id: string;
  full_name: string;
  email: string;
  role: string;
  team_id: string | null;
  jersey_number: number | null;
}

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();

      const { data: teamsData } = await supabase
        .from("teams")
        .select("id, name, payment_status, invite_code, tournament:tournaments(name)");

      if (teamsData) setTeams(teamsData as unknown as Team[]);

      const { data: membersData } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, team_id, jersey_number");

      if (membersData) setMembers(membersData);
    }
    loadData();
  }, []);

  const updatePaymentStatus = async (teamId: string, status: string) => {
    const supabase = createClient();
    await supabase
      .from("teams")
      .update({ payment_status: status })
      .eq("id", teamId);

    setTeams((prev) =>
      prev.map((t) => (t.id === teamId ? { ...t, payment_status: status } : t))
    );
  };

  const filteredMembers = selectedTeam
    ? members.filter((m) => m.team_id === selectedTeam)
    : members;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Teams ({teams.length})</h2>
        <div className="space-y-3">
          {teams.map((team) => (
            <div
              key={team.id}
              className={`p-3 border rounded-md cursor-pointer transition ${
                selectedTeam === team.id
                  ? "border-blue-500 bg-blue-900/20"
                  : "border-slate-600 hover:bg-slate-700/50"
              }`}
              onClick={() => setSelectedTeam(selectedTeam === team.id ? null : team.id)}
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-slate-200">{team.name}</p>
                  <p className="text-xs text-slate-500">{team.tournament?.name}</p>
                </div>
                <select
                  value={team.payment_status}
                  onChange={(e) => {
                    e.stopPropagation();
                    updatePaymentStatus(team.id, e.target.value);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className={`text-xs px-2 py-1 rounded border ${
                    team.payment_status === "confirmed"
                      ? "bg-green-900/30 border-green-700 text-green-400"
                      : team.payment_status === "submitted"
                      ? "bg-amber-900/30 border-amber-700 text-amber-400"
                      : "bg-red-900/30 border-red-700 text-red-400"
                  }`}
                >
                  <option value="pending">Pending</option>
                  <option value="submitted">Submitted</option>
                  <option value="confirmed">Confirmed</option>
                </select>
              </div>
            </div>
          ))}
          {teams.length === 0 && (
            <p className="text-sm text-slate-500">No teams registered yet.</p>
          )}
        </div>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          {selectedTeam
            ? `Members of ${teams.find((t) => t.id === selectedTeam)?.name}`
            : `All Members (${members.length})`}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-2 px-2 text-slate-400">Name</th>
                <th className="text-left py-2 px-2 text-slate-400">Email</th>
                <th className="text-left py-2 px-2 text-slate-400">Role</th>
                <th className="text-left py-2 px-2 text-slate-400">#</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((member) => (
                <tr key={member.id} className="border-b border-slate-700/50 last:border-0">
                  <td className="py-2 px-2 text-slate-200">{member.full_name}</td>
                  <td className="py-2 px-2 text-slate-400">{member.email}</td>
                  <td className="py-2 px-2 text-slate-300 capitalize">{member.role.replace("_", " ")}</td>
                  <td className="py-2 px-2 text-slate-300">{member.jersey_number ?? "—"}</td>
                </tr>
              ))}
              {filteredMembers.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-slate-500">
                    No members found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
