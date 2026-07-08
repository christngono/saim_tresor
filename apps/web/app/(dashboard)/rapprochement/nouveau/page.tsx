import { listComptes } from "../../../../lib/api";
import { requireCtx } from "../../../../lib/session";
import { UploadForm } from "../../../../components/reconciliation/UploadForm";

export default async function Page() {
  const ctx = await requireCtx();
  const comptes = await listComptes(ctx);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-6 text-2xl font-bold">Nouveau rapprochement</h1>
      {comptes.length === 0 ? (
        <p className="text-gray-500">Aucun compte bancaire configuré pour cette entreprise.</p>
      ) : (
        <UploadForm comptes={comptes} />
      )}
    </div>
  );
}
