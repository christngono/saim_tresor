# SAIM Trésorerie

Agent IA de gestion financière pour PME et structures parapubliques camerounaises.
Module complémentaire à SAIM Fiscal. Conforme **SYSCOHADA révisé**.

> **Principe fondateur** : le cœur des calculs (rapprochement, TFT, DSO) est
> **100 % déterministe** (Python/SQL). Le LLM n'intervient **que** pour extraire
> des documents non structurés et rédiger des résumés en langage naturel.
> Aucun résultat n'est définitif sans **validation humaine**. Tout est **audité**
> (horodaté + attribué à un humain ou à l'IA) et **isolé par entreprise** (RLS).

## Modules

| # | Module | État |
|---|--------|------|
| 1 | **Rapprochement bancaire** | ✅ implémenté |
| 2 | **Tableaux de flux de trésorerie (TFT)** | ✅ implémenté |
| 3 | **Analyse de facturation / DSO** | ✅ implémenté |

## Architecture

```
saim-treasury/
├── apps/
│   ├── web/     Next.js 14 (App Router, TS, Tailwind, NextAuth v5)
│   └── api/     FastAPI — cœur déterministe + couche LLM isolée
├── packages/
│   └── database/  schema.prisma = source de vérité (client JS + Python)
├── fixtures/    jeu de test réaliste en FCFA
└── infra/       docker-compose (Postgres + MinIO = R2 local)
```

**Décisions clés** : `prisma-client-py` pour que FastAPI et Next.js partagent un
seul schéma ; **Postgres RLS** pour l'isolation multi-tenant au niveau base.

## Prérequis

- Node ≥ 20, **pnpm** ≥ 9
- Python ≥ 3.11, **uv** (ou pip)
- Docker

## Démarrage local

```bash
# 1. Infrastructure (Postgres + MinIO)
docker compose -f infra/docker-compose.yml up -d

# 2. Variables d'environnement
cp .env.example .env   # renseigner TOGETHER_API_KEY / GROQ_API_KEY

# 3. Base de données : migrations Prisma + génération des deux clients
pnpm install
pnpm --filter @saim/database migrate      # crée les tables
pnpm --filter @saim/database generate      # client JS + client Python
pnpm --filter @saim/database rls           # applique les politiques RLS

# 4. Backend
cd apps/api
uv venv && source .venv/bin/activate
uv pip install -e ".[dev]"
prisma generate                            # client Python
python -m scripts.seed_fixtures            # charge le jeu de test (affiche les IDs)
uvicorn app.main:app --reload              # http://localhost:8000/docs

# 5. Frontend (autre terminal)
cd apps/web && pnpm dev                     # http://localhost:3000
```

**Connexion (démo)** : email `comptable@sawa-distribution.cm` (créé par le seed),
mot de passe `demo1234` (valeur `DEMO_PASSWORD` pour les comptes sans hash — voir
`apps/web/auth.ts`). En production, les comptes utilisent un hash bcrypt (`hashPwd`).

**Parcours frontend** : `/tresorerie` (vue d'ensemble) → `/rapprochement` (liste)
→ `/rapprochement/nouveau` (upload d'un relevé → extraction IA → rapprochement)
→ `/rapprochement/[id]` (valider chaque écart → clôturer → exporter SYSCOHADA).
Le tenant et l'utilisateur proviennent de la session NextAuth ; les mutations
passent par des Server Actions (le tenant n'est jamais transmis par le client).

## Valider le pipeline de bout en bout (module 1)

```bash
# Tests du moteur déterministe (aucune DB, aucun LLM requis)
cd apps/api && pytest tests/test_matcher.py -v

# Rapprochement sur le jeu de test (IDs affichés par seed_fixtures)
curl -X POST localhost:8000/reconciliation/run \
  -H 'X-Entreprise-Id: <id>' -H 'X-Utilisateur-Id: <id>' \
  -H 'Content-Type: application/json' \
  -d '{"compte_bancaire_id":"<id>","releve_id":"<id>",
       "periode_debut":"2026-06-01","periode_fin":"2026-06-30"}'
```

**Résultat attendu** sur le jeu de test (`fixtures/meta.json`) :
5 écritures rapprochées, et les écarts — 2 frais bancaires, 1 encaissement non
comptabilisé, 1 chèque non débité, 1 doublon signalé. L'état de rapprochement
SYSCOHADA (`GET /reconciliation/{id}/etat`) est **équilibré** (résidu = 0), le
doublon étant isolé pour instruction humaine.

## Flux du module 1

```
upload (PDF/CSV/image)
   └─► extraction IA (Together/Qwen2.5-VL, fallback Groq) ── JSON validé Pydantic
        └─► rapprochement DÉTERMINISTE (fuzzy montant/date/libellé + score)
             └─► revue & validation HUMAINE (chaque écart)
                  └─► clôture (statut VALIDE)
                       └─► export SYSCOHADA (.xlsx sur R2) — bloqué si non validé
```

Toute étape est journalisée dans `audit_logs` avec son acteur (HUMAIN / IA).

## Module 2 — Tableaux de flux de trésorerie (TFT)

Moteur déterministe ([`core/cashflow/`](apps/api/app/core/cashflow/)) :

- **TFT SYSCOHADA révisé** (méthode directe ou indirecte), construit depuis les
  mouvements de la période. Invariant garanti et testé :
  `FTAO + FTAI + FTAF == variation de trésorerie == Δ classe 5` (contrôle = 0).
- **Prévisionnel glissant 30/60/90 j** à partir des factures en cours, avec
  **alerte de rupture** de trésorerie (à valider par le DAF).

```bash
cd apps/api && pytest tests/test_tft.py tests/test_forecast.py -v
```

Sur le jeu de test : FTAO 2 200 000, FTAI −1 000 000, FTAF −500 000, variation
+700 000 (contrôle 0) ; prévisionnel en **rupture à 30 j** (solde projeté
−100 000 FCFA). Front : page `/tft` (TFT visuel + prévisionnel + alerte).

## Module 3 — Analyse de facturation / DSO

Extraction OCR de factures isolée (Together/Qwen2.5-VL + fallback Groq), puis
cœur déterministe ([`core/invoicing/`](apps/api/app/core/invoicing/)) :

- **Détection d'anomalies** : doublons, écarts de prix, montants incohérents
  (HT + TVA ≠ TTC), retards de paiement.
- **DSO** (Days Sales Outstanding) = encours créances / CA TTC × jours.
- **Relances** de créances : brouillons à 3 niveaux d'escalade, **jamais
  envoyés sans validation humaine** (statut BROUILLON → ENVOYEE/ANNULEE).

```bash
cd apps/api && pytest tests/test_invoicing.py -v
```

Sur le jeu de test (`fixtures/factures_analyse.csv`, réf. 2026-07-08) :
DSO = **69,7 j**, 7 anomalies (4 retards, 1 doublon, 1 écart de prix, 1 montant
incohérent), 4 relances (2× niveau 1, 2× niveau 2). Front : page `/factures`.

## Tests déterministes (cœur métier, sans DB ni LLM)

```bash
cd apps/api && pytest -q     # 21 tests : rapprochement, TFT, prévisionnel, DSO/anomalies/relances
```
