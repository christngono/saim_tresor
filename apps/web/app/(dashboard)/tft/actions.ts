"use server";

import { requireCtx } from "../../../lib/session";
import * as api from "../../../lib/api";

export async function buildTFTAction(input: {
  periode_debut: string;
  periode_fin: string;
  tresorerie_ouverture: string;
  methode: string;
}) {
  const ctx = await requireCtx();
  return api.buildTFT(ctx, input);
}

export async function forecastAction(input: {
  date_reference: string;
  solde_initial: string;
  seuil_alerte: string;
}) {
  const ctx = await requireCtx();
  return api.forecastTresorerie(ctx, input);
}
