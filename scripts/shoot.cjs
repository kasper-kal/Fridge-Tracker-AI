/**
 * Local visual audit. Seeds a demo profile + products through the API, opens the
 * dev server in Chromium at desktop and phone sizes, screenshots every route and
 * records console/page errors.
 *
 * Playwright is not a workspace dependency; install it wherever you like and
 * point PLAYWRIGHT_PATH at it (it defaults to normal module resolution).
 * Run with LD_LIBRARY_PATH and PLAYWRIGHT_BROWSERS_PATH pointing at that
 * install's browsers too.
 */
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? "playwright");
const fs = require("node:fs/promises");

const BASE = process.env.AUDIT_BASE ?? "http://127.0.0.1:3000";
const API = `${BASE}/api`;
const OUT =
  process.env.AUDIT_OUT ??
  require("node:path").resolve(__dirname, "..", "artifacts", "screens");
const DEVICE_ID = "audit-device-1";

const PRODUCTS = [
  { name: "Melk", quantity: 1, unit: "l", storageLocation: "fridge" },
  { name: "Aardbeien", quantity: 250, unit: "g", storageLocation: "fridge" },
  { name: "Oude kaas", quantity: 3, unit: "plakken", storageLocation: "fridge" },
  { name: "Spinazie", quantity: 400, unit: "g", storageLocation: "freezer" },
  { name: "Pizza margherita", quantity: 2, unit: "stuks", storageLocation: "freezer" },
  { name: "Rijst", quantity: 2, unit: "kg", storageLocation: "pantry" },
  { name: "Olijfolie", quantity: 1, unit: "fles", storageLocation: "pantry" },
  { name: "Koffiebonen", quantity: 500, unit: "g", storageLocation: "pantry" },
];

async function seed() {
  const res = await fetch(`${API}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId: DEVICE_ID, username: "Kasper" }),
  });
  const user = await res.json();
  const existing = await (await fetch(`${API}/products`)).json();
  if (Array.isArray(existing) && existing.length > 0) return user;
  for (const p of PRODUCTS) {
    await fetch(`${API}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-device-id": DEVICE_ID },
      body: JSON.stringify(p),
    });
  }
  return user;
}

const ROUTES = [
  ["koelkast", "/"],
  ["vriezer", "/freezer"],
  ["voorraad", "/pantry"],
  ["account", "/account"],
  ["uitleg", "/help"],
  ["voorwaarden", "/terms"],
  ["privacy", "/privacy"],
  ["inloggen", "/sign-in"],
  ["aanmelden", "/sign-up"],
];

const VIEWPORTS = [
  ["desktop", { width: 1440, height: 900 }],
  ["phone", { width: 390, height: 844 }],
];

(async () => {
  await fs.mkdir(OUT, { recursive: true });
  const user = await seed();
  console.log("seeded user", user.id);

  const browser = await chromium.launch({
    channel: "chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  browser.on("disconnected", () => console.log("!! browser disconnected"));

  const report = [];

  for (const [vpName, viewport] of VIEWPORTS) {
    for (const [name, route] of ROUTES) {
      const context = await browser.newContext({
        viewport,
        deviceScaleFactor: 1,
        locale: "nl-NL",
      });
      await context.addInitScript(
        ([deviceId, cachedUser]) => {
          localStorage.setItem("fridge_device_id", deviceId);
          localStorage.setItem("fridge_user", cachedUser);
          localStorage.setItem("fridge_guest_mode", "1");
          localStorage.setItem("fridge_onboarding_seen", "1");
          localStorage.setItem("fridge_tour_seen", "1");
        },
        [DEVICE_ID, JSON.stringify(user)],
      );

      console.log(`-> ${vpName} ${route}`);
      const page = await context.newPage();
      const errors = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(`console: ${msg.text().slice(0, 300)}`);
      });
      page.on("pageerror", (err) => errors.push(`pageerror: ${String(err).slice(0, 300)}`));
      page.on("crash", () => errors.push("page crashed"));

      try {
        await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${OUT}/${vpName}-${name}.png`, fullPage: false });

        const metrics = await page.evaluate(() => ({
          scrollW: document.documentElement.scrollWidth,
          clientW: document.documentElement.clientWidth,
          scrollH: document.documentElement.scrollHeight,
          bodyText: (document.body.innerText || "").slice(0, 160).replace(/\s+/g, " "),
        }));
        report.push({ vp: vpName, route, ...metrics, errors });
      } catch (e) {
        errors.push(`step failed: ${String(e).slice(0, 200)}`);
        report.push({ vp: vpName, route, errors });
      }
      await context.close().catch(() => {});
    }
  }

  // Interaction shots: reveal product actions, open the add drawer.
  for (const [vpName, viewport] of VIEWPORTS) {
    const context = await browser.newContext({ viewport, locale: "nl-NL" });
    await context.addInitScript(
      ([deviceId, cachedUser]) => {
        localStorage.setItem("fridge_device_id", deviceId);
        localStorage.setItem("fridge_user", cachedUser);
        localStorage.setItem("fridge_guest_mode", "1");
        localStorage.setItem("fridge_onboarding_seen", "1");
        localStorage.setItem("fridge_tour_seen", "1");
      },
      [DEVICE_ID, JSON.stringify(user)],
    );
    console.log(`-> ${vpName} interactions`);
    const page = await context.newPage();
    const errors = [];
    let moreVisible = false;
    page.on("pageerror", (err) => errors.push(String(err).slice(0, 300)));
    try {
      await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(1500);

      const more = page.getByRole("button", { name: "Acties tonen" }).first();
      moreVisible = await more.isVisible().catch(() => false);
      if (moreVisible) {
        await more.click();
        await page.waitForTimeout(600);
        await page.screenshot({ path: `${OUT}/${vpName}-acties.png` });
      }

      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1200);
      await page.getByRole("button", { name: "Product toevoegen" }).first().click({ timeout: 8000 });
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${OUT}/${vpName}-toevoegen.png` });
    } catch (e) {
      errors.push(`interaction failed: ${String(e).slice(0, 200)}`);
    }

    report.push({ vp: vpName, route: "interactions", moreVisible, errors });
    await context.close().catch(() => {});
  }

  await browser.close();
  await fs.writeFile(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  for (const row of report) {
    const flag = row.errors?.length ? `ERRORS(${row.errors.length})` : "ok";
    console.log(
      `${row.vp.padEnd(8)} ${String(row.route).padEnd(12)} ${flag} ` +
        `w=${row.scrollW}/${row.clientW} ${row.bodyText ?? ""}`,
    );
    for (const e of row.errors ?? []) console.log(`   - ${e}`);
  }
})();
