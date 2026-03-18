import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { validateApiAuth } from '@/lib/auth';

/**
 * Middleware — route redirects + API authentication
 */

const ROUTE_REDIRECTS: Record<string, string> = {
  '/investors': '/orgs?type=investor',
  '/soccer-orgs': '/orgs?type=customer',
  '/channel-partners': '/orgs?type=partner',
  '/all-orgs': '/orgs',
  '/investor-contacts': '/contacts?type=investor',
  '/market-map': '/orgs',
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── API Authentication ──
  if (pathname.startsWith('/api/')) {
    const authError = validateApiAuth(request);
    if (authError) {
      return NextResponse.json(
        { error: authError },
        { status: 401 },
      );
    }
    return NextResponse.next();
  }

  // ── Route Redirects ──
  if (ROUTE_REDIRECTS[pathname]) {
    const url = request.nextUrl.clone();
    const target = ROUTE_REDIRECTS[pathname];
    const [targetPath, targetQuery] = target.split('?');
    url.pathname = targetPath;

    if (targetQuery) {
      const params = new URLSearchParams(targetQuery);
      params.forEach((value, key) => {
        url.searchParams.set(key, value);
      });
    }

    request.nextUrl.searchParams.forEach((value, key) => {
      if (!url.searchParams.has(key)) {
        url.searchParams.set(key, value);
      }
    });

    return NextResponse.redirect(url, 308);
  }

  // Redirect old detail routes: /investors/[id] → /orgs/[id]
  if (pathname.startsWith('/investors/') && pathname.split('/').length === 3) {
    const id = pathname.split('/')[2];
    const url = request.nextUrl.clone();
    url.pathname = `/orgs/${id}`;
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // API routes — auth check
    '/api/:path*',
    // Legacy route redirects
    '/investors/:path*',
    '/soccer-orgs/:path*',
    '/channel-partners/:path*',
    '/all-orgs/:path*',
    '/investor-contacts/:path*',
    '/market-map/:path*',
  ],
};
