import { Server, Socket } from "socket.io";

export const setupSocket = (io: Server) => {
  io.on("connection", (socket: Socket) => {
    console.log(`Client connecté au WebSocket (Socket ID: ${socket.id})`);

    // Le client Next.js envoie son identifiant de session persistant
    socket.on("joinSession", (clientSessionId: string) => {
      if (!clientSessionId) return;

      console.log(
        `Le navigateur [${clientSessionId}] a rejoint sa chambre privée.`,
      );
      socket.join(clientSessionId); // Le socket rejoint la chambre dédiée
    });

    socket.on("disconnect", () => {
      console.log(` Client déconnecté (Socket ID: ${socket.id})`);
    });
  });
};

/**
 * Envoie une notification de succès de scraping à un navigateur spécifique
 */
export const notifyScrapingFinished = (
  io: Server,
  clientSessionId: string,
  data: { sourceId: string; collectedCount: number },
) => {
  io.to(clientSessionId).emit("scraping-finished", {
    sourceId: data.sourceId,
    collectedCount: data.collectedCount,
    message: `Le scraping de la source est terminé ! ${data.collectedCount} documents ont été collectés.`,
  });
};


export const notifyScrapingFailed = (
  io: Server,
  clientSessionId: string,
  reason: string,
) => {
  io.to(clientSessionId).emit("scraping-failed", {
    reason,
    message: `La tâche de scraping a échoué. Raison : ${reason}`,
  });
};
