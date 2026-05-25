"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function TeamRegisterPage() {
  const [teamName, setTeamName] = useState("");
  const [tournaments, setTournaments] = useState<{ id: string; name: string }[]>([]);
  const [selectedTournament, setSelectedTournament] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
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

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

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

    if (logoFile) {
      const fileExt = logoFile.name.split(".").pop();
      const filePath = `${team.id}/logo.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("team-logos")
        .upload(filePath, logoFile, { upsert: true });

      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage
          .from("team-logos")
          .getPublicUrl(filePath);

        await supabase
          .from("teams")
          .update({ logo_url: publicUrl })
          .eq("id", team.id);
      }
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
        <h1 className="text-2xl font-bold text-center text-white mb-6">Register Your Team</h1>

        <form onSubmit={handleRegister} className="bg-slate-800 border border-slate-700 p-6 rounded-lg space-y-4">
          {tournaments.length > 0 ? (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Tournament</label>
              <select
                value={selectedTournament}
                onChange={(e) => setSelectedTournament(e.target.value)}
                className="w-full px-3 py-2 rounded-md text-sm"
              >
                {tournaments.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-sm text-amber-400">
              No tournaments are currently open for registration. Please check back later.
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Team Name</label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              required
              placeholder="e.g. Thunder FC"
              className="w-full px-3 py-2 rounded-md text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Team Logo <span className="text-slate-500">(optional)</span>
            </label>
            <div className="flex items-center gap-4">
              {logoPreview && (
                <img
                  src={logoPreview}
                  alt="Logo preview"
                  className="w-16 h-16 rounded-lg object-cover border border-slate-600"
                />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-500"
              />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading || tournaments.length === 0}
            className="w-full py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-500 disabled:opacity-50 transition"
          >
            {loading ? "Registering..." : "Register Team"}
          </button>
        </form>
      </div>
    </div>
  );
}
