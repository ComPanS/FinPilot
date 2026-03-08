import { auth } from "@/auth";
import { NextResponse } from "next/server";

const ADMIN_INTERNAL_PARAM = "internal";

export default auth((req) => {
  const { pathname, searchParams } = req.nextUrl;
  // Edge Runtime: only NEXT_PUBLIC_ vars are available; value comes from next.config env
  const adminPath = process.env.NEXT_PUBLIC_ADMIN_PATH;

  // Admin panel: block direct /admin access (only allow via rewrite from ADMIN_PATH)
  if (pathname === "/admin") {
    if (searchParams.get(ADMIN_INTERNAL_PARAM) !== "1") {
      return new NextResponse(null, { status: 404 });
    }
    // Fall through: require auth for /admin
  }

  // Admin panel: rewrite /{ADMIN_PATH} to /admin (also /a/ with trailing slash)
  if (
    adminPath &&
    (pathname === `/${adminPath}` || pathname === `/${adminPath}/`)
  ) {
    const url = new URL("/admin", req.url);
    url.searchParams.set(ADMIN_INTERNAL_PARAM, "1");
    return NextResponse.rewrite(url);
  }

  const isLoggedIn = !!req.auth;

  // Public routes
  const publicPaths = [
    "/",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/verify-new-email",
    "/oauth/yandex/token",
  ];
  const isPublic = publicPaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );

  if (isPublic) {
    if (
      isLoggedIn &&
      (pathname === "/" || pathname === "/login" || pathname === "/register")
    ) {
      return Response.redirect(new URL("/dashboard", req.url));
    }
    return;
  }

  // Protected routes - require auth
  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.url);
    if (pathname === "/admin" && adminPath) {
      loginUrl.searchParams.set("callbackUrl", `/${adminPath}`);
    }
    return Response.redirect(loginUrl);
  }

  return;
});

export const config = {
  matcher: [
    "/",
    "/((?!api|_next/static|_next/image|favicon.ico|logo.png|manifest.webmanifest|robots.txt|sitemap.xml).*)",
  ],
};
