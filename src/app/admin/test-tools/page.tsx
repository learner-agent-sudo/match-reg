"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const DEMO_PASSWORD = "demo1234";

interface DemoLogin {
  id: string;
  full_name: string;
  email: string;
  role: string;
  team: { name: string } | null;
}

export default function TestToolsPage() {
  const [numTeams, setNumTeams] = useState("4");
  const [playersPerTeam, setPlayersPerTeam] = useState("5");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [logins, setLogins] = useState<DemoLogin[]>([]);
  const [showPlayers, setShowPlayers] = useState(false);
  const router = useRouter();

  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    async function fetchLogins() {
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, team:teams(name)")
        .like("email", "demo-%@example.com")
        .order("email");
      setLogins((data ?? []) as unknown as DemoLogin[]);
    }
    fetchLogins();
  }, [refresh]);

  async function run(label: string, fn: string, args?: Record<string, unknown>) {
    setBusy(label);
    setMessage(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc(fn, args);
    if (error) {
      const missing = error.code === "PGRST202" || error.message.includes("Could not find the function");
      setMessage({
        ok: false,
        text: missing
          ? "The test tools aren't installed in the database yet. In Supabase, open SQL Editor, paste the contents of supabase/test-tools.sql and click Run."
          : error.message,
      });
    } else {
      setMessage({ ok: true, text: String(data) });
    }
    setBusy("");
    setRefresh((r) => r + 1);
  }

  const loadDemo = () => {
    if (!confirm("Create a demo tournament? Any existing demo tournament and demo logins are replaced. Your real data is not touched.")) return;
    run("load", "demo_load", { p_teams: parseInt(numTeams), p_players_per_team: parseInt(playersPerTeam) });
  };

  const deleteDemo = () => {
    if (!confirm("Delete the demo tournament and all demo logins? Your real data is not touched.")) return;
    run("delete", "demo_delete");
  };

  const signInAs = async (email: string) => {
    if (!confirm(`Sign out of admin and sign in as ${email}?\n\nTo come back, sign out and sign in with your admin account.`)) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    const { error } = await supabase.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
    if (error) {
      setMessage({ ok: false, text: `Could not sign in as ${email}: ${error.message}` });
      return;
    }
    router.push("/dashboard");
  };

  const visibleLogins = showPlayers ? logins : logins.filter((l) => l.role !== "player");
  const playerCount = logins.filter((l) => l.role === "player").length;

  const button = "px-3 py-2 text-sm font-medium rounded-md text-white disabled:opacity-50 transition";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Test Tools</h2>
        <p className="text-sm text-slate-400 mt-1">
          One-click demo data for trying out the site. Everything here only touches the
          <span className="text-slate-200"> DEMO Cup (test data)</span> tournament and the demo logins — never your real tournaments.
        </p>
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm border ${
          message.ok ? "bg-green-900/30 border-green-700 text-green-300" : "bg-red-900/30 border-red-700 text-red-300"
        }`}>
          {message.text}
        </div>
      )}

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 space-y-4">
        <h3 className="font-semibold text-white">1. Create demo tournament</h3>
        <p className="text-sm text-slate-400">
          Creates teams (each with a coach, a team manager and players), 2 pitches with time slots on the coming
          weekend, 3 referees, 2 runners, Group A and all its round-robin matches. Referees and runners are assigned;
          time slots are left empty so you can test <span className="text-slate-200">Auto Schedule</span>.
        </p>
        <div className="flex flex-wrap gap-4 items-end">
          <label className="text-sm text-slate-300">
            Teams
            <select value={numTeams} onChange={(e) => setNumTeams(e.target.value)} className="block mt-1 px-3 py-2 rounded-md text-sm">
              {[4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-300">
            Players per team
            <select value={playersPerTeam} onChange={(e) => setPlayersPerTeam(e.target.value)} className="block mt-1 px-3 py-2 rounded-md text-sm">
              {[0, 3, 5, 8, 11].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <button onClick={loadDemo} disabled={!!busy} className={`${button} bg-blue-600 hover:bg-blue-500`}>
            {busy === "load" ? "Creating..." : "Load demo tournament"}
          </button>
        </div>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 space-y-4">
        <h3 className="font-semibold text-white">2. Simulate results</h3>
        <ol className="text-sm text-slate-400 list-decimal list-inside space-y-1">
          <li>Fill group scores, then look at the standings in the Matches tab.</li>
          <li>In the Matches tab, open Group Setup and click Generate Playoffs.</li>
          <li>Come back and fill playoff scores — winners move into the final automatically.</li>
        </ol>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => run("group", "demo_fill_scores", { p_stage: "group" })} disabled={!!busy}
            className={`${button} bg-green-600 hover:bg-green-500`}>
            {busy === "group" ? "Filling..." : "Fill group scores"}
          </button>
          <button onClick={() => run("playoff", "demo_fill_scores", { p_stage: "playoff" })} disabled={!!busy}
            className={`${button} bg-purple-600 hover:bg-purple-500`}>
            {busy === "playoff" ? "Filling..." : "Fill playoff scores"}
          </button>
          <button onClick={() => run("clear", "demo_clear_scores")} disabled={!!busy}
            className={`${button} bg-slate-600 hover:bg-slate-500`}>
            {busy === "clear" ? "Clearing..." : "Clear all scores"}
          </button>
        </div>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 space-y-4">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <h3 className="font-semibold text-white">3. Demo logins</h3>
          {playerCount > 0 && (
            <button onClick={() => setShowPlayers(!showPlayers)} className="text-sm text-blue-400 hover:underline">
              {showPlayers ? "Hide players" : `Show ${playerCount} players`}
            </button>
          )}
        </div>
        {logins.length === 0 ? (
          <p className="text-sm text-slate-500">No demo logins yet. Load a demo tournament first.</p>
        ) : (
          <>
            <p className="text-sm text-slate-400">
              Every demo password is <span className="font-mono text-slate-200">{DEMO_PASSWORD}</span>.
              Use &quot;Sign in as&quot; to see the site as a coach, manager or player.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2 px-2 text-slate-400">Team</th>
                    <th className="text-left py-2 px-2 text-slate-400">Role</th>
                    <th className="text-left py-2 px-2 text-slate-400">Name</th>
                    <th className="text-left py-2 px-2 text-slate-400">Email</th>
                    <th className="py-2 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLogins.map((l) => (
                    <tr key={l.id} className="border-b border-slate-700/50 last:border-0">
                      <td className="py-2 px-2 text-slate-300">{l.team?.name ?? "—"}</td>
                      <td className="py-2 px-2 text-slate-300 capitalize">{l.role.replace("_", " ")}</td>
                      <td className="py-2 px-2 text-slate-200">{l.full_name}</td>
                      <td className="py-2 px-2 text-slate-400 font-mono text-xs">{l.email}</td>
                      <td className="py-2 px-2 text-right">
                        <button onClick={() => signInAs(l.email)} className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-200 hover:bg-slate-600 whitespace-nowrap">
                          Sign in as
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="bg-slate-800 border border-red-900/60 rounded-lg p-6 space-y-3">
        <h3 className="font-semibold text-white">4. Clean up</h3>
        <p className="text-sm text-slate-400">Removes the demo tournament and every demo login. Do this before the real tournament goes live.</p>
        <button onClick={deleteDemo} disabled={!!busy} className={`${button} bg-red-600 hover:bg-red-500`}>
          {busy === "delete" ? "Deleting..." : "Delete demo data"}
        </button>
      </div>
    </div>
  );
}
