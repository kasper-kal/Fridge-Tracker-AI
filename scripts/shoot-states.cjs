/**
 * Local visual audit of the overlay states (drawers, dialogs, onboarding) at
 * desktop and phone sizes.
 *
 * Playwright is not a workspace dependency; install it wherever you like and
 * point PLAYWRIGHT_PATH at it (it defaults to normal module resolution).
 */
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? "playwright");
const fs = require("node:fs/promises");
const path = require("node:path");

const BASE = process.env.AUDIT_BASE ?? "http://127.0.0.1:3000";
const OUT =
  process.env.AUDIT_OUT ?? path.resolve(__dirname, "..", "artifacts", "screens");
const DEVICE_ID = "audit-device-1";
const USER = {
  id: 5,
  deviceId: DEVICE_ID,
  username: "Kasper",
  isBanned: false,
  householdId: null,
  householdName: null,
  householdIsCreator: false,
};

const VIEWPORTS = [
  ["desktop", { width: 1440, height: 900 }],
  ["phone", { width: 390, height: 844 }],
];

async function shot(browser, vpName, viewport, name, storage, route = "/", after) {
  const context = await browser.newContext({ viewport, locale: "nl-NL" });
  await context.addInitScript((entries) => {
    for (const [k, v] of entries) localStorage.setItem(k, v);
  }, Object.entries(storage));
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  try {
    await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !document.body.innerText.includes("Account laden"), null, {
      timeout: 15000,
    }).catch(() => {});
    await page.waitForTimeout(900);
    if (after) await after(page).catch((e) => errors.push(`after: ${String(e).slice(0, 160)}`));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${vpName}-state-${name}.png` });
    const text = (await page.innerText("body")).slice(0, 200).replace(/\s+/g, " ");
    console.log(`${vpName.padEnd(8)} ${name.padEnd(16)} ${errors.length ? "ERR " + errors.join(" | ") : "ok"} :: ${text}`);
  } catch (e) {
    console.log(`${vpName} ${name} FAILED ${String(e).slice(0, 200)}`);
  }
  await context.close().catch(() => {});
}

(async () => {
  await fs.mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({
    channel: "chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  const signedIn = {
    fridge_device_id: DEVICE_ID,
    fridge_user: JSON.stringify(USER),
    fridge_guest_mode: "1",
    fridge_onboarding_seen: "1",
    fridge_tour_seen: "1",
    fridge_cookie_consent: "accepted",
  };
  const freshUserNoName = Object.assign({}, signedIn);

  for (const [vp, viewport] of VIEWPORTS) {
    // 1. Nobody signed in, no profile on this device.
    await shot(browser, vp, viewport, "gate", {});

    // 2. Onboarding slides (first run).
    await shot(browser, vp, viewport, "onboarding", { fridge_guest_mode: "1" });

    // 3. Setup dialog: no profile yet on this device.
    await shot(browser, vp, viewport, "setup", {
      fridge_guest_mode: "1",
      fridge_onboarding_seen: "1",
      fridge_tour_seen: "1",
      fridge_cookie_consent: "accepted",
    });

    // 4. Manual add form inside the drawer.
    await shot(browser, vp, viewport, "add-manual", signedIn, "/", async (page) => {
      const trigger =
        vp === "desktop"
          ? page.getByRole("button", { name: "Product toevoegen" }).first()
          : page.getByRole("button", { name: "Product toevoegen" }).first();
      await trigger.click();
      await page.waitForTimeout(500);
      await page.getByText("Handmatig toevoegen").first().click();
      await page.waitForTimeout(600);
    });

    // 5. Shopping list drawer.
    await shot(browser, vp, viewport, "shopping", signedIn, "/", async (page) => {
      await page.getByRole("button", { name: "Boodschappenlijst" }).first().click();
      await page.waitForTimeout(600);
    });
  }

  await browser.close();
})();
