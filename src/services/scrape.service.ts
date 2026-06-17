import { chromium } from "playwright";
import * as cheerio from "cheerio";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const INFRA_URL = process.env.OATD_INFRA_URL;
const BUFFER_FILE = path.join(process.cwd(), "public", "buffer.json");

// Sécurité : Création du dossier public si inexistant
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
  const targetQuery = "afrique";

  let buffer: BufferData = {
    query: targetQuery,
    currentStart: 1,
    thesesLeft: [],
  };

  // Détection du tout premier lancement de l'application
  const isFirstLaunch = !fs.existsSync(BUFFER_FILE);

  if (fs.existsSync(BUFFER_FILE)) {
    try {
      buffer = JSON.parse(fs.readFileSync(BUFFER_FILE, "utf-8"));
    } catch {
      console.log(
        "[Buffer] Réinitialisation du fichier tampon suite à une lecture impossible.",
      );
    }
  }

  const needRefill = buffer.thesesLeft.length === 0;

  if (needRefill) {
    if (isFirstLaunch) {
      console.log(
        "[Flux Principal] Premier lancement absolu. Initialisation à start=1.",
      );
    } else {
      const oldStart = buffer.currentStart;
      buffer.currentStart =
        buffer.currentStart === 1 ? 100 : buffer.currentStart + 99;
    }
  }

  const browser = await chromium.launch({
    headless: true,
    slowMo: 800,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 720 },
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
  });

  const page = await context.newPage();

  const session = await context.newCDPSession(page);
  await session.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 2500,
    downloadThroughput: 500 * 1024,
    uploadThroughput: 256 * 1024,
  });

  let htmlContent = "";

  await page.route(
    (url) => url.href.includes("oatd.org/oatd/search"),
    async (route) => {
      const currentUrl = route.request().url();
      const resourceType = route.request().resourceType();

      if (resourceType !== "document") {
        return route.continue();
      }

      if (needRefill) {
        try {
          const response = await axios.get(INFRA_URL as string, {
            params: { q: targetQuery, start: buffer.currentStart },
          });
          htmlContent = response.data;

          await route.fulfill({
            status: 200,
            contentType: "text/html",
            body: htmlContent,
          });
        } catch (err: any) {
          await route.abort();
        }
      } else {

        await route.fulfill({
          status: 200,
          contentType: "text/html",
          body: "<html><body>Démo OATD Mode Tampon Actif</body></html>",
        });
      }
    },
  );

  // Route B : BLOCAGE DES AGRESSEURS DE BANDE PASSANTE (Images, CSS, Logos, Analytics)
  await page.route(
    (url) => !url.href.includes("oatd.org/oatd/search"),
    async (route) => {
      const type = route.request().resourceType();
      if (["image", "stylesheet", "font", "media", "script"].includes(type)) {
        return route.abort();
      }
      return route.continue();
    },
  );

  const targetUrl = `https://oatd.org/oatd/search?q=${encodeURIComponent(targetQuery)}&start=${buffer.currentStart}`;
  console.log(
    `[Playwright] Envoi de la requête officielle simulée vers : ${targetUrl}`,
  );

  await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(5000);

  await browser.close();


  if (needRefill && htmlContent) {

    const $ = cheerio.load(htmlContent);
    const freshTheses: OatdThesis[] = [];

    $(".result").each((_, element) => {
      const title = $(element).find(".etdTitle span").text().trim();
      const author =
        $(element).find(".etdTitle").prev("span").text().trim() || "Inconnu";

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

      const sourceUrl = $(element).find(".links a").attr("href") || "";

      if (title && sourceUrl) {
        freshTheses.push({
          title,
          author,
          university: university.replace(/\s+/g, " "),
          sourceUrl,
        });
      }
    });

    buffer.thesesLeft = freshTheses;

    if (freshTheses.length === 0 && buffer.currentStart === 1) {
      buffer.currentStart = 100;
    }
  }

  
  const structuralRandom = Math.floor(Math.random() * (47 - 33 + 1)) + 33;
  const finalTake = Math.min(structuralRandom, buffer.thesesLeft.length);
  const waveToDeliver = buffer.thesesLeft.splice(0, finalTake);

  
  fs.writeFileSync(BUFFER_FILE, JSON.stringify(buffer, null, 2), "utf-8");

  return waveToDeliver;
}
