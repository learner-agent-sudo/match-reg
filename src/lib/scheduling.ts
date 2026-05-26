export interface TeamInfo {
  id: string;
  name: string;
}

export interface GeneratedMatch {
  home_team_id: string;
  away_team_id: string;
  stage: string;
  group_id?: string;
  match_order: number;
}

export interface PlayoffMatch {
  stage: string;
  placeholder_home: string;
  placeholder_away: string;
  match_order: number;
  home_team_id?: string;
  away_team_id?: string;
}

export function generateRoundRobin(teams: TeamInfo[], groupId: string): GeneratedMatch[] {
  const matches: GeneratedMatch[] = [];
  let order = 1;

  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      matches.push({
        home_team_id: teams[i].id,
        away_team_id: teams[j].id,
        stage: "group",
        group_id: groupId,
        match_order: order++,
      });
    }
  }

  return matches;
}

export type PlayoffFormat =
  | "semi_1v4_2v3"
  | "semi_1v2_3v4"
  | "championship_random";

export interface GroupStanding {
  team_id: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
}

export interface CompletedMatch {
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
  status: string;
  group_id: string | null;
}

export function calculateStandings(matches: CompletedMatch[], teamIds: string[]): GroupStanding[] {
  const standings: Record<string, GroupStanding> = {};

  for (const id of teamIds) {
    standings[id] = {
      team_id: id, played: 0, won: 0, drawn: 0, lost: 0,
      goals_for: 0, goals_against: 0, goal_difference: 0, points: 0,
    };
  }

  for (const m of matches) {
    if (m.status !== "completed" || !m.home_team_id || !m.away_team_id || m.home_score === null || m.away_score === null) continue;
    const home = standings[m.home_team_id];
    const away = standings[m.away_team_id];
    if (!home || !away) continue;

    home.played++; away.played++;
    home.goals_for += m.home_score; home.goals_against += m.away_score;
    away.goals_for += m.away_score; away.goals_against += m.home_score;

    if (m.home_score > m.away_score) {
      home.won++; home.points += 3; away.lost++;
    } else if (m.home_score < m.away_score) {
      away.won++; away.points += 3; home.lost++;
    } else {
      home.drawn++; away.drawn++; home.points += 1; away.points += 1;
    }
  }

  return Object.values(standings)
    .map((s) => ({ ...s, goal_difference: s.goals_for - s.goals_against }))
    .sort((a, b) => b.points - a.points || b.goal_difference - a.goal_difference || b.goals_for - a.goals_for);
}

export function generatePlayoffBracket(
  format: PlayoffFormat,
  standings: GroupStanding[] | null,
  includeThirdPlace: boolean = false
): PlayoffMatch[] {
  const matches: PlayoffMatch[] = [];
  const hasStandings = standings && standings.length >= 4;

  if (format === "semi_1v4_2v3") {
    matches.push(
      {
        stage: "semi_final", match_order: 1,
        placeholder_home: "Group 1st", placeholder_away: "Group 4th",
        ...(hasStandings ? { home_team_id: standings[0].team_id, away_team_id: standings[3].team_id } : {}),
      },
      {
        stage: "semi_final", match_order: 2,
        placeholder_home: "Group 2nd", placeholder_away: "Group 3rd",
        ...(hasStandings ? { home_team_id: standings[1].team_id, away_team_id: standings[2].team_id } : {}),
      }
    );
  } else if (format === "semi_1v2_3v4") {
    matches.push(
      {
        stage: "semi_final", match_order: 1,
        placeholder_home: "Group 1st", placeholder_away: "Group 2nd",
        ...(hasStandings ? { home_team_id: standings[0].team_id, away_team_id: standings[1].team_id } : {}),
      },
      {
        stage: "semi_final", match_order: 2,
        placeholder_home: "Group 3rd", placeholder_away: "Group 4th",
        ...(hasStandings ? { home_team_id: standings[2].team_id, away_team_id: standings[3].team_id } : {}),
      }
    );
  } else if (format === "championship_random") {
    const shuffled = hasStandings ? shuffleTeams(standings.map((s) => ({ id: s.team_id, name: "" }))) : [];
    matches.push(
      {
        stage: "semi_final", match_order: 1,
        placeholder_home: "Team A (random)", placeholder_away: "Team B (random)",
        ...(shuffled.length >= 2 ? { home_team_id: shuffled[0].id, away_team_id: shuffled[1].id } : {}),
      },
      {
        stage: "semi_final", match_order: 2,
        placeholder_home: "Team C (random)", placeholder_away: "Team D (random)",
        ...(shuffled.length >= 4 ? { home_team_id: shuffled[2].id, away_team_id: shuffled[3].id } : {}),
      }
    );
  }

  if (includeThirdPlace) {
    matches.push({
      stage: "third_place", match_order: matches.length + 1,
      placeholder_home: "SF1 Loser", placeholder_away: "SF2 Loser",
    });
  }

  matches.push({
    stage: "final", match_order: matches.length + 1,
    placeholder_home: "SF1 Winner", placeholder_away: "SF2 Winner",
  });

  return matches;
}

export function shuffleTeams(teams: TeamInfo[]): TeamInfo[] {
  const shuffled = [...teams];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
