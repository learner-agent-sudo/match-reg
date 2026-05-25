"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PaymentUpload from "@/components/PaymentUpload";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  team_id: string | null;
  jersey_number: number | null;
}

interface Team {
  id: string;
  name: string;
  invite_code: string;
  payment_status: string;
}

interface TeamMember {
  id: string;
  full_name: string;
  role: string;
  jersey_number: number | null;
}

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth/login"); return; }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileData) {
        setProfile(profileData);

        if (profileData.role === "admin") {
          router.push("/admin");
          return;
        }

        if (profileData.team_id) {
          const { data: teamData } = await supabase
            .from("teams")
            .select("*")
            .eq("id", profileData.team_id)
            .single();

          if (teamData) {
            setTeam(teamData);

            const { data: membersData } = await supabase
              .from("profiles")
              .select("id, full_name, role, jersey_number")
              .eq("team_id", teamData.id);

            if (membersData) setMembers(membersData);
          }
        }
      }
    }
    loadData();
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  const copyInviteLink = () => {
    if (!team) return;
    const link = `${window.location.origin}/team/join/${team.invite_code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!profile) {
    return <div className="flex items-center justify-center min-h-screen text-slate-400">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <button onClick={handleSignOut} className="text-sm text-slate-400 hover:text-white transition">
          Sign Out
        </button>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-2">Welcome, {profile.full_name}</h2>
        <p className="text-sm text-slate-400">
          Role: <span className="capitalize font-medium text-slate-300">{profile.role.replace("_", " ")}</span>
        </p>
      </div>

      {!team && (profile.role === "coach" || profile.role === "team_manager") && (
        <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-amber-300 mb-2">No Team Yet</h2>
          <p className="text-sm text-amber-400 mb-4">You haven&apos;t registered a team yet.</p>
          <Link
            href="/team/register"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition"
          >
            Register Team
          </Link>
        </div>
      )}

      {team && (
        <>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 mb-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-semibold text-white">{team.name}</h2>
                <p className="text-sm text-slate-400 mt-1">
                  Payment: <span className={`font-medium ${
                    team.payment_status === "confirmed" ? "text-green-400" :
                    team.payment_status === "submitted" ? "text-amber-400" :
                    "text-red-400"
                  }`}>{team.payment_status}</span>
                </p>
              </div>

              {(profile.role === "coach" || profile.role === "team_manager") && (
                <button
                  onClick={copyInviteLink}
                  className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-500 transition"
                >
                  {copied ? "Copied!" : "Copy Invite Link"}
                </button>
              )}
            </div>

            {(profile.role === "coach" || profile.role === "team_manager") && (
              <PaymentUpload
                teamId={team.id}
                currentStatus={team.payment_status}
                onStatusChange={(status) => setTeam({ ...team, payment_status: status })}
              />
            )}
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Team Members ({members.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2 px-2 text-slate-400">Name</th>
                    <th className="text-left py-2 px-2 text-slate-400">Role</th>
                    <th className="text-left py-2 px-2 text-slate-400">Jersey #</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id} className="border-b border-slate-700/50 last:border-0">
                      <td className="py-2 px-2 text-slate-200">{member.full_name}</td>
                      <td className="py-2 px-2 text-slate-300 capitalize">{member.role.replace("_", " ")}</td>
                      <td className="py-2 px-2 text-slate-300">{member.jersey_number ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
