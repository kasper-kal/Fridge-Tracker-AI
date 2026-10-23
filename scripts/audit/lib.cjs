/**
 * Shared plumbing for the audit instruments in this folder.
 *
 * Every audit in here follows the same contract:
 *
 *  - it judges a nameable station (a list of screens x widths x appearances),
 *  - it prints how many things it judged, so a run over nothing cannot pass,
 *  - it prints one line per finding, with the screen and the measured value,
 *  - it exits 1 when there is a finding and 0 when there is not.
 *
 * Playwright is not a workspace dependency. Install it with
 * `scripts/audit/setup-browser.sh` and point PLAYWRIGHT_PATH here if you kept
 * it somewhere else.
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");
const PLAYWRIGHT_PATH =
  process.env.PLAYWRIGHT_PATH ??
  path.join(ROOT, "node_modules_pw_tmp", "node_modules", "playwright");

let chromium;
try {
  ({ chromium } = require(PLAYWRIGHT_PATH));
} catch {
  console.error(
    `[audit] Playwright is not installed at ${PLAYWRIGHT_PATH}.\n` +
      `        Run scripts/audit/setup-browser.sh once, or set PLAYWRIGHT_PATH.`,
  );
  process.exit(2);
}

const BASE = process.env.AUDIT_BASE ?? "http://127.0.0.1:3000";
const API = `${BASE}/api`;
const DEVICE_ID = process.env.AUDIT_DEVICE_ID ?? "audit-device-1";

/**
 * A narrowed station, for proving a gate can fail without walking every screen:
 * AUDIT_ROUTES=koelkast,uitleg AUDIT_WIDTHS=390. Unset means the full station.
 */
const onlyRoutes = process.env.AUDIT_ROUTES?.split(",").map((name) => name.trim());
const onlyWidths = process.env.AUDIT_WIDTHS?.split(",").map(Number);

/** Every screen the product has, with the name used in findings. */
const ALL_ROUTES = [
  ["koelkast", "/"],
  ["vriezer", "/freezer"],
  ["voorraad", "/pantry"],
  ["account", "/account"],
  ["uitleg", "/help"],
  ["voorwaarden", "/terms"],
  ["privacy", "/privacy"],
  ["verwijderd", "/deleted"],
];

/**
 * Widths that matter. 390 is the narrowest phone the layout is built for;
 * 767/768 and 1024 are the exact edges of the project's own breakpoints, which
 * is where a half-mobile/half-desktop page shows up; 1440 is the desktop the
 * sidebar is designed for. See register.json for the breakpoint register.
 */
const ALL_WIDTHS = [
  [390, "phone"],
  [767, "phone-edge"],
  [768, "tablet"],
  [1024, "desktop-edge"],
  [1440, "desktop"],
];

const ROUTES = onlyRoutes ? ALL_ROUTES.filter(([name]) => onlyRoutes.includes(name)) : ALL_ROUTES;
const WIDTHS = onlyWidths ? ALL_WIDTHS.filter(([width]) => onlyWidths.includes(width)) : ALL_WIDTHS;

/** Light is the only reachable appearance; dark is measured because it exists. */
const APPEARANCES = ["light", "dark"];
const ALL_DARK_WIDTHS = [390, 1440];
const DARK_WIDTHS = WIDTHS.map(([width]) => width).filter((width) => ALL_DARK_WIDTHS.includes(width));

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

async function probeServer() {
  for (const url of [BASE, `${API}/products`]) {
    let res;
    try {
      res = await fetch(url, {
        headers: { host: new URL(BASE).host },
        signal: AbortSignal.timeout(10000),
      });
    } catch (error) {
      console.error(
        `[audit] ${url} is not reachable (${error.message}).\n` +
          `        Start the API on :8080 and the app on :3000 first.`,
      );
      process.exit(2);
    }
    if (!res.ok) {
      console.error(`[audit] ${url} answered ${res.status}.`);
      process.exit(2);
    }
  }
}

/**
 * Rows this run created. The fridge is one shared list - not a per-device one -
 * so anything seeded here lands in the owner's own screen. Every id is recorded
 * and unseed() takes them out again; an audit that leaves demo food behind is a
 * bug the owner sees.
 */
const seededProductIds = [];

/** Seeds one profile and a set of products so every screen has real content. */
async function seed() {
  const userRes = await fetch(`${API}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId: DEVICE_ID, username: "Kasper" }),
  });
  if (!userRes.ok) throw new Error(`POST /api/users -> ${userRes.status}`);
  const user = await userRes.json();

  const existing = await (await fetch(`${API}/products`)).json();
  // Seeding into a list that already has the owner's food would put fake
  // products next to real ones, so the demo set is only added to an empty list.
  if (!Array.isArray(existing) || existing.length === 0) {
    for (const product of PRODUCTS) {
      const res = await fetch(`${API}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": DEVICE_ID },
        body: JSON.stringify(product),
      });
      const created = await res.json().catch(() => null);
      if (created?.id) seededProductIds.push(created.id);
    }
  }
  return user;
}

/** Removes everything seed() added. Best effort: it never fails the instrument. */
async function unseed() {
  const ids = seededProductIds.splice(0);
  for (const id of ids) {
    // `/permanent` because a plain DELETE only moves the row to the Verwijderd
    // page now; the audit's own rows must not land in the owner's list.
    await fetch(`${API}/products/${id}/permanent`, { method: "DELETE" }).catch(() => {});
  }
  if (ids.length) console.log(`[audit] removed ${ids.length} seeded product(s) again`);
}

/**
 * The app's own first-run state, set the way a returning user has it. Dark is
 * applied by class because the product ships a `.dark` block with no control
 * that reaches it - the audit measures what the stylesheet defines.
 */
function storageState(user, appearance = "light") {
  return {
    fridge_device_id: DEVICE_ID,
    fridge_user: JSON.stringify(user),
    fridge_guest_mode: "1",
    fridge_onboarding_seen: "1",
    fridge_tour_seen: "1",
    fridge_cookie_consent: "accepted",
    fridge_appearance: appearance,
  };
}

async function launch() {
  return chromium.launch({
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
}

async function newPage(browser, { width, height = 900, user, appearance = "light", reducedMotion }) {
  const context = await browser.newContext({
    viewport: { width, height },
    locale: "nl-NL",
    deviceScaleFactor: 1,
    reducedMotion: reducedMotion ?? "no-preference",
  });
  const storage = storageState(user, appearance);
  await context.addInitScript(
    ([entries, dark]) => {
      for (const [key, value] of entries) localStorage.setItem(key, value);
      if (!dark) return;
      // addInitScript runs before the document has an <html> element.
      const apply = () => document.documentElement?.classList.add("dark");
      if (document.documentElement) apply();
      else document.addEventListener("DOMContentLoaded", apply, { once: true });
    },
    [Object.entries(storage), appearance === "dark"],
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${String(error).slice(0, 200)}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text().slice(0, 200)}`);
  });
  return { page, context, errors };
}

async function openRoute(page, route) {
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page
    .waitForFunction(() => !document.body.innerText.includes("Account laden"), null, {
      timeout: 15000,
    })
    .catch(() => {});
  await page.waitForTimeout(600);
}

function loadRegister() {
  const file = path.join(__dirname, "register.json");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function exemptionsFor(register, audit) {
  return (register.exemptions?.[audit] ?? []).map((entry) => ({
    match: entry.match,
    reason: entry.reason,
  }));
}

/** True when a finding's subject matches an exemption, which must state a reason. */
function exempt(exemptions, subject) {
  const hit = exemptions.find(
    (entry) => entry.reason && subject.toLowerCase().includes(entry.match.toLowerCase()),
  );
  return hit ?? null;
}

/**
 * Prints the run and returns the exit code. `judged` is the coverage number:
 * zero judged is a failure, not a pass, because a loop over nothing always
 * agrees with you.
 */
function report({ audit, judged, unit, findings, info = [], coverage }) {
  console.log(`[${audit}] judged ${judged} ${unit}`);
  for (const line of info) console.log(`[${audit}] ${line}`);

  if (coverage && judged < coverage) {
    console.log(
      `[${audit}] FAIL vacuous: judged ${judged} ${unit}, expected at least ${coverage}. ` +
        `An audit that measured nothing cannot pass.`,
    );
    return 1;
  }

  for (const finding of findings) {
    console.log(`  - ${finding.where} :: ${finding.what}${finding.measured ? ` [${finding.measured}]` : ""}`);
  }

  if (findings.length === 0) {
    console.log(`[${audit}] PASS 0 findings in ${judged} ${unit}`);
    return 0;
  }
  console.log(`[${audit}] FAIL ${findings.length} findings in ${judged} ${unit}`);
  return 1;
}

function finish(code) {
  process.exitCode = code;
}

module.exports = {
  BASE,
  API,
  ROOT,
  DEVICE_ID,
  ROUTES,
  WIDTHS,
  APPEARANCES,
  DARK_WIDTHS,
  PRODUCTS,
  probeServer,
  seed,
  storageState,
  launch,
  newPage,
  openRoute,
  loadRegister,
  exemptionsFor,
  exempt,
  unseed,
  report,
  finish,
};
