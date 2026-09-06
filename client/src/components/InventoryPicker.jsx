import React from 'react';

// ── Catalog ───────────────────────────────────────────────────────────────────

export const CATALOG = [
  // ── Dormitorio ──────────────────────────────────────────────
  { id: 'cama1p',      name: 'Cama 1 plaza',       icon: '🛏️', vol: 1.5, cat: 'Dormitorio', minVehicleType: 'furgon', requiredHelpers: 0, isLong: true },
  { id: 'cama15p',     name: 'Cama 1½ plaza',      icon: '🛏️', vol: 1.8, cat: 'Dormitorio', minVehicleType: 'furgon', requiredHelpers: 0, isLong: true },
  { id: 'cama2p',      name: 'Cama 2 plazas',      icon: '🛏️', vol: 2.0, cat: 'Dormitorio', minVehicleType: 'camion34', requiredHelpers: 1, isLong: true },
  { id: 'camaQueen',   name: 'Cama Queen / King',  icon: '🛏️', vol: 2.8, cat: 'Dormitorio', minVehicleType: 'camion34', requiredHelpers: 1, isLong: true },
  { id: 'camarote',    name: 'Camarote / litera',  icon: '🛏️', vol: 2.6, cat: 'Dormitorio', minVehicleType: 'camion34', requiredHelpers: 1, isTall: true },
  { id: 'colchon',     name: 'Colchón suelto',     icon: '🛌', vol: 1.0, cat: 'Dormitorio', minVehicleType: 'furgon', requiredHelpers: 0, isLong: true },
  { id: 'closet',      name: 'Clóset / ropero',    icon: '🚪', vol: 2.5, cat: 'Dormitorio', minVehicleType: 'camion34', requiredHelpers: 1, isTall: true },
  { id: 'comoda',      name: 'Cómoda',             icon: '🗄️', vol: 0.8, cat: 'Dormitorio', minVehicleType: 'furgon', requiredHelpers: 0 },
  { id: 'mesaNoche',   name: 'Velador / mesa noche',icon: '🪑', vol: 0.3, cat: 'Dormitorio', minVehicleType: 'furgon', requiredHelpers: 0 },
  { id: 'tocador',     name: 'Tocador / peinadora',icon: '💄', vol: 0.9, cat: 'Dormitorio', minVehicleType: 'furgon', requiredHelpers: 0, isFragile: true },
  { id: 'espejoPie',   name: 'Espejo de cuerpo',   icon: '🪞', vol: 0.4, cat: 'Dormitorio', minVehicleType: 'furgon', requiredHelpers: 0, isFragile: true },
  { id: 'baul',        name: 'Baúl / arcón',       icon: '🧰', vol: 0.6, cat: 'Dormitorio', minVehicleType: 'furgon', requiredHelpers: 0 },

  // ── Living ──────────────────────────────────────────────────
  { id: 'sofa1p',      name: 'Sillón 1 cuerpo',    icon: '🛋️', vol: 1.2, cat: 'Living', minVehicleType: 'furgon', requiredHelpers: 0 },
  { id: 'sofa2p',      name: 'Sofá 2 plazas',      icon: '🛋️', vol: 2.0, cat: 'Living', minVehicleType: 'furgon', requiredHelpers: 1 },
  { id: 'sofa3p',      name: 'Sofá 3 plazas',      icon: '🛋️', vol: 3.2, cat: 'Living', minVehicleType: 'camion34', requiredHelpers: 1, isLong: true },
  { id: 'sofaSecc',    name: 'Sofá seccional / L', icon: '🛋️', vol: 4.5, cat: 'Living', minVehicleType: 'camion34', requiredHelpers: 2, isLong: true },
  { id: 'sofaCama',    name: 'Sofá cama / futón',  icon: '🛋️', vol: 3.0, cat: 'Living', minVehicleType: 'camion34', requiredHelpers: 1, isHeavy: true },
  { id: 'sillonRecl',  name: 'Sillón reclinable',  icon: '💺', vol: 1.6, cat: 'Living', minVehicleType: 'furgon', requiredHelpers: 1 },
  { id: 'rackTv',      name: 'Rack / mueble TV',   icon: '📼', vol: 1.2, cat: 'Living', minVehicleType: 'furgon', requiredHelpers: 0 },
  { id: 'mesaCentro',  name: 'Mesa de centro',     icon: '🪵', vol: 0.6, cat: 'Living', minVehicleType: 'furgon', requiredHelpers: 0 },
  { id: 'tvSmall',     name: 'TV hasta 50"',       icon: '📺', vol: 0.3, cat: 'Living', minVehicleType: 'furgon', requiredHelpers: 0, isFragile: true },
  { id: 'tvLarge',     name: 'TV 55" o más',       icon: '📺', vol: 0.6, cat: 'Living', minVehicleType: 'furgon', requiredHelpers: 0, isFragile: true },
  { id: 'homeTheater', name: 'Home theater / parlantes', icon: '🔊', vol: 0.4, cat: 'Living', minVehicleType: 'furgon', requiredHelpers: 0, isFragile: true },
  { id: 'alfombra',    name: 'Alfombra enrollada', icon: '🧶', vol: 0.4, cat: 'Living', minVehicleType: 'furgon', requiredHelpers: 0, isLong: true },
  { id: 'lamparaPie',  name: 'Lámpara de pie',     icon: '💡', vol: 0.3, cat: 'Living', minVehicleType: 'furgon', requiredHelpers: 0, isFragile: true },

  // ── Comedor ─────────────────────────────────────────────────
  { id: 'mesaComedor', name: 'Mesa comedor',       icon: '🍽️', vol: 1.2, cat: 'Comedor', minVehicleType: 'furgon', requiredHelpers: 0 },
  { id: 'mesaComedorXl',name: 'Mesa comedor 8+',   icon: '🍽️', vol: 2.2, cat: 'Comedor', minVehicleType: 'camion34', requiredHelpers: 1, isLong: true },
  { id: 'silla',       name: 'Silla (x1)',         icon: '🪑', vol: 0.3, cat: 'Comedor', minVehicleType: 'furgon', requiredHelpers: 0 },
  { id: 'piso',        name: 'Piso / banqueta',    icon: '🪑', vol: 0.2, cat: 'Comedor', minVehicleType: 'furgon', requiredHelpers: 0 },
  { id: 'vitrina',     name: 'Vitrina / cristalero',icon: '🗃️', vol: 1.8, cat: 'Comedor', minVehicleType: 'camion34', requiredHelpers: 1, isFragile: true, isTall: true },
  { id: 'aparador',    name: 'Aparador / bufetera',icon: '🪟', vol: 1.4, cat: 'Comedor', minVehicleType: 'furgon', requiredHelpers: 1 },

  // ── Cocina ──────────────────────────────────────────────────
  { id: 'nevera',      name: 'Refrigerador',       icon: '🧊', vol: 1.5, cat: 'Cocina', minVehicleType: 'camion34', requiredHelpers: 1, isTall: true },
  { id: 'neveraSbs',   name: 'Refrigerador side-by-side', icon: '🧊', vol: 2.2, cat: 'Cocina', minVehicleType: 'camion34', requiredHelpers: 2, isTall: true, isHeavy: true },
  { id: 'freezer',     name: 'Freezer / congeladora', icon: '❄️', vol: 1.2, cat: 'Cocina', minVehicleType: 'furgon', requiredHelpers: 1 },
  { id: 'cocina',      name: 'Cocina / horno',     icon: '🍳', vol: 1.0, cat: 'Cocina', minVehicleType: 'camion34', requiredHelpers: 1 },
  { id: 'hornoEmp',    name: 'Horno / encimera empotrable', icon: '🔥', vol: 0.5, cat: 'Cocina', minVehicleType: 'furgon', requiredHelpers: 0 },
  { id: 'microondas',  name: 'Microondas',         icon: '📟', vol: 0.1, cat: 'Cocina', minVehicleType: 'furgon', requiredHelpers: 0 },
  { id: 'lavavajillas',name: 'Lavavajillas',       icon: '🍴', vol: 0.7, cat: 'Cocina', minVehicleType: 'furgon', requiredHelpers: 1 },
  { id: 'muebleCocina',name: 'Mueble / repisa de cocina', icon: '🗄️', vol: 1.0, cat: 'Cocina', minVehicleType: 'furgon', requiredHelpers: 0 },
  { id: 'menaje',      name: 'Caja de menaje / vajilla', icon: '🍶', vol: 0.2, cat: 'Cocina', minVehicleType: 'furgon', requiredHelpers: 0, isFragile: true },

  // ── Electrodomésticos ───────────────────────────────────────
  { id: 'lavadora',    name: 'Lavadora',           icon: '🫧', vol: 0.8, cat: 'Electrodomésticos', minVehicleType: 'furgon', requiredHelpers: 1, isHeavy: true },
  { id: 'lavaSeca',    name: 'Lavadora-secadora',  icon: '🫧', vol: 0.9, cat: 'Electrodomésticos', minVehicleType: 'furgon', requiredHelpers: 1, isHeavy: true },
  { id: 'secadora',    name: 'Secadora',           icon: '🌀', vol: 0.8, cat: 'Electrodomésticos', minVehicleType: 'furgon', requiredHelpers: 1 },
  { id: 'calefont',    name: 'Calefont / termo',   icon: '🚿', vol: 0.4, cat: 'Electrodomésticos', minVehicleType: 'furgon', requiredHelpers: 0 },
  { id: 'estufa',      name: 'Estufa / calefactor',icon: '🔥', vol: 0.5, cat: 'Electrodomésticos', minVehicleType: 'furgon', requiredHelpers: 0 },
  { id: 'aire',        name: 'Aire acondicionado', icon: '🌬️', vol: 0.5, cat: 'Electrodomésticos', minVehicleType: 'furgon', requiredHelpers: 0 },
  { id: 'ventilador',  name: 'Ventilador',         icon: '💨', vol: 0.3, cat: 'Electrodomésticos', minVehicleType: 'furgon', requiredHelpers: 0 },
  { id: 'aspiradora',  name: 'Aspiradora',         icon: '🧹', vol: 0.3, cat: 'Electrodomésticos', minVehicleType: 'furgon', requiredHelpers: 0 },

  // ── Oficina ─────────────────────────────────────────────────
  { id: 'escritorio',  name: 'Escritorio',         icon: '💻', vol: 0.8, cat: 'Oficina', minVehicleType: 'furgon', requiredHelpers: 0 },
  { id: 'escritorioL', name: 'Escritorio en L / gamer', icon: '🖥️', vol: 1.4, cat: 'Oficina', minVehicleType: 'furgon', requiredHelpers: 1 },
  { id: 'sillaOfic',   name: 'Silla de oficina',   icon: '🪑', vol: 0.5, cat: 'Oficina', minVehicleType: 'furgon', requiredHelpers: 0 },
  { id: 'librero',     name: 'Librero / estante',  icon: '📚', vol: 1.0, cat: 'Oficina', minVehicleType: 'furgon', requiredHelpers: 0, isTall: true },
  { id: 'archivador',  name: 'Archivador / kardex',icon: '🗂️', vol: 0.7, cat: 'Oficina', minVehicleType: 'furgon', requiredHelpers: 0, isHeavy: true },
  { id: 'pcMonitor',   name: 'PC / monitor (caja)',icon: '🖨️', vol: 0.2, cat: 'Oficina', minVehicleType: 'furgon', requiredHelpers: 0, isFragile: true },
  { id: 'impresora',   name: 'Impresora / multifuncional', icon: '🖨️', vol: 0.3, cat: 'Oficina', minVehicleType: 'furgon', requiredHelpers: 0 },
  { id: 'cajaFuerte',  name: 'Caja fuerte',        icon: '🔐', vol: 0.3, cat: 'Oficina', minVehicleType: 'furgon', requiredHelpers: 1, isHeavy: true },

  // ── Baño ────────────────────────────────────────────────────
  { id: 'vanitorio',   name: 'Lavamanos / vanitorio', icon: '🚰', vol: 0.6, cat: 'Baño', minVehicleType: 'furgon', requiredHelpers: 0, isFragile: true },
  { id: 'muebleBano',  name: 'Mueble / repisa de baño', icon: '🧴', vol: 0.5, cat: 'Baño', minVehicleType: 'furgon', requiredHelpers: 0 },
  { id: 'espejoBano',  name: 'Espejo de baño',     icon: '🪞', vol: 0.2, cat: 'Baño', minVehicleType: 'furgon', requiredHelpers: 0, isFragile: true },
  { id: 'canastoRopa', name: 'Canasto de ropa',    icon: '🧺', vol: 0.2, cat: 'Baño', minVehicleType: 'furgon', requiredHelpers: 0 },

  // ── Exterior / terraza ──────────────────────────────────────
  { id: 'mesaTerraza', name: 'Mesa de terraza',    icon: '⛱️', vol: 1.0, cat: 'Exterior', minVehicleType: 'furgon', requiredHelpers: 0 },
  { id: 'sillasTerraza',name: 'Sillas de terraza (set)', icon: '🪑', vol: 0.8, cat: 'Exterior', minVehicleType: 'furgon', requiredHelpers: 0 },
  { id: 'quitasol',    name: 'Quitasol / sombrilla',icon: '🏖️', vol: 0.4, cat: 'Exterior', minVehicleType: 'furgon', requiredHelpers: 0, isLong: true },
  { id: 'parrilla',    name: 'Parrilla / quincho', icon: '🔥', vol: 0.8, cat: 'Exterior', minVehicleType: 'furgon', requiredHelpers: 0 },
  { id: 'bodegaJardin',name: 'Bodega de jardín',   icon: '🏚️', vol: 1.5, cat: 'Exterior', minVehicleType: 'furgon', requiredHelpers: 1 },
  { id: 'maceteros',   name: 'Maceteros / plantas grandes', icon: '🪴', vol: 0.3, cat: 'Exterior', minVehicleType: 'furgon', requiredHelpers: 0, isFragile: true },
  { id: 'cortadora',   name: 'Cortadora de pasto', icon: '🌱', vol: 0.4, cat: 'Exterior', minVehicleType: 'furgon', requiredHelpers: 0 },
  { id: 'escalera',    name: 'Escalera',           icon: '🪜', vol: 0.4, cat: 'Exterior', minVehicleType: 'furgon', requiredHelpers: 0, isLong: true },
  { id: 'herramientas',name: 'Caja de herramientas',icon: '🧰', vol: 0.3, cat: 'Exterior', minVehicleType: 'furgon', requiredHelpers: 0, isHeavy: true },
  { id: 'bancoTrabajo',name: 'Banco de trabajo',   icon: '🔨', vol: 1.2, cat: 'Exterior', minVehicleType: 'furgon', requiredHelpers: 1, isHeavy: true },

  // ── Bebé y niños ────────────────────────────────────────────
  { id: 'cuna',        name: 'Cuna',               icon: '🍼', vol: 1.2, cat: 'Bebé y niños', minVehicleType: 'furgon', requiredHelpers: 0 },
  { id: 'practicuna',  name: 'Corral / practicuna',icon: '🧷', vol: 0.5, cat: 'Bebé y niños', minVehicleType: 'furgon', requiredHelpers: 0 },
  { id: 'coche',       name: 'Coche / carriola',   icon: '👶', vol: 0.4, cat: 'Bebé y niños', minVehicleType: 'furgon', requiredHelpers: 0 },
  { id: 'sillaComer',  name: 'Silla de comer',     icon: '🥣', vol: 0.3, cat: 'Bebé y niños', minVehicleType: 'furgon', requiredHelpers: 0 },
  { id: 'sillaAuto',   name: 'Silla de auto',      icon: '🚗', vol: 0.3, cat: 'Bebé y niños', minVehicleType: 'furgon', requiredHelpers: 0 },
  { id: 'juguetes',    name: 'Caja de juguetes',   icon: '🧸', vol: 0.2, cat: 'Bebé y niños', minVehicleType: 'furgon', requiredHelpers: 0 },
  { id: 'juegoJardin', name: 'Resbalín / juegos',  icon: '🛝', vol: 0.9, cat: 'Bebé y niños', minVehicleType: 'furgon', requiredHelpers: 0 },

  // ── Deco y varios ───────────────────────────────────────────
  { id: 'cuadros',     name: 'Cuadros / espejos (set)', icon: '🖼️', vol: 0.3, cat: 'Deco y varios', minVehicleType: 'furgon', requiredHelpers: 0, isFragile: true },
  { id: 'plantas',     name: 'Plantas de interior',icon: '🪴', vol: 0.2, cat: 'Deco y varios', minVehicleType: 'furgon', requiredHelpers: 0, isFragile: true },
  { id: 'maletas',     name: 'Maletas / bolsos',   icon: '🧳', vol: 0.3, cat: 'Deco y varios', minVehicleType: 'furgon', requiredHelpers: 0 },
  { id: 'ropaBolsas',  name: 'Bolsas de ropa',     icon: '👕', vol: 0.2, cat: 'Deco y varios', minVehicleType: 'furgon', requiredHelpers: 0 },
  { id: 'bicicleta',   name: 'Bicicleta',          icon: '🚲', vol: 0.5, cat: 'Deco y varios', minVehicleType: 'furgon', requiredHelpers: 0, isLong: true },
  { id: 'trotadora',   name: 'Trotadora / caminadora', icon: '🏃', vol: 1.2, cat: 'Deco y varios', minVehicleType: 'camion34', requiredHelpers: 1, isHeavy: true },
  { id: 'biciEstatica',name: 'Bicicleta estática / spinning', icon: '🚴', vol: 0.6, cat: 'Deco y varios', minVehicleType: 'furgon', requiredHelpers: 1 },
  { id: 'pesas',       name: 'Set de pesas / mancuernas', icon: '🏋️', vol: 0.3, cat: 'Deco y varios', minVehicleType: 'furgon', requiredHelpers: 1, isHeavy: true },
  { id: 'pianoVert',   name: 'Piano vertical',     icon: '🎹', vol: 2.5, cat: 'Deco y varios', minVehicleType: 'camion34', requiredHelpers: 2, isHeavy: true },
  { id: 'tecladoDig',  name: 'Piano digital / teclado', icon: '🎹', vol: 0.4, cat: 'Deco y varios', minVehicleType: 'furgon', requiredHelpers: 0 },
  { id: 'instrumento', name: 'Instrumento (guitarra, batería…)', icon: '🎸', vol: 0.3, cat: 'Deco y varios', minVehicleType: 'furgon', requiredHelpers: 0, isFragile: true },
  { id: 'acuario',     name: 'Acuario / pecera',   icon: '🐠', vol: 0.3, cat: 'Deco y varios', minVehicleType: 'furgon', requiredHelpers: 0, isFragile: true },
  { id: 'jaulaMascota',name: 'Jaula / casa de mascota', icon: '🐾', vol: 0.4, cat: 'Deco y varios', minVehicleType: 'furgon', requiredHelpers: 0 },
  { id: 'moto',        name: 'Moto / scooter',     icon: '🏍️', vol: 1.0, cat: 'Deco y varios', minVehicleType: 'furgon', requiredHelpers: 1, isHeavy: true },

  // ── Cajas ───────────────────────────────────────────────────
  { id: 'cajaP',       name: 'Caja pequeña',       icon: '📦', vol: 0.08, cat: 'Cajas', minVehicleType: 'furgon', requiredHelpers: 0 },
  { id: 'cajaM',       name: 'Caja mediana',       icon: '📦', vol: 0.18, cat: 'Cajas', minVehicleType: 'furgon', requiredHelpers: 0 },
  { id: 'cajaG',       name: 'Caja grande',        icon: '📦', vol: 0.35, cat: 'Cajas', minVehicleType: 'furgon', requiredHelpers: 0 },
  { id: 'cajaLibros',  name: 'Caja de libros',     icon: '📦', vol: 0.15, cat: 'Cajas', minVehicleType: 'furgon', requiredHelpers: 0, isHeavy: true },
  { id: 'cajaRopa',    name: 'Caja de ropa / vestuario', icon: '📦', vol: 0.20, cat: 'Cajas', minVehicleType: 'furgon', requiredHelpers: 0 },
  { id: 'bolsaEmb',    name: 'Bolso de embalaje',  icon: '🛍️', vol: 0.12, cat: 'Cajas', minVehicleType: 'furgon', requiredHelpers: 0 },
];

export const VEHICLE_THRESHOLDS = [
  { vehicleType: 'furgon',      name: 'Furgón',       icon: '🚐', maxVol: 6,  desc: 'Cajas, colchón, electrodomésticos y muebles pequeños. Hasta 6 m³.' },
  { vehicleType: 'camion34',    name: 'Camión 3/4',   icon: '🚚', maxVol: 15, desc: 'Cama, nevera, sofá, closet y mudanza mediana. Hasta 15 m³.' },
  { vehicleType: 'camionLargo', name: 'Camión Largo', icon: '🚛', maxVol: 30, desc: 'Mudanza completa de depto o casa de 2-3 dormitorios. Hasta 30 m³.' },
];

export const MAX_MOVE_VOL = VEHICLE_THRESHOLDS[2].maxVol;

export const TALL_ITEM_IDS = new Set(
  CATALOG.filter(i => i.minVehicleType === 'camion34' || i.isTall).map(i => i.id)
);

const VEHICLE_RANK = { furgon: 1, camion34: 2, camionLargo: 3 };

export function normalizeCatalogItem(item) {
  return {
    ...item,
    isHeavy: Boolean(item.isHeavy ?? Number(item.requiredHelpers || 0) > 0),
    isTall: Boolean(item.isTall ?? item.minVehicleType === 'camion34'),
    isLong: Boolean(item.isLong ?? false),
    isFragile: Boolean(item.isFragile ?? false),
  };
}

export function totalVol(inventory, catalog = CATALOG) {
  return inventory.reduce((sum, item) => {
    const c = catalog.find(x => x.id === item.id);
    return sum + (c ? c.vol * (item.qty || 0) : 0);
  }, 0);
}

export function inventoryHasTallItems(inventory = [], catalog = CATALOG) {
  return inventory.some(item => {
    const c = catalog.find(x => x.id === item.id);
    return item.qty > 0 && c?.minVehicleType === 'camion34';
  });
}

export function inventoryLoadStats(inventory = [], catalog = CATALOG) {
  return inventory.reduce((stats, item) => {
    const qty = Number(item.qty || 0);
    if (qty <= 0) return stats;
    const raw = catalog.find(x => x.id === item.id);
    if (!raw) return stats;
    const c = normalizeCatalogItem(raw);
    stats.totalQty += qty;
    stats.totalVol += Number(c.vol || 0) * qty;
    stats.requiredItemHelpers = Math.max(stats.requiredItemHelpers, Number(c.requiredHelpers || 0));
    if (c.isHeavy) stats.heavyQty += qty;
    if (c.isTall || c.minVehicleType === 'camion34') stats.tallQty += qty;
    if (c.isLong) stats.longQty += qty;
    if (c.isFragile) stats.fragileQty += qty;
    if (c.cat) stats.categories.add(c.cat);
    return stats;
  }, {
    totalQty: 0,
    totalVol: 0,
    heavyQty: 0,
    tallQty: 0,
    longQty: 0,
    fragileQty: 0,
    requiredItemHelpers: 0,
    categories: new Set(),
  });
}

export function requiredHelpersForInventory(inventory = [], catalog = CATALOG) {
  const stats = inventoryLoadStats(inventory, catalog);
  if (stats.totalQty === 0 || stats.totalVol <= 0) return 0;

  let helpers = stats.requiredItemHelpers;

  // 1 ayudante: cualquier item muy pesado/alto, o volumen considerable
  if (stats.heavyQty >= 1 || stats.tallQty >= 1 || stats.totalVol > 5) {
    helpers = Math.max(helpers, 1);
  }

  // 2 ayudantes: mudanza real con mucho volumen y varios muebles pesados
  if (
    stats.totalVol > 16 ||
    stats.totalQty >= 16 ||
    stats.heavyQty >= 4 ||
    (stats.categories.size >= 4 && stats.totalQty >= 12)
  ) {
    helpers = Math.max(helpers, 2);
  }

  // 3 ayudantes: mudanza muy grande (camión largo lleno)
  if (stats.totalVol > 24 || stats.totalQty >= 24) {
    helpers = Math.max(helpers, 3);
  }

  return Math.min(3, helpers);
}

export function recommendVehicleType(vol, inventory = [], catalog = CATALOG) {
  if (vol > VEHICLE_THRESHOLDS[1].maxVol) return 'camionLargo';
  const minVehicle = inventory.reduce((best, item) => {
    const c = catalog.find(x => x.id === item.id);
    return item.qty > 0 && VEHICLE_RANK[c?.minVehicleType] > VEHICLE_RANK[best] ? c.minVehicleType : best;
  }, 'furgon');
  if (minVehicle === 'camionLargo') return 'camionLargo';
  if (minVehicle === 'camion34') return 'camion34';
  const v = VEHICLE_THRESHOLDS.find(t => vol <= t.maxVol);
  return (v || VEHICLE_THRESHOLDS[VEHICLE_THRESHOLDS.length - 1]).vehicleType;
}

export function recommendVehicleTypeByVolume(vol) {
  const v = VEHICLE_THRESHOLDS.find(t => vol <= t.maxVol);
  return (v || VEHICLE_THRESHOLDS[VEHICLE_THRESHOLDS.length - 1]).vehicleType;
}

export function parseInventoryStr(str) {
  if (!str) return { inventory: [], extras: '' };
  try {
    const p = JSON.parse(str);
    if (p && Array.isArray(p.inventory)) return { inventory: p.inventory, extras: p.extras || '' };
  } catch {}
  return { inventory: [], extras: str }; // backward compat: plain text
}

export function serializeInventory(inventory, extras) {
  const active = inventory.filter(i => i.qty > 0);
  if (!active.length && !extras) return '';
  if (!active.length) return extras;
  return JSON.stringify({ inventory: active, extras: extras || '' });
}

// Categories that start expanded by default
const OPEN_BY_DEFAULT = new Set(['Dormitorio', 'Living', 'Cocina']);

// ── Component ─────────────────────────────────────────────────────────────────

export default function InventoryPicker({ inventory, onChange, extras, onExtrasChange, disabled = false, catalog = CATALOG }) {
  const cats = React.useMemo(() => [...new Set(catalog.map(c => c.cat))], [catalog]);
  const [collapsed, setCollapsed] = React.useState(() =>
    // In disabled mode: start all collapsed (only non-empty ones are shown, auto-expand them)
    disabled
      ? Object.fromEntries(cats.map(c => [c, false]))
      : Object.fromEntries(cats.map(c => [c, !OPEN_BY_DEFAULT.has(c)]))
  );

  const getQty = id => inventory.find(i => i.id === id)?.qty || 0;
  const currentVol = totalVol(inventory, catalog);

  const setQty = (id, qty) => {
    const next = inventory.filter(i => i.id !== id);
    if (qty > 0) {
      const cat = catalog.find(c => c.id === id);
      next.push({ id, name: cat.name, qty });
    }
    onChange(next);
  };

  const toggleCat = cat => setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }));

  return (
    <div>
      {cats.map(cat => {
        const isOpen = !collapsed[cat];
        const catItems = catalog.filter(c => c.cat === cat);
        const selectedCount = catItems.reduce((s, i) => s + (getQty(i.id) > 0 ? 1 : 0), 0);
        // In disabled (read-only) mode, hide empty categories entirely
        if (disabled && selectedCount === 0) return null;
        return (
          <div key={cat} style={{ marginBottom: 6, borderRadius: 10, overflow: 'hidden', border: '1px solid #e8edf5' }}>
            {/* Category accordion header */}
            <button
              type="button"
              onClick={() => toggleCat(cat)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', background: selectedCount > 0 ? '#f4f8ff' : '#f8fafc',
                border: 'none', cursor: 'pointer',
                padding: '11px 14px', minHeight: 48,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: .8, color: selectedCount > 0 ? 'var(--accent)' : '#64748b', textTransform: 'uppercase' }}>
                  {cat}
                </span>
                {selectedCount > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: 'var(--accent)', borderRadius: 99, padding: '1px 7px', minWidth: 20, textAlign: 'center' }}>
                    {selectedCount}
                  </span>
                )}
                {!isOpen && selectedCount === 0 && (
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{catItems.length} artículos</span>
                )}
              </div>
              <span style={{
                fontSize: 11, color: '#94a3b8', display: 'inline-block', lineHeight: 1,
                transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                transition: 'transform .2s ease',
              }}>▼</span>
            </button>

            {/* Category items */}
            {isOpen && (
              <div className="inventory-item-grid" style={{ padding: '8px 10px 10px' }}>
                {catItems.map(item => {
                  const qty = getQty(item.id);
                  const wouldExceedLimit = currentVol + item.vol > MAX_MOVE_VOL;
                  return (
                    <div
                      key={item.id}
                      className="inventory-item"
                      style={{
                        background: qty > 0 ? '#EEF4FF' : '#fff',
                        border: `1.5px solid ${qty > 0 ? 'var(--accent)' : '#e2e8f0'}`,
                        borderRadius: 9,
                      }}
                    >
                      <span className="inventory-item-icon">{item.icon}</span>
                      <div className="inventory-item-name" style={{ fontWeight: qty > 0 ? 700 : 500, color: qty > 0 ? 'var(--accent)' : '#475569' }}>
                        <div>{item.name}</div>
                        <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 1 }}>{item.vol} m³</div>
                      </div>
                      <div className="inventory-stepper">
                        <button
                          type="button"
                          onClick={() => !disabled && setQty(item.id, Math.max(0, qty - 1))}
                          disabled={disabled || qty === 0}
                          style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px solid #e2e8f0', background: '#fff', fontSize: 16, fontWeight: 700, cursor: (disabled || qty === 0) ? 'not-allowed' : 'pointer', color: qty === 0 ? '#cbd5e1' : '#0f172a', lineHeight: 1, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .12s', flexShrink: 0 }}>−</button>
                        <span style={{ fontSize: 13, fontWeight: 800, minWidth: 16, textAlign: 'center', color: qty > 0 ? 'var(--accent)' : '#94a3b8' }}>{qty}</span>
                        <button
                          type="button"
                          onClick={() => !disabled && setQty(item.id, qty + 1)}
                          disabled={disabled || wouldExceedLimit}
                          title={wouldExceedLimit ? 'Límite de volumen para cotización online' : undefined}
                          style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px solid #e2e8f0', background: qty > 0 ? 'var(--accent)' : '#fff', fontSize: 16, fontWeight: 700, cursor: (disabled || wouldExceedLimit) ? 'not-allowed' : 'pointer', color: (disabled || wouldExceedLimit) ? '#cbd5e1' : qty > 0 ? '#fff' : '#0f172a', lineHeight: 1, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .12s', flexShrink: 0 }}>+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Free-text extras */}
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: .5, color: '#94a3b8', textTransform: 'uppercase', margin: '0 0 6px' }}>Otros artículos</div>
        <textarea
          value={extras}
          onChange={e => !disabled && onExtrasChange(e.target.value)}
          placeholder="Piano, moto, bicicleta, cuadros frágiles, herramientas, colchón…"
          rows={2}
          disabled={disabled}
          style={{ width: '100%', height: 72, maxHeight: 72, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 9, color: '#0f172a', fontSize: 13, padding: '9px 11px', outline: 'none', display: 'block', boxSizing: 'border-box', resize: 'none', overflow: 'auto' }}
        />
      </div>
    </div>
  );
}
