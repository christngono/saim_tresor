import type { TFTOut } from "../../lib/api";

function fcfa(v: string | number) {
  return new Intl.NumberFormat("fr-FR").format(Number(v)) + " FCFA";
}

function Ligne({ label, value, bold, indent }: { label: string; value: string; bold?: boolean; indent?: boolean }) {
  const neg = Number(value) < 0;
  return (
    <div className={`flex justify-between border-b py-1.5 ${bold ? "font-semibold" : ""} ${indent ? "pl-4 text-gray-600" : ""}`}>
      <span>{label}</span>
      <span className={neg ? "text-red-600" : ""}>{fcfa(value)}</span>
    </div>
  );
}

export function TFTView({ tft }: { tft: TFTOut }) {
  const d = tft.donnees;
  return (
    <div className="rounded-lg border p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          TFT — {d.norme} ({d.methode})
        </h2>
        <span className={`rounded px-2 py-0.5 text-xs ${d.equilibre ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          {d.equilibre ? "Équilibré (contrôle = 0)" : `Écart de contrôle : ${fcfa(d.controle)}`}
        </span>
      </div>

      <Ligne label="FTAO — Flux opérationnels" value={d.flux_operationnel.total} bold />
      <Ligne label="Résultat net" value={d.flux_operationnel.resultat_net} indent />
      <Ligne label="Dotations amort./prov." value={d.flux_operationnel.dotations_amortissements_provisions} indent />
      <Ligne label="Variation du BFR" value={d.flux_operationnel.variation_bfr} indent />

      <Ligne label="FTAI — Flux d'investissement" value={d.flux_investissement.total} bold />
      <Ligne label="FTAF — Flux de financement" value={d.flux_financement.total} bold />

      <div className="mt-3 border-t-2 pt-2">
        <Ligne label="Variation de trésorerie" value={d.variation_tresorerie} bold />
        <Ligne label="Trésorerie d'ouverture" value={d.tresorerie_ouverture} indent />
        <Ligne label="Trésorerie de clôture" value={d.tresorerie_cloture} bold />
      </div>
    </div>
  );
}
