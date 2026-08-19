# Macro Mate — Project Context

## What this is
A personal macro-aware meal planning web app. The main file is `ritual-planner.html` — a single-file HTML/CSS/JS app that opens directly in the browser (no build step needed).

## User
Michelle. Fat-loss phase. Daily macro targets: **1,500 cal · 110g protein · 183g carbs · 34g fat**.
Cuisine preferences: Asian, Mediterranean. Diet: omnivore.

## What's built so far
- `ritual-planner.html` — the full working app, which includes:
  - A **landing page** ("Macro Mate" home screen with hero, feature highlights, "My Dashboard" CTA)
  - A **weekly planner dashboard** (7-day grid, rows = meal types, columns = days)
  - A recipe database of 34 hand-curated recipes (9 breakfast, 8 snack, 9 lunch, 9 dinner) with accurate macro data
  - A **plan generator** that shuffles recipes across the week with no repeats
  - A **swap modal** that shows recipe alternatives ranked by macro match score for that day's remaining budget
  - Daily macro totals per column with colour-coded progress bars (sage = on track, warm = over)
  - Week navigation (prev/next week arrows)
  - "Macro Mate" brand in header navigates back to landing; "My Dashboard" navigates to planner

- `ritual-prototype.html` — earlier mobile phone-frame prototype (kept for reference, not the main app)

## Aesthetic direction
Wellness-forward, "it girl" vibe. **Not** clinical like MyFitnessPal. Think: warm cream backgrounds, Cormorant Garamond serif for headings, DM Sans for body, sage green (#7A9E75) as primary accent, soft shadows, rounded cards. Reference images showed yoga, whole foods, clean lifestyle.

## CSS design tokens (in `:root`)
- `--bg: #FAF8F5` — warm off-white background
- `--surface: #F3EDE4` — slightly warmer surface
- `--card: #FFFFFF`
- `--text: #1C1A18`
- `--sage: #7A9E75` — primary accent (protein bars, match badges, on-track indicators)
- `--gold: #C8A96E` — snack row accent
- `--warm: #C4875A` — lunch row accent / over-target warning
- `--rose: #B8748A` — dinner row accent

## Recipe data format
Each recipe object in `RECIPES[category]`:
```js
{ id:'b1', name:'...', emoji:'🥑', cuisine:'American', time:10,
  cal:368, p:32, c:28, f:14,
  desc:'Short description', bg:'#EAF3E8' }
```

## What's next (ideas discussed)
- Loading user's own recipes (currently hardcoded — would benefit from an import form or spreadsheet integration)
- Cuisine/preference filters on the Discover view
- Shopping list export
- Printing / exporting the week plan
- Possibly connecting to a recipe API (Spoonacular, Edamam) for a larger recipe pool
