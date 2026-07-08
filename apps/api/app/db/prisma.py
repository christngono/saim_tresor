"""Client Prisma partagé + contexte multi-tenant (RLS).

Chaque requête HTTP fixe le tenant courant au niveau de la connexion Postgres
(`SET app.current_tenant`), ce qui active l'isolation Row-Level Security définie
dans packages/database/prisma/rls.sql.
"""
from contextlib import asynccontextmanager

from prisma import Prisma

db = Prisma()


async def connect() -> None:
    await db.connect()


async def disconnect() -> None:
    await db.disconnect()


@asynccontextmanager
async def tenant_scope(entreprise_id: str):
    """Exécute un bloc avec le tenant RLS positionné.

    On utilise set_config(..., is_local=true) pour que le réglage soit limité à
    la transaction courante et ne fuite pas vers d'autres requêtes du pool.
    """
    async with db.tx() as tx:
        # is_local=true → réinitialisé automatiquement en fin de transaction.
        await tx.query_raw(
            "SELECT set_config('app.current_tenant', $1, true)", entreprise_id
        )
        yield tx
