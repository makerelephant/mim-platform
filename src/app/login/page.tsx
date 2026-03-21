"use client";

/**
 * Login Page — Pixel-perfect match to Figma node 72:578
 *
 * Split layout: white form panel left (460px), background image right.
 * Auth is placeholder until Phase 5. Currently navigates straight to dashboard.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/* eslint-disable @next/next/no-img-element */

const geist = "var(--font-geist-sans), 'Geist', sans-serif";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Invalid credentials.");
        setLoading(false);
        return;
      }

      router.push("/");
    } catch {
      setError("Failed to connect. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="relative flex h-screen w-full overflow-hidden">

      {/* ══════════════════════════════════════════════════════════════
          BACKGROUND — Full viewport image with gradient overlay
          ══════════════════════════════════════════════════════════════ */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
        <img
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          src="/icons/login-bg.png"
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(
              -90deg,
              rgba(255, 255, 255, 0.4) 7.5%,
              rgba(230, 241, 255, 0.4) 11.2%,
              rgba(255, 255, 255, 0.4) 15.7%,
              rgba(238, 242, 245, 0.4) 20.3%,
              rgba(236, 250, 255, 0.4) 23%,
              rgba(242, 233, 250, 0.4) 26.3%,
              rgba(255, 255, 255, 0.4) 30%
            )`,
          }}
        />
      </div>

      {/* ══════════════════════════════════════════════════════════════
          LEFT PANEL — White form area (460px)
          ══════════════════════════════════════════════════════════════ */}
      <div
        className="relative z-10 flex flex-col h-full shrink-0 bg-white"
        style={{ width: "460px" }}
      >
        {/* ── MiMbrain Logo ── */}
        <div
          className="flex items-center"
          style={{ paddingLeft: "37px", paddingTop: "34px", height: "64px" }}
        >
          <img
            src="/icons/MiMbrain Icon.png"
            alt="MiMBrain"
            style={{ width: "62.7px", height: "44.6px" }}
          />
        </div>

        {/* ── Form ── */}
        <div
          className="flex flex-col"
          style={{ paddingLeft: "37px", paddingTop: "279px", width: "421px" }}
        >
          <div className="flex flex-col" style={{ gap: "32px" }}>
            {/* Heading */}
            <div className="flex flex-col" style={{ gap: "6px", width: "230px" }}>
              <h1
                style={{
                  fontFamily: geist,
                  fontSize: "24px",
                  fontWeight: 600,
                  lineHeight: "1.2",
                  letterSpacing: "-0.48px",
                  color: "#1e252a",
                }}
              >
                Welcome Back
              </h1>
              <p
                style={{
                  fontFamily: geist,
                  fontSize: "16px",
                  fontWeight: 400,
                  lineHeight: "1.2",
                  color: "#7b7f81",
                }}
              >
                Sign in to your motion account.
              </p>
            </div>

            {/* Fields */}
            <div className="flex flex-col" style={{ gap: "24px", width: "384px" }}>
              {/* Email */}
              <div className="flex flex-col" style={{ gap: "8px" }}>
                <label
                  style={{
                    fontFamily: geist,
                    fontSize: "16px",
                    fontWeight: 500,
                    lineHeight: "normal",
                    letterSpacing: "-0.16px",
                    color: "#020618",
                  }}
                >
                  Email
                </label>
                <input
                  type="email"
                  placeholder="team@madeinmotionapp.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  autoComplete="email"
                  autoFocus
                  className="w-full"
                  style={{
                    fontFamily: geist,
                    fontSize: "16px",
                    fontWeight: 300,
                    lineHeight: "normal",
                    color: "#020618",
                    height: "40px",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                    backgroundColor: "white",
                    paddingLeft: "12px",
                    paddingRight: "12px",
                    outline: "none",
                  }}
                />
              </div>

              {/* Password + Forgot */}
              <div className="flex flex-col" style={{ gap: "6px" }}>
                <div className="flex flex-col" style={{ gap: "8px" }}>
                  <label
                    style={{
                      fontFamily: geist,
                      fontSize: "16px",
                      fontWeight: 500,
                      lineHeight: "normal",
                      letterSpacing: "-0.16px",
                      color: "#020618",
                    }}
                  >
                    Password
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    autoComplete="current-password"
                    className="w-full"
                    style={{
                      fontFamily: geist,
                      fontSize: "14px",
                      fontWeight: 400,
                      lineHeight: "20px",
                      color: "#020618",
                      height: "40px",
                      borderRadius: "10px",
                      border: "1px solid #e2e8f0",
                      backgroundColor: "white",
                      paddingLeft: "12px",
                      paddingRight: "12px",
                      outline: "none",
                    }}
                  />
                </div>
                <span
                  className="cursor-pointer"
                  style={{
                    fontFamily: geist,
                    fontSize: "14px",
                    fontWeight: 300,
                    lineHeight: "normal",
                    color: "#020618",
                  }}
                >
                  Forgot your password?
                </span>
              </div>

              {/* Error */}
              {error && (
                <div
                  className="rounded-[10px] px-3 py-2"
                  style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca" }}
                >
                  <p style={{ fontFamily: geist, fontSize: "14px", color: "#dc2626" }}>
                    {error}
                  </p>
                </div>
              )}

              {/* Login button */}
              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center"
                style={{
                  fontFamily: geist,
                  fontSize: "14px",
                  fontWeight: 500,
                  lineHeight: "20px",
                  color: "#f8fafc",
                  height: "40px",
                  borderRadius: "10px",
                  backgroundColor: loading ? "#7ba3f7" : "#155dfc",
                  border: "none",
                  cursor: loading ? "wait" : "pointer",
                }}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Login"
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── Copyright ── */}
        <div className="mt-auto" style={{ paddingLeft: "24px", paddingBottom: "47px" }}>
          <span
            style={{
              fontFamily: geist,
              fontSize: "16px",
              fontWeight: 400,
              lineHeight: "1.2",
              color: "#9ca5a9",
            }}
          >
            ©️ 2026 Made In Motion PBC
          </span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          RIGHT PANEL — Background image visible (no separate element needed)
          ══════════════════════════════════════════════════════════════ */}
      <div className="relative z-10 flex-1 hidden lg:block">
        {/* ── Turbine animation — centered, slow spin ── */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "min(70vh, 70%)",
            aspectRatio: "1",
          }}
        >
          {/* Outer glow ring */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(40,155,255,0.08) 0%, transparent 70%)",
              animation: "turbinePulse 6s ease-in-out infinite",
            }}
          />
          {/* Primary turbine — spins slowly clockwise */}
          <img
            src="/icons/login-turbine.svg"
            alt=""
            className="absolute inset-0 w-full h-full"
            style={{
              animation: "turbineSpin 30s linear infinite",
              filter: "drop-shadow(0 0 40px rgba(40,155,255,0.15))",
            }}
          />
          {/* Secondary turbine — counter-rotate, slightly smaller, offset phase */}
          <img
            src="/icons/login-turbine.svg"
            alt=""
            className="absolute w-[60%] h-[60%]"
            style={{
              top: "20%",
              left: "20%",
              animation: "turbineSpinReverse 20s linear infinite",
              opacity: 0.4,
              filter: "drop-shadow(0 0 20px rgba(40,155,255,0.1))",
            }}
          />
          {/* Innermost — fastest, smallest */}
          <img
            src="/icons/login-turbine.svg"
            alt=""
            className="absolute w-[30%] h-[30%]"
            style={{
              top: "35%",
              left: "35%",
              animation: "turbineSpin 12s linear infinite",
              opacity: 0.25,
            }}
          />
        </div>

        {/* "THE MOTION PLATFORM" bottom text */}
        <p
          className="absolute whitespace-nowrap"
          style={{
            fontFamily: geist,
            fontSize: "18px",
            fontWeight: 600,
            lineHeight: "normal",
            letterSpacing: "2.52px",
            color: "white",
            bottom: "50px",
            left: "25px",
          }}
        >
          THE MOTION PLATFORM
        </p>

        {/* Turntable illustration — bottom-left */}
        <div
          className="absolute"
          style={{
            left: "0px",
            bottom: "20px",
            width: "89px",
            height: "75px",
            transform: "rotate(-11.73deg)",
          }}
        >
          <img
            src="/icons/login-turntable.png"
            alt=""
            className="w-full h-full object-cover pointer-events-none"
          />
        </div>

        {/* Stencil figure — bottom-right */}
        <div
          className="absolute"
          style={{
            right: "20px",
            bottom: "30px",
            width: "78px",
            height: "114px",
            opacity: 0.2,
          }}
        >
          <img
            src="/icons/login-stencil.png"
            alt=""
            className="w-full h-full object-cover pointer-events-none"
          />
        </div>
      </div>
    </div>
  );
}
