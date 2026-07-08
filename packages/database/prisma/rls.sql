-- ─────────────────────────────────────────────────────────────────
-- Row-Level Security (RLS) — isolation multi-tenant au niveau base.
-- À exécuter APRÈS `prisma migrate` (les tables doivent exister).
--
-- Principe : chaque connexion applicative pose le tenant courant via
--   SET app.current_tenant = '<entrepriseId>';
-- et toute requête est automatiquement filtrée sur entrepriseId.
-- La donnée d'une entreprise devient inaccessible même en cas de
-- bug applicatif (oubli d'un WHERE). Défense en profondeur.
-- ─────────────────────────────────────────────────────────────────

-- Helper : lit le tenant courant (chaîne vide si non défini → aucun accès).
CREATE OR REPLACE FUNCTION current_tenant() RETURNS text AS $$
  SELECT current_setting('app.current_tenant', true);
$$ LANGUAGE sql STABLE;

-- Tables portant directement entrepriseId (filtrage direct).
DO $$
DECLARE
  t text;
  direct_tables text[] := ARRAY[
    'comptes_bancaires', 'releves_bancaires', 'comptes_comptables',
    'ecritures_comptables', 'rapprochements', 'factures', 'tfts',
    'documents_importes', 'audit_logs'
  ];
BEGIN
  FOREACH t IN ARRAY direct_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format($f$
      CREATE POLICY tenant_isolation ON %I
      USING ("entrepriseId" = current_tenant())
      WITH CHECK ("entrepriseId" = current_tenant());
    $f$, t);
  END LOOP;
END $$;

-- Tables filtrées indirectement (via leur parent porteur du tenant).
-- lignes_releve → releves_bancaires
ALTER TABLE lignes_releve ENABLE ROW LEVEL SECURITY;
ALTER TABLE lignes_releve FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON lignes_releve
  USING (EXISTS (
    SELECT 1 FROM releves_bancaires r
    WHERE r.id = lignes_releve."releveId"
      AND r."entrepriseId" = current_tenant()
  ));

-- rapprochement_matches → rapprochements
ALTER TABLE rapprochement_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE rapprochement_matches FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON rapprochement_matches
  USING (EXISTS (
    SELECT 1 FROM rapprochements r
    WHERE r.id = rapprochement_matches."rapprochementId"
      AND r."entrepriseId" = current_tenant()
  ));

-- anomalies_facture / relances → factures
ALTER TABLE anomalies_facture ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomalies_facture FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON anomalies_facture
  USING (EXISTS (
    SELECT 1 FROM factures f
    WHERE f.id = anomalies_facture."factureId"
      AND f."entrepriseId" = current_tenant()
  ));

ALTER TABLE relances ENABLE ROW LEVEL SECURITY;
ALTER TABLE relances FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON relances
  USING (EXISTS (
    SELECT 1 FROM factures f
    WHERE f.id = relances."factureId"
      AND f."entrepriseId" = current_tenant()
  ));

-- NOTE : le rôle applicatif ne doit PAS être superuser/BYPASSRLS.
-- CREATE ROLE saim_app LOGIN PASSWORD '...'; puis GRANT sur les tables.
