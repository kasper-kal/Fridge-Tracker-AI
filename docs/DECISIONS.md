# Decisions

Newest first. A decision that gets corrected is deleted, not left standing next
to its replacement.

## 2026-10-23 - a deleted product is kept for a week, then destroyed

Keeping deleted rows forever is a leak with a friendly face. `startDeletionRetention`
(`artifacts/api-server/src/lib/retention.ts`) runs one sweep when the API starts
and then hourly, deleting every product whose `deleted_at` is older than seven
days (`DELETION_RETENTION_DAYS`). Restoring inside that window still works, which
is the point of the page; after it the row is gone and nothing can bring it back.
The Verwijderde producten page says so in its own words ("blijft hier een week
staan"), and the spec carries the same rule on `deletedAt`.

Checked against the real database: a row deleted eight days ago is removed by the
sweep, a row deleted six days ago survives it, and a restored row is never
touched.

## 2026-10-23 - a deleted product is kept, not destroyed

`DELETE /api/products/:id` removed the row, so a mistaken swipe was gone for
good. It now sets `products.deleted_at`; the list and the summary exclude those
rows, `GET /products/deleted` returns them newest first, and
`POST /products/:id/restore` puts one back. `DELETE /products/:id/permanent`
removes the row outright.

The new **Verwijderde producten** page (`/deleted`, reachable from Account and
the desktop sidebar) lists what was thrown away with a Herstellen button and a
trash button for permanent removal; it shares the legal pages' reading column
and is part of the audit station now. The audits' own cleanup
(`scripts/audit/lib.cjs`, `scripts/shoot.cjs`) uses `/permanent`, so seeded demo
rows can never land in the owner's deleted list.

Proven end to end against the database: create, delete (row disappears from the
list, appears at `/products/deleted` with a timestamp), restore (back in the
list), purge (gone from both) - then the whole UI path at 390px.

## 2026-10-23 - the next tap after a swipe is not swallowed

The card set an `ignoreClick` latch when a drag began and cleared it when a click
arrived. A touch drag usually produces no click, so the latch stayed set and ate
the next real tap on a swipe tile - the double tap the owner reported. It is now
a 300ms window that starts when the drag ends, so the click that belongs to a
drag is still dropped but any tap after it works the first time. Checked at
390px: one tap on Verwijder after a swipe removes exactly one card.

## 2026-10-23 - Koelkast, Voorraad, Vriezer - everywhere

The owner asked for Voorraad in the middle everywhere. The tab bar and the
sidebar already read Koelkast, Voorraad, Vriezer; the count tiles, the swipe move
tiles and the add sheet's "Bewaren in" picker read Koelkast, Vriezer, Voorraad.

Those three now follow the tab order too, so the same three locations never swap
places between screens. Amber (Voorraad) therefore sits between sky (Koelkast)
and indigo (Vriezer) in the count row. Checked at 390px in a browser: tiles
`Koelkast|Voorraad|Vriezer`, swipe row `Lijst|Voorraad|Vriezer|Verwijder`, picker
`Koelkast|Voorraad|Vriezer`.

## 2026-10-23 - the bottom bar's space is reserved once

Account scrolled into 224px of nothing. The scroll area already reserves the
bottom bar (`main` pb-24 = 96px), and the page added `pb-32` on top of it, so the
last line ("versie 1.0") sat 224px above the bottom of the document. The legal
pages had the same doubling with `pb-16`.

`pb-32` and `pb-16` are gone from those pages; the shared 96px is the only
clearance. At 390px the account document is 978px instead of 1098 and its last
line ends 16px above the tab bar at full scroll; terms and privacy do the same.
At 1024 the shell keeps `h-[100dvh]` and the scroll area does the scrolling, so
nothing changes there.

## 2026-10-23 - undo sits next to the change it undoes

Undo/redo spent the day as a fixed strip across the top that reserved 44px on
every list, then as a floating pill that sat on the page title. The owner circled
the strip: a white band with a hairline under it, above the heading, reading as
a broken header rather than a control.

A phone has no third place for a permanent bar - pinned at the top it either
reserves a band or covers the title - so the buttons now appear as a small pill
just above the + button for six seconds after a change, which is when a mistake
is noticed and undone. Nothing reserves space at the top any more: `Layout` no
longer sets `--undo-bar-inset`, the heading starts at 48px, and the toast lane
moved to a flat 12px. Verified at 390px: no toolbar on a fresh list, one after a
quantity change that clears itself, `scrollY` 0 and the heading unmoved in both
states, and no overlap with the + button.

## 2026-10-23 - a page opens at its own top

Opening Gebruiksvoorwaarden from the bottom of Account showed section 2 with the
heading off-screen: on a phone the document itself scrolls (the shell is
`min-h`, so a long page grows past the viewport) while `<main>` scrolls on
desktop, and neither was reset on a route change. `Layout` now scrolls both back
to the top whenever `location` changes. Checked at 390px across account -> terms,
terms -> account, account -> privacy, pantry -> freezer, account -> help and
help -> account: every one lands with `scrollY` 0 and its `h1` on screen.

While there: the floating `+` is now drawn on the three storage lists only. On a
legal page there is nothing to add and it was parked on the text.

## 2026-10-23 - opening a row is a swipe, closing it is a pull

The swipe judged the release point against the same 60px threshold in both
directions. An open card sits at `-width`, so getting it back past `-60` meant
dragging nearly the whole card width to the right, and the owner reported the
row as almost impossible to close.

Closing is now judged on intent instead: while open, any pull of more than 24px
to the right (or most of the way home) closes the card, and a smaller nudge
snaps it back open. Verified in a browser at 390px: a 200px swipe opens, a 40px
pull closes, a 12px nudge leaves it open, and no action behind the card fires.

## 2026-10-23 - the audits leave no food behind

The fridge is one shared list: `/api/products` scopes by household or by
`household_id IS NULL`, not by device, so anything the audit seeds is the
owner's own screen. The screenshots and `pnpm run audit` were seeding eight
demo products into that list and never removing them, and the owner saw them as
their own inventory.

`scripts/audit/lib.cjs`, `scripts/audit/browser.cjs`, `scripts/audit/styles.cjs`
and `scripts/shoot.cjs` now record every row they create and delete those ids
when the run ends (`unseed()`), and the runs print how many they removed. Proven
by running the full audit and counting: 8 removed, `select count(*) from
products` is 0 afterwards. The eight demo rows and the two audit profiles that
were already in the database are deleted.

## 2026-10-23 - each location carries its own colour

The owner pointed at the swipe strip (emerald for Lijst, sky for Koelkast,
indigo for Vriezer, red for Verwijder) and asked why the app had lost its
colours; the freezer screen, with nothing but navy on it, was the proof. The
pages keep their navy/ice-blue base, and the three places where the three
locations sit side by side now wear the strip's palette:

- the count strip on phones - a sky, indigo and amber tile, the active page's
tile ringed in its own colour,
- the active item in the bottom bar and the desktop sidebar,
- the empty-state icon on each page.

Tints are `-500/10` with `-700` numerals and labels, which keeps every one of
these above AA on its own tile (the layout instrument judges all of them; 0
findings). Koelkast is sky, Vriezer indigo, Voorraad amber - the same mapping
the swipe tiles use, so amber only appears when a product moves *out of* the
fridge or freezer.

Untouched, because the owner did not ask for it: the navy primary, the page
background, the + button and the header.

## 2026-10-23 - the palette is not mine to redraw

The first run also darkened things that were legible enough to leave alone, and
that read as a new design: the swipe tiles went from `*-500` to `*-700` and the
red action fill from `0 84% 60%` to `0 72% 42%`. Both are reverted. The tiles
are `emerald/sky/indigo/amber-500` again and `--destructive` is `0 84% 60%`.

What that costs, measured on the same station: the white 9px labels on the
`/help` illustration are 2.15 - 3.82:1, and the same fills carry the product's
own 10px tiles. That is below AA and is now a known, accepted trade-off rather
than a fixed defect: the illustration has to draw the tiles the product really
has, and the real fix - darkening the product's tiles - is the owner's call.
The finding is registered under `uitleg ::` with that reason.

`--muted-foreground` stays at 41%: a four-point lightness shift that is not
readable as a colour, and the only thing keeping every page subtitle at AA
instead of 4.36:1.

## 2026-10-22 - every gate seen red before it was trusted

Each instrument was run against a defect planted for it, and the red output was
kept before reverting. Proof runs narrowed the station with `AUDIT_ROUTES` /
`AUDIT_WIDTHS` to keep them cheap; the rule under test does not depend on the
width of the sweep.

| gate | planted defect | red output |
|---|---|---|
| dead-name | `.custom-scrollbar` rule renamed in `index.css` | `class "custom-scrollbar" :: rendered on 7 element(s) and has no rule in any stylesheet` |
| breakpoints | `@media (min-width: 1111px)` added | `1111px is not in the breakpoint register, 7 rule(s) behind it` |
| contrast | `--muted-foreground` back to 45% | `4.36:1 < 4.5:1 (16px/500)` on every screen with a page subtitle |
| target size | name-edit button padding removed again | `effective target smaller than 24x24 [16x16px]` |
| icons | sidebar brand glyph set to `h-5 w-3` | `glyph is not square [12x20px]` and `painted non-square` |
| consistency | second `Boodschappenlijst` control with a square shape on `/help` | `one action drawn differently on different screens [(pill ...) on 1 screen(s) ; (0px / rgb(29, 69, 150) ...) on 1 screen(s)]` |
| wording | `<h2>1 item(s) in storageLocation</h2>` on `/help` | `plural artefact in a label` and `raw machine value shown to the user` (2 findings) |

All seven reverted afterwards; the full suite is green on the unmodified
product.

## 2026-10-22 - what the first full run found, and what was changed

Measured before -> after on the same stations (390/767/768/1024/1440, light
plus dark at both ends, eight routes, 55 screens):

| finding | before | after | change |
|---|---|---|---|
| page subtitles and other muted text | 4.36:1 (AA needs 4.5) | 5.06:1 on the header tint, 4.77:1 on the secondary surface | `--muted-foreground` 45% -> 41% lightness |
| white text on the red swipe action | 3.78:1 | unchanged | reverted the same day, see above |
| white 10px labels on the move/list tiles | 2.15 - 2.78:1 | unchanged | reverted the same day, see above |
| name-edit button | 16x16 target | 24x24 | added `p-1 -m-1 rounded-full` |
| classes with no rule | 4 (`pb-safe`, `custom-scrollbar`, `hover-elevate`, `active-elevate-2`) | 0 | the four rules were restored in `index.css`, in the utilities layer, using the `--elevate-*` values that already existed for them |

Contrast coverage went from 961 to 2299 text judgements once an opaque app shell
was allowed to hide the body's radial gradient instead of marking everything
under it unjudged.

Remaining differences are in `scripts/audit/register.json` as exemptions, each
with its reason: navigation surfaces per mode, the floating add button, the
legal pages' narrower reading column, the short swipe-tile label, and the brand
lockup sharing the refrigerator glyph.

## 2026-10-22 - measurements are instruments, screenshots are for people

**Decision.** Layout, glyph, placement and wording promises are judged by the
scripts in `scripts/audit/` (see `docs/AUDITS.md`), not by looking at a
screenshot. Screenshots stay for showing what changed.

**Stations.** 390 / 767 / 768 / 1024 / 1440 px; light everywhere, dark at the two
ends; eight routes; AA contrast; 24x24 effective targets; nl only.

**Why.** The failure being guarded against is a defect fixed on the screens that
were named and reported again on the next screen. A number measured across every
screen, width and appearance is the only report that cannot be re-reported.

**Consequences.**
- A finding is one line, with the screen and the measured value.
- An audit that judged nothing fails instead of passing.
- Exemptions live in `scripts/audit/register.json` and need a reason. An
  exemption without a reason is not read.
- Breakpoint widths are registered with their reason; a new width is a
  conversation, not a wall.

## 2026-10-22 - what is exempt, and why

| exemption | reason |
|---|---|
| every `dark/` contrast finding | the `.dark` palette exists in `index.css` but no control reaches it. Measured and printed, not enforced, until a control exists. |
| `lucide-*`, `group`, `peer`, `dark`, `radix-*` classes | markers consumed by variants or by the component library; they are meant to have no rule of their own |

No other exemption is in force.

## 2026-10-22 - chromium libraries and fonts are unpacked, not installed

This VM has no root, no Chromium shared libraries and no fonts at all. Text
metrics without fonts are meaningless, so `scripts/audit/setup-browser.sh`
unpacks the needed `.deb` files into `/tmp/pwlibs` and points the launcher at
them; `scripts/audit/env.sh` loads that. Playwright itself stays out of the
workspace dependencies, in `node_modules_pw_tmp`.
