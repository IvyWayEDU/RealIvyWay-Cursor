import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:3001";
const outDir = path.resolve(process.cwd(), ".mobile-audit");

const routes = [
  "/",
  "/pricing",
  "/auth/login",
  "/auth/register",
  "/checkout",
  "/admin/login",
];

const viewports = [
  { name: "iphone-390x844", width: 390, height: 844, deviceScaleFactor: 3 },
  { name: "android-360x740", width: 360, height: 740, deviceScaleFactor: 3 },
];

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function slugRoute(route) {
  if (route === "/") return "home";
  return route.replaceAll("/", "_").replace(/^_+/, "");
}

async function main() {
  await ensureDir(outDir);

  console.log(`[mobile-audit] baseURL=${baseURL}`);
  console.log(`[mobile-audit] outDir=${outDir}`);

  const browser = await chromium.launch({
    // In some sandboxed environments, Playwright's "headless shell" build can hang/crash.
    // Forcing normal Chromium with `--headless=new` has proven more reliable.
    headless: false,
    timeout: 30_000,
    args: ["--headless=new", "--disable-gpu"],
  });
  const results = {
    baseURL,
    timestamp: new Date().toISOString(),
    checks: [],
  };

  try {
    for (const vp of viewports) {
      console.log(`[mobile-audit] viewport=${vp.name} ${vp.width}x${vp.height}`);
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.deviceScaleFactor,
      });

      const page = await ctx.newPage();
      page.setDefaultTimeout(20_000);
      page.setDefaultNavigationTimeout(20_000);

      for (const route of routes) {
        const url = new URL(route, baseURL).toString();
        const entry = { viewport: vp, route, url, overflowX: null, overflowDetails: null };

        try {
          console.log(`[mobile-audit] goto ${route}`);
          await page.goto(url, { waitUntil: "domcontentloaded" });
          await page.waitForTimeout(250);

          const overflow = await page.evaluate(() => {
            const de = document.documentElement;
            const body = document.body;
            const scrollWidth = Math.max(de?.scrollWidth ?? 0, body?.scrollWidth ?? 0);
            const clientWidth = de?.clientWidth ?? window.innerWidth;
            const overflowX = scrollWidth > clientWidth + 1;

            return {
              overflowX,
              scrollWidth,
              clientWidth,
              location: window.location.pathname,
            };
          });

          entry.overflowX = overflow.overflowX;
          entry.overflowDetails = overflow;

          // Force a little scrolling to ensure lazy sections load before screenshot.
          await page.evaluate(async () => {
            const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
            const max = Math.max(
              document.documentElement.scrollHeight || 0,
              document.body.scrollHeight || 0
            );
            const steps = 6;
            for (let i = 0; i <= steps; i++) {
              window.scrollTo(0, Math.round((max * i) / steps));
              // eslint-disable-next-line no-await-in-loop
              await sleep(150);
            }
            window.scrollTo(0, 0);
          });

          const file = path.join(outDir, `${vp.name}__${slugRoute(route)}.png`);
          await page.screenshot({ path: file, fullPage: true });
          console.log(
            `[mobile-audit] saved ${path.basename(file)} overflowX=${entry.overflowX ? "YES" : "no"}`
          );
        } catch (e) {
          entry.error = String(e?.message ?? e);
          console.log(`[mobile-audit] error ${route}: ${entry.error}`);
        }

        results.checks.push(entry);
      }

      await ctx.close();
    }
  } finally {
    await browser.close();
  }

  await fs.writeFile(path.join(outDir, "results.json"), JSON.stringify(results, null, 2), "utf8");

  const hasOverflow = results.checks.some((c) => c.overflowX);
  const hasErrors = results.checks.some((c) => c.error);
  if (hasErrors || hasOverflow) process.exitCode = 1;
}

await main();

