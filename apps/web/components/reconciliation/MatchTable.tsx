"use client";

import { useState, useTransition } from "react";
import type { MatchOut } from "../../lib/api";
import { validerMatchAction } from "../../app/(dashboard)/rapprochement/actions";

const LIBELLE_ECART: Record<string, string> = {
  FRAIS_BANCAIRE: "Frais bancaires non comptabilisés",
  DOUBLON: "Doublon suspecté",
  CHEQUE_NON_DEBITE: "Chèque émis non débité",
  VIREMENT_NON_COMPTABILISE: "Encaissement non comptabilisé",
  ECART_MONTANT: "Écart de montant",
  AUTRE: "Écart à qualifier",
};

function Confidence({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const tone = score >= 0.9 ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : score >= 0.75 ? "bg-amber-50 text-amber-700 ring-amber-200"
    : "bg-rose-50 text-rose-700 ring-rose-200";
  return (
    <span className={`inline-flex w-12 justify-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${tone}`}>
      {pct}%
    </span>
  );
}

function StatutTag({ statut }: { statut: string }) {
  const map: Record<string, string> = {
    SUGGERE: "text-amber-600", VALIDE: "text-emerald-600",
    REJETE: "text-rose-600", CORRIGE: "text-sky-600",
  };
  return <span className={`text-xs font-medium ${map[statut] ?? "text-slate-500"}`}>{statut}</span>;
}

export function MatchTable({ matches, readOnly }: { matches: MatchOut[]; readOnly: boolean }) {
  const [rows, setRows] = useState(matches);
  const [pending, startTransition] = useTransition();

  function decide(id: string, decision: "VALIDE" | "REJETE") {
    startTransition(async () => {
      await validerMatchAction(id, decision);
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, statut: decision } : r)));
    });
  }

  const apparies = rows.filter((r) => !r.type_ecart);
  const ecarts = rows.filter((r) => r.type_ecart);

  return (
    <div className="space-y-6">
      <section className="card overflow-hidden">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Écritures rapprochées</h2>
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">{apparies.length}</span>
        </header>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-5 py-2.5 font-medium">Confiance</th>
              <th className="px-5 py-2.5 font-medium">Détail des scores</th>
              <th className="px-5 py-2.5 font-medium">Statut</th>
              {!readOnly && <th className="px-5 py-2.5 text-right font-medium">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {apparies.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50">
                <td className="px-5 py-3"><Confidence score={m.score_confiance} /></td>
                <td className="px-5 py-3 text-xs text-slate-500">
                  montant {Math.round(m.score_montant * 100)}% · date {Math.round(m.score_date * 100)}% · libellé {Math.round(m.score_libelle * 100)}%
                </td>
                <td className="px-5 py-3"><StatutTag statut={m.statut} /></td>
                {!readOnly && <td className="px-5 py-3 text-right"><Actions id={m.id} pending={pending} onDecide={decide} done={m.statut !== "SUGGERE"} /></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card overflow-hidden">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Écarts à instruire</h2>
          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">{ecarts.length}</span>
        </header>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-5 py-2.5 font-medium">Type d'écart</th>
              <th className="px-5 py-2.5 font-medium">Origine</th>
              <th className="px-5 py-2.5 font-medium">Statut</th>
              {!readOnly && <th className="px-5 py-2.5 text-right font-medium">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ecarts.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-800">{LIBELLE_ECART[m.type_ecart!] ?? m.type_ecart}</td>
                <td className="px-5 py-3 text-slate-500">{m.ligne_releve_id ? "Relevé bancaire" : "Grand livre"}</td>
                <td className="px-5 py-3"><StatutTag statut={m.statut} /></td>
                {!readOnly && <td className="px-5 py-3 text-right"><Actions id={m.id} pending={pending} onDecide={decide} done={m.statut !== "SUGGERE"} /></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Actions({
  id, pending, done, onDecide,
}: {
  id: string; pending: boolean; done: boolean; onDecide: (id: string, d: "VALIDE" | "REJETE") => void;
}) {
  if (done) return <span className="text-slate-300">—</span>;
  return (
    <div className="inline-flex gap-2">
      <button disabled={pending} onClick={() => onDecide(id, "VALIDE")}
        className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50">Valider</button>
      <button disabled={pending} onClick={() => onDecide(id, "REJETE")}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">Rejeter</button>
    </div>
  );
}
