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
