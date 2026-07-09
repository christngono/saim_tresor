import { getRapprochement } from "../../../../lib/api";
import { requireCtx } from "../../../../lib/session";
import { MatchTable } from "../../../../components/reconciliation/MatchTable";
import { ActionsBar } from "../../../../components/reconciliation/ActionsBar";
import { PageHeader, StatCard, Badge, fcfa } from "../../../../components/ui";
import { IconAlert } from "../../../../components/ui/icons";

const STATUT: Record<string, "neutral" | "warning" | "positive" | "info"> = {
  BROUILLON: "neutral", EN_REVUE: "warning", VALIDE: "positive", EXPORTE: "info",
};

export default async function Page({ params }: { params: { id: string } }) {
  const ctx = await requireCtx();
  const rap = await getRapprochement(params.id, ctx);
  const readOnly = rap.statut === "VALIDE" || rap.statut === "EXPORTE";

  const apparies = rap.matches.filter((m) => !m.type_ecart);
  const ecarts = rap.matches.filter((m) => m.type_ecart);
  const restants = rap.matches.filter((m) => m.statut === "SUGGERE").length;
  const ecartNonNul = Number(rap.ecart) !== 0;

  return (
    <>
      <PageHeader
        title="Rapprochement bancaire"
        description={`Moteur ${rap.algo_version}`}
        actions={<><Badge tone={STATUT[rap.statut] ?? "neutral"}>{rap.statut}</Badge><ActionsBar id={rap.id} statut={rap.statut} /></>}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Solde relevé" value={fcfa(rap.solde_releve)} />
        <StatCard label="Solde comptable" value={fcfa(rap.solde_comptable)} />
        <StatCard label="Rapprochées auto" value={String(apparies.length)} tone="positive" />
        <StatCard label="Écarts à instruire" value={String(ecarts.length)} tone={ecarts.length ? "warning" : "neutral"} />
      </div>

      {restants > 0 && !readOnly && (
        <div className="mb-5 flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
          <IconAlert className="h-4 w-4 shrink-0" />
          {restants} élément(s) restent à revoir avant de pouvoir clôturer.
          {ecartNonNul && <span className="text-amber-600"> · Écart de solde restant : {fcfa(rap.ecart)}</span>}
        </div>
      )}

      <MatchTable matches={rap.matches} readOnly={readOnly} rapId={rap.id} />
    </>
  );
}
