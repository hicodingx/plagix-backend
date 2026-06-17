import { chromium } from "playwright";
import * as cheerio from "cheerio";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";

import * as dotenv from "dotenv";
dotenv.config();

const INFRA_URL = process.env.OATD_INFRA_URL;
const BUFFER_FILE = path.join(process.cwd(), "public", "buffer.json");

const publicDir = path.dirname(BUFFER_FILE);
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

interface OatdThesis {
  title: string;
  author: string;
  university: string;
  sourceUrl: string;
}

interface BufferData {
  query: string;
  currentStart: number;
  thesesLeft: OatdThesis[];
}

export async function fetchAndParse(query: string): Promise<OatdThesis[]> {
  // Verrouillage de la démo sur le mot-clé unique
  const targetQuery = "afrique";

  // 1. Initialisation ou lecture du fichier tampon
  let buffer: BufferData = {
    query: targetQuery,
    currentStart: 1,
    thesesLeft: [],
  };
  if (fs.existsSync(BUFFER_FILE)) {
    try {
      buffer = JSON.parse(fs.readFileSync(BUFFER_FILE, "utf-8"));
    } catch {
      console.log(
        "[Buffer] Réinitialisation du fichier tampon suite à une lecture impossible.",
      );
    }
  }

  // Détermination de l'état du stock local
  const needRefill = buffer.thesesLeft.length === 0;

  // Si le réservoir est vide et qu'on a déjà consommé la première page, on avance l'index de l'infra
  if (needRefill && buffer.currentStart !== 1) {
    buffer.currentStart += 99;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 720 },
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
  });
  const page = await context.newPage();

  let htmlContent = "";

  await page.route("**/oatd/search**", async (route) => {
    if (needRefill) {
      console.log(
        `[Playwright Intercept] Buffer vide ! Détournement réseau vers CDN Infra (Start: ${buffer.currentStart})`,
      );
      try {
        console.log(INFRA_URL);
        const response = await axios.get(INFRA_URL as string, {
          params: { q: targetQuery, start: buffer.currentStart },
        });
        htmlContent = response.data; // Capture du HTML pour le traitement Cheerio ultérieur

        await route.fulfill({
          status: 200,
          contentType: "text/html",
          body: htmlContent,
        });
      } catch (err: any) {
        console.error(
          `[Playwright Intercept] Erreur critique liaison CDN Infra : ${err.message}`,
        );
        await route.abort();
      }
    } else {
      console.log(
        `[Playwright Intercept] Données déjà disponibles en buffer local. Navigation blanche simulée.`,
      );

      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<html><body>Démo OATD Mode Tampon Actif</body></html>",
      });
    }
  });

  const targetUrl = `https://oatd.org/oatd/search?q=${encodeURIComponent(targetQuery)}&start=${buffer.currentStart}`;
  console.log(
    `[Playwright] Envoi de la requête officielle fictive vers : ${targetUrl}`,
  );

  await page.goto(targetUrl, { waitUntil: "commit", timeout: 30000 });

  await page.waitForTimeout(4000);

  await browser.close();
  console.log("[Playwright] Navigateur refermé proprement.");

  if (needRefill && htmlContent) {
    console.log("[Cheerio] Analyse chirurgicale du nouveau package HTML...");
    const $ = cheerio.load(htmlContent);
    const freshTheses: OatdThesis[] = [];

    $(".result").each((_, element) => {
      // 1. Extraction du titre (Reste inchangé et fonctionnel)
      const title = $(element).find(".etdTitle span").text().trim();

      // 🔥 CORRECTION AUTEUR : On cherche la balise <cite>, et on prend le <span> juste avant elle
      const author =
        $(element).find(".etdTitle").prev("span").text().trim() || "Inconnu";

      // 🔥 CORRECTION UNIVERSITÉ : On cherche d'abord le publisher itemprop,
      // sinon on se rabat sur le texte de la div .cover
      let university = $(element)
        .find("span[itemprop='publisher']")
        .text()
        .trim();
      if (!university) {
        university = $(element).find(".cover p").text().trim();
      }
      if (!university) {
        university = "Inconnue";
      }

      // Extraction de l'URL
      const sourceUrl = $(element).find(".links a").attr("href") || "";

      if (title && sourceUrl) {
        freshTheses.push({
          title,
          author,
          university: university.replace(/\s+/g, " "), // Nettoie les espaces et retours à la ligne superflus
          sourceUrl,
        });
      }
    });

    buffer.thesesLeft = freshTheses;
  }

  const structuralRandom = Math.floor(Math.random() * (27 - 16 + 1)) + 16;

  const finalTake = Math.min(structuralRandom, buffer.thesesLeft.length);
  const waveToDeliver = buffer.thesesLeft.splice(0, finalTake);

  // 6. MISE À JOUR DU DOSSIER TAMPON PHYSIQUE
  fs.writeFileSync(BUFFER_FILE, JSON.stringify(buffer, null, 2), "utf-8");

  console.log(
    `[Vague Livrée] ${waveToDeliver.length} thèses prêtes transmises au Worker BullMQ.`,
  );
  console.log(
    `[Statut Buffer] Résidu en attente dans public/buffer.json : ${buffer.thesesLeft.length} thèses.\n`,
  );

  return waveToDeliver;
}
