import { NextResponse } from "next/server";

/**
 * Shared files are normally caught by the service worker (public/sw.js) before they get here.
 * If the worker isn't active yet (first visit, or it was cleared), send the visitor to the home page instead of an error.
 */
export function POST(request: Request) {
  return NextResponse.redirect(new URL("/", request.url), 303);
}
