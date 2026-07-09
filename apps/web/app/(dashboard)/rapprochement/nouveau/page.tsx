import { listComptes } from "../../../../lib/api";
import { requireCtx } from "../../../../lib/session";
import { UploadForm } from "../../../../components/reconciliation/UploadForm";
import { PageHeader, EmptyState } from "../../../../components/ui";

export default async function Page() {
  const ctx = await requireCtx();
  const comptes = await listComptes(ctx);

  return (
    <>
      <PageHeader title="Upload d'un relevé (extraction IA)"
        description="Importez un relevé PDF, CSV ou image — extrait par l'IA puis rapproché." />
      {comptes.length === 0 ? (
        <EmptyState title="Aucun compte bancaire" hint="Configurez un compte pour cette entreprise." />
      ) : (
        <UploadForm comptes={comptes} />
      )}
    </>
  );
}
