import { auth } from "../auth";

export type Ctx = { entrepriseId: string; utilisateurId: string };

/** Récupère le tenant + l'utilisateur depuis la session NextAuth (côté serveur). */
export async function requireCtx(): Promise<Ctx> {
  const session = (await auth()) as (Record<string, unknown> & { user?: unknown }) | null;
  const entrepriseId = session?.entrepriseId as string | undefined;
  const utilisateurId = session?.utilisateurId as string | undefined;
  if (!entrepriseId || !utilisateurId) throw new Error("Non authentifié");
  return { entrepriseId, utilisateurId };
}
