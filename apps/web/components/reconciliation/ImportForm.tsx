"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import type { CompteBancaire } from "../../lib/api";
import { importerEtRapprocherAction } from "../../app/(dashboard)/rapprochement/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className="rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50">
      {pending ? "Import & rapprochement…" : "Importer et rapprocher"}
    </button>
  );
}

export function ImportForm({ comptes }: { comptes: CompteBancaire[] }) {
  const [gl, setGl] = useState("");
  const [rv, setRv] = useState("");

  return (
    <form action={importerEtRapprocherAction} className="max-w-lg space-y-5">
      <div>
        <label className="mb-1 block text-sm font-medium">Compte bancaire</label>
        <select name="compte_bancaire_id" required className="w-full rounded border px-3 py-2 text-sm">
          {comptes.map((c) => (
            <option key={c.id} value={c.id}>{c.banque} — {c.intitule}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">
          Grand livre (CSV — compte 521)
        </label>
        <input type="file" name="grand_livre" accept=".csv" required
          onChange={(e) => setGl(e.target.files?.[0]?.name ?? "")} className="w-full text-sm" />
        <p className="mt-1 text-xs text-gray-500">
          Colonnes : date_ecriture, journal, piece, compte, libelle, debit, credit. {gl}
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Relevé bancaire (CSV)</label>
        <input type="file" name="releve" accept=".csv" required
          onChange={(e) => setRv(e.target.files?.[0]?.name ?? "")} className="w-full text-sm" />
        <p className="mt-1 text-xs text-gray-500">
          Colonnes : date_operation, date_valeur, libelle, reference, debit, credit. {rv}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Solde initial du relevé</label>
          <input name="solde_initial" type="number" step="0.01" defaultValue="0"
            className="w-full rounded border px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Solde final du relevé</label>
          <input name="solde_final" type="number" step="0.01" required
            className="w-full rounded border px-3 py-2 text-sm" />
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Import 100 % déterministe (ni IA, ni stockage). Le rapprochement se lance
        automatiquement ; vous validerez ensuite chaque écart.
      </p>
      <SubmitButton />
    </form>
  );
}
