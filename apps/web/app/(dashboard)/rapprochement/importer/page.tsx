import Link from "next/link";
import { listComptes } from "../../../../lib/api";
import { requireCtx } from "../../../../lib/session";
import { ImportForm } from "../../../../components/reconciliation/ImportForm";

export default async function Page() {
  const ctx = await requireCtx();
  const comptes = await listComptes(ctx);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-2 text-2xl font-bold">Importer grand livre + relevé (CSV)</h1>
      <p className="mb-6 text-sm text-gray-500">
        Voie déterministe pour tester avec vos propres fichiers. Pour un relevé
        PDF/image (extraction IA), utilisez plutôt{" "}
        <Link href="/rapprochement/nouveau" className="text-blue-700">l'upload</Link>.
      </p>
      {comptes.length === 0 ? (
        <p className="text-gray-500">Aucun compte bancaire configuré pour cette entreprise.</p>
      ) : (
        <ImportForm comptes={comptes} />
      )}
    </div>
  );
}
