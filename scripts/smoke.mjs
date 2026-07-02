import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";

const chromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
const routes = [
  "/en",
  "/en/vote",
  "/en/report",
  "/en/track",
  "/en/pulse",
  "/en/alerts",
  "/en/how-it-works",
  "/en/assembly",
  "/sw",
];

await mkdir(".artifacts", { recursive: true });

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
});

const results = [];

async function checkRoute(path, viewport) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));

  const response = await page.goto(`${baseUrl}${path}`, {
    waitUntil: "domcontentloaded",
    timeout: 20000,
  });
  await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});

  const state = await page.evaluate(() => ({
    title: document.title,
    h1: document.querySelector("h1")?.textContent?.trim() ?? null,
    width: document.body.scrollWidth,
    viewport: window.innerWidth,
    overflowX: document.body.scrollWidth > window.innerWidth + 1,
    navLinks: document.querySelectorAll("a[href]").length,
    buttons: document.querySelectorAll("button").length,
    svgs: document.querySelectorAll("svg").length,
  }));

  await page.screenshot({
    path: `.artifacts/${viewport.width}x${viewport.height}-${path.replaceAll("/", "_") || "_root"}.png`,
    fullPage: true,
  });

  await page.close();

  results.push({
    path,
    status: response?.status() ?? null,
    viewport,
    ...state,
    errors: errors.filter(
      (error) =>
        !error.includes("Hydration failed") &&
        !error.includes("A tree hydrated") &&
        !error.includes("data-new-gr-c-s-check-loaded"),
    ),
  });
}

for (const route of routes) {
  await checkRoute(route, { width: 1280, height: 900 });
}

for (const route of ["/en", "/en/vote", "/en/report", "/en/pulse", "/sw"]) {
  await checkRoute(route, { width: 360, height: 740 });
}

await browser.close();

const failures = results.filter(
  (result) =>
    result.status == null ||
    result.status >= 400 ||
    result.overflowX ||
    result.errors.length > 0,
);

console.log(JSON.stringify({ ok: failures.length === 0, failures, results }, null, 2));

if (failures.length > 0) {
  process.exitCode = 1;
}
