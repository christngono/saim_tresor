// Client typé vers l'API FastAPI. Le contexte (tenant + utilisateur) provient de
// la session NextAuth v5 (voir lib/session.ts) et est transmis en en-têtes ;
// l'API positionne alors le tenant RLS.
import type { Ctx } from "./session";

const API = process.env.API_BASE_URL ?? "http://localhost:8000";

export type MatchOut = {
  id: string;
  ligne_releve_id: string | null;
  ecriture_id: string | null;
  score_confiance: number;
  score_montant: number;
  score_date: number;
  score_libelle: number;
  methode: string;
  type_ecart: string | null;
  statut: string;
};

export type RapprochementOut = {
  id: string;
  statut: string;
  solde_releve: string;
  solde_comptable: string;
  ecart: string;
  algo_version: string;
  matches: MatchOut[];
};

export type RapprochementListItem = {
  id: string;
  statut: string;
  compteBancaireId: string;
  periodeDebut: string;
  periodeFin: string;
  ecart: string;
  nbEcarts: number;
  createdAt: string;
};

export type CompteBancaire = {
  id: string;
  banque: string;
  numeroCompte: string;
  intitule: string;
  devise: string;
};

function headers(ctx: Ctx, json = true) {
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    "X-Entreprise-Id": ctx.entrepriseId,
    "X-Utilisateur-Id": ctx.utilisateurId,
  };
}

async function jsonOrThrow(res: Response, msg: string) {
  if (!res.ok) throw new Error(`${msg} (${res.status})`);
  return res.json();
}

// ── Lecture ──
export async function listComptes(ctx: Ctx): Promise<CompteBancaire[]> {
  return jsonOrThrow(
    await fetch(`${API}/comptes-bancaires`, { headers: headers(ctx), cache: "no-store" }),
    "Comptes indisponibles",
  );
}

export async function listRapprochements(ctx: Ctx): Promise<RapprochementListItem[]> {
  return jsonOrThrow(
    await fetch(`${API}/rapprochements`, { headers: headers(ctx), cache: "no-store" }),
    "Rapprochements indisponibles",
  );
}

export async function getRapprochement(id: string, ctx: Ctx): Promise<RapprochementOut> {
  return jsonOrThrow(
    await fetch(`${API}/reconciliation/${id}`, { headers: headers(ctx), cache: "no-store" }),
    "Rapprochement introuvable",
  );
}

// ── Écriture ──
export async function uploadReleve(ctx: Ctx, compteBancaireId: string, fichier: File) {
  const fd = new FormData();
  fd.append("compte_bancaire_id", compteBancaireId);
  fd.append("fichier", fichier);
  return jsonOrThrow(
    await fetch(`${API}/reconciliation/upload`, {
      method: "POST",
      headers: headers(ctx, false),
      body: fd,
    }),
    "Échec de l'upload",
  );
}

export async function runRapprochement(
  ctx: Ctx,
  body: { compte_bancaire_id: string; releve_id: string; periode_debut: string; periode_fin: string },
): Promise<RapprochementOut> {
  return jsonOrThrow(
    await fetch(`${API}/reconciliation/run`, {
      method: "POST",
      headers: headers(ctx),
      body: JSON.stringify(body),
    }),
    "Échec du rapprochement",
  );
}

export async function validerMatch(
  ctx: Ctx,
  matchId: string,
  decision: "VALIDE" | "REJETE" | "CORRIGE",
  ecritureIdCorrigee?: string,
) {
  return jsonOrThrow(
    await fetch(`${API}/reconciliation/match/valider`, {
      method: "POST",
      headers: headers(ctx),
      body: JSON.stringify({
        match_id: matchId,
        decision,
        ecriture_id_corrigee: ecritureIdCorrigee ?? null,
      }),
    }),
    "Échec de la validation",
  );
}

export async function validerRapprochement(ctx: Ctx, id: string) {
  return jsonOrThrow(
    await fetch(`${API}/reconciliation/${id}/valider`, { method: "POST", headers: headers(ctx) }),
    "Clôture impossible",
  );
}

export async function exporterRapprochement(ctx: Ctx, id: string): Promise<{ url: string }> {
  return jsonOrThrow(
    await fetch(`${API}/reconciliation/${id}/export`, { method: "POST", headers: headers(ctx) }),
    "Export impossible",
  );
}

// ── Module 2 : TFT ──
export type TFTOut = {
  id: string;
  statut: string;
  methode: string;
  algo_version: string;
  donnees: Record<string, any>;
  previsionnel: Record<string, any> | null;
};

export type Forecast = {
  algo_version: string;
  date_reference: string;
  solde_initial: string;
  seuil_alerte: string;
  alerte_rupture: boolean;
  rupture_horizon_jours: number | null;
  points: {
    horizon_jours: number;
    date: string;
    encaissements_prevus: string;
    decaissements_prevus: string;
    solde_projete: string;
    rupture: boolean;
  }[];
};

export async function buildTFT(
  ctx: Ctx,
  body: { periode_debut: string; periode_fin: string; tresorerie_ouverture: string; methode: string },
): Promise<TFTOut> {
  return jsonOrThrow(
    await fetch(`${API}/cashflow/build`, {
      method: "POST", headers: headers(ctx), body: JSON.stringify(body),
    }),
    "Construction du TFT impossible",
  );
}

export async function forecastTresorerie(
  ctx: Ctx,
  body: { date_reference: string; solde_initial: string; seuil_alerte: string },
): Promise<Forecast> {
  return jsonOrThrow(
    await fetch(`${API}/cashflow/forecast`, {
      method: "POST", headers: headers(ctx), body: JSON.stringify(body),
    }),
    "Prévisionnel indisponible",
  );
}

// ── Module 3 : Facturation / DSO ──
export type FactureItem = {
  id: string; sens: string; numero: string; tiers: string;
  dateEcheance: string; montantTTC: string; montantPaye: string;
  resteAPayer: string; statut: string;
};

export type Analyse = {
  dso: {
    date_reference: string; periode_jours: number;
    encours_creances_ttc: string; chiffre_affaires_ttc: string; dso_jours: string;
  };
  anomalies: { facture_id: string; type: string; detail: string }[];
};

export type RelanceItem = {
  id: string; facture_id: string; tiers: string; niveau: number;
  jours_retard: number; montant_du: string; message: string; statut: string;
};

export async function listFactures(ctx: Ctx): Promise<FactureItem[]> {
  return jsonOrThrow(
    await fetch(`${API}/invoicing/factures`, { headers: headers(ctx), cache: "no-store" }),
    "Factures indisponibles",
  );
}

export async function analyserFactures(ctx: Ctx, date_reference: string): Promise<Analyse> {
  return jsonOrThrow(
    await fetch(`${API}/invoicing/analyse`, {
      method: "POST", headers: headers(ctx),
      body: JSON.stringify({ date_reference, periode_jours: 90 }),
    }),
    "Analyse impossible",
  );
}

export async function genererRelances(
  ctx: Ctx, date_reference: string,
): Promise<{ relances: RelanceItem[] }> {
  return jsonOrThrow(
    await fetch(`${API}/invoicing/relances/generer`, {
      method: "POST", headers: headers(ctx),
      body: JSON.stringify({ date_reference, periode_jours: 90 }),
    }),
    "Génération des relances impossible",
  );
}

export async function validerRelance(
  ctx: Ctx, relance_id: string, decision: "ENVOYER" | "ANNULER",
) {
  return jsonOrThrow(
    await fetch(`${API}/invoicing/relances/valider`, {
      method: "POST", headers: headers(ctx),
      body: JSON.stringify({ relance_id, decision }),
    }),
    "Validation impossible",
  );
}
