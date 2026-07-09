"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import type { CompteBancaire } from "../../lib/api";
import { importerEtRapprocherAction } from "../../app/(dashboard)/rapprochement/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full">
      {pending ? "Import & rapprochement…" : "Importer et rapprocher"}
    </button>
  );
}

function FileField({ name, label, hint, onName }: { name: string; label: string; hint: string; onName: (s: string) => void }) {
  const [n, setN] = useState("");
  return (
    <div>
      <label className="label">{label}</label>
      <label className="flex cursor-pointer items-center justify-between rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500 hover:border-brand-400 hover:bg-brand-50/40">
        <span>{n || "Choisir un fichier CSV…"}</span>
        <span className="rounded-md bg-white px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">Parcourir</span>
        <input type="file" name={name} accept=".csv" required className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]?.name ?? ""; setN(f); onName(f); }} />
      </label>
      <p className="mt-1 text-xs text-slate-400">{hint}</p>
    </div>
  );
}

export function ImportForm({ comptes }: { comptes: CompteBancaire[] }) {
  return (
    <form action={importerEtRapprocherAction} className="card max-w-xl space-y-5 p-6">
      <div>
        <label className="label">Compte bancaire</label>
        <select name="compte_bancaire_id" required className="input">
          {comptes.map((c) => <option key={c.id} value={c.id}>{c.banque} — {c.intitule}</option>)}
        </select>
      </div>

      <FileField name="grand_livre" label="Grand livre (CSV — compte 521)"
        hint="Colonnes : date_ecriture, journal, piece, compte, libelle, debit, credit" onName={() => {}} />
      <FileField name="releve" label="Relevé bancaire (CSV)"
        hint="Colonnes : date_operation, date_valeur, libelle, reference, debit, credit" onName={() => {}} />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Solde initial du relevé</label>
          <input name="solde_initial" type="number" step="0.01" defaultValue="0" className="input" />
        </div>
        <div>
          <label className="label">Solde final du relevé</label>
          <input name="solde_final" type="number" step="0.01" required className="input" />
        </div>
      </div>

      <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
        Import 100 % déterministe (ni IA, ni stockage). Le rapprochement se lance automatiquement.
      </p>
      <SubmitButton />
    </form>
  );
}
