"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function TeamRegisterPage() {
  const [teamName, setTeamName] = useState("");
  const [tournaments, setTournaments] = useState<{ id: string; name: string }[]>([]);
  const [selectedTournament, setSelectedTournament] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function fetchTournaments() {
      const supabase = createClient();
      const { data } = await supabase
        .from("tournaments")
        .select("id, name")
        .eq("registration_open", true);
      if (data && data.length > 0) {
        setTournaments(data);
        setSelectedTournament(data[0].id);
      }
    }
    fetchTournaments();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("You must be logged in.");
      setLoading(false);
      return;
    }

    const { data: team, error: teamError } = await supabase
      .from("teams")
      .insert({ name: teamName, tournament_id: selectedTournament })
      .select()
      .single();

    if (teamError) {
      setError(teamError.message);
      setLoading(false);
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ team_id: team.id })
      .eq("id", user.id);

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  };

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6">Register Your Team</h1>

        <form onSubmit={handleRegister} className="bg-white p-6 rounded-lg shadow-sm space-y-4">
          {tournaments.length > 0 ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tournament</label>
              <select
                value={selectedTournament}
                onChange={(e) => setSelectedTournament(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {tournaments.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-sm text-amber-600">
              No tournaments are currently open for registration. Please check back later.
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Team Name</label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              required
              placeholder="e.g. Thunder FC"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading || tournaments.length === 0}
            className="w-full py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {loading ? "Registering..." : "Register Team"}
          </button>
        </form>
      </div>
    </div>
  );
}
