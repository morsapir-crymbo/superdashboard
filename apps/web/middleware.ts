import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const config = { matcher: ['/dashboard/:path*'] };

export function middleware(req: NextRequest) {
  const token = req.cookies.get('sd_token')?.value;
  if (!token) {
    const url = new URL('/login', req.url);
    url.searchParams.set('error', 'Please sign in first');
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
