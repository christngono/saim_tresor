export { auth as middleware } from "./auth";

// Protège toutes les routes du dashboard : redirige vers /login si non connecté.
export const config = {
  matcher: ["/tresorerie/:path*", "/rapprochement/:path*", "/tft/:path*", "/factures/:path*"],
};
