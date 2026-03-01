import { auth } from "@/auth";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  // Public routes
  const publicPaths = ["/", "/login", "/register", "/forgot-password"];
  const isPublic = publicPaths.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (isPublic) {
    if (isLoggedIn && (pathname === "/login" || pathname === "/register")) {
      return Response.redirect(new URL("/dashboard", req.url));
    }
    return;
  }

  // Protected routes - require auth
  if (!isLoggedIn) {
    return Response.redirect(new URL("/login", req.url));
  }

  return;
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
