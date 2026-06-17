import { Router } from "express";
import {
  getAllSources,
  getSourceDocuments,
  triggerScrape,
} from "../controllers/sources.controller.js";

const router = Router();

// Route 1 : Récupérer toutes les sources (Ex: OATD, etc.)
router.get("/", getAllSources);

// Route 2 : Déclencher le traitement asynchrone du robot de scraping via la Queue
router.post("/:id/scrape", triggerScrape);

// Route 3 : Consulter les documents extraits avec la pagination
router.get("/:id/documents", getSourceDocuments);

export default router;
