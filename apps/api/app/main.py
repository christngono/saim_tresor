from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.db.prisma import connect, disconnect
from app.routers import accounts, cashflow, invoicing, reconciliation


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect()
    yield
    await disconnect()


app = FastAPI(title="SAIM Trésorerie API", version="0.1.0", lifespan=lifespan)
app.include_router(reconciliation.router)
app.include_router(accounts.router)
app.include_router(cashflow.router)
app.include_router(invoicing.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
