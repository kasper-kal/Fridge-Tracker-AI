/**
 * Style-layer audits. No layout, no contrast: these judge the CSS itself.
 *
 *  1. Dead-name audit - every class the markup actually renders must have a
 *     rule in the stylesheet. A class with no rule is not a spacing value that
 *     looks wrong; it is a style that silently evaluated to nothing.
 *  2. Breakpoint audit - every width in every @media must be on the register,
 *     and the register must state a reason for each one.
 *
 * Both read the live CSSOM, so Tailwind's generated utilities count as rules
 * and a class that only exists in an unreached branch is still judged on the
 * screens that do render.
 *
 * Usage: node scripts/audit/styles.cjs
 */
const {
  ROUTES,
  probeServer,
  seed,
  launch,
  newPage,
  openRoute,
  loadRegister,
  unseed,
  report,
  finish,
} = require("./lib.cjs");

const requested = process.env.AUDIT_WIDTHS?.split(",").map(Number);
const SCREEN_WIDTHS = [390, 768, 1440].filter((width) => !requested || requested.includes(width));

async function main() {
  await probeServer();
  const register = loadRegister();
  const user = await seed();

  const browser = await launch();
  const usedClasses = new Map(); // token -> element count
  const css = { classSelectors: new Set(), mediaWidths: new Map(), mediaConditions: new Set(), ruleCount: 0 };
  const screens = [];
  const runtimeErrors = [];

  for (const [, route] of ROUTES) {
    for (const width of SCREEN_WIDTHS) {
      const { page, context, errors } = await newPage(browser, { width, user });
      await openRoute(page, route);
      const data = await page.evaluate(() => {
        const used = {};
        let elements = 0;
        for (const el of document.querySelectorAll("*")) {
          elements += 1;
          for (const token of el.classList) used[token] = (used[token] || 0) + 1;
        }

        const classSelectors = [];
        const mediaConditions = [];
        let ruleCount = 0;

        // Tailwind writes `.lg\:flex` and `.bg-primary\/10`; CSS escapes are not
        // class names, so undo them before comparing with classList tokens. The
        // token is captured from the raw selector (where every special character
        // is escaped) and unescaped afterwards, so `[&_svg]:size-4` survives
        // intact while a structural `:hover` is not swallowed into the name.
        const unescape = (value) =>
          value
            .replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, hex) =>
              String.fromCodePoint(parseInt(hex, 16)),
            )
            .replace(/\\(.)/g, "$1");

        const classTokensIn = (selectorText) =>
          [...selectorText.matchAll(/\.((?:\\[0-9a-fA-F]{1,6}\s?|\\.|[\w-])+)/g)].map((match) =>
            unescape(match[1]),
          );

        const walk = (rules, owner) => {
          for (const rule of rules) {
            if (rule.selectorText) {
              ruleCount += 1;
              for (const token of classTokensIn(rule.selectorText)) {
                classSelectors.push(token);
              }
            }
            if (rule.media && rule.conditionText) {
              mediaConditions.push({ condition: rule.conditionText, owner });
            }
            if (rule.cssRules) walk(rule.cssRules, owner);
          }
        };
        for (const sheet of document.styleSheets) {
          const node = sheet.ownerNode;
          const owner =
            node?.getAttribute?.("data-vite-dev-id") ??
            (sheet.href ? new URL(sheet.href).pathname : "inline <style>");
          try {
            walk(sheet.cssRules, owner);
          } catch {
            /* a cross-origin sheet (Clerk) cannot be read; counted in the limits */
          }
        }
        const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        return { used, elements, classSelectors, mediaConditions, ruleCount, rootFontSize };
      });

      screens.push(`${route || "/"}@${width}`);
      runtimeErrors.push(...errors);
      if (errors.length) continue;

      for (const [token, count] of Object.entries(data.used)) {
        usedClasses.set(token, (usedClasses.get(token) || 0) + count);
      }
      for (const name of data.classSelectors) css.classSelectors.add(name);
      css.ruleCount = Math.max(css.ruleCount, data.ruleCount);
      for (const { condition, owner } of data.mediaConditions) {
        css.mediaConditions.add(condition);
        const widths = [...condition.matchAll(/(?:min|max)-width:\s*([\d.]+)(px|rem|em)/g)];
        for (const [, value, unit] of widths) {
          const px = unit === "px" ? Number(value) : Number(value) * data.rootFontSize;
          const entry = css.mediaWidths.get(px) ?? {
            count: 0,
            conditions: new Set(),
            owners: new Set(),
          };
          entry.count += 1;
          entry.conditions.add(condition);
          entry.owners.add(owner);
          css.mediaWidths.set(px, entry);
        }
      }
      await context.close();
    }
  }
  await browser.close();
  // The fridge is one shared list, so the demo food leaves with the browser.
  await unseed();

  if (runtimeErrors.length) {
    console.log(`[styles] the app threw while being read (${runtimeErrors.length}):`);
    for (const line of runtimeErrors.slice(0, 8)) console.log(`  - ${line}`);
  }

  // ---- Dead-name audit -------------------------------------------------
  const markers = register.classMarkers ?? [];
  const isMarker = (token) => markers.some((m) => new RegExp(m.pattern).test(token));
  const findings = [];
  let judgedClasses = 0;

  for (const token of [...usedClasses.keys()].sort()) {
    if (isMarker(token)) continue;
    judgedClasses += 1;
    if (!css.classSelectors.has(token)) {
      findings.push({
        where: `class "${token}"`,
        what: `rendered on ${usedClasses.get(token)} element(s) and has no rule in any stylesheet`,
      });
    }
  }

  const unrendered = [...css.classSelectors].filter((name) => !usedClasses.has(name) && !isMarker(name));
  const info = [
    `screens read: ${screens.length} (${ROUTES.length} routes x ${SCREEN_WIDTHS.length} widths)`,
    `${css.ruleCount} style rules, ${css.classSelectors.size} distinct class selectors`,
    `${usedClasses.size} distinct classes rendered, ${judgedClasses} judged after ${markers.length} markers`,
    `class selectors with no element on these screens: ${unrendered.length} (not a failure: a dialog or a state that these screens do not open)`,
    `${css.mediaConditions.size} distinct @media conditions`,
  ];

  const deadCode = report({
    audit: "dead-name",
    judged: judgedClasses,
    unit: "classes",
    findings,
    info,
    coverage: 150,
  });

  // ---- Breakpoint audit ------------------------------------------------
  const registerWidths = new Map((register.breakpoints ?? []).map((b) => [Number(b.min), b]));
  const breakpointFindings = [];
  for (const [width, entry] of [...css.mediaWidths.entries()].sort((a, b) => a[0] - b[0])) {
    const registered = registerWidths.has(width);
    if (!registered) {
      breakpointFindings.push({
        where: `@media ${[...entry.conditions][0]}`,
        what: `${width}px is not in the breakpoint register, ${entry.count} rule(s) behind it`,
        measured: `${[...entry.owners].join(", ")}`,
      });
    }
  }
  const unused = [...registerWidths.keys()].filter((width) => !css.mediaWidths.has(width));

  const breakpointInfo = [
    `widths found: ${[...css.mediaWidths.keys()].sort((a, b) => a - b).join(", ") || "none"}`,
    `widths on the register: ${[...registerWidths.keys()].sort((a, b) => a - b).join(", ") || "none"}`,
    ...(unused.length ? [`registered but unused: ${unused.join(", ")}px`] : []),
    ...(registerWidths.size
      ? []
      : ["the register is empty, so this gate is currently a wall with no reasons on it"]),
  ];

  const breakpointCode = report({
    audit: "breakpoints",
    judged: css.mediaWidths.size,
    unit: "media widths",
    findings: breakpointFindings,
    info: breakpointInfo,
    coverage: 1,
  });

  finish(Math.max(deadCode, breakpointCode));
}

main().catch((error) => {
  console.error(`[styles] crashed: ${error.stack}`);
  finish(2);
});
