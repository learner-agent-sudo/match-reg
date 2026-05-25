"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <button
          onClick={handleSignOut}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          Sign Out
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold mb-2">Welcome, {profile.full_name}</h2>
        <p className="text-sm text-gray-600">
          Role: <span className="capitalize font-medium">{profile.role.replace("_", " ")}</span>
        </p>
      </div>

      {!team && (profile.role === "coach" || profile.role === "team_manager") && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-amber-800 mb-2">No Team Yet</h2>
          <p className="text-sm text-amber-700 mb-4">You haven&apos;t registered a team yet.</p>
          <Link
            href="/team/register"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
          >
            Register Team
          </Link>
        </div>
      )}

      {team && (
        <>
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-lg font-semibold">{team.name}</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Payment: <span className={`font-medium ${
                    team.payment_status === "confirmed" ? "text-green-600" :
                    team.payment_status === "submitted" ? "text-amber-600" :
                    "text-red-600"
                  }`}>{team.payment_status}</span>
                </p>
              </div>

              {(profile.role === "coach" || profile.role === "team_manager") && (
                <button
                  onClick={copyInviteLink}
                  className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition"
                >
                  {copied ? "Copied!" : "Copy Invite Link"}
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Team Members ({members.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Name</th>
                    <th className="text-left py-2 px-2">Role</th>
                    <th className="text-left py-2 px-2">Jersey #</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id} className="border-b last:border-0">
                      <td className="py-2 px-2">{member.full_name}</td>
                      <td className="py-2 px-2 capitalize">{member.role.replace("_", " ")}</td>
                      <td className="py-2 px-2">{member.jersey_number ?? "—"}</td>
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
