import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const baseUrl = process.env.ONBOARDING_BASE_URL ?? "http://127.0.0.1:5173/";
const chromeBin = process.env.CHROME_BIN ?? "chromium";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function stopChrome(chrome, userDataDir) {
  if (chrome.exitCode === null) chrome.kill("SIGTERM");
  if (chrome.exitCode === null) {
    await Promise.race([
      new Promise((resolve) => chrome.once("exit", resolve)),
      sleep(5000),
    ]);
  }
  if (chrome.exitCode === null) chrome.kill("SIGKILL");
  await rm(userDataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}

class DevTools {
  nextId = 0;
  pending = new Map();

  constructor(socket) {
    this.socket = socket;
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(typeof event.data === "string" ? event.data : Buffer.from(event.data).toString());
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result ?? {});
    });
    socket.addEventListener("close", () => {
      for (const pending of this.pending.values()) pending.reject(new Error("Chrome DevTools connection closed"));
      this.pending.clear();
    });
  }

  send(method, params = {}) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const response = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
    }
    return response.result?.value;
  }
}

const mockApi = `(() => {
  const originalFetch = window.fetch.bind(window);
  let products = [];
  let nextId = 7000;
  const json = (data, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
  window.fetch = async (input, init = {}) => {
    const requestUrl = typeof input === "string" ? input : input.url;
    const url = new URL(requestUrl, window.location.href);
    const method = (init.method || (input instanceof Request ? input.method : "GET")).toUpperCase();

    if (url.pathname.endsWith("/api/users") && method === "POST") {
      const body = JSON.parse(init.body || "{}");
      return json({
        id: 9001,
        deviceId: body.deviceId || "onboarding-e2e",
        username: body.username || "Onboarding test",
        isBanned: false,
      });
    }
    if (url.pathname.endsWith("/api/products") && method === "GET") return json(products);
    if (url.pathname.endsWith("/api/products") && method === "POST") {
      const body = JSON.parse(init.body || "{}");
      const product = { id: nextId++, ...body, createdAt: new Date().toISOString() };
      products = [product, ...products];
      return json(product);
    }
    return originalFetch(input, init);
  };
})();`;

const visibleText = (text) => {
  const value = JSON.stringify(text);
  return `(() => [...document.querySelectorAll("body *")].some((el) => {
    if (el.children.length > 0) return false;
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && el.textContent?.includes(${value});
  }))()`;
};

function clickButton(text, { exact = true, selector } = {}) {
  if (selector) {
    return `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error("Missing selector: " + ${JSON.stringify(selector)}); el.click(); return true; })()`;
  }
  return `(() => {
    const expected = ${JSON.stringify(text)};
    const normalize = (s) => (s || "").replace(/\\s+/g, " ").trim();
    const button = [...document.querySelectorAll("button")].find((el) => {
      const label = normalize(el.innerText || el.getAttribute("aria-label"));
      return ${exact ? "label === expected" : "label.includes(expected)"};
    });
    if (!button) throw new Error("Missing button: " + expected);
    button.click();
    return true;
  })()`;
}

function setInput(selector, value) {
  return `(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    if (!input) throw new Error("Missing input: " + ${JSON.stringify(selector)});
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`;
}

async function waitFor(devtools, expression, label, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await devtools.evaluate(expression)) return;
    } catch {
      // A navigation can briefly destroy the current execution context.
    }
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function waitForText(devtools, text, timeoutMs = 8000) {
  await waitFor(devtools, visibleText(text), `visible text "${text}"`, timeoutMs);
}

async function click(devtools, text, options) {
  await devtools.evaluate(clickButton(text, options));
}

async function resetToIntro(devtools) {
  await devtools.evaluate("localStorage.clear(); sessionStorage.clear(); true");
  await devtools.send("Page.navigate", { url: baseUrl });
  await waitForText(devtools, "Herken je dit?");
}

async function startTour(devtools) {
  await click(devtools, "Volgende");
  await click(devtools, "Start de rondleiding");
  await waitForText(devtools, "Tik op +");
}

async function openAddMethods(devtools) {
  await click(devtools, "", { selector: 'button[aria-label="Product toevoegen"]' });
  await waitForText(devtools, "Kies hoe je wilt toevoegen");
}

async function openManualEntry(devtools) {
  await click(devtools, "Handmatig toevoegen", { exact: false });
  await waitForText(devtools, "Vul de productnaam in");
  await waitFor(devtools, '!!document.querySelector("#name")', "product name field");
  await waitForText(devtools, "Rondleiding · 3/5");
}

async function saveManualProduct(devtools, name, location) {
  await devtools.evaluate(setInput("#name", name));
  await waitForText(devtools, "Rondleiding · 4/5");
  await waitForText(devtools, "Tik op Item opslaan");
  if (location !== "fridge") {
    await devtools.evaluate(`document.querySelector('label[for="${location}-m"]').click(); true`);
  }
  await click(devtools, "", { selector: 'button[data-tour="save-product"]' });
  await waitForText(devtools, "Rondleiding · 5/5");
  await waitForText(devtools, "Veeg het gemarkeerde product naar links");
  const expectedPath = location === "fridge" ? "/" : `/${location}`;
  await waitFor(devtools, `location.pathname.endsWith(${JSON.stringify(expectedPath)})`, `route ${expectedPath}`);
  await waitForText(devtools, name);
}

async function setupBrowser() {
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), "fridge-onboarding-e2e-"));
  const chrome = spawn(chromeBin, [
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=0",
    "--remote-allow-origins=*",
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ], { stdio: "ignore" });

  let devtools;
  try {
    const activePortFile = path.join(userDataDir, "DevToolsActivePort");
    let activePort;
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        activePort = Number((await readFile(activePortFile, "utf8")).split("\n")[0]);
        if (activePort) break;
      } catch {}
      if (chrome.exitCode !== null) throw new Error(`Chromium exited with status ${chrome.exitCode}`);
      await sleep(100);
    }
    if (!activePort) throw new Error("Chromium did not open its DevTools port");

    const targetsResponse = await fetch(`http://127.0.0.1:${activePort}/json/list`);
    const targets = await targetsResponse.json();
    const page = targets.find((target) => target.type === "page");
    if (!page) throw new Error("Chromium did not create a page target");

    const socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    devtools = new DevTools(socket);
    await devtools.send("Page.enable");
    await devtools.send("Runtime.enable");
    await devtools.send("Network.enable");
    await devtools.send("Emulation.setDeviceMetricsOverride", {
      width: 402,
      height: 874,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await devtools.send("Emulation.setTouchEmulationEnabled", {
      enabled: true,
      maxTouchPoints: 1,
    });
    await devtools.send("Page.addScriptToEvaluateOnNewDocument", { source: mockApi });
    await devtools.send("Page.navigate", { url: baseUrl });
    await waitForText(devtools, "Herken je dit?", 20000);
    return { devtools, chrome, userDataDir };
  } catch (error) {
    devtools?.socket.close();
    try {
      await stopChrome(chrome, userDataDir);
    } catch {}
    throw error;
  }
}

const checks = [];
let browser;

try {
  browser = await setupBrowser();
  const { devtools } = browser;

  await click(devtools, "Intro overslaan");
  await waitForText(devtools, "Tik op +");
  assert.equal(
    await devtools.evaluate('!!document.querySelector("#setup-username")'),
    false,
    "skipping the intro keeps username setup behind the interactive tour",
  );
  checks.push("skipping the intro continues to the add-and-swipe tour before account setup");

  await resetToIntro(devtools);
  await startTour(devtools);
  await openAddMethods(devtools);
  await click(devtools, "Rondleiding overslaan");
  await waitFor(devtools, '!!document.querySelector("#setup-username")', "username setup after tour skip");
  await waitFor(devtools, '!document.querySelector("#name")', "add drawer closed after tour skip");
  checks.push("skipping with the add drawer open closes it");

  await resetToIntro(devtools);
  await startTour(devtools);
  await openAddMethods(devtools);
  await openManualEntry(devtools);
  await devtools.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  await devtools.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  await waitForText(devtools, "Tik op +");
  await waitFor(devtools, '!document.querySelector("#name")', "manual form closed without saving");
  await click(devtools, "", { selector: 'button[aria-label="Product toevoegen"]' });
  await waitForText(devtools, "Bon scannen");
  checks.push("closing an unsaved manual entry returns to the add prompt and resets the drawer");

  for (const location of ["fridge", "freezer"]) {
    await resetToIntro(devtools);
    await startTour(devtools);
    await openAddMethods(devtools);
    await openManualEntry(devtools);
    const name = `E2E ${location}`;
    await saveManualProduct(devtools, name, location);
    await click(devtools, "Verder zonder veegactie");
    await waitFor(devtools, '!!document.querySelector("#setup-username")', `setup after ${location} save`);
    checks.push(`manual save routes to ${location}`);
  }

  await resetToIntro(devtools);
  await startTour(devtools);
  await openAddMethods(devtools);
  await click(devtools, "Bon scannen", { exact: false });
  await waitForText(devtools, "Voeg een bonafbeelding toe");
  await devtools.send("Network.emulateNetworkConditions", {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
    connectionType: "none",
  });
  await devtools.evaluate(`(() => {
    const input = document.querySelector('input[type="file"]:not([capture])');
    if (!input) throw new Error("Missing receipt upload input");
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array([0, 1, 2, 3])], "broken.png", { type: "image/png" }));
    Object.defineProperty(input, "files", { configurable: true, value: transfer.files });
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);
  await waitFor(
    devtools,
    `(${visibleText("De bon kon niet worden gelezen")}) || (${visibleText("Geen tekst gevonden")})`,
    "receipt scan failure fallback",
    30000,
  );
  await devtools.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
    connectionType: "wifi",
  });
  await click(devtools, "Lukt scannen niet? Handmatig invoeren");
  await waitForText(devtools, "Vul de productnaam in");
  await saveManualProduct(devtools, "E2E OCR fallback", "freezer");
  await click(devtools, "Verder zonder veegactie");
  await waitFor(devtools, '!!document.querySelector("#setup-username")', "setup after OCR fallback save");
  checks.push("receipt OCR failure offers manual entry and can save to freezer");

  await resetToIntro(devtools);
  await startTour(devtools);
  await openAddMethods(devtools);
  await devtools.evaluate(`Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: async () => { throw new DOMException("Denied", "NotAllowedError"); } },
  }); true`);
  await click(devtools, "Barcode scannen", { exact: false });
  await waitForText(devtools, "Sta cameratoegang toe", 12000);
  await click(devtools, "Camera werkt niet? Handmatig invoeren");
  await waitForText(devtools, "Vul de productnaam in");
  checks.push("barcode camera failure exposes manual entry");

  await resetToIntro(devtools);
  await startTour(devtools);
  await openAddMethods(devtools);
  await openManualEntry(devtools);
  await saveManualProduct(devtools, "E2E pantry scroll", "pantry");
  await devtools.evaluate(`(() => {
    const target = document.querySelector('[data-tour="swipe-target"]');
    const results = target?.parentElement?.parentElement;
    if (!target || !results) throw new Error("Missing swipe target list");
    for (let i = 0; i < 14; i++) {
      const filler = document.createElement("div");
      filler.setAttribute("aria-hidden", "true");
      filler.style.height = "96px";
      results.appendChild(filler);
    }
    let scroller = null;
    for (let el = target.parentElement; el && el !== document.documentElement; el = el.parentElement) {
      if (
        el.scrollHeight > el.clientHeight + 100 &&
        /auto|scroll/.test(getComputedStyle(el).overflowY)
      ) {
        scroller = el;
        break;
      }
    }
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
    else window.scrollTo(0, document.documentElement.scrollHeight);
    return true;
  })()`);
  await waitForText(devtools, "Het product staat buiten beeld");
  const cardInBounds = await devtools.evaluate(`(() => {
    const card = document.querySelector('[role="region"][aria-label^="Rondleiding"]');
    if (!card) return false;
    const bounds = card.getBoundingClientRect();
    return bounds.top >= 0 && bounds.bottom <= innerHeight;
  })()`);
  assert.equal(cardInBounds, true, "the tour explanation remains inside the phone viewport while the target is off-screen");

  await devtools.evaluate(`document.querySelector('[data-tour="swipe-target"]').scrollIntoView({ block: "center", behavior: "instant" }); true`);
  await waitFor(
    devtools,
    `!(${visibleText("Het product staat buiten beeld")})`,
    "swipe target back in view",
  );
  const touchPointHitsTarget = `(() => {
    const target = document.querySelector('[data-tour="swipe-target"]');
    const face = document.querySelector('[data-tour="swipe-target"] div[style*="translateX"]');
    if (!target || !face) return false;
    const bounds = face.getBoundingClientRect();
    const hit = document.elementFromPoint(bounds.left + bounds.width * 0.8, bounds.top + bounds.height / 2);
    return !!hit && target.contains(hit);
  })()`;
  await waitFor(devtools, touchPointHitsTarget, "swipe target to be unobstructed by tutorial guidance");
  const touchBounds = await devtools.evaluate(`(() => {
    const card = document.querySelector('[data-tour="swipe-target"] div[style*="translateX"]');
    const target = document.querySelector('[data-tour="swipe-target"]');
    if (!card) throw new Error("Missing swipeable product face");
    const bounds = card.getBoundingClientRect();
    const x = bounds.left + bounds.width * 0.8;
    const y = bounds.top + bounds.height / 2;
    const hit = document.elementFromPoint(x, y);
    return {
      x,
      y,
      insideTarget: !!hit && !!target?.contains(hit),
      hit: hit?.outerHTML.slice(0, 180),
    };
  })()`);
  assert.equal(touchBounds.insideTarget, true, "the gesture starts on the highlighted product, not the tooltip");
  await devtools.evaluate(`window.__tourActions = [];
    window.__touchTrace = [];
    for (const type of ["touchstart", "touchmove", "touchend"]) {
      document.addEventListener(type, () => window.__touchTrace.push(type), true);
    }
    document.addEventListener("tour-action", (event) => window.__tourActions.push(event.detail.action));
    true`);
  await devtools.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: touchBounds.x, y: touchBounds.y, id: 1 }],
  });
  await devtools.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: touchBounds.x - 110, y: touchBounds.y, id: 1 }],
  });
  await devtools.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await waitFor(devtools, 'window.__tourActions.includes("swipe")', "left swipe action", 5000);
  await waitFor(devtools, '!!document.querySelector("#setup-username")', "setup after touch swipe", 5000);
  const swipeDebug = await devtools.evaluate(`(() => {
    const face = document.querySelector('[data-tour="swipe-target"] div[style*="translateX"]');
    return {
      actions: window.__tourActions,
      touchTrace: window.__touchTrace,
      touchPoint: ${JSON.stringify(touchBounds)},
      transform: face?.style.transform,
      bounds: face?.getBoundingClientRect().toJSON(),
      actionsBounds: document.querySelector('[data-testid="swipe-actions"]')?.getBoundingClientRect().toJSON(),
      setupVisible: !!document.querySelector("#setup-username"),
      tourText: document.querySelector('[role="region"][aria-label^="Rondleiding"]')?.innerText,
    };
  })()`);
  assert.ok(
    swipeDebug.actions.includes("swipe"),
    `a left swipe emits the tour completion action: ${JSON.stringify(swipeDebug)}`,
  );
  assert.equal(
    Math.abs(Number(swipeDebug.transform.slice("translateX(".length, -3))),
    swipeDebug.bounds.width,
    "a left swipe moves the whole product face out of the way",
  );
  assert.equal(
    swipeDebug.actionsBounds.width,
    swipeDebug.bounds.width,
    "the action buttons fill the same width as the product card",
  );
  assert.equal(swipeDebug.setupVisible, true, "the onboarding advances after the swipe");
  await waitFor(devtools, '!!document.querySelector("#setup-username")', "setup after the swipe tour", 10000);
  await devtools.evaluate(setInput("#setup-username", "Onboarding test"));
  await click(devtools, "", { selector: 'button[type="submit"]' });
  await waitFor(devtools, '!document.querySelector("#setup-username")', "app after username setup");
  checks.push("pantry save routes correctly; off-screen tour guidance stays visible; swipe completes onboarding");

  await click(devtools, "", { selector: 'a[href="/account"]' });
  await waitForText(devtools, "Jouw profiel en instellingen");
  await click(devtools, "Rondleiding opnieuw starten");
  await waitForText(devtools, "Herken je dit?");
  await click(devtools, "Volgende");
  await click(devtools, "Start de rondleiding");
  await waitForText(devtools, "Tik op +");
  checks.push("account settings restart the tutorial from the beginning");

  console.log(`Passed ${checks.length} onboarding smoke checks at ${baseUrl}:`);
  for (const check of checks) console.log(`- ${check}`);
} finally {
  if (browser) {
    browser.devtools.socket.close();
    await stopChrome(browser.chrome, browser.userDataDir);
  }
}
