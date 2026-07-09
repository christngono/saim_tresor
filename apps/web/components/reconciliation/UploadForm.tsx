"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import type { CompteBancaire } from "../../lib/api";
import { uploadEtRunAction } from "../../app/(dashboard)/rapprochement/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full">
      {pending ? "Extraction & rapprochement…" : "Importer et rapprocher"}
    </button>
  );
}

export function UploadForm({ comptes }: { comptes: CompteBancaire[] }) {
  const [fichier, setFichier] = useState("");
  return (
    <form action={uploadEtRunAction} className="card max-w-xl space-y-5 p-6">
      <div>
        <label className="label">Compte bancaire</label>
        <select name="compte_bancaire_id" required className="input">
          {comptes.map((c) => <option key={c.id} value={c.id}>{c.banque} — {c.intitule}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Relevé bancaire (PDF, CSV ou image)</label>
        <label className="flex cursor-pointer items-center justify-between rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500 hover:border-brand-400 hover:bg-brand-50/40">
          <span>{fichier || "Choisir un fichier…"}</span>
          <span className="rounded-md bg-white px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">Parcourir</span>
          <input type="file" name="fichier" required accept=".pdf,.csv,.png,.jpg,.jpeg" className="hidden"
            onChange={(e) => setFichier(e.target.files?.[0]?.name ?? "")} />
        </label>
      </div>
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
        Le document est extrait par l'IA (Qwen2.5-VL / Groq), puis rapproché par le moteur déterministe.
      </p>
      <SubmitButton />
    </form>
  );
}
