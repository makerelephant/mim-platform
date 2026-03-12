import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Route redirect middleware
 *
 * Redirects old org-specific routes to the unified /orgs route.
 * Preserves query params. Uses 308 Permanent Redirect for SEO.
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

  // Check static path redirects
  if (ROUTE_REDIRECTS[pathname]) {
    const url = request.nextUrl.clone();
    const target = ROUTE_REDIRECTS[pathname];

    // Parse the target — it may contain query params (e.g., /orgs?type=investor)
    const [targetPath, targetQuery] = target.split('?');
    url.pathname = targetPath;

    if (targetQuery) {
      // Set query params from the redirect target
      const params = new URLSearchParams(targetQuery);
      params.forEach((value, key) => {
        url.searchParams.set(key, value);
      });
    }

    // Preserve any existing query params from the original request
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
  // Only run middleware on old routes that need redirecting
  matcher: [
    '/investors/:path*',
    '/soccer-orgs/:path*',
    '/channel-partners/:path*',
    '/all-orgs/:path*',
    '/investor-contacts/:path*',
    '/market-map/:path*',
  ],
};
