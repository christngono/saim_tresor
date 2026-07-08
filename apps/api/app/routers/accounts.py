"""Endpoints de lecture pour alimenter le dashboard trésorerie."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.db.prisma import tenant_scope
from app.routers.reconciliation import Ctx, get_ctx

router = APIRouter(tags=["dashboard"])


@router.get("/comptes-bancaires")
async def lister_comptes(ctx: Ctx = Depends(get_ctx)):
    async with tenant_scope(ctx.entreprise_id) as tx:
        comptes = await tx.comptebancaire.find_many()
        return [
            {"id": c.id, "banque": c.banque, "numeroCompte": c.numeroCompte,
             "intitule": c.intitule, "devise": c.devise}
            for c in comptes
        ]


@router.get("/releves")
async def lister_releves(ctx: Ctx = Depends(get_ctx)):
    async with tenant_scope(ctx.entreprise_id) as tx:
        releves = await tx.relevebancaire.find_many(order={"createdAt": "desc"})
        return [
            {"id": r.id, "compteBancaireId": r.compteBancaireId,
             "periodeDebut": r.periodeDebut.date().isoformat(),
             "periodeFin": r.periodeFin.date().isoformat(),
             "soldeFinal": str(r.soldeFinal), "statut": r.statut}
            for r in releves
        ]


@router.get("/rapprochements")
async def lister_rapprochements(ctx: Ctx = Depends(get_ctx)):
    async with tenant_scope(ctx.entreprise_id) as tx:
        raps = await tx.rapprochement.find_many(order={"createdAt": "desc"})
        out = []
        for r in raps:
            nb_ecarts = await tx.rapprochementmatch.count(
                where={"rapprochementId": r.id, "typeEcart": {"not": None}}
            )
            out.append({
                "id": r.id, "statut": r.statut, "compteBancaireId": r.compteBancaireId,
                "periodeDebut": r.periodeDebut.date().isoformat(),
                "periodeFin": r.periodeFin.date().isoformat(),
                "ecart": str(r.ecart), "nbEcarts": nb_ecarts,
                "createdAt": r.createdAt.isoformat(),
            })
        return out
