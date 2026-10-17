import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

const AUTH_PATHS = ["/login", "/signup", "/recuperar-senha", "/redefinir-senha"];

function isPublicSignupEnabled() {
  return process.env.ALLOW_PUBLIC_SIGNUP === "true";
}

export async function proxy(request) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Cadastro público desativado: contas novas são criadas pela equipe.
  if (pathname === "/signup" && !isPublicSignupEnabled()) {
    return NextResponse.redirect(new URL(user ? "/panel" : "/login", request.url));
  }

  if (pathname.startsWith("/panel") && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (AUTH_PATHS.includes(pathname) && user) {
    return NextResponse.redirect(new URL("/panel", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/panel/:path*", "/login", "/signup", "/recuperar-senha", "/redefinir-senha"],
};
