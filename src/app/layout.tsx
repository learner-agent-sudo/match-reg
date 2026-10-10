import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Tournament Hub",
  description: "Soccer tournament registration and management platform",
  // Invite links carry a team code in the URL; don't leak it to other sites.
  referrer: "no-referrer",
};

// GitHub Pages can't send security headers, so the browser policy is set with
// a <meta> tag instead. Next.js inlines its startup scripts, which is why
// 'unsafe-inline' is needed for scripts; the real win is connect-src, which
// only lets the page talk to this site and our Supabase project.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseUrl}`,
  "font-src 'self'",
  `connect-src 'self' ${supabaseUrl}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.className} h-full antialiased`}>
      <head>
        {process.env.NODE_ENV === "production" && (
          <meta httpEquiv="Content-Security-Policy" content={contentSecurityPolicy} />
        )}
      </head>
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
