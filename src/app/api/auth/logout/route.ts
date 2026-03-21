import { NextResponse } from "next/server";

/**
 * POST /api/auth/logout
 *
 * Clears the mim-auth cookie and returns success.
 */
export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set("mim-auth", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0, // expire immediately
  });
  return res;
}
