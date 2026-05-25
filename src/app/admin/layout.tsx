"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/admin", label: "Teams" },
  { href: "/admin/tournaments", label: "Tournaments" },
  { href: "/admin/matches", label: "Matches" },
  { href: "/admin/pitches", label: "Pitches" },
  { href: "/admin/referees", label: "Referees" },
  { href: "/admin/runners", label: "Runners" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    async function checkAdmin() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth/login"); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!profile || profile.role !== "admin") {
        router.push("/dashboard");
        return;
      }
      setAuthorized(true);
    }
    checkAdmin();
  }, [router]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  if (!authorized) {
    return <div className="flex items-center justify-center min-h-screen text-slate-400">Loading...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
        <button onClick={handleSignOut} className="text-sm text-slate-400 hover:text-white transition">
          Sign Out
        </button>
      </div>

      <nav className="flex gap-1 mb-6 border-b border-slate-700 overflow-x-auto">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`px-4 py-2 text-sm font-medium rounded-t-md transition whitespace-nowrap ${
              pathname === item.href
                ? "bg-slate-800 border border-slate-700 border-b-slate-800 -mb-px text-blue-400"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
