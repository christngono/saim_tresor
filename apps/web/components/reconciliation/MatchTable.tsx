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

function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const tone =
    score >= 0.9 ? "bg-green-100 text-green-800"
      : score >= 0.75 ? "bg-amber-100 text-amber-800"
        : "bg-red-100 text-red-800";
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${tone}`}>{pct}%</span>;
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
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-lg font-semibold">Écritures rapprochées ({apparies.length})</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500">
            <tr>
              <th className="py-2">Confiance</th>
              <th>Détail des scores</th>
              <th>Statut</th>
              {!readOnly && <th className="text-right">Action</th>}
            </tr>
          </thead>
          <tbody>
            {apparies.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="py-2"><ConfidenceBadge score={m.score_confiance} /></td>
                <td className="text-gray-600">
                  montant {Math.round(m.score_montant * 100)}% · date {Math.round(m.score_date * 100)}%
                  {" · "}libellé {Math.round(m.score_libelle * 100)}%
                </td>
                <td><StatutTag statut={m.statut} /></td>
                {!readOnly && (
                  <td className="text-right">
                    <ActionButtons id={m.id} pending={pending} onDecide={decide}
                      done={m.statut !== "SUGGERE"} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Écarts à instruire ({ecarts.length})</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500">
            <tr>
              <th className="py-2">Type d'écart</th>
              <th>Origine</th>
              <th>Statut</th>
              {!readOnly && <th className="text-right">Action</th>}
            </tr>
          </thead>
          <tbody>
            {ecarts.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="py-2 font-medium">{LIBELLE_ECART[m.type_ecart!] ?? m.type_ecart}</td>
                <td className="text-gray-600">{m.ligne_releve_id ? "Relevé bancaire" : "Grand livre"}</td>
                <td><StatutTag statut={m.statut} /></td>
                {!readOnly && (
                  <td className="text-right">
                    <ActionButtons id={m.id} pending={pending} onDecide={decide}
                      done={m.statut !== "SUGGERE"} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function StatutTag({ statut }: { statut: string }) {
  const map: Record<string, string> = {
    SUGGERE: "text-amber-700", VALIDE: "text-green-700",
    REJETE: "text-red-700", CORRIGE: "text-blue-700",
  };
  return <span className={map[statut] ?? ""}>{statut}</span>;
}

function ActionButtons({
  id, pending, done, onDecide,
}: {
  id: string; pending: boolean; done: boolean;
  onDecide: (id: string, d: "VALIDE" | "REJETE") => void;
}) {
  if (done) return <span className="text-gray-400">—</span>;
  return (
    <div className="inline-flex gap-2">
      <button disabled={pending} onClick={() => onDecide(id, "VALIDE")}
        className="rounded bg-green-600 px-3 py-1 text-white disabled:opacity-50">Valider</button>
      <button disabled={pending} onClick={() => onDecide(id, "REJETE")}
        className="rounded border border-red-300 px-3 py-1 text-red-700 disabled:opacity-50">Rejeter</button>
    </div>
  );
}
