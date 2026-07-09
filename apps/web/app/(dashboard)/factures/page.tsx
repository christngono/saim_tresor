import { listFactures } from "../../../lib/api";
import { requireCtx } from "../../../lib/session";
import { AnalysePanel } from "../../../components/invoicing/AnalysePanel";
import { PageHeader, Card, SectionTitle, Badge, fcfa } from "../../../components/ui";

const STATUT: Record<string, "neutral" | "warning" | "positive" | "negative"> = {
  EMISE: "neutral", PARTIELLE: "warning", PAYEE: "positive", EN_RETARD: "negative", LITIGE: "negative",
};

const DATE_REF = "2026-07-08";

export default async function Page() {
  const ctx = await requireCtx();
  const factures = await listFactures(ctx);

  return (
    <>
      <PageHeader title="Factures & DSO" description="Anomalies, délai de paiement (DSO) et relances de créances." />

      <div className="mb-8">
        <AnalysePanel dateReference={DATE_REF} />
      </div>

      <SectionTitle>Toutes les factures ({factures.length})</SectionTitle>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-5 py-3 font-medium">Sens</th>
              <th className="px-5 py-3 font-medium">Numéro</th>
              <th className="px-5 py-3 font-medium">Tiers</th>
              <th className="px-5 py-3 font-medium">Échéance</th>
              <th className="px-5 py-3 font-medium">Statut</th>
              <th className="px-5 py-3 text-right font-medium">Reste dû</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {factures.map((f) => (
              <tr key={f.id} className="hover:bg-slate-50">
                <td className="px-5 py-3">
                  <Badge tone={f.sens === "CLIENT" ? "info" : "neutral"}>{f.sens === "CLIENT" ? "Client" : "Fourn."}</Badge>
                </td>
                <td className="px-5 py-3 font-medium text-slate-700">{f.numero}</td>
                <td className="px-5 py-3 text-slate-600">{f.tiers}</td>
                <td className="px-5 py-3 text-slate-600">{f.dateEcheance}</td>
                <td className="px-5 py-3"><Badge tone={STATUT[f.statut] ?? "neutral"}>{f.statut}</Badge></td>
                <td className="px-5 py-3 text-right tabular text-slate-700">{fcfa(f.resteAPayer)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
