import { Queue, QueueEvents } from "bullmq";
import { Server } from "socket.io";
import {
  notifyScrapingFinished,
  notifyScrapingFailed,
} from "../services/socket.service.js";


const redisConnection = {
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT) || 6379,
};

// 1. Création de la file d'attente (utilisée par tes routes Express pour ajouter des tâches)
export const scrapeQueue = new Queue("scrape-queue", {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail:{age : 60}
  }
});

// 2. Création de l'écouteur d'événements globaux
export const scrapeQueueEvents = new QueueEvents("scrape-queue", {
  connection: redisConnection,
});

// 3. Fonction pour lier les résultats de la Queue vers Socket.io
export const listenToQueueEvents = (io: Server) => {
  // Quand un worker termine un job avec succès
  scrapeQueueEvents.on("completed", ({ jobId, returnvalue }) => {
    console.log(`[Queue] Job ${jobId} terminé avec succès.`);
    if (!returnvalue) return;

    try {
      const data = JSON.parse(returnvalue);
      if (data.clientSessionId) {
        notifyScrapingFinished(io, data.clientSessionId, data);
      }
    } catch (err) {
      console.error("Erreur de parsing du succès :", err);
    }
  });

  // Quand un worker échoue sur un job
  scrapeQueueEvents.on("failed", ({ jobId, failedReason }) => {
    console.error(` [Queue] Job ${jobId} en échec. Raison : ${failedReason}`);
    if (!failedReason) return;

    try {
      const errorData = JSON.parse(failedReason.replace("Error: ", ""));
      if (errorData.clientSessionId) {
        notifyScrapingFailed(io, errorData.clientSessionId, errorData.reason);
      }
    } catch (err) {
      console.warn("Impossible de parser l'erreur au format JSON.");
    }
  });
};
