import Link from "next/link";
import { listComptes, listRapprochements } from "../../../lib/api";
import { requireCtx } from "../../../lib/session";
import { PageHeader, StatCard, Card, SectionTitle, Badge, EmptyState, ButtonLink } from "../../../components/ui";
import { IconTresorerie, IconRapprochement, IconAlert, IconPlus } from "../../../components/ui/icons";

const STATUT: Record<string, "neutral" | "warning" | "positive" | "info"> = {
  BROUILLON: "neutral", EN_REVUE: "warning", VALIDE: "positive", EXPORTE: "info",
};

export default async function Page() {
  const ctx = await requireCtx();
  const [comptes, raps] = await Promise.all([listComptes(ctx), listRapprochements(ctx)]);
  const aInstruire = raps.filter((r) => r.statut === "EN_REVUE").length;
  const ecartsOuverts = raps.filter((r) => r.statut === "EN_REVUE").reduce((s, r) => s + r.nbEcarts, 0);

  return (
    <>
      <PageHeader
        title="Vue d'ensemble trésorerie"
        description="Pilotage de la trésorerie, conforme SYSCOHADA révisé."
        actions={<ButtonLink href="/rapprochement/importer"><IconPlus className="h-4 w-4" /> Nouveau rapprochement</ButtonLink>}
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Comptes bancaires" value={String(comptes.length)} tone="brand" icon={<IconTresorerie />} />
        <StatCard label="À instruire" value={String(aInstruire)} tone={aInstruire ? "warning" : "neutral"}
          hint="rapprochements en revue" icon={<IconRapprochement />} />
        <StatCard label="Écarts ouverts" value={String(ecartsOuverts)} tone={ecartsOuverts ? "negative" : "neutral"}
          hint="à valider par un humain" icon={<IconAlert />} />
      </div>

      <div className="mb-8">
        <SectionTitle>Comptes bancaires</SectionTitle>
        {comptes.length === 0 ? (
          <EmptyState title="Aucun compte bancaire" hint="Configurez un compte pour démarrer un rapprochement." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {comptes.map((c) => (
              <Card key={c.id} className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-slate-900">{c.banque}</div>
                    <div className="text-sm text-slate-500">{c.intitule}</div>
                  </div>
                  <Badge tone="neutral">{c.devise}</Badge>
                </div>
                <div className="mt-3 font-mono text-xs text-slate-400">{c.numeroCompte}</div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle>Rapprochements récents</SectionTitle>
          <Link href="/rapprochement" className="text-sm font-medium text-brand-700 hover:underline">Tout voir →</Link>
        </div>
        <Card>
          {raps.length === 0 ? (
            <p className="p-6 text-sm text-slate-400">Aucun rapprochement pour le moment.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {raps.slice(0, 5).map((r) => (
                <li key={r.id}>
                  <Link href={`/rapprochement/${r.id}`} className="flex items-center justify-between px-5 py-3.5 text-sm hover:bg-slate-50">
                    <span className="font-medium text-slate-700">{r.periodeDebut} → {r.periodeFin}</span>
                    <span className="flex items-center gap-3">
                      <span className="text-slate-400">{r.nbEcarts} écart(s)</span>
                      <Badge tone={STATUT[r.statut] ?? "neutral"}>{r.statut}</Badge>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
