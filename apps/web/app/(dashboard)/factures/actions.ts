"use server";

import { requireCtx } from "../../../lib/session";
import * as api from "../../../lib/api";

export async function analyserAction(dateReference: string) {
  const ctx = await requireCtx();
  return api.analyserFactures(ctx, dateReference);
}

export async function genererRelancesAction(dateReference: string) {
  const ctx = await requireCtx();
  return api.genererRelances(ctx, dateReference);
}

export async function validerRelanceAction(relanceId: string, decision: "ENVOYER" | "ANNULER") {
  const ctx = await requireCtx();
  return api.validerRelance(ctx, relanceId, decision);
}
