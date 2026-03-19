/**
 * API Authentication
 *
 * Protects API routes with token-based auth.
 * - Browser requests: checked via `mim-auth` httpOnly cookie
 * - Cron jobs: checked via `Authorization: Bearer <CRON_SECRET>`
 * - Server-to-server: checked via `Authorization: Bearer <API_AUTH_TOKEN>`
 *
 * Phase 1: single user, token-based. Phase 5: Supabase Auth.
 */

import { NextRequest } from "next/server";

/** Routes triggered by Vercel cron (use CRON_SECRET) */
const CRON_ROUTES = new Set([
  "/api/agents/gmail-scanner",
  "/api/agents/slack-scanner",
  "/api/agents/daily-briefing",
  "/api/brain/autonomy",
  "/api/feed/resurface",
  "/api/agents/synthesis",
  "/api/agents/monthly-report",
]);

/** Routes that must remain public (login flow, health checks) */
const PUBLIC_ROUTES = new Set([
  "/api/engine/health",
  "/api/auth/login",
]);

/**
 * Validate an API request.
 * Returns null if authorized, or an error string if not.
 */
export function validateApiAuth(request: NextRequest): string | null {
  const pathname = request.nextUrl.pathname;

  // Public routes — no auth needed
  if (PUBLIC_ROUTES.has(pathname)) return null;

  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  // Cron routes — check CRON_SECRET or cookie (browser-triggered gopher runs)
  if (CRON_ROUTES.has(pathname)) {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      // If CRON_SECRET not configured, allow (don't break existing crons during rollout)
      console.warn(`[auth] CRON_SECRET not set — allowing cron route ${pathname}`);
      return null;
    }
    if (bearerToken === cronSecret) return null;

    // Also accept CEO cookie — allows browser-triggered gopher runs via refresh button
    const apiToken = process.env.API_AUTH_TOKEN;
    const cookieToken = request.cookies.get("mim-auth")?.value;
    if (apiToken && cookieToken === apiToken) return null;

    return "Invalid cron authorization";
  }

  // All other API routes — check API_AUTH_TOKEN via header or cookie
  const apiToken = process.env.API_AUTH_TOKEN;
  if (!apiToken) {
    // If API_AUTH_TOKEN not configured, allow (don't break during rollout)
    console.warn(`[auth] API_AUTH_TOKEN not set — allowing ${pathname}`);
    return null;
  }

  // Check Authorization header
  if (bearerToken === apiToken) return null;

  // Check cookie (set by login page)
  const cookieToken = request.cookies.get("mim-auth")?.value;
  if (cookieToken === apiToken) return null;

  return "Unauthorized";
}
