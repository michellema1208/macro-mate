export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });

  const apiKey = process.env.ANTHROPIC_API_KEY;

  try {
    // Step 1: fetch the page
    const pageRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'max-age=0',
        'Upgrade-Insecure-Requests': '1',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!pageRes.ok) return res.status(400).json({ error: `blocked (${pageRes.status}) — try pasting the recipe text instead` });
    const html = await pageRes.text();

    // Step 2: try JSON-LD schema.org/Recipe (no AI needed)
    const scriptBlocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    for (const block of scriptBlocks) {
      try {
        const data = JSON.parse(block[1]);
        const candidates = [data, ...(data['@graph'] || [])];
        const recipe = candidates.find(d => {
          const t = d['@type'];
          return t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'));
        });
        if (recipe) {
          const instructions = Array.isArray(recipe.recipeInstructions)
            ? recipe.recipeInstructions.map(s => typeof s === 'string' ? s : s.text || '').join('\n')
            : String(recipe.recipeInstructions || '');
          return res.status(200).json({
            source: 'schema',
            name: recipe.name || '',
            servings: parseInt(recipe.recipeYield || recipe.recipeServings) || 1,
            description: recipe.description || '',
            instructions,
            ingredientStrings: recipe.recipeIngredient || [],
          });
        }
      } catch(e) {}
    }

    // Step 3: fall back to Claude on cleaned HTML
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000);

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `Extract the recipe from this webpage text. Return ONLY valid JSON with no markdown:\n{\n  "name": "Recipe name",\n  "servings": 1,\n  "description": "Brief description",\n  "instructions": "Step by step instructions",\n  "ingredientStrings": ["1 cup oat milk", "2 tsp matcha"]\n}\n\nWebpage:\n${cleaned}`,
        }],
      }),
    });

    const claudeData = await claudeRes.json();
    const text = claudeData.content?.[0]?.text || '';
    const json = JSON.parse(text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim());
    res.status(200).json({ source: 'ai', ...json });

  } catch(err) {
    res.status(500).json({ error: err.message });
  }
}
