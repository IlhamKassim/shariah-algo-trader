/**
 * Screenshot harness for visual review of the dashboard.
 *
 * Boots against an already-running Vite dev server, enters demo mode so no
 * real account or production API is touched, and captures each route at
 * desktop and mobile widths. Also reports console errors and horizontal
 * overflow, which are the two failures a static read of the code can't catch.
 *
 *   node scripts/shots.mjs                    # all routes, default target
 *   node scripts/shots.mjs /console           # one route
 *   BASE=http://127.0.0.1:5173 node scripts/shots.mjs
 */

import { chromium } from "playwright";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://127.0.0.1:5173";
const OUT = process.env.OUT ?? path.resolve("shots");

const ROUTES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      "/console",
      "/performance",
      "/universe",
      "/ledger",
      "/account",
      "/day-trader",
      "/learn",
      "/notifications",
    ];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const results = [];

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
  });

  // Demo mode short-circuits ProtectedRoute and makes lib/api serve mocks
  // client-side, so nothing reaches the production API.
  await ctx.addInitScript(() => {
    localStorage.setItem("shariah_demo_mode", "true");
  });

  for (const route of ROUTES) {
    const page = await ctx.newPage();
    const errors = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text().slice(0, 200));
    });
    page.on("pageerror", (e) => errors.push("PAGEERROR: " + String(e).slice(0, 200)));

    let status = "ok";
    try {
      await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 30_000 });
      await page.waitForTimeout(700); // let charts settle
    } catch (e) {
      status = "nav-failed: " + String(e).split("\n")[0].slice(0, 120);
    }

    const overflow = await page
      .evaluate(() => {
        const d = document.documentElement;
        return { scrollW: d.scrollWidth, clientW: d.clientWidth };
      })
      .catch(() => null);

    const slug = route.replace(/\//g, "_").replace(/^_/, "") || "root";
    const file = path.join(OUT, `${slug}.${vp.name}.png`);
    await page.screenshot({ path: file, fullPage: true }).catch(() => {});

    results.push({
      route,
      viewport: vp.name,
      status,
      overflowPx: overflow ? overflow.scrollW - overflow.clientW : null,
      errors,
      file,
    });
    await page.close();
  }
  await ctx.close();
}

await browser.close();

let bad = 0;
for (const r of results) {
  const flags = [];
  if (r.status !== "ok") flags.push(r.status);
  if (r.overflowPx && r.overflowPx > 1) flags.push(`h-overflow ${r.overflowPx}px`);
  if (r.errors.length) flags.push(`${r.errors.length} console error(s)`);
  if (flags.length) bad++;
  console.log(
    `${flags.length ? "FAIL" : " ok "}  ${r.route.padEnd(18)} ${r.viewport.padEnd(8)} ${flags.join(" | ")}`,
  );
  r.errors.slice(0, 3).forEach((e) => console.log(`         ${e}`));
}
console.log(`\n${results.length} shots -> ${OUT}   (${bad} with findings)`);
