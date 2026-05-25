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

export function generatePlayoffBracket(
  format: PlayoffFormat,
  numTeams: number
): PlayoffMatch[] {
  const matches: PlayoffMatch[] = [];

  if (format === "semi_1v4_2v3") {
    matches.push(
      { stage: "semi_final", placeholder_home: "Group 1st", placeholder_away: "Group 4th", match_order: 1 },
      { stage: "semi_final", placeholder_home: "Group 2nd", placeholder_away: "Group 3rd", match_order: 2 },
      { stage: "third_place", placeholder_home: "SF1 Loser", placeholder_away: "SF2 Loser", match_order: 3 },
      { stage: "final", placeholder_home: "SF1 Winner", placeholder_away: "SF2 Winner", match_order: 4 }
    );
  } else if (format === "semi_1v2_3v4") {
    matches.push(
      { stage: "semi_final", placeholder_home: "Group 1st", placeholder_away: "Group 2nd", match_order: 1 },
      { stage: "semi_final", placeholder_home: "Group 3rd", placeholder_away: "Group 4th", match_order: 2 },
      { stage: "third_place", placeholder_home: "SF1 Loser", placeholder_away: "SF2 Loser", match_order: 3 },
      { stage: "final", placeholder_home: "SF1 Winner", placeholder_away: "SF2 Winner", match_order: 4 }
    );
  } else if (format === "championship_random") {
    if (numTeams >= 4) {
      matches.push(
        { stage: "semi_final", placeholder_home: "Team A (random)", placeholder_away: "Team B (random)", match_order: 1 },
        { stage: "semi_final", placeholder_home: "Team C (random)", placeholder_away: "Team D (random)", match_order: 2 },
        { stage: "third_place", placeholder_home: "SF1 Loser", placeholder_away: "SF2 Loser", match_order: 3 },
        { stage: "final", placeholder_home: "SF1 Winner", placeholder_away: "SF2 Winner", match_order: 4 }
      );
    }
  }

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
