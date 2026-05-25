"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface Tournament {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  max_teams: number;
  registration_open: boolean;
}

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    start_date: "",
    end_date: "",
    max_teams: "8",
  });

  useEffect(() => {
    loadTournaments();
  }, []);

  async function loadTournaments() {
    const supabase = createClient();
    const { data } = await supabase
      .from("tournaments")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setTournaments(data);
  }

  const createTournament = async () => {
    if (!form.name) return;
    const supabase = createClient();
    await supabase.from("tournaments").insert({
      name: form.name,
      description: form.description || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      max_teams: parseInt(form.max_teams) || 8,
      registration_open: true,
    });
    setForm({ name: "", description: "", start_date: "", end_date: "", max_teams: "8" });
    setShowAdd(false);
    loadTournaments();
  };

  const toggleRegistration = async (id: string, current: boolean) => {
    const supabase = createClient();
    await supabase.from("tournaments").update({ registration_open: !current }).eq("id", id);
    loadTournaments();
  };

  const deleteTournament = async (id: string) => {
    const supabase = createClient();
    await supabase.from("tournaments").delete().eq("id", id);
    loadTournaments();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-white">Tournaments</h2>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-500"
        >
          + Create Tournament
        </button>
      </div>

      {showAdd && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-3">
          <h3 className="font-medium text-sm text-slate-300">New Tournament</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Tournament name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="px-3 py-2 rounded-md text-sm"
            />
            <input
              type="number"
              placeholder="Max teams"
              value={form.max_teams}
              onChange={(e) => setForm({ ...form, max_teams: e.target.value })}
              min={2}
              className="px-3 py-2 rounded-md text-sm"
            />
            <input
              type="date"
              placeholder="Start date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              className="px-3 py-2 rounded-md text-sm"
            />
            <input
              type="date"
              placeholder="End date"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              className="px-3 py-2 rounded-md text-sm"
            />
          </div>
          <textarea
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 rounded-md text-sm"
          />
          <button
            onClick={createTournament}
            className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-500"
          >
            Save Tournament
          </button>
        </div>
      )}

      <div className="space-y-3">
        {tournaments.map((t) => (
          <div key={t.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-white">{t.name}</h3>
                {t.description && <p className="text-sm text-slate-400 mt-1">{t.description}</p>}
                <div className="flex gap-4 mt-2 text-xs text-slate-500">
                  {t.start_date && <span>Start: {t.start_date}</span>}
                  {t.end_date && <span>End: {t.end_date}</span>}
                  <span>Max teams: {t.max_teams}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleRegistration(t.id, t.registration_open)}
                  className={`text-xs px-3 py-1 rounded-md border ${
                    t.registration_open
                      ? "bg-green-900/30 border-green-700 text-green-400"
                      : "bg-slate-700 border-slate-600 text-slate-400"
                  }`}
                >
                  {t.registration_open ? "Open" : "Closed"}
                </button>
                <button
                  onClick={() => deleteTournament(t.id)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
        {tournaments.length === 0 && (
          <p className="text-sm text-slate-500 bg-slate-800 border border-slate-700 rounded-lg p-6">
            No tournaments yet. Create one to get started.
          </p>
        )}
      </div>
    </div>
  );
}
