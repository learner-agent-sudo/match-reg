"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

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

export default function AdminPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth/login"); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!profile || profile.role !== "admin") {
        router.push("/dashboard");
        return;
      }

      setIsAdmin(true);

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

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  if (!isAdmin) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  const filteredMembers = selectedTeam
    ? members.filter((m) => m.team_id === selectedTeam)
    : members;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <button
          onClick={handleSignOut}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          Sign Out
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Teams */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Teams ({teams.length})</h2>
          <div className="space-y-3">
            {teams.map((team) => (
              <div
                key={team.id}
                className={`p-3 border rounded-md cursor-pointer transition ${
                  selectedTeam === team.id ? "border-blue-500 bg-blue-50" : "hover:bg-gray-50"
                }`}
                onClick={() => setSelectedTeam(selectedTeam === team.id ? null : team.id)}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{team.name}</p>
                    <p className="text-xs text-gray-500">{team.tournament?.name}</p>
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
                        ? "bg-green-50 border-green-300 text-green-700"
                        : team.payment_status === "submitted"
                        ? "bg-amber-50 border-amber-300 text-amber-700"
                        : "bg-red-50 border-red-300 text-red-700"
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
              <p className="text-sm text-gray-500">No teams registered yet.</p>
            )}
          </div>
        </div>

        {/* Members */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">
            {selectedTeam
              ? `Members of ${teams.find((t) => t.id === selectedTeam)?.name}`
              : `All Members (${members.length})`}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Name</th>
                  <th className="text-left py-2 px-2">Email</th>
                  <th className="text-left py-2 px-2">Role</th>
                  <th className="text-left py-2 px-2">#</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member) => (
                  <tr key={member.id} className="border-b last:border-0">
                    <td className="py-2 px-2">{member.full_name}</td>
                    <td className="py-2 px-2 text-gray-600">{member.email}</td>
                    <td className="py-2 px-2 capitalize">{member.role.replace("_", " ")}</td>
                    <td className="py-2 px-2">{member.jersey_number ?? "—"}</td>
                  </tr>
                ))}
                {filteredMembers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-gray-500">
                      No members found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
