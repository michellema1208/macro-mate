// Macro Mate — Grounded Estimation Pipeline Eval
//
// Tests whether grounding macro estimation in a verified ingredient database
// (instead of relying purely on the LLM's own nutrition recall) reduces error,
// on a HELD-OUT set of recipes distinct from the original 8-recipe eval
// (different phrasing/quantities, plus one recipe with an ingredient NOT in
// the database, to test the fallback path and avoid a circular/rigged result).
//
// Two pipelines are run on the SAME held-out recipes for a fair before/after:
//   OLD:      single-shot LLM macro estimate (same prompt as generateRecipeIdea())
//   GROUNDED: LLM parses ingredients+quantities -> code looks up verified
//             per-unit macros and sums them -> falls back to OLD approach for
//             any recipe with an ingredient the database doesn't recognize
//
// USAGE (from Terminal, on your own machine):
//   cd "/Users/michellema/Documents/Claude/Projects/macro mate/eval"
//   node run_eval_grounded.js

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const PROJECT_DIR = process.argv[2] || path.join(__dirname, '..');
const CONFIG_PATH = path.join(PROJECT_DIR, 'config.js');
const HELD_OUT_PATH = path.join(__dirname, 'held_out_recipes.json');

function getApiKey() {
  const content = fs.readFileSync(CONFIG_PATH, 'utf8');
  const match = content.match(/ANTHROPIC_API_KEY\s*=\s*'([^']+)'/);
  if (!match) throw new Error(`Could not find ANTHROPIC_API_KEY in ${CONFIG_PATH}`);
  return match[1];
}

// ═══════════════════════════════════════════════════════
//  VERIFIED INGREDIENT DATABASE
//  Same reference values researched for the original eval (USDA + product labels).
// ═══════════════════════════════════════════════════════
const INGREDIENT_DB = [
  { aliases: ['egg', 'eggs', 'large egg', 'large eggs'], unit: 'count', perUnit: { cal: 72, p: 6, c: 0, f: 4 } },
  { aliases: ['chicken breast', 'chicken', 'skinless chicken breast', 'cooked chicken breast', 'grilled chicken breast', 'grilled skinless chicken breast', 'cooked skinless chicken breast'], unit: 'g', perUnit: { cal: 1.65, p: 0.31, c: 0, f: 0.036 } },
  { aliases: ['oikos', 'oikos triple zero', 'triple zero yogurt', 'triple zero vanilla', 'oikos triple zero vanilla'], unit: 'count', perUnit: { cal: 100, p: 15, c: 10, f: 0 } },
  { aliases: ['isopure', 'isopure zero carb', 'protein powder', 'zero carb protein powder', 'isopure zero carb protein powder'], unit: 'scoop', perUnit: { cal: 100, p: 25, c: 0, f: 0 } },
  { aliases: ['califia', 'califia farms', 'oat barista blend', 'oat milk', 'oat barista', 'califia farms oat barista blend'], unit: 'cup', perUnit: { cal: 130, p: 2, c: 13, f: 7 } },
  { aliases: ['rolled oats', 'dry rolled oats', 'oats'], unit: 'halfCup', perUnit: { cal: 150, p: 5, c: 27, f: 3 } },
  { aliases: ['almond butter'], unit: 'tbsp', perUnit: { cal: 98, p: 3.4, c: 3, f: 9 } },
  { aliases: ['banana', 'medium banana'], unit: 'count', perUnit: { cal: 105, p: 1.3, c: 27, f: 0.4 } },
  { aliases: ['olive oil'], unit: 'tbsp', perUnit: { cal: 120, p: 0, c: 0, f: 14 } },
];

function matchIngredient(name, unit) {
  const lower = name.toLowerCase().trim();
  for (const entry of INGREDIENT_DB) {
    const aliasMatch = entry.aliases.some(a => lower.includes(a) || a.includes(lower));
    if (aliasMatch && entry.unit === unit) return entry;
  }
  return null;
}

function computeGroundedTotal(ingredients) {
  const totals = { cal: 0, p: 0, c: 0, f: 0 };
  for (const ing of ingredients) {
    const match = matchIngredient(ing.name, ing.unit);
    if (!match) return { fullyGrounded: false, unmatched: ing.name };
    totals.cal += match.perUnit.cal * ing.quantity;
    totals.p += match.perUnit.p * ing.quantity;
    totals.c += match.perUnit.c * ing.quantity;
    totals.f += match.perUnit.f * ing.quantity;
  }
  return { fullyGrounded: true, totals };
}

// ═══════════════════════════════════════════════════════
//  API CALL HELPER (curl-based — see run_eval.js for why)
// ═══════════════════════════════════════════════════════
function callApi(apiKey, systemPrompt, userMessage) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'macromate-eval-'));
  const bodyPath = path.join(tmpDir, 'body.json');
  const configPath = path.join(tmpDir, 'curl.cfg');

  const body = {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  };
  fs.writeFileSync(bodyPath, JSON.stringify(body));

  const cfgLines = [
    `url = "https://api.anthropic.com/v1/messages"`,
    `header = "x-api-key: ${apiKey}"`,
    `header = "anthropic-version: 2023-06-01"`,
    `header = "content-type: application/json"`,
    `data = @${bodyPath}`,
    `silent`,
    `show-error`,
  ].join('\n');
  fs.writeFileSync(configPath, cfgLines);

  try {
    const stdout = execFileSync('curl', ['-K', configPath], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    const data = JSON.parse(stdout);
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    const rawText = data.content?.[0]?.text || '';
    const jsonStr = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(jsonStr);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ═══════════════════════════════════════════════════════
//  OLD APPROACH — single-shot LLM estimate (same prompt as the shipped app)
// ═══════════════════════════════════════════════════════
const OLD_SYSTEM_PROMPT = `You are a nutrition expert helping tailor a recipe to fit specific macro targets.

User's daily macro targets: 1500 cal · 110g protein · 183g carbs · 34g fat.
For context, a balanced single meal is roughly: 350–500 cal, 28–38g protein, 40–60g carbs, 8–12g fat.
A snack is roughly: 150–250 cal, 12–20g protein, 15–25g carbs, 3–6g fat.

Respond with ONLY a valid JSON object — no markdown, no code fences, no extra text:
{
  "recipeName": "Name of the recipe (infer if not stated)",
  "original": { "cal": 580, "p": 22, "c": 48, "f": 26 }
}`;

function buildOldUserMessage(recipeText, servings) {
  const servingLine = servings
    ? `This recipe makes ${servings} serving${servings > 1 ? 's' : ''}. Per-serving macros = total ÷ ${servings}.`
    : '';
  return `${servingLine}\n\nRecipe to analyse:\n"""\n${recipeText}\n"""`;
}

function runOldApproach(apiKey, recipeText, servings) {
  const result = callApi(apiKey, OLD_SYSTEM_PROMPT, buildOldUserMessage(recipeText, servings));
  return result.original;
}

// ═══════════════════════════════════════════════════════
//  GROUNDED APPROACH — parse ingredients, look up + sum verified data,
//  fall back to the OLD approach for any recipe with an unrecognized ingredient
// ═══════════════════════════════════════════════════════
const PARSE_SYSTEM_PROMPT = `You are a precise recipe ingredient parser. Extract each distinct ingredient from the recipe with its quantity, expressed ONLY in one of these standard units based on ingredient type:
- "g" for meats like chicken breast (convert oz or other units to grams)
- "count" for discrete items like eggs, bananas, or single-serving cups of a branded yogurt (e.g. Oikos Triple Zero)
- "scoop" for protein powder
- "cup" for pourable liquids like oat milk
- "tbsp" for oils, nut butters, honey, and similar (convert tsp to tbsp: 1 tsp = 0.33 tbsp)
- "halfCup" for dry rolled oats, expressed as a multiple of a 1/2 cup serving (e.g. 1 cup dry oats = 2 halfCup, 1/4 cup = 0.5 halfCup)

Respond with ONLY valid JSON, no markdown, no extra text:
{"ingredients": [{"name": "chicken breast", "quantity": 150, "unit": "g"}, {"name": "olive oil", "quantity": 1, "unit": "tbsp"}]}`;

function buildParseUserMessage(recipeText) {
  return `Recipe:\n"""\n${recipeText}\n"""`;
}

function runGroundedApproach(apiKey, recipeText, servings) {
  const parsed = callApi(apiKey, PARSE_SYSTEM_PROMPT, buildParseUserMessage(recipeText));
  const ingredients = parsed.ingredients || [];
  const grounded = computeGroundedTotal(ingredients);

  if (grounded.fullyGrounded) {
    const divisor = servings || 1;
    return {
      source: 'grounded',
      estimate: {
        cal: grounded.totals.cal / divisor,
        p: grounded.totals.p / divisor,
        c: grounded.totals.c / divisor,
        f: grounded.totals.f / divisor,
      },
    };
  }
  // Fallback: at least one ingredient wasn't in the database
  const fallbackEstimate = runOldApproach(apiKey, recipeText, servings);
  return { source: `fallback-llm (unmatched: ${grounded.unmatched})`, estimate: fallbackEstimate };
}

// ═══════════════════════════════════════════════════════
//  SCORING
// ═══════════════════════════════════════════════════════
function pctError(estimate, truth) {
  if (truth === 0) return estimate === 0 ? 0 : 100;
  return Math.abs(estimate - truth) / Math.abs(truth) * 100;
}

function scoreEstimate(estimate, truth) {
  const errs = {
    cal: pctError(estimate.cal, truth.cal),
    p: pctError(estimate.p, truth.p),
    c: pctError(estimate.c, truth.c),
    f: pctError(estimate.f, truth.f),
  };
  return { errs, avgErrPct: (errs.cal + errs.p + errs.c + errs.f) / 4 };
}

function main() {
  const apiKey = getApiKey();
  const recipes = JSON.parse(fs.readFileSync(HELD_OUT_PATH, 'utf8'));

  const rows = [];
  for (const recipe of recipes) {
    process.stderr.write(`Running: ${recipe.name}...\n`);
    try {
      const oldEst = runOldApproach(apiKey, recipe.recipeText, recipe.servings);
      const oldScore = scoreEstimate(oldEst, recipe.truth);

      const grounded = runGroundedApproach(apiKey, recipe.recipeText, recipe.servings);
      const groundedScore = scoreEstimate(grounded.estimate, recipe.truth);

      rows.push({
        id: recipe.id,
        name: recipe.name,
        truth: recipe.truth,
        old: { estimate: oldEst, avgErrPct: oldScore.avgErrPct },
        grounded: { source: grounded.source, estimate: grounded.estimate, avgErrPct: groundedScore.avgErrPct },
      });
    } catch (e) {
      rows.push({ id: recipe.id, name: recipe.name, error: e.message });
    }
  }

  const valid = rows.filter(r => !r.error);
  const oldAvg = valid.length ? valid.reduce((s, r) => s + r.old.avgErrPct, 0) / valid.length : null;
  const groundedAvg = valid.length ? valid.reduce((s, r) => s + r.grounded.avgErrPct, 0) / valid.length : null;
  const relativeImprovement = (oldAvg && groundedAvg !== null) ? ((oldAvg - groundedAvg) / oldAvg) * 100 : null;

  const summary = {
    generatedAt: new Date().toISOString(),
    recipeCount: recipes.length,
    successCount: valid.length,
    oldAvgErrorPct: oldAvg,
    groundedAvgErrorPct: groundedAvg,
    relativeErrorReductionPct: relativeImprovement,
    rows,
  };
  fs.writeFileSync(path.join(__dirname, 'eval_grounded_results.json'), JSON.stringify(summary, null, 2));

  console.log('\n=== Grounded vs. Old Estimation — Held-Out Set ===\n');
  console.log('Recipe'.padEnd(32), 'Old err%'.padEnd(10), 'Grounded err%'.padEnd(14), 'Grounded source');
  for (const r of rows) {
    if (r.error) { console.log(r.name.padEnd(32), 'ERROR:', r.error); continue; }
    console.log(
      r.name.padEnd(32),
      r.old.avgErrPct.toFixed(1).padEnd(10),
      r.grounded.avgErrPct.toFixed(1).padEnd(14),
      r.grounded.source
    );
  }
  console.log(`\nOld approach average error:      ${oldAvg !== null ? oldAvg.toFixed(1) + '%' : 'n/a'}`);
  console.log(`Grounded approach average error:  ${groundedAvg !== null ? groundedAvg.toFixed(1) + '%' : 'n/a'}`);
  console.log(`Relative error reduction:         ${relativeImprovement !== null ? relativeImprovement.toFixed(1) + '%' : 'n/a'}`);
  console.log('\nFull results saved to eval_grounded_results.json');
}

main();
