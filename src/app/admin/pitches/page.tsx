"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface TimeSlot {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

interface Pitch {
  id: string;
  name: string;
  location: string;
  notes: string | null;
  time_slots: TimeSlot[];
}

export default function PitchesPage() {
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [tournaments, setTournaments] = useState<{ id: string; name: string }[]>([]);
  const [selectedTournament, setSelectedTournament] = useState("");
  const [expandedPitch, setExpandedPitch] = useState<string | null>(null);
  const [newPitch, setNewPitch] = useState({ name: "", location: "", notes: "" });
  const [newSlot, setNewSlot] = useState({ pitch_id: "", date: "", start_time: "", end_time: "" });
  const [showAddPitch, setShowAddPitch] = useState(false);

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
    if (selectedTournament) loadPitches();
  }, [selectedTournament]);

  async function loadPitches() {
    const supabase = createClient();
    const { data } = await supabase
      .from("pitches")
      .select("id, name, location, notes, time_slots(id, date, start_time, end_time, is_available)")
      .eq("tournament_id", selectedTournament)
      .order("name");
    if (data) setPitches(data as Pitch[]);
  }

  const addPitch = async () => {
    if (!newPitch.name || !newPitch.location) return;
    const supabase = createClient();
    await supabase.from("pitches").insert({
      ...newPitch,
      tournament_id: selectedTournament,
      notes: newPitch.notes || null,
    });
    setNewPitch({ name: "", location: "", notes: "" });
    setShowAddPitch(false);
    loadPitches();
  };

  const deletePitch = async (id: string) => {
    const supabase = createClient();
    await supabase.from("pitches").delete().eq("id", id);
    loadPitches();
  };

  const addTimeSlot = async () => {
    if (!newSlot.pitch_id || !newSlot.date || !newSlot.start_time || !newSlot.end_time) return;
    const supabase = createClient();
    await supabase.from("time_slots").insert(newSlot);
    setNewSlot({ pitch_id: "", date: "", start_time: "", end_time: "" });
    loadPitches();
  };

  const deleteTimeSlot = async (id: string) => {
    const supabase = createClient();
    await supabase.from("time_slots").delete().eq("id", id);
    loadPitches();
  };

  const toggleSlotAvailability = async (slotId: string, current: boolean) => {
    const supabase = createClient();
    await supabase.from("time_slots").update({ is_available: !current }).eq("id", slotId);
    loadPitches();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-white">Pitches & Time Slots</h2>
          {tournaments.length > 1 && (
            <select
              value={selectedTournament}
              onChange={(e) => setSelectedTournament(e.target.value)}
              className="text-sm rounded-md px-2 py-1"
            >
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
        </div>
        <button
          onClick={() => setShowAddPitch(!showAddPitch)}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-500"
        >
          + Add Pitch
        </button>
      </div>

      {showAddPitch && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-3">
          <h3 className="font-medium text-sm text-slate-300">New Pitch</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Pitch name (e.g. Pitch A)"
              value={newPitch.name}
              onChange={(e) => setNewPitch({ ...newPitch, name: e.target.value })}
              className="px-3 py-2 rounded-md text-sm"
            />
            <input
              type="text"
              placeholder="Location (e.g. Main Park)"
              value={newPitch.location}
              onChange={(e) => setNewPitch({ ...newPitch, location: e.target.value })}
              className="px-3 py-2 rounded-md text-sm"
            />
            <input
              type="text"
              placeholder="Notes (optional)"
              value={newPitch.notes}
              onChange={(e) => setNewPitch({ ...newPitch, notes: e.target.value })}
              className="px-3 py-2 rounded-md text-sm"
            />
          </div>
          <button
            onClick={addPitch}
            className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-500"
          >
            Save Pitch
          </button>
        </div>
      )}

      {pitches.length === 0 ? (
        <p className="text-sm text-slate-500 bg-slate-800 border border-slate-700 rounded-lg p-6">
          No pitches added yet. Add a pitch to start setting up time slots.
        </p>
      ) : (
        <div className="space-y-4">
          {pitches.map((pitch) => (
            <div key={pitch.id} className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
              <div
                className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-700/50 transition"
                onClick={() => setExpandedPitch(expandedPitch === pitch.id ? null : pitch.id)}
              >
                <div>
                  <p className="font-medium text-slate-200">{pitch.name}</p>
                  <p className="text-sm text-slate-500">{pitch.location}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">
                    {pitch.time_slots.length} slot{pitch.time_slots.length !== 1 ? "s" : ""}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deletePitch(pitch.id); }}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {expandedPitch === pitch.id && (
                <div className="border-t border-slate-700 p-4 space-y-3">
                  {pitch.time_slots.length > 0 && (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700">
                          <th className="text-left py-1 px-2 text-slate-400">Date</th>
                          <th className="text-left py-1 px-2 text-slate-400">Start</th>
                          <th className="text-left py-1 px-2 text-slate-400">End</th>
                          <th className="text-left py-1 px-2 text-slate-400">Status</th>
                          <th className="text-left py-1 px-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pitch.time_slots
                          .sort((a, b) => `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`))
                          .map((slot) => (
                          <tr key={slot.id} className="border-b border-slate-700/50 last:border-0">
                            <td className="py-1.5 px-2 text-slate-300">{slot.date}</td>
                            <td className="py-1.5 px-2 text-slate-300">{slot.start_time.slice(0, 5)}</td>
                            <td className="py-1.5 px-2 text-slate-300">{slot.end_time.slice(0, 5)}</td>
                            <td className="py-1.5 px-2">
                              <button
                                onClick={() => toggleSlotAvailability(slot.id, slot.is_available)}
                                className={`text-xs px-2 py-0.5 rounded ${
                                  slot.is_available
                                    ? "bg-green-900/30 text-green-400"
                                    : "bg-slate-700 text-slate-500"
                                }`}
                              >
                                {slot.is_available ? "Available" : "Unavailable"}
                              </button>
                            </td>
                            <td className="py-1.5 px-2">
                              <button
                                onClick={() => deleteTimeSlot(slot.id)}
                                className="text-xs text-red-400 hover:text-red-300"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  <div className="pt-2 border-t border-slate-700">
                    <p className="text-xs font-medium text-slate-400 mb-2">Add time slot:</p>
                    <div className="flex flex-wrap gap-2 items-end">
                      <input
                        type="date"
                        value={newSlot.pitch_id === pitch.id ? newSlot.date : ""}
                        onChange={(e) => setNewSlot({ ...newSlot, pitch_id: pitch.id, date: e.target.value })}
                        className="px-2 py-1 rounded text-sm"
                      />
                      <input
                        type="time"
                        value={newSlot.pitch_id === pitch.id ? newSlot.start_time : ""}
                        onChange={(e) => setNewSlot({ ...newSlot, pitch_id: pitch.id, start_time: e.target.value })}
                        className="px-2 py-1 rounded text-sm"
                      />
                      <span className="text-sm text-slate-500">to</span>
                      <input
                        type="time"
                        value={newSlot.pitch_id === pitch.id ? newSlot.end_time : ""}
                        onChange={(e) => setNewSlot({ ...newSlot, pitch_id: pitch.id, end_time: e.target.value })}
                        className="px-2 py-1 rounded text-sm"
                      />
                      <button
                        onClick={addTimeSlot}
                        disabled={newSlot.pitch_id !== pitch.id || !newSlot.date || !newSlot.start_time || !newSlot.end_time}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-500 disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
