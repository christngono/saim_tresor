import Link from "next/link";
import { getTFT, forecastTresorerie } from "../../../../lib/api";
import { requireCtx } from "../../../../lib/session";
import { TFTView } from "../../../../components/cashflow/TFTView";
import { ForecastView } from "../../../../components/cashflow/ForecastView";
import { TFTActionsBar } from "../../../../components/cashflow/TFTActionsBar";
import { PageHeader, Badge } from "../../../../components/ui";
import { IconAlert } from "../../../../components/ui/icons";

const STATUT: Record<string, "neutral" | "warning" | "positive" | "info"> = {
  BROUILLON: "neutral", EN_REVUE: "warning", VALIDE: "positive", EXPORTE: "info",
};

export default async function Page({ params }: { params: { id: string } }) {
  const ctx = await requireCtx();
  const tft = await getTFT(ctx, params.id);

  // Prévisionnel : part de la trésorerie de clôture du TFT, à la date de fin de période.
  let forecast = null;
  try {
    forecast = await forecastTresorerie(ctx, {
      date_reference: tft.periode_fin,
      solde_initial: String(tft.donnees.tresorerie_cloture),
      seuil_alerte: "0",
    });
  } catch {
    forecast = null; // pas de factures en base → pas de prévisionnel
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tableau des flux de trésorerie"
        description={`${tft.periode_debut} → ${tft.periode_fin} · moteur ${tft.algo_version}`}
        actions={<><Badge tone={STATUT[tft.statut] ?? "neutral"}>{tft.statut}</Badge><TFTActionsBar id={tft.id} statut={tft.statut} /></>}
      />

      {!tft.donnees.equilibre && (
        <div className="flex items-start gap-2 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-inset ring-rose-200">
          <IconAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>Livres déséquilibrés</strong> : le contrôle ne tombe pas à 0 (écart de{" "}
            {tft.donnees.controle}). Vérifiez que votre grand livre est complet et en partie double
            (Σ débits = Σ crédits). Le TFT est affiché mais ne doit pas être exporté en l'état.
          </span>
        </div>
      )}

      <TFTView tft={tft} />
      {forecast && <ForecastView f={forecast} />}

      <p className="text-sm text-slate-500">
        <Link href="/tft" className="font-medium text-brand-700 hover:underline">← Tous les TFT</Link>
      </p>
    </div>
  );
}
