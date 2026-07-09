import type { TFTOut } from "../../lib/api";

function fcfa(v: string | number) {
  return new Intl.NumberFormat("fr-FR").format(Number(v)) + " FCFA";
}

function Row({ label, value, bold, indent }: { label: string; value: string; bold?: boolean; indent?: boolean }) {
  const neg = Number(value) < 0;
  return (
    <div className={`flex items-center justify-between border-b border-slate-100 py-2 last:border-0 ${bold ? "font-semibold text-slate-900" : ""} ${indent ? "pl-5 text-sm text-slate-500" : ""}`}>
      <span>{label}</span>
      <span className={`tabular ${neg ? "text-rose-600" : bold ? "" : "text-slate-700"}`}>{fcfa(value)}</span>
    </div>
  );
}

export function TFTView({ tft }: { tft: TFTOut }) {
  const d = tft.donnees;
  return (
    <div className="card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Tableau des flux — {d.norme} ({d.methode})</h2>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${d.equilibre ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-rose-200"}`}>
          {d.equilibre ? "Équilibré · contrôle = 0" : `Écart : ${fcfa(d.controle)}`}
        </span>
      </div>

      <Row label="FTAO — Flux opérationnels" value={d.flux_operationnel.total} bold />
      <Row label="Résultat net" value={d.flux_operationnel.resultat_net} indent />
      <Row label="Dotations amort./prov." value={d.flux_operationnel.dotations_amortissements_provisions} indent />
      <Row label="Variation du BFR" value={d.flux_operationnel.variation_bfr} indent />
      <Row label="FTAI — Flux d'investissement" value={d.flux_investissement.total} bold />
      <Row label="FTAF — Flux de financement" value={d.flux_financement.total} bold />

      <div className="mt-3 rounded-lg bg-slate-50 p-4">
        <Row label="Variation de trésorerie" value={d.variation_tresorerie} bold />
        <Row label="Trésorerie d'ouverture" value={d.tresorerie_ouverture} indent />
        <Row label="Trésorerie de clôture" value={d.tresorerie_cloture} bold />
      </div>
    </div>
  );
}
