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

export function AnalysePanel({ dateReference }: { dateReference: string }) {
  const [analyse, setAnalyse] = useState<Analyse | null>(null);
  const [relances, setRelances] = useState<RelanceItem[]>([]);
  const [pending, start] = useTransition();

  function lancer() {
    start(async () => {
      setAnalyse(await analyserAction(dateReference));
      const r = await genererRelancesAction(dateReference);
      setRelances(r.relances);
    });
  }

  function decider(id: string, decision: "ENVOYER" | "ANNULER") {
    start(async () => {
      await validerRelanceAction(id, decision);
      setRelances((rs) => rs.map((r) => r.id === id
        ? { ...r, statut: decision === "ENVOYER" ? "ENVOYEE" : "ANNULEE" } : r));
    });
  }

  return (
    <div className="space-y-6">
      <button onClick={lancer} disabled={pending}
        className="rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50">
        {pending ? "Analyse en cours…" : "Analyser (DSO, anomalies, relances)"}
      </button>

      {analyse && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Kpi label="DSO" value={`${analyse.dso.dso_jours} j`} highlight={Number(analyse.dso.dso_jours) > 60} />
            <Kpi label="Encours créances" value={fcfa(analyse.dso.encours_creances_ttc)} />
            <Kpi label="Anomalies détectées" value={String(analyse.anomalies.length)}
              highlight={analyse.anomalies.length > 0} />
          </div>

          <section>
            <h2 className="mb-2 text-lg font-semibold">Anomalies</h2>
            <table className="w-full text-sm">
              <thead className="text-left text-gray-500"><tr><th className="py-1">Type</th><th>Détail</th></tr></thead>
              <tbody>
                {analyse.anomalies.map((a, i) => (
                  <tr key={i} className="border-t">
                    <td className="py-1.5 font-medium">{LIBELLE[a.type] ?? a.type}</td>
                    <td className="text-gray-600">{a.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      {relances.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Relances (brouillons — à valider avant envoi)</h2>
          <div className="space-y-3">
            {relances.map((r) => (
              <div key={r.id} className="rounded-lg border p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm">
                    <span className="font-medium">{r.tiers}</span> · niveau {r.niveau} ·{" "}
                    {r.jours_retard} j de retard · {fcfa(r.montant_du)}
                  </div>
                  {r.statut === "BROUILLON" ? (
                    <div className="flex gap-2">
                      <button onClick={() => decider(r.id, "ENVOYER")} disabled={pending}
                        className="rounded bg-green-600 px-3 py-1 text-xs text-white disabled:opacity-50">Envoyer</button>
                      <button onClick={() => decider(r.id, "ANNULER")} disabled={pending}
                        className="rounded border border-red-300 px-3 py-1 text-xs text-red-700 disabled:opacity-50">Annuler</button>
                    </div>
                  ) : (
                    <span className={`text-xs ${r.statut === "ENVOYEE" ? "text-green-700" : "text-red-700"}`}>{r.statut}</span>
                  )}
                </div>
                <pre className="whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs text-gray-700">{r.message}</pre>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? "border-amber-300 bg-amber-50" : ""}`}>
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
