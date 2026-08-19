// Macro Mate — Tailor Recipe eval runner
//
// Replicates the exact system prompt / user message used by generateRecipeIdea()
// in ritual-planner.html, runs it against 8 ground-truth recipes (eval_recipes.json),
// and measures how close the AI's macro estimates land vs. verified real-world
// nutrition data (USDA + branded product labels — sources noted in eval_recipes.json).
//
// USAGE (from Terminal, on your own machine):
//   cd "/Users/michellema/Documents/Claude/Projects/macro mate/eval"
//   node run_eval.js
//
// Requires: Node.js and curl (both already on macOS by default).
// Reads your Anthropic key from ../config.js. The key is passed to curl via a
// temp config file (not a command-line argument) and is never printed to the
// console or written anywhere except that temp file, which is deleted after
// each request.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const PROJECT_DIR = process.argv[2] || path.join(__dirname, '..');
const CONFIG_PATH = path.join(PROJECT_DIR, 'config.js');
const EVAL_PATH = path.join(__dirname, 'eval_recipes.json');

function getApiKey() {
  const content = fs.readFileSync(CONFIG_PATH, 'utf8');
  const match = content.match(/ANTHROPIC_API_KEY\s*=\s*'([^']+)'/);
  if (!match) throw new Error(`Could not find ANTHROPIC_API_KEY in ${CONFIG_PATH}`);
  return match[1];
}

const SYSTEM_PROMPT = `You are a nutrition expert helping tailor a recipe to fit specific macro targets.

User's daily macro targets: 1500 cal · 110g protein · 183g carbs · 34g fat.
For context, a balanced single meal is roughly: 350–500 cal, 28–38g protein, 40–60g carbs, 8–12g fat.
A snack is roughly: 150–250 cal, 12–20g protein, 15–25g carbs, 3–6g fat.

Rules:
- If stated nutrition facts were provided, use them verbatim as "original" — do not override with estimates
- "flags" only lists actual issues vs the targets — be concise and specific. Can be [] if the recipe is close
- "substitutions" must be 3–6 specific, actionable swaps with realistic macro deltas (negative = reduction)
- Include swaps that boost protein if it's low (swap sour cream for Greek yogurt, add egg whites, reduce oil)
- Be specific with quantities (e.g. "reduce oil from 2 tbsp to 1 tsp" not "use less oil")
- Omit impact fields that are 0 or negligible
- Substitutions must preserve the core flavor profile and cuisine character of the dish — no swaps that fundamentally change the taste
- Set "confidence" based on how the "original" macros were determined:
  - "high" — stated nutrition facts were provided and used verbatim, OR every ingredient is a well-documented single branded/whole-food item with unambiguous quantities, assembled (not blended/mixed into a combined liquid or sauce)
  - "medium" — standard, well-documented ingredients but the dish combines multiple items into a mixed beverage, smoothie, shake, or sauce (combined-liquid totals are harder to verify even when each ingredient is well known), OR at least one imprecise quantity or preparation detail (a "handful", "a drizzle", unspecified oil amount)
  - "low" — homemade or unusual preparations, ambiguous quantities, uncommon ingredients, or anything where your estimate could plausibly be off by more than ~15%
  - Carbohydrate values specifically are the least certain of the four macros to estimate — carbs are often a residual figure calculated by subtraction on nutrition labels rather than directly measured. If you have meaningful uncertainty about the carb estimate, do not rate overall confidence higher than "medium", even if calories/protein/fat are well-grounded
- Include a one-sentence "confidenceNote" explaining the confidence level, e.g. "Based on standard USDA values for whole-food ingredients" or "Oil quantity wasn't specified — estimated a typical amount" or "Combined liquid ingredients make total carbs harder to verify precisely"`;

function buildUserMessage(recipeText, servings) {
  const servingLine = servings
    ? `This recipe makes ${servings} serving${servings > 1 ? 's' : ''}. Per-serving macros = total ÷ ${servings}.`
    : '';
  return `${servingLine}


Recipe to analyse:
"""
${recipeText}
"""

Respond with ONLY a valid JSON object — no markdown, no code fences, no extra text:
{
  "recipeName": "Name of the recipe (infer if not stated)",
  "servingNote": "e.g. Per serving · makes 2",
  "original": { "cal": 580, "p": 22, "c": 48, "f": 26 },
  "confidence": "medium",
  "confidenceNote": "Oil quantity wasn't specified — estimated a typical amount",
  "flags": [
    "Fat is 26g — roughly double the ~10g target for a main meal",
    "Protein is 22g — a bit below the 28–35g ideal range"
  ],
  "substitutions": [
    {
      "swap": "Replace 2 whole eggs with 1 egg + 3 egg whites",
      "reason": "Removes yolk fat while keeping structure and boosting protein slightly",
      "impact": { "cal": -70, "p": 6, "f": -10 }
    }
  ]
}
`;
}

// Mirrors the deterministic override in ritual-planner.html: the model's
// self-reported confidence doesn't reliably track accuracy (blended/shake
// recipes self-report "high" despite large carb/fat misses), so this
// downgrades confidence in code for that known risk pattern regardless of
// what the model claims. Keep this in sync with applyConfidenceOverride()
// in the app.
const CONFIDENCE_RISK_KEYWORDS = ['shake', 'smoothie', 'blend', 'latte', 'juice', 'protein drink'];

function applyConfidenceOverride(result, recipeText) {
  const lower = recipeText.toLowerCase();
  const isRisky = CONFIDENCE_RISK_KEYWORDS.some(kw => lower.includes(kw));
  if (isRisky && result.confidence === 'high') {
    result.confidence = 'medium';
    result.confidenceNote = (result.confidenceNote ? result.confidenceNote + ' ' : '') +
      '(Downgraded automatically — blended drink, harder to verify precisely.)';
  }
  return result;
}

function callModelViaCurl(apiKey, recipeText, servings) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'macromate-eval-'));
  const bodyPath = path.join(tmpDir, 'body.json');
  const configPath = path.join(tmpDir, 'curl.cfg');

  const body = {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserMessage(recipeText, servings) }],
  };
  fs.writeFileSync(bodyPath, JSON.stringify(body));

  // curl config file keeps the API key out of process argv (so it never shows in `ps`)
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
    const result = JSON.parse(jsonStr);
    applyConfidenceOverride(result, recipeText);
    return result;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function pctError(estimate, truth) {
  if (truth === 0) return estimate === 0 ? 0 : 100;
  return Math.abs(estimate - truth) / Math.abs(truth) * 100;
}

function main() {
  const apiKey = getApiKey();
  const recipes = JSON.parse(fs.readFileSync(EVAL_PATH, 'utf8'));

  const results = [];
  for (const recipe of recipes) {
    process.stderr.write(`Running: ${recipe.name}...\n`);
    try {
      const result = callModelViaCurl(apiKey, recipe.recipeText, recipe.servings);
      const est = result.original;
      const truth = recipe.truth;
      const errs = {
        cal: pctError(est.cal, truth.cal),
        p: pctError(est.p, truth.p),
        c: pctError(est.c, truth.c),
        f: pctError(est.f, truth.f),
      };
      const avgErr = (errs.cal + errs.p + errs.c + errs.f) / 4;
      results.push({
        id: recipe.id,
        name: recipe.name,
        truth,
        estimate: est,
        errs,
        avgErrPct: avgErr,
        modelConfidence: result.confidence,
        confidenceNote: result.confidenceNote,
      });
    } catch (e) {
      results.push({ id: recipe.id, name: recipe.name, error: e.message });
    }
  }

  const valid = results.filter(r => !r.error);
  const overallAvgErr = valid.length
    ? valid.reduce((sum, r) => sum + r.avgErrPct, 0) / valid.length
    : null;

  const summary = {
    generatedAt: new Date().toISOString(),
    recipeCount: recipes.length,
    successCount: valid.length,
    overallAvgErrorPct: overallAvgErr,
    results,
  };

  fs.writeFileSync(path.join(__dirname, 'eval_results.json'), JSON.stringify(summary, null, 2));

  console.log('\n=== Macro Estimation Accuracy — Tailor Recipe Feature ===\n');
  console.log(`Recipes tested: ${recipes.length}  |  Succeeded: ${valid.length}\n`);
  console.log('Recipe'.padEnd(32), 'Cal err%'.padEnd(10), 'P err%'.padEnd(9), 'C err%'.padEnd(9), 'F err%'.padEnd(9), 'Avg err%'.padEnd(10), 'Confidence');
  for (const r of results) {
    if (r.error) {
      console.log(r.name.padEnd(32), 'ERROR:', r.error);
      continue;
    }
    console.log(
      r.name.padEnd(32),
      r.errs.cal.toFixed(1).padEnd(10),
      r.errs.p.toFixed(1).padEnd(9),
      r.errs.c.toFixed(1).padEnd(9),
      r.errs.f.toFixed(1).padEnd(9),
      r.avgErrPct.toFixed(1).padEnd(10),
      r.modelConfidence || '—'
    );
  }
  console.log(`\nOverall average macro error: ${overallAvgErr !== null ? overallAvgErr.toFixed(1) + '%' : 'n/a'}`);
  console.log(`(i.e. estimates landed within ~${overallAvgErr !== null ? (100 - overallAvgErr).toFixed(0) : 'n/a'}% of verified ground truth, on average)`);
  console.log('\nFull results saved to eval_results.json');
}

main();
