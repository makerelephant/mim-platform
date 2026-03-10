"use client";

/**
 * MiMbrain Login Page
 * src/app/login/page.tsx
 *
 * Split layout: form left, animated brand panel right.
 * - No Google OAuth (internal tool, 4 users)
 * - No sign-up link (invite-only)
 * - Forgot password → /login/reset (placeholder)
 * - Enter key submits form
 *
 * Auth is placeholder until Phase 5. Currently navigates straight to dashboard.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    setError(null);

    // Placeholder — real Supabase auth in Phase 5
    // For now, just redirect to the dashboard after a brief pause
    await new Promise((r) => setTimeout(r, 600));
    router.push("/");
  }

  return (
    <>
      <style>{`
        @keyframes mesh-shift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes float-mark {
          0%, 100% { transform: translateY(0px) rotate(-4deg); }
          50%       { transform: translateY(-18px) rotate(-4deg); }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-up          { animation: fade-up 0.5s ease forwards; }
        .animate-fade-up-delay-1  { animation: fade-up 0.5s 0.08s ease both; }
        .animate-fade-up-delay-2  { animation: fade-up 0.5s 0.16s ease both; }
        .animate-fade-up-delay-3  { animation: fade-up 0.5s 0.24s ease both; }
        .animate-fade-up-delay-4  { animation: fade-up 0.5s 0.32s ease both; }
        .animate-fade-up-delay-5  { animation: fade-up 0.5s 0.40s ease both; }

        .mesh-bg {
          background: linear-gradient(
            135deg,
            #0f172a 0%,
            #1e3a5f 20%,
            #0f172a 40%,
            #1a2e4a 60%,
            #0f172a 80%,
            #162032 100%
          );
          background-size: 400% 400%;
          animation: mesh-shift 12s ease infinite;
        }

        .grid-overlay {
          background-image:
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 48px 48px;
        }

        .float-mark {
          animation: float-mark 7s ease-in-out infinite;
        }

        .mim-input {
          height: 44px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          font-size: 14px;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .mim-input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
          outline: none;
        }
        .mim-input::placeholder { color: #94a3b8; }
      `}</style>

      <div className="flex h-screen w-full overflow-hidden bg-[#f8fafc]">

        {/* ── Left: Form panel ── */}
        <div className="flex flex-col justify-between w-full max-w-[520px] px-12 py-10 bg-white border-r border-slate-100">

          {/* Logo */}
          <div className="animate-fade-up">
            <div className="flex items-center gap-2.5">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M4 22L10 6" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round"/>
                <path d="M10 22L16 6" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round"/>
                <path d="M16 22L22 6" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
              <span
                style={{ fontFamily: "'Geist', system-ui, sans-serif", letterSpacing: "0.12em" }}
                className="text-[15px] font-semibold text-slate-800 uppercase tracking-widest"
              >
                MiMbrain
              </span>
            </div>
          </div>

          {/* Form */}
          <div className="flex-1 flex flex-col justify-center max-w-[360px]">

            <div className="animate-fade-up-delay-1 mb-8">
              <h1 className="text-2xl font-semibold text-slate-900 mb-1">
                Welcome back
              </h1>
              <p className="text-sm text-slate-500">
                Sign in to your MiMbrain account
              </p>
            </div>

            <div className="space-y-4">

              <div className="animate-fade-up-delay-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email
                </label>
                <Input
                  type="email"
                  placeholder="you@madeinmotionapp.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLogin()}
                  className="mim-input w-full"
                  autoComplete="email"
                  autoFocus
                />
              </div>

              <div className="animate-fade-up-delay-3">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-slate-700">
                    Password
                  </label>
                  <a
                    href="/login/reset"
                    className="text-xs text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                  >
                    Forgot password?
                  </a>
                </div>
                <Input
                  type="password"
                  placeholder="••••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleLogin()}
                  className="mim-input w-full"
                  autoComplete="current-password"
                />
              </div>

              {/* Error state */}
              {error && (
                <div className="animate-fade-up rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="animate-fade-up-delay-4 pt-1">
                <Button
                  onClick={handleLogin}
                  disabled={loading}
                  className="w-full h-11 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-sm transition-all duration-150 shadow-sm"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </div>

            </div>
          </div>

          {/* Footer */}
          <div className="animate-fade-up-delay-5">
            <p className="text-xs text-slate-400">
              &copy; 2026 Made In Motion PBC &middot; Internal platform
            </p>
          </div>

        </div>

        {/* ── Right: Brand panel ── */}
        <div className="hidden lg:flex flex-1 relative overflow-hidden mesh-bg">

          {/* Grid overlay */}
          <div className="absolute inset-0 grid-overlay" />

          {/* Glow blobs */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)', filter: 'blur(60px)' }}
          />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-15"
            style={{ background: 'radial-gradient(circle, #818cf8 0%, transparent 70%)', filter: 'blur(60px)' }}
          />

          {/* Large floating MiM mark */}
          <div className="absolute inset-0 flex items-center justify-center float-mark">
            <svg width="180" height="180" viewBox="0 0 180 180" fill="none" opacity="0.12">
              <path d="M30 148L70 32" stroke="white" strokeWidth="16" strokeLinecap="round"/>
              <path d="M72 148L112 32" stroke="white" strokeWidth="16" strokeLinecap="round"/>
              <path d="M114 148L154 32" stroke="white" strokeWidth="16" strokeLinecap="round"/>
            </svg>
          </div>

          {/* Bottom tag */}
          <div className="absolute bottom-10 left-10 right-10">
            <p
              className="text-white/30 text-xs uppercase tracking-[0.2em]"
              style={{ fontFamily: "'Geist', system-ui, sans-serif" }}
            >
              Made In Motion &middot; Internal Intelligence Platform
            </p>
          </div>

        </div>

      </div>
    </>
  );
}
