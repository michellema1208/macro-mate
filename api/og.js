export default function handler(req, res) {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FCFAF1"/>
      <stop offset="55%" stop-color="#EDF1DE"/>
      <stop offset="100%" stop-color="#C2D9A3"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="432" cy="178" r="9" fill="#6E8A54"/>
  <text x="454" y="190" font-family="Georgia, serif" font-size="26" fill="#4C6140" letter-spacing="1">macro mate</text>
  <text x="600" y="318" font-family="Georgia, serif" font-size="78" font-weight="300" fill="#232519" text-anchor="middle">Eat well without</text>
  <text x="600" y="408" font-family="Georgia, serif" font-size="78" font-style="italic" fill="#4C6140" text-anchor="middle">thinking</text>
  <text x="600" y="498" font-family="Georgia, serif" font-size="78" font-weight="300" fill="#232519" text-anchor="middle">about it.</text>
  <text x="600" y="570" font-family="Arial, sans-serif" font-size="24" fill="#6C7160" text-anchor="middle">Macro-aware meal planning — plan the week, hit your targets.</text>
</svg>`;

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
  res.end(svg);
}
