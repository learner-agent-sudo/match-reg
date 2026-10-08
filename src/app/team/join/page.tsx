import { Suspense } from "react";
import JoinTeamForm from "./JoinTeamForm";

export default function JoinTeamPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-slate-400">Loading...</div>}>
      <JoinTeamForm />
    </Suspense>
  );
}
