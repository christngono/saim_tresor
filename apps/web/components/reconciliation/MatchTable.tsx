"use client";

import { useState, useTransition } from "react";
import type { MatchOut, LigneReleveOut, EcritureOut } from "../../lib/api";
import { validerMatchAction } from "../../app/(dashboard)/rapprochement/actions";

const LIBELLE_ECART: Record<string, string> = {
  FRAIS_BANCAIRE: "Frais bancaires non comptabilisés",
  DOUBLON: "Doublon suspecté",
  CHEQUE_NON_DEBITE: "Chèque émis non débité",
  VIREMENT_NON_COMPTABILISE: "Encaissement non comptabilisé",
  ECART_MONTANT: "Écart de montant",
  AUTRE: "Écart à qualifier",
};

const nf = new Intl.NumberFormat("fr-FR");
function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function montantOf(m: MatchOut): { montant: string; sens: "ENTREE" | "SORTIE" } | null {
  const p = m.releve ?? m.ecriture;
  return p ? { montant: p.montant, sens: p.sens } : null;
}
function libelleOf(m: MatchOut): string {
  return (m.releve ?? m.ecriture)?.libelle ?? "—";
}
function dateOf(m: MatchOut): string {
  return fmtDate(m.releve?.date_operation ?? m.ecriture?.date_ecriture ?? null);
}

function Montant({ montant, sens }: { montant: string; sens: "ENTREE" | "SORTIE" }) {
  const entree = sens === "ENTREE";
  return (
    <span className={`inline-flex items-center gap-1 tabular font-medium ${entree ? "text-emerald-600" : "text-rose-600"}`}>
      <span aria-hidden>{entree ? "↑" : "↓"}</span>
      {nf.format(Math.abs(Number(montant)))}
    </span>
  );
}

function Confidence({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const tone = score >= 0.9 ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : score >= 0.75 ? "bg-amber-50 text-amber-700 ring-amber-200"
    : "bg-rose-50 text-rose-700 ring-rose-200";
  return <span className={`inline-flex w-11 justify-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${tone}`}>{pct}%</span>;
}

function StatutTag({ statut }: { statut: string }) {
  const map: Record<string, string> = {
    SUGGERE: "text-amber-600", VALIDE: "text-emerald-600", REJETE: "text-rose-600", CORRIGE: "text-sky-600",
  };
  const lib: Record<string, string> = { SUGGERE: "Suggéré", VALIDE: "Validé", REJETE: "Rejeté", CORRIGE: "Corrigé" };
  return <span className={`text-xs font-medium ${map[statut] ?? "text-slate-500"}`}>{lib[statut] ?? statut}</span>;
}

export function MatchTable({ matches, readOnly, rapId }: { matches: MatchOut[]; readOnly: boolean; rapId: string }) {
  const [selected, setSelected] = useState<MatchOut | null>(null);
  const [pending, start] = useTransition();

  function decide(id: string, decision: "VALIDE" | "REJETE") {
    start(async () => { await validerMatchAction(id, decision, rapId); });
  }

  const apparies = matches.filter((m) => !m.type_ecart);
  const ecarts = matches.filter((m) => m.type_ecart);

  const Actions = ({ m }: { m: MatchOut }) => (
    <div className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      {!readOnly && m.statut === "SUGGERE" ? (
        <>
          <button disabled={pending} onClick={() => decide(m.id, "VALIDE")}
            className="rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50">Valider</button>
          <button disabled={pending} onClick={() => decide(m.id, "REJETE")}
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">Rejeter</button>
        </>
      ) : null}
      <button onClick={() => setSelected(m)}
        className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50">Détail</button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Rapprochées */}
      <section className="card overflow-hidden">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Écritures rapprochées</h2>
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">{apparies.length}</span>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-2.5 font-medium">Date</th>
                <th className="px-5 py-2.5 font-medium">Libellé (relevé)</th>
                <th className="px-5 py-2.5 font-medium">Montant</th>
                <th className="px-5 py-2.5 font-medium">Contrepartie (grand livre)</th>
                <th className="px-5 py-2.5 font-medium">Confiance</th>
                <th className="px-5 py-2.5 font-medium">Statut</th>
                <th className="px-5 py-2.5 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {apparies.map((m) => {
                const mo = montantOf(m);
                return (
                  <tr key={m.id} onClick={() => setSelected(m)} className="cursor-pointer hover:bg-slate-50">
                    <td className="px-5 py-3 whitespace-nowrap text-slate-600">{dateOf(m)}</td>
                    <td className="px-5 py-3 text-slate-800">{libelleOf(m)}</td>
                    <td className="px-5 py-3 whitespace-nowrap">{mo && <Montant {...mo} />}</td>
                    <td className="px-5 py-3 text-slate-600">
                      {m.ecriture ? m.ecriture.libelle : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Confidence score={m.score_confiance} />
                        <span className="text-xs text-slate-400">{m.explication}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3"><StatutTag statut={m.statut} /></td>
                    <td className="px-5 py-3 text-right"><Actions m={m} /></td>
                  </tr>
                );
              })}
              {apparies.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-4 text-sm text-slate-400">Aucune écriture rapprochée automatiquement.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Écarts à instruire */}
      <section className="card overflow-hidden">
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Écarts à instruire</h2>
          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">{ecarts.length}</span>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-2.5 font-medium">Date</th>
                <th className="px-5 py-2.5 font-medium">Libellé</th>
                <th className="px-5 py-2.5 font-medium">Montant</th>
                <th className="px-5 py-2.5 font-medium">Origine</th>
                <th className="px-5 py-2.5 font-medium">Motif</th>
                <th className="px-5 py-2.5 font-medium">Statut</th>
                <th className="px-5 py-2.5 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ecarts.map((m) => {
                const mo = montantOf(m);
                return (
                  <tr key={m.id} onClick={() => setSelected(m)} className="cursor-pointer hover:bg-slate-50">
                    <td className="px-5 py-3 whitespace-nowrap text-slate-600">{dateOf(m)}</td>
                    <td className="px-5 py-3 text-slate-800">{libelleOf(m)}</td>
                    <td className="px-5 py-3 whitespace-nowrap">{mo && <Montant {...mo} />}</td>
                    <td className="px-5 py-3 text-slate-500">{m.releve ? "Relevé" : "Grand livre"}</td>
                    <td className="px-5 py-3 font-medium text-slate-700">{LIBELLE_ECART[m.type_ecart!] ?? m.type_ecart}</td>
                    <td className="px-5 py-3"><StatutTag statut={m.statut} /></td>
                    <td className="px-5 py-3 text-right"><Actions m={m} /></td>
                  </tr>
                );
              })}
              {ecarts.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-4 text-sm text-slate-400">Aucun écart.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected && <DetailPanel match={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

// ── Panneau latéral : les deux écritures côte à côte ──
function LigneCard({ titre, rows, vide }: { titre: string; rows?: [string, React.ReactNode][]; vide?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{titre}</div>
      {vide ? (
        <p className="text-sm text-slate-400">{vide}</p>
      ) : (
        <dl className="space-y-1.5 text-sm">
          {rows!.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="text-slate-500">{k}</dt>
              <dd className="text-right font-medium text-slate-800">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function DetailPanel({ match, onClose }: { match: MatchOut; onClose: () => void }) {
  const r = match.releve;
  const e = match.ecriture;
  const relRows: [string, React.ReactNode][] | undefined = r ? [
    ["Date opération", fmtDate(r.date_operation)],
    ["Date valeur", fmtDate(r.date_valeur)],
    ["Libellé", r.libelle],
    ["Référence", r.reference ?? "—"],
    ["Montant", <Montant montant={r.montant} sens={r.sens} />],
  ] : undefined;
  const ecrRows: [string, React.ReactNode][] | undefined = e ? [
    ["Date écriture", fmtDate(e.date_ecriture)],
    ["Journal / Pièce", `${e.journal} / ${e.piece ?? "—"}`],
    ["Libellé", e.libelle],
    ["Montant", <Montant montant={e.montant} sens={e.sens} />],
  ] : undefined;

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-[28rem] max-w-full flex-col bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="font-semibold text-slate-900">Détail de l'opération</h3>
            <p className="text-xs text-slate-500">{match.type_ecart ? (LIBELLE_ECART[match.type_ecart] ?? match.type_ecart) : "Écriture rapprochée"}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Fermer">✕</button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <LigneCard titre="Relevé bancaire" rows={relRows} vide={r ? undefined : "Aucune ligne de relevé"} />
          <LigneCard titre="Grand livre (contrepartie)" rows={ecrRows} vide={e ? undefined : "Aucune écriture correspondante"} />

          <div className="rounded-lg border border-slate-200 p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Comparaison</div>
            {r && e ? (
              <div className="space-y-1.5 text-sm">
                <Critere ok={match.score_montant >= 0.98} label={match.score_montant >= 0.98 ? "Montant identique" : "Montant différent"} />
                <Critere ok={(match.ecart_jours ?? 99) <= 3} label={match.ecart_jours === 0 ? "Même date" : `Écart de ${match.ecart_jours} jour(s)`} />
                <Critere ok={match.score_libelle >= 0.7} label={`Libellé ${Math.round(match.score_libelle * 100)}% similaire`} />
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-sm font-medium text-slate-700">Confiance globale</span>
                  <Confidence score={match.score_confiance} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Aucune contrepartie trouvée au même montant dans la période. Motif retenu :{" "}
                <span className="font-medium text-slate-700">{LIBELLE_ECART[match.type_ecart!] ?? match.type_ecart}</span>.
              </p>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function Critere({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={ok ? "text-emerald-600" : "text-rose-500"}>{ok ? "✓" : "✕"}</span>
      <span className="text-slate-700">{label}</span>
    </div>
  );
}
