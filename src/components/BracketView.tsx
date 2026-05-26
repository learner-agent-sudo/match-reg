"use client";

interface BracketMatch {
  id: string;
  stage: string;
  homeName: string;
  awayName: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
}

interface BracketViewProps {
  matches: BracketMatch[];
}

function MatchCard({ match }: { match: BracketMatch | null }) {
  if (!match) {
    return (
      <div className="w-48 border border-slate-700 rounded bg-slate-800/50 p-2 text-xs text-slate-500 text-center">
        TBD
      </div>
    );
  }

  const homeWon = match.status === "completed" && match.homeScore !== null && match.awayScore !== null && match.homeScore > match.awayScore;
  const awayWon = match.status === "completed" && match.homeScore !== null && match.awayScore !== null && match.awayScore > match.homeScore;

  return (
    <div className="w-48 border border-slate-600 rounded bg-slate-800 overflow-hidden text-xs">
      <div className={`flex justify-between px-2 py-1.5 border-b border-slate-700 ${homeWon ? "bg-green-900/20" : ""}`}>
        <span className={`truncate ${homeWon ? "text-green-400 font-semibold" : "text-slate-300"}`}>
          {match.homeName}
        </span>
        {match.status === "completed" && (
          <span className={homeWon ? "text-green-400 font-semibold" : "text-slate-500"}>{match.homeScore}</span>
        )}
      </div>
      <div className={`flex justify-between px-2 py-1.5 ${awayWon ? "bg-green-900/20" : ""}`}>
        <span className={`truncate ${awayWon ? "text-green-400 font-semibold" : "text-slate-300"}`}>
          {match.awayName}
        </span>
        {match.status === "completed" && (
          <span className={awayWon ? "text-green-400 font-semibold" : "text-slate-500"}>{match.awayScore}</span>
        )}
      </div>
    </div>
  );
}

export default function BracketView({ matches }: BracketViewProps) {
  const semis = matches.filter((m) => m.stage === "semi_final");
  const thirdPlace = matches.find((m) => m.stage === "third_place");
  const final = matches.find((m) => m.stage === "final");

  if (semis.length === 0 && !final) {
    return null;
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
      <h3 className="font-semibold text-white mb-6">Bracket View</h3>

      <div className="flex items-center justify-center gap-4 overflow-x-auto pb-4">
        {/* Semi-finals column */}
        {semis.length > 0 && (
          <div className="flex flex-col gap-8 items-center">
            <div className="text-xs text-slate-500 font-medium mb-1">SEMI-FINALS</div>
            {semis.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        )}

        {/* Connector lines */}
        {semis.length > 0 && final && (
          <div className="flex flex-col items-center justify-center h-32">
            <div className="w-8 border-t border-slate-600"></div>
            <div className="w-px h-16 border-l border-slate-600"></div>
            <div className="w-8 border-t border-slate-600"></div>
          </div>
        )}

        {/* Final column */}
        {final && (
          <div className="flex flex-col gap-8 items-center">
            <div className="text-xs text-slate-500 font-medium mb-1">FINAL</div>
            <MatchCard match={final} />
            {thirdPlace && (
              <>
                <div className="text-xs text-slate-500 font-medium mt-4 mb-1">3RD PLACE</div>
                <MatchCard match={thirdPlace} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
