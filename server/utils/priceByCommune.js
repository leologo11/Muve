// Rounded delivery prices by commune (CLP)
// All values are multiples of 500
const PRICES = {
  // Santiago centro
  'santiago': 3000, 'estacion central': 3000, 'san joaquin': 3000,
  'la granja': 3000, 'pedro aguirre cerda': 3000, 'lo espejo': 3000,
  'cerrillos': 3000, 'maipú': 3000, 'maipu': 3000,
  // Near east
  'providencia': 3500, 'nunoa': 3500, 'ñuñoa': 3500, 'macul': 3500,
  'la florida': 3500, 'penalolen': 3500, 'peñalolén': 3500,
  'san ramon': 3000, 'la cisterna': 3000,
  // Las Condes / La Reina
  'las condes': 3500, 'la reina': 3500, 'quilicura': 3500,
  // Vitacura / High east
  'vitacura': 4000,
  // Far northeast
  'lo barnechea': 4500, 'los dominicos': 4500,
  // Far north
  'colina': 5000, 'chicureo': 5000, 'lampa': 5000, 'til til': 5500,
  // West
  'pudahuel': 3500, 'renca': 3000, 'quinta normal': 3000,
  'bustos': 3500, 'cerro navia': 3000, 'lo prado': 3000,
  // South
  'puente alto': 4000, 'la pintana': 3500, 'san bernardo': 4000,
  'el bosque': 3500, 'buin': 4500, 'paine': 5000,
  // Default for unknown
  '_default': 3500
};

function normalize(str) {
  return (str || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function suggestPrice(commune) {
  const key = normalize(commune);
  return PRICES[key] || PRICES['_default'];
}

export function roundPrice(price) {
  return Math.round(Number(price) / 500) * 500;
}

export { PRICES };
