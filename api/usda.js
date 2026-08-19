function scoreMatch(description, query) {
  const desc  = description.toLowerCase();
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  return words.reduce((n, w) => desc.includes(w) ? n + 1 : n, 0);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Query required' });

  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'USDA_API_KEY not set' });

  try {
    const searchUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&dataType=Branded&pageSize=10&api_key=${apiKey}`;
    const searchRes  = await fetch(searchUrl);
    const searchData = await searchRes.json();
    const foods = searchData.foods || [];
    if (!foods.length) return res.status(200).json({ found: false });

    // Pick the best match by keyword overlap with the full query
    const scored = foods
      .map(f => ({ food: f, score: scoreMatch(f.description || '', query) }))
      .sort((a, b) => b.score - a.score);

    // Require at least 70% of query words to match — prevents matching wrong products
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const minScore   = Math.ceil(queryWords.length * 0.7);
    if (scored[0].score < minScore) return res.status(200).json({ found: false });

    const food = scored[0].food;

    const detailUrl = `https://api.nal.usda.gov/fdc/v1/food/${food.fdcId}?api_key=${apiKey}`;
    const detailRes  = await fetch(detailUrl);
    const detail     = await detailRes.json();

    res.status(200).json({
      found: true,
      description:     detail.description,
      brandOwner:      detail.brandOwner,
      servingSize:     detail.servingSize,
      servingSizeUnit: detail.servingSizeUnit,
      labelNutrients:  detail.labelNutrients,
      foodNutrients:   detail.foodNutrients,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
