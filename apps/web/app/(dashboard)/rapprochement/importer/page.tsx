import Link from "next/link";
import { listComptes } from "../../../../lib/api";
import { requireCtx } from "../../../../lib/session";
import { ImportForm } from "../../../../components/reconciliation/ImportForm";
import { PageHeader, EmptyState } from "../../../../components/ui";

export default async function Page() {
  const ctx = await requireCtx();
  const comptes = await listComptes(ctx);

  return (
    <>
      <PageHeader
        title="Importer grand livre + relevé"
        description="Voie déterministe (CSV) — testez avec vos propres fichiers. Pour un relevé PDF/image, utilisez l'upload IA."
      />
      {comptes.length === 0 ? (
        <EmptyState title="Aucun compte bancaire" hint="Configurez un compte pour cette entreprise." />
      ) : (
        <>
          <ImportForm comptes={comptes} />
          <p className="mt-4 text-sm text-slate-500">
            Besoin d'un relevé PDF/image ? <Link href="/rapprochement/nouveau" className="font-medium text-brand-700 hover:underline">Passer par l'upload IA</Link>.
          </p>
        </>
      )}
    </>
  );
}
