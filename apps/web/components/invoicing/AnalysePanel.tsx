"use client";

import { useState, useTransition } from "react";
import type { Analyse, RelanceItem } from "../../lib/api";
import { analyserAction, genererRelancesAction, validerRelanceAction } from "../../app/(dashboard)/factures/actions";

function fcfa(v: string) {
  return new Intl.NumberFormat("fr-FR").format(Number(v)) + " FCFA";
}

const LIBELLE: Record<string, string> = {
  DOUBLON: "Doublon", ECART_PRIX: "Écart de prix",
  MONTANT_INCOHERENT: "Montant incohérent", RETARD: "Retard de paiement",
};
const ANO_TONE: Record<string, string> = {
  RETARD: "bg-amber-50 text-amber-700 ring-amber-200",
  DOUBLON: "bg-rose-50 text-rose-700 ring-rose-200",
  ECART_PRIX: "bg-rose-50 text-rose-700 ring-rose-200",
  MONTANT_INCOHERENT: "bg-rose-50 text-rose-700 ring-rose-200",
};

export function AnalysePanel({ dateReference }: { dateReference: string }) {
  const [analyse, setAnalyse] = useState<Analyse | null>(null);
  const [relances, setRelances] = useState<RelanceItem[]>([]);
  const [pending, start] = useTransition();

  function lancer() {
    start(async () => {
      setAnalyse(await analyserAction(dateReference));
      setRelances((await genererRelancesAction(dateReference)).relances);
    });
  }
  function decider(id: string, decision: "ENVOYER" | "ANNULER") {
    start(async () => {
      await validerRelanceAction(id, decision);
      setRelances((rs) => rs.map((r) => r.id === id ? { ...r, statut: decision === "ENVOYER" ? "ENVOYEE" : "ANNULEE" } : r));
    });
  }

  return (
    <div className="space-y-6">
      {!analyse && (
        <button onClick={lancer} disabled={pending} className="btn-primary">
          {pending ? "Analyse en cours…" : "Analyser (DSO, anomalies, relances)"}
        </button>
      )}

      {analyse && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Kpi label="DSO" value={`${analyse.dso.dso_jours} j`} tone={Number(analyse.dso.dso_jours) > 60 ? "warn" : "ok"} hint="délai moyen de paiement" />
            <Kpi label="Encours créances" value={fcfa(analyse.dso.encours_creances_ttc)} />
            <Kpi label="Anomalies" value={String(analyse.anomalies.length)} tone={analyse.anomalies.length ? "warn" : "ok"} />
          </div>

          <div className="card overflow-hidden">
            <header className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-900">Anomalies détectées</header>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {analyse.anomalies.map((a, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-5 py-3 w-48">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${ANO_TONE[a.type] ?? "bg-slate-100 text-slate-700 ring-slate-200"}`}>
                        {LIBELLE[a.type] ?? a.type}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{a.detail}</td>
                  </tr>
                ))}
                {analyse.anomalies.length === 0 && <tr><td className="px-5 py-4 text-sm text-slate-400">Aucune anomalie.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {relances.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Relances — brouillons à valider avant envoi
          </h3>
          <div className="space-y-3">
            {relances.map((r) => (
              <div key={r.id} className="card p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-sm">
                    <span className="font-semibold text-slate-800">{r.tiers}</span>
                    <span className="text-slate-400"> · niveau {r.niveau} · {r.jours_retard} j · {fcfa(r.montant_du)}</span>
                  </div>
                  {r.statut === "BROUILLON" ? (
                    <div className="flex gap-2">
                      <button onClick={() => decider(r.id, "ENVOYER")} disabled={pending}
                        className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50">Envoyer</button>
                      <button onClick={() => decider(r.id, "ANNULER")} disabled={pending}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">Annuler</button>
                    </div>
                  ) : (
                    <span className={`text-xs font-medium ${r.statut === "ENVOYEE" ? "text-emerald-600" : "text-rose-600"}`}>{r.statut}</span>
                  )}
                </div>
                <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{r.message}</pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "ok" | "warn" }) {
  const accent = tone === "warn" ? "text-amber-600" : "text-slate-900";
  return (
    <div className="card p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-2 text-2xl font-bold tabular ${accent}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}
