/**
 * Behavioural audits, in a real browser.
 *
 * Four instruments share one walk of the product so a screen is only loaded
 * once:
 *
 *  - layout      : contrast, effective target size, clipped text, horizontal
 *                  overflow, and the top row agreeing between screens
 *  - icons       : every rendered glyph is square, whole-pixel, named and
 *                  drawn at one stroke weight
 *  - consistency : every control grouped by the action it performs - one label,
 *                  one glyph, one shape per action
 *  - wording     : standalone labels in Dutch for plural artefacts, raw enum
 *                  values, demo vocabulary and capitalisation
 *
 * Each prints how many things it judged, so an empty run cannot pass, and one
 * line per finding with the screen it was seen on.
 *
 * Usage: node scripts/audit/browser.cjs [--only=layout,icons,consistency,wording]
 */
const {
  ROUTES,
  WIDTHS,
  DARK_WIDTHS,
  probeServer,
  seed,
  launch,
  newPage,
  openRoute,
  loadRegister,
  exemptionsFor,
  exempt,
  unseed,
  report,
  finish,
} = require("./lib.cjs");

const ONLY = (process.argv.find((arg) => arg.startsWith("--only=")) ?? "")
  .replace("--only=", "")
  .split(",")
  .filter(Boolean);
const wants = (name) => ONLY.length === 0 || ONLY.includes(name);

/* ------------------------------------------------------------------ layout */

function layoutProbe() {
  const findings = [];
  let contrastJudged = 0;
  let contrastUnjudged = 0;
  let contrastGradient = 0;
  const unjudgedWhy = { transparent: 0, hidden: 0, animated: 0, image: 0, tiny: 0 };
  const imageReasons = new Map();
  let targetsJudged = 0;
  let targetExemptInline = 0;
  let textJudged = 0;
  let barsJudged = 0;

  const parseColor = (value) => {
    const match = value && value.match(/^rgba?\(([^)]+)\)$/);
    if (!match) return null;
    const parts = match[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (parts.length < 3) return null;
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  };

  // oklab(L a b / alpha) and oklch(L C H / alpha): how Tailwind v4 writes its
  // palette and its tinted gradient stops. Without these, an emerald tile looks
  // like the white page behind it and every contrast number is wrong.
  const oklabToSrgb = (L, a, b, alpha) => {
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.291485548 * b;
    const l = l_ ** 3;
    const m = m_ ** 3;
    const s = s_ ** 3;
    const lin = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
    const gamma = (v) => {
      const c = Math.min(1, Math.max(0, v));
      return (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055) * 255;
    };
    return { r: gamma(lin[0]), g: gamma(lin[1]), b: gamma(lin[2]), a: alpha };
  };

  const parseOklab = (value) => {
    const match = value.match(/^oklab\(([^)]+)\)$/);
    if (!match) return null;
    const [channels, alphaPart] = match[1].split("/");
    const [L, a, b] = channels.trim().split(/\s+/).map(Number);
    return oklabToSrgb(L, a, b, alphaPart === undefined ? 1 : Number(alphaPart.trim()));
  };

  const parseOklch = (value) => {
    const match = value.match(/^oklch\(([^)]+)\)$/);
    if (!match) return null;
    const [channels, alphaPart] = match[1].split("/");
    const [L, C, H] = channels.trim().split(/\s+/).map(Number);
    const hue = (H * Math.PI) / 180;
    return oklabToSrgb(
      L,
      C * Math.cos(hue),
      C * Math.sin(hue),
      alphaPart === undefined ? 1 : Number(alphaPart.trim()),
    );
  };

  const parseAny = (value) => parseColor(value) ?? parseOklab(value) ?? parseOklch(value);

  const composite = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });

  const luminance = (color) => {
    const channel = (value) => {
      const v = value / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
  };

  const ratio = (a, b) => {
    const first = luminance(a);
    const second = luminance(b);
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  };

  /**
   * Every colour the background behind `el` could take. A gradient contributes
   * both of its stops, and the judgement uses the worst of them - a text that
   * fails against both ends of a gradient fails everywhere in between, which is
   * a claim about pixels that were never sampled.
   */
  const backgroundsBehind = (el) => {
    const chain = [];
    for (let node = el; node; node = node.parentElement) chain.push(node);
    chain.reverse();

    let bases = [{ r: 255, g: 255, b: 255, a: 1 }];
    let unjudged = null;
    let fromGradient = false;
    let hidden = false;
    let animated = false;

    for (const node of chain) {
      const style = getComputedStyle(node);
      if (Number(style.opacity) < 1) animated = true;
      if (Number(style.opacity) === 0) hidden = true;

      const image = style.backgroundImage;        if (image && image !== "none") {
        if (/url\(|radial-gradient|conic-gradient|repeating-/.test(image)) {
          unjudged = `${node.tagName.toLowerCase()} has ${image.split("(")[0]}(...)`;
        } else {
          const stops = [...image.matchAll(/(rgba?\([^)]*\)|oklab\([^)]*\)|oklch\([^)]*\))/g)]
            .map((match) => parseAny(match[1]))
            .filter(Boolean);
          if (stops.length === 0) {
            unjudged = `${node.tagName.toLowerCase()} has an unparsed gradient`;
          } else {
            fromGradient = stops.length > 0;
            const next = [];
            for (const base of bases) for (const stop of stops) next.push(composite(stop, base));
            bases = next.slice(0, 8);
          }
        }
      }

      const color = parseAny(style.backgroundColor);
      if (color && color.a >= 0.999) {
        // An opaque fill hides everything painted behind it, so a radial
        // gradient on <body> stops mattering under an opaque app shell instead
        // of poisoning every text element on the page as "unjudged".
        bases = [{ r: color.r, g: color.g, b: color.b, a: 1 }];
        unjudged = null;
        fromGradient = false;
      } else if (color && color.a > 0) {
        bases = bases.map((base) => composite(color, base));
      }
    }

    const unique = [];
    for (const base of bases) {
      if (!unique.some((seen) => Math.abs(seen.r - base.r) + Math.abs(seen.g - base.g) + Math.abs(seen.b - base.b) < 1)) {
        unique.push(base);
      }
    }
    return { bases: unique, unjudged, fromGradient, hidden, animated };
  };

  const isVisible = (el) => {
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  // A 1x1 clipped box is visually hidden text (sr-only, a dialog's accessible
  // title): there is nothing on screen to judge, in either direction.
  const isVisuallyHidden = (el) => {
    const rect = el.getBoundingClientRect();
    return rect.width <= 4 || rect.height <= 4;
  };

  const describe = (el) => {
    const tag = el.tagName.toLowerCase();
    const cls = el.className && typeof el.className === "string" ? el.className.split(/\s+/).slice(0, 3).join(".") : "";
    const text = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
    return `<${tag}${cls ? "." + cls : ""}> "${text}"`;
  };

  /* ---- contrast ---------------------------------------------------- */
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seenText = new Set();
  let node = walker.nextNode();
  while (node) {
    const text = (node.nodeValue || "").trim();
    const el = node.parentElement;
    if (text && el && !seenText.has(el) && !el.closest("svg") && !el.closest("[data-audit-skip]")) {
      seenText.add(el);
      if (isVisible(el)) {
        const style = getComputedStyle(el);
        const color = parseColor(style.color);
        const { bases, unjudged, fromGradient, hidden, animated } = backgroundsBehind(el);
        textJudged += 1;
        if (!color || hidden || animated || unjudged || isVisuallyHidden(el)) {
          contrastUnjudged += 1;
          if (!color) unjudgedWhy.transparent += 1;
          else if (hidden) unjudgedWhy.hidden += 1;
          else if (animated) unjudgedWhy.animated += 1;
          else if (unjudged) {
            unjudgedWhy.image += 1;
            imageReasons.set(unjudged, (imageReasons.get(unjudged) ?? 0) + 1);
          }
          else unjudgedWhy.tiny += 1;
        } else {
          const size = parseFloat(style.fontSize);
          const weight = Number(style.fontWeight) || 400;
          const large = size >= 24 || (size >= 18.66 && weight >= 700);
          const required = large ? 3 : 4.5;
          let worst = Infinity;
          for (const base of bases) worst = Math.min(worst, ratio(composite(color, base), base));
          if (fromGradient) contrastGradient += 1;
          contrastJudged += 1;
          if (worst < required) {
            findings.push({
              kind: "contrast",
              where: describe(el),
              what: `text contrast below AA`,
              measured: `${worst.toFixed(2)}:1 < ${required}:1 (${style.fontSize}/${weight})`,
            });
          }
        }
      }
    }
    node = walker.nextNode();
  }

  /* ---- effective target size --------------------------------------- */
  const interactive = document.querySelectorAll(
    'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="switch"], [role="tab"], [role="menuitem"], [role="checkbox"], [tabindex]:not([tabindex="-1"])',
  );
  for (const el of interactive) {
    if (!isVisible(el) || el.closest("[data-audit-skip]")) continue;
    const style = getComputedStyle(el);
    if (style.pointerEvents === "none") continue;
    if (isVisuallyHidden(el)) continue;
    const rect = el.getBoundingClientRect();
    const inlineInText =
      style.display === "inline" &&
      el.parentElement &&
      (el.parentElement.textContent || "").trim().length > (el.textContent || "").trim().length + 1;
    if (inlineInText) {
      targetExemptInline += 1;
      continue;
    }
    targetsJudged += 1;
    const width = Math.round(rect.width * 10) / 10;
    const height = Math.round(rect.height * 10) / 10;
    if (width < 24 || height < 24) {
      findings.push({
        kind: "target",
        where: describe(el),
        what: "effective target smaller than 24x24",
        measured: `${width}x${height}px`,
      });
    }
  }

  /* ---- clipped text ------------------------------------------------ */
  for (const el of document.querySelectorAll("h1,h2,h3,h4,p,span,button,a,label,li,td,th,div")) {
    if (el.children.length !== 0) continue;
    const text = (el.textContent || "").trim();
    if (!text || !isVisible(el) || isVisuallyHidden(el)) continue;
    const style = getComputedStyle(el);
    const clipped =
      el.scrollWidth > el.clientWidth + 1 &&
      ["hidden", "clip"].includes(style.overflowX) &&
      style.textOverflow !== "ellipsis";
    if (clipped) {
      findings.push({
        kind: "clip",
        where: describe(el),
        what: "text is clipped with no ellipsis",
        measured: `${el.scrollWidth}px in ${el.clientWidth}px`,
      });
    }
  }

  /* ---- horizontal overflow ---------------------------------------- */
  const doc = document.documentElement;
  if (doc.scrollWidth > doc.clientWidth + 1) {
    const culprits = [];
    for (const el of document.querySelectorAll("body *")) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0) continue;
      if (rect.right > doc.clientWidth + 1 || rect.left < -1) {
        culprits.push(describe(el));
        if (culprits.length > 4) break;
      }
    }
    findings.push({
      kind: "overflow",
      where: "document",
      what: "page scrolls sideways",
      measured: `${doc.scrollWidth}px wide in ${doc.clientWidth}px; ${culprits.join(", ") || "no single culprit found"}`,
    });
  }

  /* ---- the top row and the content rail ---------------------------- */
  // This app has no sticky header, so "one top edge" is measured where it is
  // visible: the first block painted inside <main>, and the left edge of the
  // page's own <h1>. Screens at one width must agree on both.
  const main = document.querySelector("main");
  let rail = null;
  if (main) {
    const mainRect = main.getBoundingClientRect();
    // The page's first block: it carries the top padding and the horizontal
    // padding, so its box is the content rail. A centred <h1> says nothing
    // about the rail and is not used for it.
    const firstBlock = main.firstElementChild?.firstElementChild;
    const blockRect = firstBlock?.getBoundingClientRect();
    rail = {
      mainTop: Math.round(mainRect.top * 10) / 10,
      firstTop: Math.round((blockRect?.top ?? mainRect.top) * 10) / 10,
      left: blockRect ? Math.round(blockRect.left * 10) / 10 : null,
      right: blockRect ? Math.round(blockRect.right * 10) / 10 : null,
      sig: blockRect
        ? `${Math.round(blockRect.top)}|${Math.round(blockRect.left)}|${Math.round(blockRect.right)}`
        : `no-block|${Math.round(mainRect.top)}`,
      detail: blockRect
        ? `first block at x=${Math.round(blockRect.left)}..${Math.round(blockRect.right)} y=${Math.round(blockRect.top)}`
        : "no block inside <main>",
    };
  }
  barsJudged = rail ? 1 : 0;

  return {
    findings,
    rail,
    counts: {
      contrastJudged,
      contrastUnjudged,
      contrastGradient,
      unjudgedWhy,
      imageReasons: [...imageReasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4),
      targetsJudged,
      targetExemptInline,
      textJudged,
      barsJudged,
    },
  };
}

/* ------------------------------------------------------------------- icons */

function iconProbe() {
  const glyphs = [];
  for (const svg of document.querySelectorAll("svg")) {
    const rect = svg.getBoundingClientRect();
    const style = getComputedStyle(svg);
    if (style.display === "none" || style.visibility === "hidden") continue;
    if (rect.width === 0 || rect.height === 0) continue;

    const control = svg.closest("button, a, [role='button'], label");
    const named =
      svg.getAttribute("aria-hidden") === "true" ||
      Boolean(svg.getAttribute("aria-label")) ||
      Boolean(svg.querySelector("title")) ||
      Boolean(control && (control.getAttribute("aria-label") || control.getAttribute("title") || (control.textContent || "").trim()));

    const classList = typeof svg.className === "string" ? svg.className : svg.className.baseVal || "";
    const lucide = (classList.match(/lucide-([a-z0-9-]+)/) || [])[1] ?? null;
    const strokes = new Set();
    for (const shape of svg.querySelectorAll("path, line, circle, rect, polyline, polygon")) {
      const stroke = getComputedStyle(shape).strokeWidth;
      if (stroke && stroke !== "0px") strokes.add(stroke);
    }
    const owner = control || svg.parentElement;
    glyphs.push({
      // Layout size, not the painted box: an active tab is scaled 1.1 by its
      // parent, and a vector glyph stays crisp under a transform, so 26.4 is a
      // rendering effect rather than a glyph on a fractional pixel.
      width: Math.round((parseFloat(style.width) || rect.width) * 100) / 100,
      height: Math.round((parseFloat(style.height) || rect.height) * 100) / 100,
      renderedWidth: Math.round(rect.width * 100) / 100,
      renderedHeight: Math.round(rect.height * 100) / 100,
      named,
      name: lucide ?? (svg.querySelector("title")?.textContent ?? "(unnamed path icon)").slice(0, 30),
      stroke: [...strokes].join(",") || "none",
      where: `<svg class="lucide-${lucide ?? "?"}"> in ${owner ? owner.tagName.toLowerCase() : "?"} "${(owner?.textContent ?? "").trim().slice(0, 24)}"`,
    });
  }
  return glyphs;
}

/* ------------------------------------------------------------- consistency */

function controlProbe() {
  const controls = [];
  const nodes = document.querySelectorAll(
    'button, a[href], [role="button"], [role="switch"], [role="tab"], input[type="submit"], summary',
  );
  for (const el of nodes) {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    if (rect.width === 0 || rect.height === 0) continue;
    if (style.visibility === "hidden" || style.display === "none") continue;

    // innerText, not textContent: a link whose label wraps onto two lines
    // ("Koelkast" over "Tracker") must not fuse into a different word, and a
    // row's trailing count ("Koelkast 3") is a badge, not part of the name.
    const label = (
      el.getAttribute("aria-label") ||
      el.getAttribute("title") ||
      (el.innerText || "").trim() ||
      el.getAttribute("placeholder") ||
      ""
    )
      .replace(/\s+/g, " ")
      .replace(/\s*\d+$/, "")
      .trim()
      .slice(0, 48);
    if (!label) continue;

    const svgs = [...el.querySelectorAll("svg")];
    const icon =
      svgs
        .map((svg) => {
          const cls = typeof svg.className === "string" ? svg.className : svg.className.baseVal || "";
          return (cls.match(/lucide-([a-z0-9-]+)/) || [])[1] ?? "path";
        })
        .join("+") || "";

    // Chromium reports 9999px as 3.35544e+07px; a pill is a pill.
    const radiusValue = parseFloat(style.borderTopLeftRadius) || 0;
    const radius = radiusValue >= 1000 ? "pill" : `${Math.round(radiusValue)}px`;
    const background = style.backgroundColor
      .replace(/(\d+\.\d{2})\d+/g, "$1")
      .replace(/\s+/g, " ");
    const border = `${parseFloat(style.borderTopWidth)}px ${style.borderTopStyle}`;
    controls.push({
      label,
      icon,
      shape: `${radius}|${background}|${border}`,
      where: `<${el.tagName.toLowerCase()}> "${label}"`,
    });
  }
  return controls;
}

/* ----------------------------------------------------------------- wording */

function wordingProbe() {
  const strings = [];
  const push = (kind, value, where) => {
    const text = (value || "").replace(/\s+/g, " ").trim();
    if (text) strings.push({ kind, text, where });
  };

  for (const el of document.querySelectorAll("h1,h2,h3,h4,h5,h6")) {
    push("heading", el.textContent, `<${el.tagName.toLowerCase()}>`);
  }
  for (const el of document.querySelectorAll("button, a[href], summary, label, th")) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    push(el.tagName === "LABEL" ? "label" : "control", el.textContent, `<${el.tagName.toLowerCase()}>`);
  }
  for (const el of document.querySelectorAll("[aria-label], [placeholder], [title]")) {
    for (const attr of ["aria-label", "placeholder", "title"]) {
      const value = el.getAttribute(attr);
      if (value) push(attr, value, `<${el.tagName.toLowerCase()} ${attr}>`);
    }
  }
  return strings;
}

/* -------------------------------------------------------------------- main */

const MACHINE_WORDS = [
  "fridge",
  "freezer",
  "pantry",
  "storageLocation",
  "deviceId",
  "householdId",
  "banReason",
  "isBanned",
  "createdAt",
  "updatedAt",
  "quantity",
  "expiryDate",
  "userId",
  "householdName",
  "isRegistered",
];

const DEMO_WORDS = [
  /(?<!bij)\bvoorbeeld\b/i,
  /\bsimulatie\b/i,
  /\bgesimuleerd\b/i,
  /\bprototype\b/i,
  /\bcoming soon\b/i,
  /\bbinnenkort beschikbaar\b/i,
  /\blorem ipsum\b/i,
  /\bplaceholder\b/i,
];

async function main() {
  await probeServer();
  const register = loadRegister();
  const user = await seed();
  const browser = await launch();

  const layoutFindings = [];
  const barsByScreen = [];
  const glyphs = [];
  const controls = [];
  const strings = [];
  const layoutCounts = {
    contrastJudged: 0,
    contrastUnjudged: 0,
    contrastGradient: 0,
    unjudgedWhy: { transparent: 0, hidden: 0, animated: 0, image: 0, tiny: 0 },
    targetsJudged: 0,
    targetExemptInline: 0,
    textJudged: 0,
    barsJudged: 0,
  };
  const screens = [];
  const runtimeErrors = [];
  const measuredStates = [];
  const unmeasuredStates = [];
  const imageReasonCounts = new Map();
  const mergeCounts = (counts) => {
    for (const [key, value] of Object.entries(counts)) {
      if (key === "imageReasons") {
        for (const [reason, count] of value) {
          imageReasonCounts.set(reason, (imageReasonCounts.get(reason) ?? 0) + count);
        }
      } else if (typeof value === "number") {
        layoutCounts[key] += value;
      } else {
        for (const [reason, count] of Object.entries(value)) layoutCounts[key][reason] += count;
      }
    }
  };

  const plan = [];
  for (const [width, name] of WIDTHS) plan.push({ width, name, appearance: "light" });
  for (const width of DARK_WIDTHS) {
    const name = WIDTHS.find(([w]) => w === width)?.[1] ?? String(width);
    plan.push({ width, name, appearance: "dark" });
  }

  for (const { width, name, appearance } of plan) {
    for (const [routeName, route] of ROUTES) {
      const { page, context, errors } = await newPage(browser, { width, user, appearance });
      await openRoute(page, route);
      const screen = `${appearance}/${name} ${routeName}`;
      screens.push(screen);

      if (wants("layout")) {
        const result = await page.evaluate(layoutProbe);
        mergeCounts(result.counts);
        for (const finding of result.findings) {
          layoutFindings.push({ ...finding, where: `${screen} :: ${finding.where}` });
        }
        if (result.rail) {
          barsByScreen.push({
            screen,
            width,
            appearance,
            signature: result.rail.sig,
            detail: result.rail.detail,
          });
        }
      }
      if (wants("icons")) {
        const result = await page.evaluate(iconProbe);
        for (const glyph of result) glyphs.push({ ...glyph, screen });
      }
      if (wants("consistency")) {
        const result = await page.evaluate(controlProbe);
        for (const control of result) controls.push({ ...control, screen });
      }
      if (wants("wording")) {
        const result = await page.evaluate(wordingProbe);
        for (const string of result) strings.push({ ...string, screen });
      }
      // States the plain walk never opens: a revealed swipe row and the add
      // sheet. A state that does not open is reported as unmeasured, not as a
      // pass.
      if (wants("layout") && appearance === "light" && width === 390 && route === "/") {
        const probeState = async (label, opened) => {
          if (!opened) {
            unmeasuredStates.push(label);
            return;
          }
          const result = await page.evaluate(layoutProbe);
          mergeCounts(result.counts);
          for (const finding of result.findings) {
            layoutFindings.push({ ...finding, where: `${screen} +${label} :: ${finding.where}` });
          }
          measuredStates.push(`${screen} +${label}`);
        };

        const firstCard = page.locator("h3").first();
        const cardBox = (await firstCard.count()) ? await firstCard.boundingBox() : null;
        if (cardBox) {
          await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
          await page.mouse.down();
          await page.mouse.move(cardBox.x + cardBox.width / 2 - 140, cardBox.y + cardBox.height / 2, {
            steps: 10,
          });
          await page.mouse.up();
          await page.waitForTimeout(500);
        }
        const swipeOpen = await page.evaluate(
          () => !document.querySelector('[data-testid="swipe-actions"]')?.hasAttribute("inert"),
        );
        await probeState("veegacties", Boolean(cardBox) && swipeOpen);

        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForTimeout(900);
        await page
          .getByRole("button", { name: "Product toevoegen" })
          .first()
          .click({ timeout: 8000 })
          .catch(() => {});
        await page.waitForTimeout(900);
        const sheetOpen = await page.evaluate(
          () => document.querySelectorAll('[role="dialog"]').length > 0,
        );
        await probeState("toevoegen", sheetOpen);
      }

      if (errors.length) runtimeErrors.push(...errors.map((error) => `${screen} ${error}`));
      await context.close();
    }
  }
  await browser.close();
  // The fridge is one shared list, so the demo food leaves with the browser.
  await unseed();

  const codes = [];

  /* ---- layout ------------------------------------------------------ */
  if (wants("layout")) {
    const exemptions = exemptionsFor(register, "contrast");
    const targetExemptions = exemptionsFor(register, "targets");
    const kept = [];
    let exempted = 0;
    for (const finding of layoutFindings) {
      const list = finding.kind === "target" ? targetExemptions : exemptions;
      if (exempt(exemptions, finding.where) || exempt(list, finding.where)) {
        exempted += 1;
        continue;
      }
      kept.push(finding);
    }

    // One top edge, one content rail: screens at the same width and appearance
    // must start their first block on the same line and their <h1> on the same x.
    const byViewport = new Map();
    for (const entry of barsByScreen) {
      const key = `${entry.appearance}/${entry.width}`;
      const bucket = byViewport.get(key) ?? new Map();
      bucket.set(entry.screen, entry);
      byViewport.set(key, bucket);
    }
    let headerGroups = 0;
    let headerDiffs = 0;
    for (const [key, bucket] of byViewport) {
      const tally = new Map();
      for (const entry of bucket.values()) tally.set(entry.signature, (tally.get(entry.signature) ?? 0) + 1);
      const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1]);
      const majority = ranked[0][0];
      headerGroups += 1;
      for (const [screen, entry] of bucket) {
        if (entry.signature !== majority) {
          headerDiffs += 1;
          if (exempt(exemptions, `${screen} :: top row`)) {
            exempted += 1;
            continue;
          }
          kept.push({
            kind: "header",
            where: `${screen} :: top row`,
            what: `top edge / content rail differs from the other screens at ${key}`,
            measured: `${entry.detail} vs majority ${majority.split("|").join("/")}`,
          });
        }
      }
    }

    codes.push(
      report({
        audit: "layout",
        judged: layoutCounts.contrastJudged + layoutCounts.targetsJudged,
        unit: "text+target judgements",
        findings: kept,
        // A narrower station (AUDIT_ROUTES / AUDIT_WIDTHS) legitimately judges
        // less; the floor scales with the screens actually visited, so "judged
        // nothing" still fails while a proof run is not called vacuous.
        coverage: Math.min(400, screens.length * 12),
        info: [
          `screens: ${screens.length} (${ROUTES.length} routes x ${WIDTHS.length + DARK_WIDTHS.length} width/appearance pairs)`,
          `contrast: ${layoutCounts.contrastJudged} judged of ${layoutCounts.textJudged} text elements; ` +
            `${layoutCounts.contrastUnjudged} unjudged (` +
            Object.entries(layoutCounts.unjudgedWhy)
              .map(([reason, count]) => `${reason} ${count}`)
              .join(", ") +
            `); ${layoutCounts.contrastGradient} judged against both ends of a gradient`,
          `not judged because of a background image: ${[...imageReasonCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([reason, count]) => `${reason} x${count}`)
            .join(", ") || "none"}`,
          `not judged because the element is hidden or in an animation: ${layoutCounts.unjudgedWhy.hidden} hidden, ${layoutCounts.unjudgedWhy.animated} animating, ${layoutCounts.unjudgedWhy.transparent} transparent, ${layoutCounts.unjudgedWhy.tiny} visually hidden`,
          `targets: ${layoutCounts.targetsJudged} judged at 24x24, ${layoutCounts.targetExemptInline} inline links exempt`,
          `top row: ${headerGroups} viewport groups compared, ${headerDiffs} screen(s) differ from their group`,
          `extra states measured: ${measuredStates.length || "none"}${measuredStates.length ? ` (${measuredStates.join(", ")})` : ""}`,
          ...(unmeasuredStates.length
            ? [`states that did not open: ${[...new Set(unmeasuredStates)].join(", ")}`]
            : []),
          `${exempted} finding(s) silenced by a register exemption with a reason`,
        ],
      }),
    );
  }

  /* ---- icons ------------------------------------------------------- */
  if (wants("icons")) {
    const exemptions = exemptionsFor(register, "icons");
    const findings = [];
    let judged = 0;
    const strokes = new Map();
    const names = new Map();
    for (const glyph of glyphs) {
      strokes.set(glyph.stroke, (strokes.get(glyph.stroke) ?? 0) + 1);
      names.set(glyph.name, (names.get(glyph.name) ?? 0) + 1);
      if (exempt(exemptions, `${glyph.screen} ${glyph.where}`)) continue;
      judged += 1;
      if (Math.abs(glyph.width - glyph.height) > 0.5) {
        findings.push({
          where: `${glyph.screen} :: ${glyph.where}`,
          what: "glyph is not square",
          measured: `${glyph.width}x${glyph.height}px`,
        });
      }
      if (Math.abs(glyph.renderedWidth - glyph.renderedHeight) > 0.5) {
        findings.push({
          where: `${glyph.screen} :: ${glyph.where}`,
          what: "glyph is painted non-square",
          measured: `${glyph.renderedWidth}x${glyph.renderedHeight}px on screen`,
        });
      }
      if (Math.abs(glyph.width - Math.round(glyph.width)) > 0.25 || Math.abs(glyph.height - Math.round(glyph.height)) > 0.25) {
        findings.push({
          where: `${glyph.screen} :: ${glyph.where}`,
          what: "glyph sits on a fractional pixel",
          measured: `${glyph.width}x${glyph.height}px`,
        });
      }
      if (!glyph.named) {
        findings.push({
          where: `${glyph.screen} :: ${glyph.where}`,
          what: "glyph is neither decorative-marked nor named",
          measured: "no aria-hidden, no label",
        });
      }
    }
    const weights = [...strokes.entries()].sort((a, b) => b[1] - a[1]);
    if (weights.length > 1) {
      findings.push({
        where: "all screens :: glyphs",
        what: "more than one stroke weight across icons",
        measured: weights.map(([value, count]) => `${value} x${count}`).join(", "),
      });
    }
    codes.push(
      report({
        audit: "icons",
        judged,
        unit: "glyphs",
        findings,
        coverage: Math.min(100, screens.length * 3),
        info: [
          `distinct glyph names: ${names.size} (${[...names.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => `${name} x${count}`).join(", ")})`,
          `stroke weights seen: ${weights.map(([value, count]) => `${value} x${count}`).join(", ")}`,
        ],
      }),
    );
  }

  /* ---- consistency ------------------------------------------------- */
  if (wants("consistency")) {
    const exemptions = exemptionsFor(register, "consistency");
    const findings = [];
    const groups = new Map();
    for (const control of controls) {
      // Appearance is a palette dimension, not a component difference: the same
      // action is allowed to be a different colour in dark. Everything else -
      // radius, border, glyph - must still agree.
      const appearance = control.screen.split("/")[0];
      const key = `${appearance}|${control.label.toLowerCase()}`;
      const group = groups.get(key) ?? {
        label: control.label,
        icons: new Map(),
        shapes: new Map(),
        shapesByScreen: new Map(),
        places: [],
      };
      if (control.icon) group.icons.set(control.icon, (group.icons.get(control.icon) ?? 0) + 1);
      group.shapes.set(control.shape, (group.shapes.get(control.shape) ?? 0) + 1);
      const perScreen = group.shapesByScreen.get(control.screen) ?? new Map();
      perScreen.set(control.shape, (perScreen.get(control.shape) ?? 0) + 1);
      group.shapesByScreen.set(control.screen, perScreen);
      group.places.push(control.screen);
      groups.set(key, group);
    }

    let judgedGroups = 0;
    let exemptedGroups = 0;
    let sameScreenVariants = 0;
    for (const [key, group] of groups) {
      if (group.icons.size === 0 && group.shapes.size === 0) continue;
      if (exempt(exemptions, `label:${group.label.toLowerCase()}`)) {
        exemptedGroups += 1;
        continue;
      }
      judgedGroups += 1;
      if (group.icons.size > 1) {
        findings.push({
          where: `label "${group.label}"`,
          what: "one action drawn with more than one glyph",
          measured: [...group.icons.entries()].map(([icon, count]) => `${icon} x${count}`).join(", "),
        });
      }
      // One action, one shape: the same label must be drawn the same way on
      // every screen. Two shapes on one screen are two affordances (a row and
      // a swipe tile), which is a different question from drift across screens.
      const screenShapes = new Map();
      for (const [screen, perScreen] of group.shapesByScreen) {
        const representative = [...perScreen.entries()].sort((a, b) => b[1] - a[1])[0][0];
        screenShapes.set(screen, representative);
      }
      const distinctAcrossScreens = new Set(screenShapes.values());
      if (distinctAcrossScreens.size > 1) {
        const byShape = new Map();
        for (const [screen, shape] of screenShapes) {
          const bucket = byShape.get(shape) ?? [];
          bucket.push(screen);
          byShape.set(shape, bucket);
        }
        findings.push({
          where: `label "${group.label}"`,
          what: "one action drawn differently on different screens",
          measured: [...byShape.entries()]
            .map(([shape, screensSeen]) => `(${shape.replaceAll("|", " / ")}) on ${screensSeen.length} screen(s)`)
            .join(" ; "),
        });
      }
      if (group.shapes.size > 1 && distinctAcrossScreens.size === 1) {
        sameScreenVariants += 1;
      }
    }

    // The inverse: one glyph reaching for two differently named actions.
    const byIcon = new Map();
    for (const control of controls) {
      if (!control.icon) continue;
      const entry = byIcon.get(control.icon) ?? new Set();
      entry.add(control.label.toLowerCase());
      byIcon.set(control.icon, entry);
    }
    for (const [icon, labels] of byIcon) {
      if (labels.size < 2) continue;
      if (exempt(exemptions, `glyph:${icon}`)) {
        exemptedGroups += 1;
        continue;
      }
      findings.push({
        where: `glyph ${icon}`,
        what: "one glyph used for more than one named action",
        measured: [...labels].join(", "),
      });
    }

    codes.push(
      report({
        audit: "consistency",
        judged: judgedGroups,
        unit: "action groups",
        findings,
        coverage: Math.min(15, Math.ceil(screens.length * 1.5)),
        info: [
          `${controls.length} controls captured across ${screens.length} screens`,
          `${groups.size} distinct labels, ${judgedGroups} judged after ${exemptedGroups} exemption(s)`,
          `${sameScreenVariants} label(s) drawn with more than one shape on the same screen: a row and a swipe tile with the same word are different affordances, so this is printed, not failed (see docs/AUDITS.md)`,
        ],
      }),
    );
  }

  /* ---- wording ----------------------------------------------------- */
  if (wants("wording")) {
    const exemptions = exemptionsFor(register, "wording");
    const findings = [];
    const seen = new Set();
    let judged = 0;
    for (const entry of strings) {
      const key = `${entry.kind}:${entry.text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (exempt(exemptions, entry.text)) continue;
      judged += 1;
      const { text } = entry;
      if (/\(s\)/i.test(text)) {
        findings.push({
          where: `${entry.screen} :: ${entry.where}`,
          what: "plural artefact in a label",
          measured: text,
        });
      }
      const machine = MACHINE_WORDS.find((word) => text.toLowerCase() === word.toLowerCase());
      if (machine || /^[a-z]+[A-Z][a-zA-Z]*$/.test(text) || text.includes("_")) {
        findings.push({
          where: `${entry.screen} :: ${entry.where}`,
          what: "raw machine value shown to the user",
          measured: `${text}${machine ? ` (= ${machine})` : ""}`,
        });
      }
      const demo = DEMO_WORDS.find((pattern) => pattern.test(text));
      if (demo) {
        findings.push({
          where: `${entry.screen} :: ${entry.where}`,
          what: "demo vocabulary in a working product",
          measured: `${text} (matched ${demo})`,
        });
      }
      const firstLetter = text.match(/[a-zA-Z]/)?.[0] ?? "";
      if (entry.kind !== "placeholder" && firstLetter && firstLetter === firstLetter.toLowerCase() && /\s/.test(text)) {
        findings.push({
          where: `${entry.screen} :: ${entry.where}`,
          what: "label does not start with a capital",
          measured: text,
        });
      }
      if (text.length > 3 && text === text.toUpperCase() && /[A-Z]/.test(text)) {
        findings.push({
          where: `${entry.screen} :: ${entry.where}`,
          what: "label is shouted in capitals",
          measured: text,
        });
      }
    }

    codes.push(
      report({
        audit: "wording",
        judged,
        unit: "standalone strings",
        findings,
        coverage: Math.min(60, screens.length * 3),
        info: [
          `${strings.length} string occurrences, ${seen.size} distinct`,
          "one language only (nl): the app has no dictionary layer, so there is nothing to cross-check",
        ],
      }),
    );
  }

  if (runtimeErrors.length) {
    console.log(`[browser] the app threw while being read (${runtimeErrors.length}):`);
    for (const line of runtimeErrors.slice(0, 6)) console.log(`  - ${line}`);
  }

  finish(codes.length ? Math.max(...codes) : 0);
}

main().catch((error) => {
  console.error(`[browser] crashed: ${error.stack}`);
  finish(2);
});
