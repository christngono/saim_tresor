"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import type { CompteBancaire } from "../../lib/api";
import { uploadEtRunAction } from "../../app/(dashboard)/rapprochement/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className="rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50">
      {pending ? "Extraction & rapprochement en cours…" : "Importer et rapprocher"}
    </button>
  );
}

export function UploadForm({ comptes }: { comptes: CompteBancaire[] }) {
  const [fichier, setFichier] = useState<string>("");

  return (
    <form action={uploadEtRunAction} className="max-w-lg space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Compte bancaire</label>
        <select name="compte_bancaire_id" required
          className="w-full rounded border px-3 py-2 text-sm">
          {comptes.map((c) => (
            <option key={c.id} value={c.id}>{c.banque} — {c.intitule}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">
          Relevé bancaire (PDF, CSV ou image)
        </label>
        <input type="file" name="fichier" required accept=".pdf,.csv,.png,.jpg,.jpeg"
          onChange={(e) => setFichier(e.target.files?.[0]?.name ?? "")}
          className="w-full text-sm" />
        {fichier && <p className="mt-1 text-xs text-gray-500">{fichier}</p>}
      </div>

      <p className="text-xs text-gray-500">
        Le document est extrait par l'IA (Qwen2.5-VL / Groq), puis rapproché par le
        moteur déterministe. Vous validerez chaque écart avant tout export.
      </p>

      <SubmitButton />
    </form>
  );
}
