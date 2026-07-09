"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCtx } from "../../../lib/session";
import * as api from "../../../lib/api";

// Toutes les mutations passent ici : le contexte (tenant + utilisateur) est
// dérivé de la session côté serveur, jamais transmis par le client.

export async function validerMatchAction(matchId: string, decision: "VALIDE" | "REJETE") {
  const ctx = await requireCtx();
  await api.validerMatch(ctx, matchId, decision);
}

export async function validerRapprochementAction(id: string) {
  const ctx = await requireCtx();
  await api.validerRapprochement(ctx, id);
  revalidatePath(`/rapprochement/${id}`);
}

export async function exporterAction(id: string): Promise<string> {
  const ctx = await requireCtx();
  const { url } = await api.exporterRapprochement(ctx, id);
  revalidatePath(`/rapprochement/${id}`);
  return url;
}

/** Import CSV du grand livre + du relevé → rapprochement → redirection.
 *  Voie 100 % déterministe : ni LLM, ni stockage R2. */
export async function importerEtRapprocherAction(formData: FormData) {
  const ctx = await requireCtx();
  const compteId = String(formData.get("compte_bancaire_id"));
  const grandLivre = formData.get("grand_livre") as File;
  const releve = formData.get("releve") as File;
  const soldeInitial = String(formData.get("solde_initial") || "0");
  const soldeFinal = String(formData.get("solde_final") || "0");

  if (grandLivre && grandLivre.size > 0) {
    await api.importGrandLivre(ctx, grandLivre);
  }
  const imp = await api.importReleveCsv(ctx, compteId, soldeInitial, soldeFinal, releve);
  const rap = await api.runRapprochement(ctx, {
    compte_bancaire_id: compteId,
    releve_id: imp.releve_id,
    periode_debut: imp.periode_debut,
    periode_fin: imp.periode_fin,
  });
  redirect(`/rapprochement/${rap.id}`);
}

/** Upload du relevé → extraction IA → rapprochement déterministe → redirection. */
export async function uploadEtRunAction(formData: FormData) {
  const ctx = await requireCtx();
  const compteId = String(formData.get("compte_bancaire_id"));
  const fichier = formData.get("fichier") as File;

  const up = await api.uploadReleve(ctx, compteId, fichier);
  const rap = await api.runRapprochement(ctx, {
    compte_bancaire_id: compteId,
    releve_id: up.releve_id,
    periode_debut: up.periode_debut,
    periode_fin: up.periode_fin,
  });
  redirect(`/rapprochement/${rap.id}`);
}
