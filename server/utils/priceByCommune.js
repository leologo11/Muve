// Precios de entrega por comuna RM (CLP) — tarifa oficial por zona
const PRICES = {
  'alhue': 30000, 'alhué': 30000,
  'buin': 12000,
  'calera de tango': 10000,
  'cerrillos': 5000,
  'cerro navia': 4500,
  'colina': 10000,
  'conchali': 4500, 'conchalí': 4500,
  'curacavi': 15000, 'curacaví': 15000,
  'el bosque': 6000,
  'el monte': 18000,
  'estacion central': 4000, 'estación central': 4000,
  'huechuraba': 4000,
  'independencia': 4000,
  'isla de maipo': 20000, 'isla de maipú': 20000,
  'la cisterna': 4500,
  'la florida': 7500,
  'la granja': 4500,
  'la pintana': 6000,
  'la reina': 4000,
  'lampa': 5000,
  'las condes': 4000,
  'lo barnechea': 5000,
  'lo espejo': 4500,
  'lo prado': 4000,
  'macul': 4500,
  'maipu': 5000, 'maipú': 5000,
  'maria pinto': 20000, 'maría pinto': 20000,
  'melipilla': 20000,
  'nunoa': 4000, 'ñuñoa': 4000, 'nuñoa': 4000,
  'padre hurtado': 10000,
  'paine': 15000,
  'pedro aguirre cerda': 4500,
  'penaflor': 12000, 'peñaflor': 12000,
  'penalolen': 5000, 'peñalolén': 5000, 'penalolén': 5000,
  'pirque': 10000,
  'providencia': 4000,
  'pudahuel': 6000,
  'puente alto': 8000,
  'quilicura': 5000,
  'quinta normal': 4000,
  'recoleta': 4500,
  'renca': 5000,
  'san bernardo': 10000,
  'san joaquin': 4500, 'san joaquín': 4500,
  'san jose de maipo': 12000, 'san josé de maipo': 12000,
  'san miguel': 4500,
  'san pedro': 30000,
  'san ramon': 4500, 'san ramón': 4500,
  'santiago': 4500,
  'talagante': 15000,
  'tiltil': 10000, 'til til': 10000,
  'vitacura': 4000,
  '_default': 5000,
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
