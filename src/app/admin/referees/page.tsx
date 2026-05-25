"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface Referee {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
}

export default function RefereesPage() {
  const [referees, setReferees] = useState<Referee[]>([]);
  const [tournaments, setTournaments] = useState<{ id: string; name: string }[]>([]);
  const [selectedTournament, setSelectedTournament] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "", email: "" });

  useEffect(() => {
    async function loadTournaments() {
      const supabase = createClient();
      const { data } = await supabase.from("tournaments").select("id, name");
      if (data && data.length > 0) {
        setTournaments(data);
        setSelectedTournament(data[0].id);
      }
    }
    loadTournaments();
  }, []);

  useEffect(() => {
    if (selectedTournament) loadReferees();
  }, [selectedTournament]);

  async function loadReferees() {
    const supabase = createClient();
    const { data } = await supabase
      .from("referees")
      .select("id, full_name, phone, email")
      .eq("tournament_id", selectedTournament)
      .order("full_name");
    if (data) setReferees(data);
  }

  const addReferee = async () => {
    if (!form.full_name) return;
    const supabase = createClient();
    await supabase.from("referees").insert({
      full_name: form.full_name,
      phone: form.phone || null,
      email: form.email || null,
      tournament_id: selectedTournament,
    });
    setForm({ full_name: "", phone: "", email: "" });
    setShowAdd(false);
    loadReferees();
  };

  const deleteReferee = async (id: string) => {
    const supabase = createClient();
    await supabase.from("referees").delete().eq("id", id);
    loadReferees();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">Referees</h2>
          {tournaments.length > 1 && (
            <select
              value={selectedTournament}
              onChange={(e) => setSelectedTournament(e.target.value)}
              className="text-sm border border-gray-300 rounded-md px-2 py-1"
            >
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
        >
          + Add Referee
        </button>
      </div>

      {showAdd && (
        <div className="bg-white rounded-lg shadow-sm p-4 space-y-3">
          <h3 className="font-medium text-sm">New Referee</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Full name"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <input
              type="tel"
              placeholder="Phone (optional)"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <input
              type="email"
              placeholder="Email (optional)"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <button
            onClick={addReferee}
            className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
          >
            Save Referee
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm p-6">
        {referees.length === 0 ? (
          <p className="text-sm text-gray-500">No referees added yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-2">Name</th>
                <th className="text-left py-2 px-2">Phone</th>
                <th className="text-left py-2 px-2">Email</th>
                <th className="text-left py-2 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {referees.map((ref) => (
                <tr key={ref.id} className="border-b last:border-0">
                  <td className="py-2 px-2 font-medium">{ref.full_name}</td>
                  <td className="py-2 px-2 text-gray-600">{ref.phone ?? "—"}</td>
                  <td className="py-2 px-2 text-gray-600">{ref.email ?? "—"}</td>
                  <td className="py-2 px-2">
                    <button
                      onClick={() => deleteReferee(ref.id)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
