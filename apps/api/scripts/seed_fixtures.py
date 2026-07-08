"""Charge le jeu de test (fixtures/) en base pour valider le pipeline.

Usage (depuis apps/api, client Prisma généré) :
    python -m scripts.seed_fixtures

Crée l'entreprise, l'utilisateur, le compte bancaire, le plan comptable, le
relevé + ses lignes et le grand livre. Affiche les identifiants à utiliser dans
les appels d'API (headers X-Entreprise-Id / X-Utilisateur-Id).
"""
import asyncio
import csv
import json
from datetime import datetime
from decimal import Decimal
from pathlib import Path

from prisma import Prisma

FIXTURES = Path(__file__).resolve().parents[3] / "fixtures"


def _dt(s: str) -> datetime:
    return datetime.fromisoformat(s)


def _dec(s: str) -> Decimal:
    return Decimal(s or "0")


async def main() -> None:
    meta = json.loads((FIXTURES / "meta.json").read_text())
    db = Prisma()
    await db.connect()

    ent = await db.entreprise.create(data={
        "raisonSociale": meta["entreprise"]["raisonSociale"],
        "niu": meta["entreprise"]["niu"],
        "rccm": meta["entreprise"]["rccm"],
        "type": meta["entreprise"]["type"],
        "deviseBase": meta["entreprise"]["deviseBase"],
    })
    user = await db.utilisateur.create(data={
        "email": meta["utilisateur"]["email"], "nom": meta["utilisateur"]["nom"],
    })
    await db.membreentreprise.create(data={
        "utilisateurId": user.id, "entrepriseId": ent.id,
        "role": meta["utilisateur"]["role"],
    })

    # Positionne le tenant RLS pour toutes les insertions suivantes.
    await db.execute_raw("SELECT set_config('app.current_tenant', $1, false)", ent.id)

    comptes = {}
    for c in meta["planComptable"]:
        cc = await db.comptecomptable.create(data={
            "entrepriseId": ent.id, "numero": c["numero"],
            "intitule": c["intitule"], "classe": c["classe"],
        })
        comptes[c["numero"]] = cc.id

    banque = await db.comptebancaire.create(data={
        "entrepriseId": ent.id, **{k: meta["compteBancaire"][k] for k in
        ("banque", "numeroCompte", "intitule", "compteSyscohada", "devise")},
    })

    releve = await db.relevebancaire.create(data={
        "entrepriseId": ent.id, "compteBancaireId": banque.id,
        "periodeDebut": _dt(meta["releve"]["periodeDebut"]),
        "periodeFin": _dt(meta["releve"]["periodeFin"]),
        "soldeInitial": _dec(meta["releve"]["soldeInitial"]),
        "soldeFinal": _dec(meta["releve"]["soldeFinal"]),
        "source": "IMPORT_CSV", "statut": "VALIDE",
    })
    with open(FIXTURES / "releve_bancaire.csv") as f:
        for r in csv.DictReader(f):
            await db.lignereleve.create(data={
                "releveId": releve.id, "dateOperation": _dt(r["date_operation"]),
                "dateValeur": _dt(r["date_valeur"]), "libelle": r["libelle"],
                "reference": r["reference"] or None,
                "debit": _dec(r["debit"]) or None, "credit": _dec(r["credit"]) or None,
            })

    with open(FIXTURES / "grand_livre.csv") as f:
        for r in csv.DictReader(f):
            await db.ecriturecomptable.create(data={
                "entrepriseId": ent.id, "compteId": comptes[r["compte"]],
                "dateEcriture": _dt(r["date_ecriture"]), "journal": r["journal"],
                "piece": r["piece"] or None, "libelle": r["libelle"],
                "debit": _dec(r["debit"]), "credit": _dec(r["credit"]),
                "source": "IMPORT_CSV",
            })

    print("✅ Fixtures chargées.")
    print(f"   X-Entreprise-Id  : {ent.id}")
    print(f"   X-Utilisateur-Id : {user.id}")
    print(f"   compte_bancaire_id : {banque.id}")
    print(f"   releve_id          : {releve.id}")
    print("\nLancer le rapprochement :")
    print(f"""   curl -X POST localhost:8000/reconciliation/run \\
     -H 'X-Entreprise-Id: {ent.id}' -H 'X-Utilisateur-Id: {user.id}' \\
     -H 'Content-Type: application/json' \\
     -d '{{"compte_bancaire_id":"{banque.id}","releve_id":"{releve.id}",
          "periode_debut":"2026-06-01","periode_fin":"2026-06-30"}}'""")
    await db.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
