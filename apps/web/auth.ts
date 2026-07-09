import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@saim/database";

// NextAuth v5 — la session porte l'utilisateur ET l'entreprise courante (tenant).
// Ces deux valeurs sont ensuite injectées dans les appels à l'API FastAPI, qui
// positionne le tenant RLS. Un utilisateur multi-entreprise (cabinet) commence
// sur sa première adhésion ; un sélecteur de tenant pourra la changer.
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (creds) => {
        const email = creds?.email as string | undefined;
        const password = (creds?.password as string | undefined) ?? "";
        if (!email) return null;

        const user = await prisma.utilisateur.findUnique({
          where: { email },
          include: { membres: true },
        });
        if (!user || user.membres.length === 0) return null;

        // hashPwd renseigné → bcrypt ; sinon, mot de passe de démo local.
        const ok = user.hashPwd
          ? await bcrypt.compare(password, user.hashPwd)
          : password === (process.env.DEMO_PASSWORD ?? "demo1234");
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.nom,
          entrepriseId: user.membres[0].entrepriseId,
        };
      },
    }),
  ],
  callbacks: {
    // Middleware : les routes protégées (voir matcher) redirigent vers /login
    // si l'utilisateur n'est pas authentifié.
    authorized({ auth }) {
      return !!auth?.user;
    },
    jwt({ token, user }) {
      if (user) {
        token.utilisateurId = (user as { id: string }).id;
        token.entrepriseId = (user as { entrepriseId: string }).entrepriseId;
      }
      return token;
    },
    session({ session, token }) {
      (session as Record<string, unknown>).utilisateurId = token.utilisateurId;
      (session as Record<string, unknown>).entrepriseId = token.entrepriseId;
      return session;
    },
  },
});
