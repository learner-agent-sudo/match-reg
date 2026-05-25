import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold text-white mb-4">
          Tournament Hub
        </h1>
        <p className="text-lg text-slate-300 mb-8">
          Register your team, manage players, and track tournament progress — all in one place.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/auth/signup"
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-500 transition"
          >
            Register Your Team
          </Link>
          <Link
            href="/auth/login"
            className="px-6 py-3 bg-slate-700 text-slate-200 font-medium rounded-lg border border-slate-600 hover:bg-slate-600 transition"
          >
            Sign In
          </Link>
        </div>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
          <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
            <h3 className="font-semibold text-white mb-1">Team Registration</h3>
            <p className="text-sm text-slate-400">
              Coaches register and invite players via a simple share link.
            </p>
          </div>
          <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
            <h3 className="font-semibold text-white mb-1">Payment Tracking</h3>
            <p className="text-sm text-slate-400">
              Upload payment proof and track confirmation status.
            </p>
          </div>
          <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
            <h3 className="font-semibold text-white mb-1">Live Results</h3>
            <p className="text-sm text-slate-400">
              View match schedules, scores, and standings in real time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
