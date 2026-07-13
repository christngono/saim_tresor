"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCtx } from "../../../lib/session";
import * as api from "../../../lib/api";

/** Import du grand livre COMPLET (toutes classes) → construction du TFT → redirection. */
export async function importerEtConstruireTFTAction(formData: FormData) {
  const ctx = await requireCtx();
  const fichier = formData.get("grand_livre") as File | null;
  const periode_debut = String(formData.get("periode_debut"));
  const periode_fin = String(formData.get("periode_fin"));
  const tresorerie_ouverture = String(formData.get("tresorerie_ouverture") || "0");
  const methode = String(formData.get("methode") || "INDIRECTE");

  // Le fichier est optionnel : on peut aussi calculer sur des écritures déjà en base.
  if (fichier && fichier.size > 0) {
    await api.importGrandLivre(ctx, fichier);
  }

  const tft = await api.buildTFT(ctx, {
    periode_debut, periode_fin, tresorerie_ouverture, methode,
  });
  redirect(`/tft/${tft.id}`);
}

export async function validerTFTAction(id: string) {
  const ctx = await requireCtx();
  await api.validerTFT(ctx, id);
  revalidatePath(`/tft/${id}`);
}

// L'export passe par la route /api/export/tft/[id] (téléchargement direct du
// fichier renvoyé par l'API) — plus de dépendance à un stockage objet.
