import Link from "next/link";
import { listTFTs } from "../../../lib/api";
import { requireCtx } from "../../../lib/session";
import { PageHeader, Card, Badge, EmptyState, fcfa } from "../../../components/ui";
import { IconPlus } from "../../../components/ui/icons";

const STATUT: Record<string, "neutral" | "warning" | "positive" | "info"> = {
  BROUILLON: "neutral", EN_REVUE: "warning", VALIDE: "positive", EXPORTE: "info",
};

export default async function Page() {
  const ctx = await requireCtx();
  const tfts = await listTFTs(ctx);

  return (
    <>
      <PageHeader
        title="Flux de trésorerie (TFT)"
        description="Tableaux des flux SYSCOHADA générés à partir de votre grand livre."
        actions={
          <Link href="/tft/importer" className="btn-primary">
            <IconPlus className="h-4 w-4" /> Importer un grand livre
          </Link>
        }
      />

      {tfts.length === 0 ? (
        <EmptyState
          title="Aucun TFT généré"
          hint="Importez votre grand livre complet (classes 1 à 7) et indiquez la trésorerie d'ouverture pour générer votre premier tableau des flux."
          action={<Link href="/tft/importer" className="btn-primary"><IconPlus className="h-4 w-4" /> Importer un grand livre</Link>}
        />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 font-medium">Période</th>
                <th className="px-5 py-3 font-medium">Méthode</th>
                <th className="px-5 py-3 font-medium">Contrôle</th>
                <th className="px-5 py-3 font-medium">Statut</th>
                <th className="px-5 py-3 text-right font-medium">Variation</th>
                <th className="px-5 py-3 text-right font-medium">Trésorerie clôture</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tfts.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3.5">
                    <Link href={`/tft/${t.id}`} className="font-medium text-brand-700 hover:underline">
                      {t.periodeDebut} → {t.periodeFin}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">{t.methode === "DIRECTE" ? "Directe" : "Indirecte"}</td>
                  <td className="px-5 py-3.5">
                    <Badge tone={t.equilibre ? "positive" : "negative"}>
                      {t.equilibre ? "Équilibré" : "Déséquilibré"}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5"><Badge tone={STATUT[t.statut] ?? "neutral"}>{t.statut}</Badge></td>
                  <td className={`px-5 py-3.5 text-right tabular ${Number(t.variation) < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                    {t.variation !== null ? fcfa(t.variation) : "—"}
                  </td>
                  <td className="px-5 py-3.5 text-right tabular font-medium text-slate-800">
                    {t.tresorerieCloture !== null ? fcfa(t.tresorerieCloture) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
