import dotenv from "dotenv";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";


// Imports de nos modules organisés (avec l'extension .js obligatoire)
import {prisma} from "../lib/prisma.js"
import { setupSocket } from "./services/socket.service.js";
import { listenToQueueEvents } from "./queues/scrape.queue.js";
import "./queues/scrape.worker.js";
import { checkConnexionToDB } from "./services/connex.service.js";
import sourcesRoutes from "./routes/sources.routes.js";

// node --import tsx email.config.ts

dotenv.config();
const app = express();

const corsOptions = {
  origin: function (origin: any, callback: any) {
    const allowedOrigins = [
      "https://plagix.pole-g.org", // pour la production
      "http://localhost:3000", // pour la production
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


const server = createServer(app); // socket.io l'oblige
const io = new Server(server, {
  cors: {
    origin: "*", // à remplacer par ton domaine (ex: https://api-preview.drauto24.com) en prod pour plus de sécurité
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
});

// 1. Activer les chambres WebSockets
setupSocket(io);

// 2. Activer le suivi de la Queue (qui appellera Socket au besoin)
listenToQueueEvents(io);

app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date() });
});

// 3. Les routes d'API
// app.use("/api/sources", sourcesRoutes);

// ─── BRANCHEMENT DE TES ROUTES D'API ───
app.use("/api/sources", sourcesRoutes);

// Route de secours globale pour les erreurs 404 REST
app.use((req, res, next) => {
  res.status(404).json({ error: "Route d'API introuvable" });
});

// Middleware global Express pour intercepter et formater proprement createHttpError
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    success: false,
    error: err.message || "Une erreur interne est survenue.",
  });
});


/*  ngrok http --url=still-routinely-javelin.ngrok-free.app 5000 */

const PORT = process.env.PORT || 5000;
const startServer = async () => {
  try {
      await checkConnexionToDB();
      server.listen(PORT, () => {
        console.log(`Serveur démarré sur http://localhost:${PORT}`);
        console.log(`Worker BullMQ connecté et à l'écoute.`);
      });
  } catch (error) {
    console.log(error);
    process.exit(1); // Arrête le serveur si la base de données n'est pas accessible
  }

};

startServer(); // Appelle la fonction pour démarrer le serveur
