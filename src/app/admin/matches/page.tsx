"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  generateRoundRobin,
  generatePlayoffBracket,
  calculateStandings,
  type PlayoffFormat,
  type TeamInfo,
} from "@/lib/scheduling";
import BracketView from "@/components/BracketView";

interface Team {
  id: string;
  name: string;
}

interface Group {
  id: string;
  name: string;
  group_teams: { team_id: string }[];
}

interface TimeSlot {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  pitch: { name: string };
}

interface Referee {
  id: string;
  full_name: string;
}

interface Runner {
  id: string;
  full_name: string;
}

interface Match {
  id: string;
  stage: string;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
  status: string;
  match_order: number;
  placeholder_home: string | null;
  placeholder_away: string | null;
  time_slot_id: string | null;
  referee_id: string | null;
  runner_id: string | null;
  group_id: string | null;
}

export default function MatchesPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [referees, setReferees] = useState<Referee[]>([]);
  const [runners, setRunners] = useState<Runner[]>([]);
  const [tournaments, setTournaments] = useState<{ id: string; name: string }[]>([]);
  const [selectedTournament, setSelectedTournament] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [playoffFormat, setPlayoffFormat] = useState<PlayoffFormat>("semi_1v4_2v3");
  const [includeThirdPlace, setIncludeThirdPlace] = useState(false);
  const [showGroupSetup, setShowGroupSetup] = useState(false);

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
    if (selectedTournament) loadAll();
  }, [selectedTournament]);

  async function loadAll() {
    const supabase = createClient();
    const [teamsRes, groupsRes, matchesRes, slotsRes, refsRes, runnersRes] = await Promise.all([
      supabase.from("teams").select("id, name").eq("tournament_id", selectedTournament),
      supabase.from("groups").select("id, name, group_teams(team_id)").eq("tournament_id", selectedTournament),
      supabase.from("matches").select("*").eq("tournament_id", selectedTournament).order("match_order"),
      supabase.from("time_slots").select("id, date, start_time, end_time, pitch:pitches(name)").eq("is_available", true),
      supabase.from("referees").select("id, full_name").eq("tournament_id", selectedTournament),
      supabase.from("runners").select("id, full_name").eq("tournament_id", selectedTournament),
    ]);
    if (teamsRes.data) setTeams(teamsRes.data);
    if (groupsRes.data) setGroups(groupsRes.data as unknown as Group[]);
    if (matchesRes.data) setMatches(matchesRes.data);
    if (slotsRes.data) setTimeSlots(slotsRes.data as unknown as TimeSlot[]);
    if (refsRes.data) setReferees(refsRes.data);
    if (runnersRes.data) setRunners(runnersRes.data);
  }

  const createGroup = async () => {
    if (!newGroupName) return;
    const supabase = createClient();
    await supabase.from("groups").insert({ name: newGroupName, tournament_id: selectedTournament });
    setNewGroupName("");
    loadAll();
  };

  const addTeamToGroup = async (groupId: string, teamId: string) => {
    const supabase = createClient();
    await supabase.from("group_teams").insert({ group_id: groupId, team_id: teamId });
    loadAll();
  };

  const removeTeamFromGroup = async (groupId: string, teamId: string) => {
    const supabase = createClient();
    await supabase.from("group_teams").delete().eq("group_id", groupId).eq("team_id", teamId);
    loadAll();
  };

  const generateGroupMatches = async (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    const groupTeams: TeamInfo[] = group.group_teams
      .map((gt) => teams.find((t) => t.id === gt.team_id))
      .filter(Boolean) as TeamInfo[];
    const generated = generateRoundRobin(groupTeams, groupId);
    const supabase = createClient();
    const maxOrder = matches.length > 0 ? Math.max(...matches.map((m) => m.match_order)) : 0;
    await supabase.from("matches").insert(
      generated.map((m, i) => ({ ...m, tournament_id: selectedTournament, match_order: maxOrder + i + 1 }))
    );
    loadAll();
  };

  const generatePlayoffs = async () => {
    const supabase = createClient();

    // Clear existing playoff matches first
    await supabase.from("matches")
      .delete()
      .eq("tournament_id", selectedTournament)
      .neq("stage", "group");

    // Calculate group standings from completed group matches
    const completedGroupMatches = matches.filter((m) => m.stage === "group");
    const allGroupTeamIds = groups.flatMap((g) => g.group_teams.map((gt) => gt.team_id));
    const standings = calculateStandings(completedGroupMatches, allGroupTeamIds);

    const allGroupsDone = completedGroupMatches.length > 0 &&
      completedGroupMatches.every((m) => m.status === "completed");

    const bracket = generatePlayoffBracket(
      playoffFormat,
      allGroupsDone ? standings : null,
      includeThirdPlace
    );

    const maxOrder = matches.length > 0 ? Math.max(...matches.map((m) => m.match_order)) : 0;

    await supabase.from("matches").insert(
      bracket.map((m, i) => ({
        tournament_id: selectedTournament,
        stage: m.stage,
        placeholder_home: m.home_team_id ? null : m.placeholder_home,
        placeholder_away: m.away_team_id ? null : m.placeholder_away,
        home_team_id: m.home_team_id ?? null,
        away_team_id: m.away_team_id ?? null,
        match_order: maxOrder + i + 1,
      }))
    );
    loadAll();
  };

  const autoScheduleMatches = async () => {
    const supabase = createClient();
    const unscheduled = matches.filter((m) => !m.time_slot_id);
    const usedSlotIds = new Set(matches.filter((m) => m.time_slot_id).map((m) => m.time_slot_id));
    const availableSlots = timeSlots
      .filter((s) => !usedSlotIds.has(s.id))
      .sort((a, b) => `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`));

    let slotIndex = 0;
    for (const match of unscheduled) {
      if (slotIndex >= availableSlots.length) break;

      // Find a slot where neither team is already playing at the same time
      let assigned = false;
      for (let i = slotIndex; i < availableSlots.length; i++) {
        const slot = availableSlots[i];
        const sameTimeMatches = matches.filter(
          (m) => m.time_slot_id && timeSlots.find((ts) => ts.id === m.time_slot_id)?.date === slot.date
            && timeSlots.find((ts) => ts.id === m.time_slot_id)?.start_time === slot.start_time
        );

        const teamsPlayingAtSameTime = new Set(
          sameTimeMatches.flatMap((m) => [m.home_team_id, m.away_team_id].filter(Boolean))
        );

        const conflict = (match.home_team_id && teamsPlayingAtSameTime.has(match.home_team_id))
          || (match.away_team_id && teamsPlayingAtSameTime.has(match.away_team_id));

        if (!conflict) {
          await supabase.from("matches").update({ time_slot_id: slot.id }).eq("id", match.id);
          usedSlotIds.add(slot.id);
          assigned = true;
          break;
        }
      }
      if (!assigned) slotIndex++;
    }
    loadAll();
  };

  const assignToMatch = async (matchId: string, field: string, value: string | null) => {
    const supabase = createClient();
    await supabase.from("matches").update({ [field]: value || null }).eq("id", matchId);
    loadAll();
  };

  const updateScore = async (matchId: string, homeScore: number | null, awayScore: number | null) => {
    const supabase = createClient();
    const updates: Record<string, unknown> = { home_score: homeScore, away_score: awayScore };
    if (homeScore !== null && awayScore !== null) updates.status = "completed";
    await supabase.from("matches").update(updates).eq("id", matchId);
    loadAll();
  };

  const deleteMatch = async (matchId: string) => {
    const supabase = createClient();
    await supabase.from("matches").delete().eq("id", matchId);
    loadAll();
  };

  const deleteAllMatches = async () => {
    const supabase = createClient();
    await supabase.from("matches").delete().eq("tournament_id", selectedTournament);
    loadAll();
  };

  const getTeamName = (id: string | null) => {
    if (!id) return "TBD";
    return teams.find((t) => t.id === id)?.name ?? "Unknown";
  };

  const unassignedTeams = teams.filter(
    (t) => !groups.some((g) => g.group_teams.some((gt) => gt.team_id === t.id))
  );
  const groupMatches = matches.filter((m) => m.stage === "group");
  const playoffMatches = matches.filter((m) => m.stage !== "group");

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-white">Match Scheduling</h2>
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
        <div className="flex gap-2">
          <button
            onClick={() => setShowGroupSetup(!showGroupSetup)}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-500"
          >
            {showGroupSetup ? "Hide Setup" : "Group Setup"}
          </button>
          {matches.some((m) => !m.time_slot_id) && timeSlots.length > 0 && (
            <button
              onClick={autoScheduleMatches}
              className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-500"
            >
              Auto Schedule
            </button>
          )}
          {matches.length > 0 && (
            <button
              onClick={deleteAllMatches}
              className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-500"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {showGroupSetup && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 space-y-4">
          <h3 className="font-semibold text-white">Group Setup</h3>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Group name (e.g. Group A)"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="px-3 py-2 rounded-md text-sm flex-1"
            />
            <button onClick={createGroup} className="px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-500">
              Create Group
            </button>
          </div>

          {groups.map((group) => (
            <div key={group.id} className="border border-slate-600 rounded-md p-3">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-medium text-sm text-slate-200">{group.name}</h4>
                <button
                  onClick={() => generateGroupMatches(group.id)}
                  className="text-xs px-2 py-1 bg-blue-900/30 border border-blue-700 text-blue-400 rounded hover:bg-blue-900/50"
                >
                  Generate Round Robin
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                {group.group_teams.map((gt) => (
                  <span key={gt.team_id} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-700 rounded text-sm text-slate-300">
                    {getTeamName(gt.team_id)}
                    <button onClick={() => removeTeamFromGroup(group.id, gt.team_id)} className="text-red-400 hover:text-red-300 ml-1">x</button>
                  </span>
                ))}
              </div>
              {unassignedTeams.length > 0 && (
                <select
                  onChange={(e) => { if (e.target.value) addTeamToGroup(group.id, e.target.value); e.target.value = ""; }}
                  className="text-sm rounded px-2 py-1"
                  defaultValue=""
                >
                  <option value="">+ Add team...</option>
                  {unassignedTeams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}
            </div>
          ))}

          <div className="border-t border-slate-700 pt-4">
            <h4 className="font-medium text-sm text-slate-300 mb-2">Generate Playoff Bracket</h4>
            <div className="flex flex-wrap gap-3 items-center">
              <select
                value={playoffFormat}
                onChange={(e) => setPlayoffFormat(e.target.value as PlayoffFormat)}
                className="text-sm rounded-md px-2 py-1"
              >
                <option value="semi_1v4_2v3">Semi: 1st vs 4th, 2nd vs 3rd</option>
                <option value="semi_1v2_3v4">Semi: 1st vs 2nd, 3rd vs 4th</option>
                <option value="championship_random">Championship: Random draw</option>
              </select>
              <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeThirdPlace}
                  onChange={(e) => setIncludeThirdPlace(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-700 text-blue-500"
                />
                Include 3rd place match
              </label>
              <button onClick={generatePlayoffs} className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-500">
                Generate Playoffs
              </button>
            </div>
          </div>
        </div>
      )}

      {groupMatches.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h3 className="font-semibold text-white mb-4">Group Stage Matches</h3>
          <div className="space-y-2">
            {groupMatches.map((match) => (
              <MatchRow key={match.id} match={match} teams={teams} timeSlots={timeSlots} referees={referees}
                runners={runners} onAssign={assignToMatch} onScore={updateScore} onDelete={deleteMatch} getTeamName={getTeamName} />
            ))}
          </div>
        </div>
      )}

      {/* Group Standings */}
      {groupMatches.length > 0 && groupMatches.some((m) => m.status === "completed") && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h3 className="font-semibold text-white mb-4">Group Standings</h3>
          {groups.map((group) => {
            const groupTeamIds = group.group_teams.map((gt) => gt.team_id);
            const groupMatchesForGroup = groupMatches.filter((m) => m.group_id === group.id);
            const standings = calculateStandings(groupMatchesForGroup, groupTeamIds);
            return (
              <div key={group.id} className="mb-4 last:mb-0">
                <h4 className="text-sm font-medium text-slate-400 mb-2">{group.name}</h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-1 px-2 text-slate-400">#</th>
                      <th className="text-left py-1 px-2 text-slate-400">Team</th>
                      <th className="text-center py-1 px-2 text-slate-400">P</th>
                      <th className="text-center py-1 px-2 text-slate-400">W</th>
                      <th className="text-center py-1 px-2 text-slate-400">D</th>
                      <th className="text-center py-1 px-2 text-slate-400">L</th>
                      <th className="text-center py-1 px-2 text-slate-400">GF</th>
                      <th className="text-center py-1 px-2 text-slate-400">GA</th>
                      <th className="text-center py-1 px-2 text-slate-400">GD</th>
                      <th className="text-center py-1 px-2 text-slate-400 font-semibold">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((s, i) => (
                      <tr key={s.team_id} className="border-b border-slate-700/50 last:border-0">
                        <td className="py-1.5 px-2 text-slate-500">{i + 1}</td>
                        <td className="py-1.5 px-2 text-slate-200 font-medium">{getTeamName(s.team_id)}</td>
                        <td className="py-1.5 px-2 text-center text-slate-300">{s.played}</td>
                        <td className="py-1.5 px-2 text-center text-slate-300">{s.won}</td>
                        <td className="py-1.5 px-2 text-center text-slate-300">{s.drawn}</td>
                        <td className="py-1.5 px-2 text-center text-slate-300">{s.lost}</td>
                        <td className="py-1.5 px-2 text-center text-slate-300">{s.goals_for}</td>
                        <td className="py-1.5 px-2 text-center text-slate-300">{s.goals_against}</td>
                        <td className="py-1.5 px-2 text-center text-slate-300">{s.goal_difference > 0 ? "+" : ""}{s.goal_difference}</td>
                        <td className="py-1.5 px-2 text-center text-white font-semibold">{s.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {playoffMatches.length > 0 && (
        <>
          <BracketView
            matches={playoffMatches.map((m) => ({
              id: m.id,
              stage: m.stage,
              homeName: m.home_team_id ? getTeamName(m.home_team_id) : (m.placeholder_home ?? "TBD"),
              awayName: m.away_team_id ? getTeamName(m.away_team_id) : (m.placeholder_away ?? "TBD"),
              homeScore: m.home_score,
              awayScore: m.away_score,
              status: m.status,
            }))}
          />

          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
            <h3 className="font-semibold text-white mb-4">Playoff Matches</h3>
            <div className="space-y-2">
              {playoffMatches.map((match) => (
                <MatchRow key={match.id} match={match} teams={teams} timeSlots={timeSlots} referees={referees}
                  runners={runners} onAssign={assignToMatch} onScore={updateScore} onDelete={deleteMatch} getTeamName={getTeamName} />
              ))}
            </div>
          </div>
        </>
      )}

      {matches.length === 0 && (
        <p className="text-sm text-slate-500 bg-slate-800 border border-slate-700 rounded-lg p-6">
          No matches scheduled yet. Use Group Setup to create groups and generate matches.
        </p>
      )}
    </div>
  );
}

function MatchRow({
  match, teams, timeSlots, referees, runners, onAssign, onScore, onDelete, getTeamName,
}: {
  match: Match; teams: Team[]; timeSlots: TimeSlot[]; referees: Referee[]; runners: Runner[];
  onAssign: (id: string, field: string, value: string | null) => void;
  onScore: (id: string, home: number | null, away: number | null) => void;
  onDelete: (id: string) => void;
  getTeamName: (id: string | null) => string;
}) {
  const [homeScore, setHomeScore] = useState(match.home_score?.toString() ?? "");
  const [awayScore, setAwayScore] = useState(match.away_score?.toString() ?? "");

  const homeName = match.home_team_id ? getTeamName(match.home_team_id) : (match.placeholder_home ?? "TBD");
  const awayName = match.away_team_id ? getTeamName(match.away_team_id) : (match.placeholder_away ?? "TBD");
  const stageLabel = match.stage.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <div className="border border-slate-600 rounded-md p-3 text-sm">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-3">
          <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-400">{stageLabel}</span>
          <span className="font-medium text-slate-200">{homeName}</span>
          <span className="text-slate-500">vs</span>
          <span className="font-medium text-slate-200">{awayName}</span>
          {match.status === "completed" && (
            <span className="text-xs px-2 py-0.5 rounded bg-green-900/30 text-green-400">
              {match.home_score} - {match.away_score}
            </span>
          )}
        </div>
        <button onClick={() => onDelete(match.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <select value={match.time_slot_id ?? ""} onChange={(e) => onAssign(match.id, "time_slot_id", e.target.value)}
          className="text-xs rounded px-2 py-1">
          <option value="">Assign time slot...</option>
          {timeSlots.map((s) => (
            <option key={s.id} value={s.id}>{s.date} {s.start_time.slice(0, 5)} ({s.pitch?.name})</option>
          ))}
        </select>

        <select value={match.referee_id ?? ""} onChange={(e) => onAssign(match.id, "referee_id", e.target.value)}
          className="text-xs rounded px-2 py-1">
          <option value="">Assign referee...</option>
          {referees.map((r) => (<option key={r.id} value={r.id}>{r.full_name}</option>))}
        </select>

        <select value={match.runner_id ?? ""} onChange={(e) => onAssign(match.id, "runner_id", e.target.value)}
          className="text-xs rounded px-2 py-1">
          <option value="">Assign runner...</option>
          {runners.map((r) => (<option key={r.id} value={r.id}>{r.full_name}</option>))}
        </select>

        {match.status !== "completed" && match.home_team_id && match.away_team_id && (
          <div className="flex gap-1 items-center">
            <input type="number" min={0} value={homeScore} onChange={(e) => setHomeScore(e.target.value)}
              className="w-12 text-center text-xs rounded px-1 py-1" placeholder="H" />
            <span className="text-slate-500">-</span>
            <input type="number" min={0} value={awayScore} onChange={(e) => setAwayScore(e.target.value)}
              className="w-12 text-center text-xs rounded px-1 py-1" placeholder="A" />
            <button
              onClick={() => onScore(match.id, homeScore ? parseInt(homeScore) : null, awayScore ? parseInt(awayScore) : null)}
              disabled={!homeScore || !awayScore}
              className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
