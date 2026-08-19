# Macro Mate — Next Phase PRD

**Product:** Macro Mate (`ritual-planner.html`)
**Owner:** Michelle
**Date:** 2026-08-05
**Status:** Draft — for Linear ticket sequencing
**Correction (2026-08-13):** This PRD originally used "mushrooms" as the running example of a disliked ingredient throughout Feature Area 2. That was wrong — Michelle likes mushrooms. All mentions below have been genericized; there's no current default excluded ingredient.

---

## Problem Statement

Macro Mate already solves Michelle's core loop: generate a macro-matched weekly meal plan from a curated recipe database and swap meals against a live budget. What it doesn't yet solve is the surrounding workflow — finding recipes that actually fit her cuisine preferences without manually scanning the rolodex, turning a finished week into something she can act on away from the screen (grocery run, fridge printout), and growing the recipe pool beyond what she's hand-entered. Right now the recipe set tops out at whatever Michelle has typed in or imported herself, and there's no way to narrow it by cuisine or exclude specific ingredients when she's deciding what to cook. Left unaddressed, this caps how long the app stays useful before the recipe pool feels repetitive and the week-to-week planning still requires a laptop in the kitchen.

## Goals

1. Michelle can filter the recipe rolodex by cuisine (Asian, Mediterranean, etc.) and exclude specific ingredients she flags in under 2 clicks.
2. A generated week plan can be exported or printed as a standalone document (not just the shopping list) for offline use.
3. The recipe pool can grow beyond manual entry by pulling candidates from an external recipe API, pre-filtered to fit macro targets.
4. All new features work within the existing single-file, no-build-step, localStorage-backed architecture — no new backend required unless explicitly scoped (recipe API calls are the one exception, see Non-Goals).
5. Two already-shipped capabilities (recipe import/export, shopping list) are documented as-built so the PRD reflects true current state for ticket planning.

## Non-Goals

- **Multi-user support / accounts.** Macro Mate is a single-user personal tool for Michelle. No auth, no user switching. Revisit only if this is ever shared.
- **Server-side backend or database.** Recipe API integration will call the external API client-side (same pattern as the existing Anthropic-powered Tailor Recipe feature) rather than standing up a proxy server, unless the API key exposure risk becomes unacceptable (see Open Questions).
- **Real-time grocery price or store integration.** Shopping list export stays a plain ingredient list — no pricing, no store-specific formatting, no delivery integration.
- **Automatic diet/allergy detection.** Preference filtering (cuisine, disliked ingredients) is manually tagged per recipe, not inferred from ingredient text via NLP.
- **Redesigning the plan generator's matching algorithm.** This PRD only adds filters and export layers on top of the existing `generatePlan()` / `matchScore()` logic — it doesn't change how meals get selected or scored.

---

## Feature Area Summary

| # | Feature | Status |
|---|---|---|
| 1 | Recipe import / spreadsheet integration | **Shipped** |
| 2 | Cuisine & preference filters (Discover view) | Planned |
| 3 | Shopping list export | **Shipped** |
| 4 | Week plan print / export | Planned |
| 5 | Recipe API integration (larger pool) | Planned |

---

## Shipped Features (as-built)

### 1. Recipe Import / Spreadsheet Integration

Already implemented and in production use:

- **CSV import** (`handleCSVImport`) — parses a CSV with `name, category, emoji, cuisine, time, cal, protein, carbs, fat, description` columns, skips duplicates by name, and reports added/skipped counts via toast.
- **JSON import** (`handleJSONImport`) — accepts a JSON object keyed by category (`breakfast`/`snack`/`lunch`/`dinner`), same dedup logic.
- **JSON export** (`exportJSON`) — downloads the full current `RECIPES` object as a `.json` file, letting Michelle back up or move her rolodex.
- **Manual add/edit form** (`openRecipeForm`) — full CRUD on individual recipes without needing a file at all.
- Recipes persist in `localStorage` (`macromate_recipes`), versioned (`macromate_recipes_v`) to support future schema migrations.

No further work needed here for this phase. Future consideration (P2, not scoped now): a guided "map your columns" step for CSVs that don't match the expected header names exactly.

### 3. Shopping List

Already implemented and in production use:

- `aggregateShoppingIngredients()` parses ingredient strings across the week's plan, normalizes units (cup/tbsp/tsp/oz/lb/g/kg/ml/scoop/etc., including unicode fractions like ½), and sums quantities across recipes.
- `openShoppingList()` renders the aggregated list grouped by category (via `getTypeColor`/`categorizeName`).
- `printShoppingList()` gives a print-formatted view of just the shopping list.

No further work needed here for this phase.

---

## Planned Features

### 2. Cuisine & Preference Filters (Discover View)

**Problem:** The Discover/rolodex view (`renderRecipesView`) currently filters only by meal category (`all`/`breakfast`/`snack`/`lunch`/`dinner`) via the `.rtab` buttons. Every recipe already carries a `cuisine` field (e.g., "Mediterranean," "Asian," "American") and could carry an ingredient list, but neither is filterable. Michelle has to scan the full list by eye to find, say, Asian dinners, and there's no way to hide recipes containing a specific ingredient she wants to avoid.

**User Stories:**
- As Michelle, I want to filter the rolodex by cuisine so I can quickly find recipes matching my Asian/Mediterranean preference.
- As Michelle, I want to exclude recipes containing an ingredient I flag so I don't have to manually screen them out.
- As Michelle, I want cuisine and exclusion filters to combine with the existing category tabs (not replace them) so I can narrow to, say, "Asian dinners without [flagged ingredient]" in one pass.
- As Michelle, I want the plan generator to respect my saved exclusions by default so flagged-ingredient recipes never get auto-assigned into a week.

**Requirements — Must-Have (P0):**
- Add a cuisine filter control to the Discover view alongside the existing category tabs. Options populate dynamically from distinct `cuisine` values present in `RECIPES`.
- Cuisine filter and category filter combine with AND logic (both apply simultaneously).
- Acceptance: given recipes tagged `cuisine:'Asian'` and `cuisine:'Mediterranean'`, selecting "Asian" + "Dinner" shows only Asian dinner recipes.

**Requirements — Nice-to-Have (P1):**
- A persistent "excluded ingredients" list (empty by default, editable) that hides matching recipes from the Discover view and excludes them from `generatePlan()`'s candidate pool.
- Acceptance: a recipe with a flagged excluded ingredient in its name or ingredient text is filtered from both the rolodex and the weekly plan generator once excluded.
- Visual indicator (badge or count) showing how many recipes are hidden by active filters, so Michelle knows filtering isn't just returning zero results.

**Requirements — Future Considerations (P2):**
- Save filter state across sessions (remember last-used cuisine filter).
- Multi-select cuisine filter (e.g., "Asian OR Mediterranean" at once).

---

### 4. Week Plan Print / Export

**Problem:** `printShoppingList()` covers the ingredient list, but there's no equivalent for the week's actual meal plan — no way to print or export the 7-day grid (which meal, which day, macro totals) for offline reference. Michelle currently has to keep a laptop or tablet open to see what she's cooking each day.

**User Stories:**
- As Michelle, I want to print my current week's plan so I can stick it on the fridge without needing a screen.
- As Michelle, I want the printed plan to show each day's meals and daily macro totals so it's a complete standalone reference.
- As Michelle, I want an export option (PDF or plain text) as an alternative to printing, so I can save the week or share it.

**Requirements — Must-Have (P0):**
- Add a "Print Week" action on the dashboard that opens a print-formatted view of the current 7-day grid: day, meal type, recipe name, and per-day macro totals — mirroring the existing print-view pattern used by `printShoppingList()`.
- Acceptance: clicking "Print Week" opens the browser print dialog with a clean, non-clipped layout of all 7 days.

**Requirements — Nice-to-Have (P1):**
- "Export as PDF" using the browser's print-to-PDF (no new dependency) or a lightweight client-side PDF library if formatting needs exceed what print CSS can do.
- Include recipe emoji/short description in the printed view for quick recognition.

**Requirements — Future Considerations (P2):**
- Export the week plan as a `.ics` calendar file (meals as calendar events).
- Combined "Print Week + Shopping List" single action.

---

### 5. Recipe API Integration (Larger Recipe Pool)

**Problem:** The recipe database is capped at what's hand-curated (34 recipes) or manually imported. There's no way to discover new recipes that fit Michelle's macro targets and cuisine preferences beyond what she or a CSV/JSON file already contains. Note: this is distinct from the existing "Tailor Recipe" feature (`generateRecipeIdea()`), which uses the Anthropic API to estimate macros for one recipe Michelle pastes in — it doesn't browse or suggest new recipes from an external database.

**User Stories:**
- As Michelle, I want to search an external recipe database (e.g., Spoonacular or Edamam) filtered by cuisine and macro range, so I can discover new recipes without leaving the app.
- As Michelle, I want a search result I like to be added to my rolodex in the same format as my existing recipes (with macros, cuisine, category) so it works seamlessly with the plan generator.
- As Michelle, I want clear feedback when an API-sourced recipe's macro data is estimated vs. verified, so I can judge how much to trust it (consistent with the existing confidence-flagging pattern in `applyConfidenceOverride`).

**Requirements — Must-Have (P0):**
- Client-side integration with one recipe API (Spoonacular or Edamam — pick one; see Open Questions) supporting search by cuisine and rough calorie/macro range.
- "Add to Rolodex" action on a search result that maps the API's response into the existing recipe schema (`id, name, emoji, cuisine, time, cal, p, c, f, desc, bg`) and appends it via the existing `saveRecipes()` path.
- Acceptance: searching "Mediterranean, ~400 cal" returns results from the API; selecting one adds it to `RECIPES` and it appears in the Discover view and plan generator immediately.

**Requirements — Nice-to-Have (P1):**
- Macro accuracy disclaimer/badge on API-sourced recipes, similar to the confidence flag already used for AI-tailored recipes.
- De-dup check against existing rolodex recipes by name before adding.

**Requirements — Future Considerations (P2):**
- Caching API results locally to reduce repeat calls.
- Auto-suggesting API recipes to fill gaps when the plan generator can't find enough variety in a category.

---

## Success Metrics

Macro Mate is a single-user personal tool, so metrics are usage-based rather than business-based:

**Leading indicators:**
- Cuisine/preference filters used at least once per planning session, within 2 weeks of shipping.
- "Print Week" used at least once per week after shipping (proxy: Michelle actually wants a physical/offline copy).
- At least 5 recipes added via the external API within the first month, indicating the integration is actually expanding the usable pool.

**Lagging indicators:**
- Recipe pool grows beyond the current 34 hand-curated recipes without requiring manual data entry.
- Reduced week-to-week repetition (fewer instances of the same recipe reused within a rolling 4-week window).

## Open Questions

- **Which recipe API — Spoonacular or Edamam?** (Michelle — pricing/quota and license terms differ; Spoonacular has a more generous free tier for macro data, Edamam's nutrition analysis is arguably more precise. Needs a quick comparison before P0 work starts.)
- **Where does the API key live?** Same client-side exposure risk already flagged for the Anthropic key in `config.js` (see memory: API key rotated 2026-07-22 after being exposed in a transcript). Worth deciding upfront whether a local proxy is warranted before adding a second exposed key. (Michelle / engineering — i.e., you, since you're the only engineer.)
- **What counts as an excluded-ingredient match?** Exact string match on ingredient text, or fuzzy/substring match? Affects how reliably flagged-ingredient recipes get excluded. (Michelle — depends on how much false-exclusion risk is acceptable.)
- **Should excluded-ingredient filtering apply retroactively to already-generated weeks**, or only to future plan generation? (Michelle.)

## Timeline / Phasing (for Linear sequencing)

Suggested ticket groupings, roughly in build order:

1. **Epic: Discover Filters** — cuisine filter (P0), excluded-ingredients list + plan generator integration (P1), filter-hidden-count badge (P1).
2. **Epic: Week Plan Export** — print view for weekly grid (P0), PDF export (P1), emoji/description in print view (P1).
3. **Epic: Recipe API Integration** — API selection decision (spike/open question), search UI + schema mapping (P0), confidence badge (P1), de-dup check (P1).

No hard external deadlines. Recommended order above front-loads the filter work (smallest, most self-contained, no new external dependency) before the API integration (largest, has an open vendor decision and a security consideration to resolve first).
