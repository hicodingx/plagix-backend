import { NextFunction, Request, Response } from "express";
import expressAsyncHandler from "express-async-handler";
import createHttpError from "http-errors";
import { prisma } from "../../lib/prisma.js";
import { scrapeQueue } from "../queues/scrape.queue.js";

/**
 * Déclenche une tâche de scraping en arrière-plan pour une source donnée
 * POST /api/sources/:id/scrape
 */
export const triggerScrape = expressAsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const id = req.params.id as string;
    const { clientSessionId } = req.body;

    // 1. Validation de la session de navigation du client
    if (!clientSessionId) {
      return next(createHttpError(400, "ID de session introuvable"));
    }

    // 2. Vérification de l'existence de la source
    const source = await prisma.scrapingSource.findUnique({
      where: { id },
    });

    if (!source) {
      return next(createHttpError(404, "Source introuvable"));
    }

    // 3. Vérification du statut de la source
    if (source.status !== "ACTIVE") {
      return next(createHttpError(400, "La source n'est plus active!"));
    }

    // 4. Approche A : Chaque clic génère un job unique lié au client connecté.
    // On ajoute le clientSessionId dans le nom du job pour une meilleure traçabilité dans Redis.
    await scrapeQueue.add(`scrape-job-${id}-${clientSessionId}`, {
      sourceId: id,
      clientSessionId: clientSessionId,
    });

    console.log(
      `[Controller] Job ajouté à BullMQ pour la source [${source.name}] par le client [${clientSessionId}]`,
    );

    // 5. Retour immédiat au Frontend
    res.status(200).send({
      success: true,
      message: "La tâche de scraping a bien été ajoutée à la file d'attente.",
    });
  },
);


/**
 * Récupère la liste de toutes les sources de scraping disponibles
 * GET /api/sources
 */
export const getAllSources = expressAsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const sources = await prisma.scrapingSource.findMany({
      orderBy: { name: "asc" }, // Trié par ordre alphabétique
    });

    res.status(200).json({ success: true, data: sources });
  },
);

/**
 * Récupère la bibliothèque des documents collectés pour une source, avec pagination
 * GET /api/sources/:id/documents?page=1&limit=10
 */
export const getSourceDocuments = expressAsyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const id = req.params.id as string;

    // Extraction et conversion des paramètres de pagination avec valeurs par défaut
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // 1. Vérifier si la source existe d'abord
    const sourceExists = await prisma.scrapingSource.findUnique({
      where: { id },
    });

    if (!sourceExists) {
      return next(createHttpError(404, "Source de scraping introuvable"));
    }

    // 2. Requêtes parallèles : Récupérer les documents paginés ET le compte total
   
    const [documents, totalDocuments] = await Promise.all([
      prisma.collectedDocument.findMany({
        where: { sourceId: id },
        orderBy: { publicationDate: "desc" }, // Les thèses les plus récentes d'abord
        skip,
        take: limit,
      }),
      prisma.collectedDocument.count({
        where: { sourceId: id },
      }),
    ]);

    // 3. Calcul des métadonnées de pagination pour le frontend Next.js
    const totalPages = Math.ceil(totalDocuments / limit);

    res.status(200).json({
      success: true,
      data: documents,
      pagination: {
        totalItems: totalDocuments,
        totalPages,
        currentPage: page,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  },
);
