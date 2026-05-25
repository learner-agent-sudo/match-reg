"use client";

import { useState, useEffect, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function JoinTeamPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [teamName, setTeamName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [jerseyNumber, setJerseyNumber] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [teamFound, setTeamFound] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function fetchTeam() {
      const supabase = createClient();
      const { data } = await supabase
        .from("teams")
        .select("name")
        .eq("invite_code", code)
        .single();

      if (data) {
        setTeamName(data.name);
        setTeamFound(true);
      }
    }
    fetchTeam();
  }, [code]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role: "player" },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const { data: team } = await supabase
      .from("teams")
      .select("id")
      .eq("invite_code", code)
      .single();

    if (!team || !authData.user) {
      setError("Team not found or signup failed.");
      setLoading(false);
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        team_id: team.id,
        jersey_number: jerseyNumber ? parseInt(jerseyNumber) : null,
        emergency_contact: emergencyContact || null,
      })
      .eq("id", authData.user.id);

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  };

  if (!teamFound) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Invite Link</h1>
          <p className="text-gray-600 mb-4">This team invite link is not valid or has expired.</p>
          <Link href="/" className="text-blue-600 hover:underline">Go to homepage</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-2">Join {teamName}</h1>
        <p className="text-center text-gray-600 mb-6">Register as a player</p>

        <form onSubmit={handleJoin} className="bg-white p-6 rounded-lg shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jersey Number (optional)</label>
            <input
              type="number"
              value={jerseyNumber}
              onChange={(e) => setJerseyNumber(e.target.value)}
              min={1}
              max={99}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact (optional)</label>
            <input
              type="text"
              value={emergencyContact}
              onChange={(e) => setEmergencyContact(e.target.value)}
              placeholder="Name & phone number"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 disabled:opacity-50 transition"
          >
            {loading ? "Joining..." : "Join Team"}
          </button>
        </form>
      </div>
    </div>
  );
}
