import { prisma } from "../lib/prisma";

async function main() {
  console.log("[seed] Début de la mise à jour des sources...");


  const sourceOatd = await prisma.scrapingSource.upsert({
    where: {
      rootUrl: "https://oatd.org",
    },
    update: {},
    create: {
      name: "OATD (Open Access Theses and Dissertations)",
      rootUrl: "https://oatd.org",
      status: "ACTIVE",
      collectedCount: 0,
      lastRunAt: null,
    },
  });

  console.log(`[seed] Source OATD synchronisée (ID: ${sourceOatd.id})`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("[seed] Déconnexion de la base de données réussie.");
  })
  .catch(async (e) => {
    console.error("[seed] Erreur critique pendant le seeding :", e);
    await prisma.$disconnect();
    process.exit(1);
  });