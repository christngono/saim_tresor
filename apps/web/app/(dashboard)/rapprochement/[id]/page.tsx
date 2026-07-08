import { getRapprochement } from "../../../../lib/api";
import { requireCtx } from "../../../../lib/session";
import { MatchTable } from "../../../../components/reconciliation/MatchTable";
import { ActionsBar } from "../../../../components/reconciliation/ActionsBar";

function fcfa(v: string) {
  return new Intl.NumberFormat("fr-FR").format(Number(v)) + " FCFA";
}

export default async function Page({ params }: { params: { id: string } }) {
  const ctx = await requireCtx();
  const rap = await getRapprochement(params.id, ctx);
  const readOnly = rap.statut === "VALIDE" || rap.statut === "EXPORTE";
  const restants = rap.matches.filter((m) => m.statut === "SUGGERE").length;

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rapprochement bancaire</h1>
          <p className="text-sm text-gray-500">Moteur {rap.algo_version} · statut {rap.statut}</p>
        </div>
        <ActionsBar id={rap.id} statut={rap.statut} />
      </header>

      <div className="mb-8 grid grid-cols-3 gap-4">
        <Kpi label="Solde relevé" value={fcfa(rap.solde_releve)} />
        <Kpi label="Solde comptable" value={fcfa(rap.solde_comptable)} />
        <Kpi label="Écart" value={fcfa(rap.ecart)} highlight={Number(rap.ecart) !== 0} />
      </div>

      {restants > 0 && !readOnly && (
        <p className="mb-4 rounded bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {restants} élément(s) restent à revoir avant de pouvoir clôturer.
        </p>
      )}

      <MatchTable matches={rap.matches} readOnly={readOnly} />
    </div>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? "border-amber-300 bg-amber-50" : ""}`}>
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
