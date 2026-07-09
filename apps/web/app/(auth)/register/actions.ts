"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@saim/database";
import { signIn } from "../../../auth";

// Inscription self-service : crée l'entreprise (tenant), l'utilisateur (ADMIN,
// mot de passe hashé bcrypt — compatible avec la vérification de auth.ts) et un
// compte bancaire par défaut, puis connecte l'utilisateur.
export async function registerAction(formData: FormData) {
  const raisonSociale = String(formData.get("raisonSociale") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const nom = String(formData.get("nom") || "").trim();
  const password = String(formData.get("password") || "");
  const banque = String(formData.get("banque") || "").trim();
  const numeroCompte = String(formData.get("numeroCompte") || "").trim();

  if (!raisonSociale || !email || !nom || !banque || password.length < 6) {
    redirect("/register?error=champs");
  }
  if (await prisma.utilisateur.findUnique({ where: { email } })) {
    redirect("/register?error=email");
  }

  const hashPwd = await bcrypt.hash(password, 10);
  const ent = await prisma.entreprise.create({
    data: { raisonSociale, type: "PME_PRIVEE", deviseBase: "XAF" },
  });
  const user = await prisma.utilisateur.create({ data: { email, nom, hashPwd } });
  await prisma.membreEntreprise.create({
    data: { utilisateurId: user.id, entrepriseId: ent.id, role: "ADMIN" },
  });

  // Compte bancaire par défaut — table soumise au RLS : on pose le tenant
  // courant dans une transaction (is_local=true) avant l'insertion.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SELECT set_config('app.current_tenant', $1, true)", ent.id);
    await tx.compteBancaire.create({
      data: {
        entrepriseId: ent.id, banque,
        numeroCompte: numeroCompte || "—",
        intitule: `Compte principal — ${raisonSociale}`,
        compteSyscohada: "521", devise: "XAF",
      },
    });
  });

  // Connexion automatique (jette une redirection NEXT_REDIRECT en cas de succès).
  await signIn("credentials", { email, password, redirectTo: "/tresorerie" });
}
