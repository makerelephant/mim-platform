import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/auth/login
 *
 * Phase 1 login: validates email + password against env vars,
 * sets an httpOnly cookie with the API auth token.
 *
 * Phase 5: replace with Supabase Auth.
 */
export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  const validEmail = process.env.CEO_EMAIL || "mark@madeinmotion.co";
  const validPassword = process.env.CEO_PASSWORD;
  const apiToken = process.env.API_AUTH_TOKEN;

  if (!validPassword || !apiToken) {
    // If not configured, allow login (don't break during rollout)
    const res = NextResponse.json({ success: true });
    return res;
  }

  if (email !== validEmail || password !== validPassword) {
    return NextResponse.json(
      { success: false, error: "Invalid credentials" },
      { status: 401 },
    );
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set("mim-auth", apiToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return res;
}
