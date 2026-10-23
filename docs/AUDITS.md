# Audit instruments

Every promise in this project that a screenshot could only *suggest* has an
instrument here that *measures* it, prints how many things it judged, and exits
non-zero when it finds something. A run over nothing is a failure, not a pass.

```
bash scripts/audit/setup-browser.sh     # once per machine / after a restore
bash scripts/audit/run.sh               # every instrument
bash scripts/audit/run.sh styles        # dead names + breakpoints only
bash scripts/audit/run.sh browser --only=icons
```

The app must be running on `127.0.0.1:3000` with the API on `8080`. Override
with `AUDIT_BASE`.

## The stations

| station | value | set by |
|---|---|---|
| widths | 390, 767, 768, 1024, 1440 px | `WIDTHS` in `scripts/audit/lib.cjs` |
| appearances | light everywhere; dark at 390 and 1440 | `APPEARANCES`, `DARK_WIDTHS` |
| screens | `/`, `/freezer`, `/pantry`, `/account`, `/help`, `/terms`, `/privacy`, `/deleted` | `ROUTES` |
| text contrast | WCAG AA: 4.5:1 normal, 3:1 for >=24px or >=18.66px bold | `layoutProbe` |
| effective target | 24x24 CSS px (WCAG 2.2 AA 2.5.8), inline links exempt | `layoutProbe` |
| language | nl only - the app has no dictionary layer | `wordingProbe` |

767 and 1024 are not extra modes: they are the two edges of the project's own
breakpoints, where a page that is half mobile and half desktop shows up.

## The instruments

| script | judges | fails on |
|---|---|---|
| `styles.cjs` dead-name | every class rendered, against every class selector in the live CSSOM (Tailwind's generated utilities included) | a class in the markup that no rule matches |
| `styles.cjs` breakpoints | every `min-width`/`max-width` in every stylesheet | a width missing from `register.json` |
| `browser.cjs` layout | text contrast, effective target size, clipped text, sideways scroll, and the top edge / content rail agreeing between screens at one width | any of those |
| `browser.cjs` icons | every rendered `<svg>` | non-square, fractional pixel, unnamed, or more than one stroke weight |
| `browser.cjs` consistency | every control grouped by its label | one label with two glyphs or two shapes, or one glyph for two named actions |
| `browser.cjs` wording | every heading, control label, placeholder, aria-label and title | `(s)` plurals, raw enum values, demo vocabulary, missing capital, shouted labels |

## What each one cannot prove

| instrument | proves | does not prove |
|---|---|---|
| dead-name | every rendered class has a rule | that the rule looks right, or that unrendered branches have one |
| breakpoints | no width is outside the register | that the layout at that width is good |
| layout | contrast, targets, clipping, overflow, the rail | wording, glyph identity, whether the place is right |
| icons | shape, size, naming, weight | that the glyph means the right thing |
| consistency | one action, one glyph, one shape | contrast, wording, or that the shape is a good one |
| wording | `(s)`, raw tokens, demo words, capitalisation | whether the sentence helps |

Known blind spots, measured rather than assumed:

* Contrast is skipped for text over an image or radial gradient: the run prints
  how many elements it could not judge. Gradient backgrounds are judged against
  both ends of the gradient, so a finding is a finding at every point.
* Dark is fully measured and never enforced: nothing in the product switches to
  it, so no user sees those screens (see `register.json`, `exemptions.contrast`).
* Classes only rendered inside a dialog or a state these screens never open are
  not judged by dead-name. The `class selectors with no element` count in the
  output is not a failure for the same reason.
* Clerk's cross-origin stylesheet cannot be read from the CSSOM and is outside
  the dead-name judgement.

## A gate is only a gate once it has been seen red

For each instrument: plant the defect it claims to catch, run it, keep the red
output, revert, run it again and keep the green one. The planted defects and
their output are recorded in `docs/DECISIONS.md`.
