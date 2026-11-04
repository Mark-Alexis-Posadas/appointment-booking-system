import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((request) => {
  if (request.nextUrl.pathname.startsWith("/provider") || request.nextUrl.pathname.startsWith("/appointments")) {
    if (!request.auth?.user) {
      const loginUrl = new URL("/login", request.nextUrl);
      loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }
  if (request.nextUrl.pathname.startsWith("/admin")) {
    if (!request.auth?.user) {
      const loginUrl = new URL("/login", request.nextUrl);
      loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (request.auth.user.role !== "ADMIN") return NextResponse.redirect(new URL("/dashboard?error=forbidden", request.nextUrl));
    return NextResponse.next();
  }
  if (!request.auth?.user) {
    const loginUrl = new URL("/login", request.nextUrl);
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/provider/:path*", "/appointments/:path*"],
};
