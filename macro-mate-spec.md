# Macro Mate — Spec
## What it is
A personal nutrition app for storing recipes and planning meals around
specific macro targets. Built for one user (me), not as a multi-user product.
## Current scope — what's built
- Recipe storage: ingredients list, cooking instructions, nutritional info
  per recipe (data must be entered manually/already known — no lookup)
- Meal planner / dashboard: arrange stored recipes across a weekly view
## In progress
- Recipe Tailor: given a recipe and target macros, suggest ingredient swaps
  or removals to hit the macros without compromising flavor/integrity.
  Status: WIP, not functional yet.
- Grocery list generation: aggregate ingredients across a week's planned
  meals into a single shopping list. Status: WIP, not functional yet.
## Not yet started
- Recipe idea generation based on eating preferences/history
## Explicit non-goals (for now)
- No internet scraping for recipes — all recipe data is manually entered.
  (Revisit if manual entry becomes the main friction point.)
## Key decisions log
- 2026-07-23: Confirmed single-user scope — no plans for multi-user support.
- 2026-07-23: Confirmed no recipe-source scraping for v1; manual entry only.
## Open questions
- Priority order between Recipe Tailor and grocery list generation — not
  yet decided.
- Does recipe idea generation depend on Recipe Tailor's substitution logic,
  or is it a separate system?
