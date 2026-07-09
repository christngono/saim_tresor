import Link from "next/link";
import { listRapprochements } from "../../../lib/api";
import { requireCtx } from "../../../lib/session";
import { PageHeader, Card, Badge, EmptyState, fcfa } from "../../../components/ui";
import { IconPlus, IconUpload } from "../../../components/ui/icons";

const STATUT: Record<string, "neutral" | "warning" | "positive" | "info"> = {
  BROUILLON: "neutral", EN_REVUE: "warning", VALIDE: "positive", EXPORTE: "info",
};

export default async function Page() {
  const ctx = await requireCtx();
  const raps = await listRapprochements(ctx);

  return (
    <>
      <PageHeader
        title="Rapprochements bancaires"
        description="Comparez votre grand livre (compte 521) à vos relevés."
        actions={
          <>
            <Link href="/rapprochement/importer" className="btn-primary"><IconPlus className="h-4 w-4" /> Importer CSV</Link>
            <Link href="/rapprochement/nouveau" className="btn-secondary"><IconUpload className="h-4 w-4" /> Upload relevé</Link>
          </>
        }
      />

      {raps.length === 0 ? (
        <EmptyState
          title="Aucun rapprochement"
          hint="Importez un grand livre et un relevé (CSV) pour lancer votre premier rapprochement."
          action={<Link href="/rapprochement/importer" className="btn-primary"><IconPlus className="h-4 w-4" /> Importer CSV</Link>}
        />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 font-medium">Période</th>
                <th className="px-5 py-3 font-medium">Statut</th>
                <th className="px-5 py-3 font-medium">Écarts</th>
                <th className="px-5 py-3 text-right font-medium">Écart de solde</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {raps.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3.5">
                    <Link href={`/rapprochement/${r.id}`} className="font-medium text-brand-700 hover:underline">
                      {r.periodeDebut} → {r.periodeFin}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5"><Badge tone={STATUT[r.statut] ?? "neutral"}>{r.statut}</Badge></td>
                  <td className="px-5 py-3.5 text-slate-600">{r.nbEcarts}</td>
                  <td className="px-5 py-3.5 text-right tabular text-slate-700">{fcfa(r.ecart)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
