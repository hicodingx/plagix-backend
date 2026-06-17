import { Worker, Job } from "bullmq";
import crypto from "crypto";
import { prisma } from "../../lib/prisma.js";
import { fetchAndParse } from "../services/scrape.service.js";

export const scrapeWorker = new Worker(
  "scrape-queue",
  async (job: Job) => {
    const { sourceId, clientSessionId } = job.data;

    try {
      // 1. Récupération des données brutes depuis le service autonome
      const rawTheses = await fetchAndParse("afrique");

      // CORRECTION 1 : Gestion du cas où il n'y a plus aucune thèse disponible
      if (!rawTheses || rawTheses.length === 0) {
        console.log(
          `[Worker] Aucune thèse récupérée. Fin d'index ou infrastructure vide.`,
        );

        // Optionnel : Tu peux notifier ton modèle qu'on a atteint le bout du tunnel
        await prisma.scrapingSource.update({
          where: { id: sourceId },
          data: { lastRunAt: new Date() },
        });

        return JSON.stringify({
          sourceId,
          clientSessionId,
          collectedCount: 0,
          status: "EMPTY_OR_FINISHED",
        });
      }

      let newDocumentsCounter = 0;
      const tasks: Promise<void>[] = [];

      // 2. Traitement des doublons et insertion BDD
      for (const thesis of rawTheses) {
        const signature = crypto
          .createHash("md5")
          .update(thesis.sourceUrl)
          .digest("hex");

        const processDocument = async () => {
          const existingDoc = await prisma.collectedDocument.findUnique({
            where: { signature },
          });

          if (!existingDoc) {
            await prisma.collectedDocument.create({
              data: {
                title: thesis.title,
                author: thesis.author,
                university: thesis.university,
                publicationDate: new Date(),
                content: `Thèse collectée automatiquement via OATD. Auteur : ${thesis.author}.`,
                sourceUrl: thesis.sourceUrl,
                signature,
                sourceId,
              },
            });
            newDocumentsCounter++;
          }
        };
        tasks.push(processDocument());
      }

      await Promise.all(tasks);

      // 3. Mise à jour des compteurs de la source
      await prisma.scrapingSource.update({
        where: { id: sourceId },
        data: {
          lastRunAt: new Date(),
          collectedCount: { increment: newDocumentsCounter },
        },
      });

      return JSON.stringify({
        sourceId,
        clientSessionId,
        collectedCount: newDocumentsCounter,
        status: "SUCCESS",
      });
    } catch (error: any) {
      throw new Error(
        JSON.stringify({ clientSessionId, reason: error.message }),
      );
    }
  },
  {
    connection: { host: "localhost", port: 6379 }
  },
);
