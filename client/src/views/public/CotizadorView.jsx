import React, { useState, useEffect, useRef } from 'react';
import { loadGoogleMaps } from '../../utils/googleMaps.js';
import {
  ArrowLeft, ArrowRight, Check, X, Sparkles,
  Building2, Shield, PenLine, Phone, Users, Mail,
  Truck, MapPin, ChevronRight, Search,
} from 'lucide-react';
import { api } from '../../api/index.js';
import AddressAutocomplete from '../../components/AddressAutocomplete.jsx';
import { CATALOG, serializeInventory, totalVol } from '../../components/InventoryPicker.jsx';
import { trackMetaEvent, initMetaPixel } from '../../utils/metaPixel.js';
import { trackLanding as _trackLandingDB, trackEvent as _trackEventDB, trackSubmit as _trackSubmitDB } from '../../utils/pageTracker.js';

// ─── Design tokens ────────────────────────────────────────────
const B = '#1B6CF5';
const N = '#0A1F3D';
const C = '#3FBEED';
const GRAD      = `linear-gradient(135deg,${B} 0%,${C} 100%)`;
const GRAD_DEEP = `linear-gradient(135deg,#0F2A52 0%,${B} 60%,${C} 100%)`;
const BG = '#F5F8FF', SURF = '#FFFFFF', BDR = '#E4ECF7';
const T2 = '#4A5B7A', T3 = '#8A9AB8';
const SUC = '#18A957', WA = '#25D366';
const fmt = n => '$' + Math.round(n || 0).toLocaleString('es-CL');

const STEP_NAMES = {
  0: 'bienvenida', 1: 'direcciones', 2: 'articulos',
  3: 'detalles', 4: 'resultado', 5: 'contacto', 6: 'enviado',
};

function trackStep(stepNum) {
  try {
    initMetaPixel();
    trackMetaEvent('CotizadorPaso', { paso: stepNum, nombre: STEP_NAMES[stepNum] || stepNum });
    if (stepNum === 1) trackMetaEvent('ViewContent', { content_name: 'Cotizador MUVE', content_category: 'flete_mudanza' });
    if (stepNum === 4) trackMetaEvent('InitiateCheckout', { content_name: 'Cotizador MUVE - Vio precio' });
  } catch (_) {}
}

// ─── Catalog grouped ──────────────────────────────────────────
const CAT_EMOJI = {
  'Dormitorio':'🛏️','Living':'🛋️','Comedor':'🍽️','Cocina':'🧊','Electrodomésticos':'🫧',
  'Oficina':'💻','Baño':'🚿','Exterior':'🌳','Bebé y niños':'🧸','Deco y varios':'🎸','Cajas':'📦',
};
const CATS_ORDER = ['Dormitorio','Living','Comedor','Cocina','Electrodomésticos','Oficina','Baño','Exterior','Bebé y niños','Deco y varios','Cajas'];
const GROUPED = CATS_ORDER.map(cat => ({
  id: cat, label: cat, emoji: CAT_EMOJI[cat] || '📦',
  items: CATALOG.filter(c => c.cat === cat),
})).filter(g => g.items.length > 0);

// ─── Google Maps route map ────────────────────────────────────
function LeafletRouteMap({ from, to, distanceKm }) {
  const divRef    = useRef(null);
  const mapRef    = useRef(null);
  const gmRef     = useRef(null);
  const routeRef  = useRef(null);
  const mksRef    = useRef([]);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    loadGoogleMaps().then(gm => {
      gmRef.current = gm;
      mapRef.current = new gm.Map(divRef.current, {
        center: { lat: -33.45, lng: -70.65 },
        zoom: 11,
        zoomControl: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: 'none',
      });
      setMapReady(true);
    });
    return () => { mapRef.current = null; gmRef.current = null; };
  }, []);

  useEffect(() => {
    const gm  = gmRef.current;
    const map = mapRef.current;
    if (!gm || !map || !from.lat || !to.lat) return;
    mksRef.current.forEach(m => m.setMap(null));
    mksRef.current = [];
    routeRef.current?.setMap(null);
    routeRef.current = null;

    const mkIcon = color => ({
      path: gm.SymbolPath.CIRCLE,
      scale: 6,
      fillColor: color,
      fillOpacity: 1,
      strokeColor: '#fff',
      strokeWeight: 3,
    });
    mksRef.current.push(
      new gm.Marker({ position: { lat: from.lat, lng: from.lng }, map, icon: mkIcon(B) }),
      new gm.Marker({ position: { lat: to.lat, lng: to.lng }, map, icon: mkIcon(SUC) }),
    );

    api.getPublicOsrmPath({ originLat: from.lat, originLng: from.lng, destLat: to.lat, destLng: to.lng })
      .then(data => {
        if (!mapRef.current || !data.geometry) throw new Error('no geometry');
        const path = data.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
        routeRef.current = new gm.Polyline({ path, strokeColor: B, strokeWeight: 4.5, strokeOpacity: 0.9, map });
        const bounds = new gm.LatLngBounds();
        path.forEach(p => bounds.extend(p));
        map.fitBounds(bounds, { top: 30, right: 30, bottom: 30, left: 30 });
      })
      .catch(() => {
        if (!mapRef.current) return;
        routeRef.current = new gm.Polyline({
          path: [{ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng }],
          strokeColor: B,
          strokeOpacity: 0,
          strokeWeight: 3,
          icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.7, strokeColor: B, scale: 3 }, offset: '0', repeat: '16px' }],
          map,
        });
        const bounds = new gm.LatLngBounds();
        bounds.extend({ lat: from.lat, lng: from.lng });
        bounds.extend({ lat: to.lat, lng: to.lng });
        map.fitBounds(bounds, { top: 30, right: 30, bottom: 30, left: 30 });
      });
  }, [mapReady, from.lat, from.lng, to.lat, to.lng]);

  return (
    <div style={{ borderRadius: 14, overflow: 'hidden', height: 190, marginBottom: 10, border: `1px solid ${BDR}`, position: 'relative', background: '#EEF3FF' }}>
      <div ref={divRef} style={{ width: '100%', height: '100%' }}/>
      {distanceKm && from.lat && to.lat && (
        <div style={{
          position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
          background: '#fff', borderRadius: 20, padding: '5px 16px',
          border: `1px solid ${BDR}`, boxShadow: '0 2px 10px rgba(10,31,61,.16)',
          pointerEvents: 'none', zIndex: 1000,
        }}>
          <span style={{ fontSize: 13, fontWeight: 900, color: B }}>{distanceKm} km</span>
        </div>
      )}
      {!from.lat && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', zIndex: 500 }}>
          <span style={{ fontSize: 12, color: T3, fontWeight: 600 }}>Ingresa las direcciones</span>
        </div>
      )}
    </div>
  );
}

// ─── Stepper +/- ─────────────────────────────────────────────
function Stepper({ value, onChange, max = 20 }) {
  const btn = (dis, label, onClick) => (
    <button type="button" disabled={dis} onClick={onClick} style={{
      width: 32, height: 32, borderRadius: 999, border: `1.5px solid ${dis ? BDR : B}`,
      background: dis ? BG : '#EFF5FF', color: dis ? T3 : B, fontSize: 18, fontWeight: 700,
      cursor: dis ? 'default' : 'pointer', display: 'grid', placeItems: 'center', lineHeight: 1,
    }}>{label}</button>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {btn(value <= 0, '−', () => onChange(Math.max(0, value - 1)))}
      <span style={{ minWidth: 20, textAlign: 'center', fontSize: 15, fontWeight: 800, color: value > 0 ? N : T3 }}>{value}</span>
      {btn(value >= max, '+', () => onChange(Math.min(max, value + 1)))}
    </div>
  );
}

const WA_URL = `https://wa.me/56952023504?text=${encodeURIComponent('Hola MUVE! 👋 Necesito ayuda con mi cotización.')}`;
const WaIcon = ({ size = 20, color = WA }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M20.5 3.5A11 11 0 003.4 17.4L2 22l4.7-1.4A11 11 0 1020.5 3.5z"/>
  </svg>
);

// ─── Flat mono icons (Fontawesome-style) ─────────────────────
const IcoBolt   = ({ size=16 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
const IcoLock   = ({ size=16 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
const IcoDiamond= ({ size=16 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 3 6 18L6 3zm0 0h12M6 3 2 9l10 12L2 9zm20 0-4 6-10 12 4-6 10-12zm-20 0h20"/><path d="m2 9h20"/></svg>;
const IcoSofa   = ({ size=15 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3"/><path d="M2 11a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4z"/><path d="M4 17v2"/><path d="M20 17v2"/></svg>;
const IcoBox    = ({ size=15 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>;
const IcoFridge = ({ size=15 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M4 10h16"/><path d="M8 6v2"/><path d="M8 14v4"/></svg>;
const IcoBed    = ({ size=15 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>;
const IcoTable  = ({ size=15 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="6" rx="1"/><path d="M3 9h18"/><path d="M7 9v12"/><path d="M17 9v12"/></svg>;
const IcoTv     = ({ size=15 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="14" rx="2"/><path d="M8 20h8"/><path d="M12 18v2"/></svg>;
const IcoChair  = ({ size=15 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3"/><path d="M3 11h2a2 2 0 0 1 2 2v2h10v-2a2 2 0 0 1 2-2h2"/><path d="M7 15v4"/><path d="M17 15v4"/><path d="M3 11v4"/><path d="M21 11v4"/></svg>;
const IcoDesk   = ({ size=15 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9h18"/><path d="M3 9v10a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9"/><path d="M3 9V5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v4"/><path d="M8 19v2"/><path d="M16 19v2"/></svg>;

// ─── Progress header ──────────────────────────────────────────
function Header({ step, total, title, onBack }) {
  const pct = (step / total) * 100;
  return (
    <div style={{ background: SURF, borderBottom: `1px solid ${BDR}`, paddingTop: 'env(safe-area-inset-top,0px)', position: 'sticky', top: 0, zIndex: 10, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 8px' }}>
        <button type="button" onClick={onBack} style={{ width: 38, height: 38, borderRadius: 12, border: `1px solid ${BDR}`, background: BG, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
          <ArrowLeft size={18} color={N} strokeWidth={2}/>
        </button>
        <img src="/logo_reducido.png" alt="MUVE" style={{ height: 44, objectFit: 'contain' }}/>
        <a href={WA_URL} target="_blank" rel="noreferrer" style={{
          width: 38, height: 38, borderRadius: 12,
          background: 'rgba(37,211,102,.12)', border: '1px solid rgba(37,211,102,.28)',
          display: 'grid', placeItems: 'center', textDecoration: 'none', flexShrink: 0,
        }}>
          <WaIcon size={20}/>
        </a>
      </div>
      <div style={{ padding: '0 16px 10px' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: N, marginBottom: 6 }}>{title}</div>
        <div style={{ height: 4, borderRadius: 99, background: BDR, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: GRAD, borderRadius: 99, transition: 'width .4s cubic-bezier(.4,0,.2,1)' }}/>
        </div>
      </div>
    </div>
  );
}

// ─── CTA bar ──────────────────────────────────────────────────
function CtaBar({ children }) {
  return (
    <div style={{
      flexShrink: 0, background: SURF, borderTop: `1px solid ${BDR}`,
      padding: '12px 16px', paddingBottom: 'max(16px,env(safe-area-inset-bottom,16px))',
      display: 'flex', gap: 10, zIndex: 10,
    }}>{children}</div>
  );
}

// ─── Buttons ──────────────────────────────────────────────────
const BtnPrimary = ({ children, onClick, disabled, style: s = {} }) => (
  <button
    type="button"
    onClick={onClick}
    onMouseDown={disabled ? undefined : addRipple}
    disabled={disabled}
    style={{
      flex: 1, padding: '16px 20px', borderRadius: 14, border: 'none',
      background: disabled ? '#CBD5E1' : GRAD, color: '#fff',
      fontSize: 15, fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      boxShadow: disabled ? 'none' : `0 8px 22px rgba(27,108,245,.35)`,
      transition: 'transform .1s ease, opacity .15s',
      position: 'relative', overflow: 'hidden',
      ...s,
    }}
    onMouseEnter={e => { if (!disabled) e.currentTarget.style.transform = 'scale(1.015)'; }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
    onMouseUp={e => { e.currentTarget.style.transform = 'scale(1.015)'; }}
  >{children}</button>
);
const BtnBack = ({ onClick }) => (
  <button type="button" onClick={onClick} style={{
    width: 50, height: 50, borderRadius: 14, border: `1.5px solid ${BDR}`,
    background: BG, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0,
  }}><ArrowLeft size={20} color={N} strokeWidth={2}/></button>
);

// ─── Static scene background (desktop only) ──────────────────
// Fondo del cotizador (desktop): render limpio y luminoso estilo low-poly.
// La PISTA se mantiene recta y horizontal en la misma posición de siempre
// (y=593, línea discontinua en y=644) para que la transición del camión no cambie.
// `packed` = el camión ya arrancó: las cajas de la mudanza "se cargaron" y desaparecen.
// Escena low-poly / origami: cada volumen con cara superior clara, cara derecha
// media y frente en sombra (luz desde arriba-derecha), + sombras proyectadas.
function SceneStatic({ packed = false }) {
  // Caja isométrica facetada. (x,y)=esquina sup-izq del frente; d=profundidad.
  const IsoBox = (x, y, w, h, d, top, side, front, i) => {
    const dy = d * 0.52;
    return (
      <g key={`ib${i}`}>
        <polygon points={`${x},${y} ${x + w},${y} ${x + w},${y + h} ${x},${y + h}`} fill={front}/>
        <polygon points={`${x + w},${y} ${x + w + d},${y - dy} ${x + w + d},${y + h - dy} ${x + w},${y + h}`} fill={side}/>
        <polygon points={`${x},${y} ${x + d},${y - dy} ${x + w + d},${y - dy} ${x + w},${y}`} fill={top}/>
      </g>
    );
  };

  // Cajas de mudanza: [x, y, w, h] (frente). Profundidad fija.
  const BOXES = [[92, 500, 46, 42], [146, 506, 42, 36], [200, 498, 38, 44], [100, 468, 38, 32], [202, 462, 32, 30]];

  // Coníferas / árboles redondos / rocas / destellos
  const CONIFERS = [[520, 548, 1], [1300, 552, 1.05], [640, 546, .78]];
  const BLOBS = [[770, 550, 1], [980, 548, .82], [1180, 552, 1.08]];
  const ROCKS = [[300, 540, 1.15], [352, 546, .8], [1240, 560, .95]];
  const SPARKS = [[240, 452, .9], [900, 500, 1], [1130, 452, .7], [660, 662, .8], [1020, 668, .7]];

  const shadow = (cx, cy, rx) => (
    <ellipse cx={cx} cy={cy} rx={rx} ry={rx * 0.16} fill="rgba(28,44,74,.12)"/>
  );

  // ── Muebles de mudanza (facetados, luz arriba-derecha) ──────────────
  const Sofa = (x, y) => (
    <g key="sofa">
      <ellipse cx={x + 66} cy={y + 4} rx="82" ry="10" fill="rgba(28,44,74,.13)"/>
      <polygon points={`${x + 6},${y - 48} ${x + 122},${y - 48} ${x + 130},${y - 55} ${x + 14},${y - 55}`} fill="#8FCFD9"/>
      <polygon points={`${x + 6},${y - 48} ${x + 122},${y - 48} ${x + 122},${y - 14} ${x + 6},${y - 14}`} fill="#5AA1AD"/>
      <polygon points={`${x - 2},${y - 20} ${x + 130},${y - 20} ${x + 138},${y - 27} ${x + 6},${y - 27}`} fill="#A6DDE4"/>
      <polygon points={`${x - 2},${y - 20} ${x + 130},${y - 20} ${x + 130},${y} ${x - 2},${y}`} fill="#559AA6"/>
      {[0, 1, 2].map(k => <rect key={k} x={x + 8 + k * 41} y={y - 33} width="35" height="15" rx="4" fill="#BEE7EC"/>)}
      <polygon points={`${x - 8},${y - 32} ${x + 12},${y - 32} ${x + 18},${y - 39} ${x - 2},${y - 39}`} fill="#8FCFD9"/>
      <polygon points={`${x - 8},${y - 32} ${x + 12},${y - 32} ${x + 12},${y} ${x - 8},${y}`} fill="#468693"/>
      <polygon points={`${x + 116},${y - 32} ${x + 136},${y - 32} ${x + 142},${y - 39} ${x + 122},${y - 39}`} fill="#8FCFD9"/>
      <polygon points={`${x + 116},${y - 32} ${x + 136},${y - 32} ${x + 136},${y} ${x + 116},${y}`} fill="#468693"/>
      <rect x={x + 2} y={y} width="5" height="8" fill="#8A6A45"/><rect x={x + 122} y={y} width="5" height="8" fill="#8A6A45"/>
    </g>
  );
  const Chair = (x, y) => (
    <g key="chair">
      <ellipse cx={x + 22} cy={y + 3} rx="36" ry="7" fill="rgba(28,44,74,.13)"/>
      <polygon points={`${x + 2},${y - 44} ${x + 44},${y - 44} ${x + 50},${y - 50} ${x + 8},${y - 50}`} fill="#F2CE84"/>
      <polygon points={`${x + 2},${y - 44} ${x + 44},${y - 44} ${x + 44},${y - 16} ${x + 2},${y - 16}`} fill="#D6A247"/>
      <polygon points={`${x - 4},${y - 20} ${x + 48},${y - 20} ${x + 54},${y - 26} ${x + 2},${y - 26}`} fill="#F2CE84"/>
      <polygon points={`${x - 4},${y - 20} ${x + 48},${y - 20} ${x + 48},${y} ${x - 4},${y}`} fill="#D6A247"/>
      <rect x={x - 2} y={y} width="5" height="8" fill="#8A6A45"/><rect x={x + 40} y={y} width="5" height="8" fill="#8A6A45"/>
    </g>
  );
  const Dresser = (x, y) => (
    <g key="dresser">
      <ellipse cx={x + 34} cy={y + 3} rx="46" ry="7" fill="rgba(28,44,74,.13)"/>
      {IsoBox(x, y - 62, 62, 62, 16, '#DEBB8F', '#B58A60', '#CBA679', 'dr')}
      {[0, 1, 2].map(k => (
        <g key={k}>
          <rect x={x + 6} y={y - 56 + k * 19} width="50" height="15" fill="none" stroke="#A57C53" strokeWidth="1.5"/>
          <rect x={x + 27} y={y - 51 + k * 19} width="8" height="4" rx="2" fill="#7C5E3E"/>
        </g>
      ))}
    </g>
  );
  const Lamp = (x, y) => (
    <g key="lamp">
      <ellipse cx={x} cy={y + 3} rx="16" ry="5" fill="rgba(28,44,74,.13)"/>
      <rect x={x - 2} y={y - 74} width="4" height="74" fill="#9AA7B5"/>
      <ellipse cx={x} cy={y} rx="13" ry="4" fill="#8A97A5"/>
      <polygon points={`${x - 17},${y - 74} ${x + 17},${y - 74} ${x + 11},${y - 100} ${x - 11},${y - 100}`} fill="#F5E8C6"/>
      <polygon points={`${x - 17},${y - 74} ${x},${y - 74} ${x - 6},${y - 100} ${x - 11},${y - 100}`} fill="#E4D0A4"/>
    </g>
  );
  const Plant = (x, y) => (
    <g key="plant">
      <ellipse cx={x} cy={y + 3} rx="18" ry="5" fill="rgba(28,44,74,.13)"/>
      {[[-11, -42, '#5CA07E'], [11, -46, '#7FC09E'], [0, -58, '#A9D8BC'], [-17, -30, '#6BB490'], [17, -30, '#5CA07E']].map(([dx, dy, c], k) => (
        <polygon key={k} points={`${x},${y - 18} ${x + dx},${y + dy} ${x + dx * 0.4},${y + dy + 15}`} fill={c}/>
      ))}
      <polygon points={`${x - 13},${y} ${x + 13},${y} ${x + 10},${y - 20} ${x - 10},${y - 20}`} fill="#C77C56"/>
      <polygon points={`${x - 10},${y - 20} ${x + 10},${y - 20} ${x + 8},${y - 8} ${x - 8},${y - 8}`} fill="#A6633F"/>
    </g>
  );

  return (
    <svg width="100%" height="100%" viewBox="0 0 1440 700" preserveAspectRatio="xMidYMax slice"
         xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', position: 'absolute', inset: 0 }}>
      <defs>
        <linearGradient id="czSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8FC4EB"/><stop offset="1" stopColor="#DFF0FA"/>
        </linearGradient>
        <linearGradient id="czGround" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#CFE3D2"/><stop offset="1" stopColor="#DEEBDD"/>
        </linearGradient>
        <linearGradient id="czGlass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#C7E6F6"/><stop offset="1" stopColor="#8FBFE2"/>
        </linearGradient>
        <linearGradient id="czDoor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FDE7A6"/><stop offset="1" stopColor="#F3C766"/>
        </linearGradient>
        <radialGradient id="czHaze" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="rgba(255,244,214,.9)"/>
          <stop offset="45%" stopColor="rgba(255,236,190,.4)"/>
          <stop offset="100%" stopColor="rgba(255,236,190,0)"/>
        </radialGradient>
        <radialGradient id="czDoorPool" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="rgba(250,214,130,.55)"/>
          <stop offset="100%" stopColor="rgba(250,214,130,0)"/>
        </radialGradient>
      </defs>

      {/* Cielo + sol */}
      <rect x="0" y="0" width="1440" height="560" fill="url(#czSky)"/>
      <circle cx="1290" cy="36" r="300" fill="url(#czHaze)"/>
      <circle cx="1290" cy="36" r="44" fill="rgba(255,240,196,.95)"/>

      {/* Nubes que derivan lento */}
      <g opacity=".9">
        <animateTransform attributeName="transform" type="translate" from="0 0" to="80 0" dur="130s" repeatCount="indefinite"/>
        <polygon points="150,96 200,72 262,80 296,100 210,110" fill="#fff"/>
        <polygon points="150,96 210,110 296,100 240,116" fill="#EAF4FC"/>
      </g>
      <g opacity=".6">
        <animateTransform attributeName="transform" type="translate" from="0 0" to="60 0" dur="170s" repeatCount="indefinite"/>
        <polygon points="740,124 800,100 866,110 892,130 810,140" fill="#fff"/>
        <polygon points="740,124 810,140 892,130 838,146" fill="#EAF4FC"/>
      </g>
      <g opacity=".5">
        <animateTransform attributeName="transform" type="translate" from="0 0" to="45 0" dur="210s" repeatCount="indefinite"/>
        <polygon points="1030,150 1078,132 1130,140 1152,158 1082,166" fill="#fff"/>
      </g>

      {/* Ciudad de fondo — dos filas facetadas con ventanas */}
      {[
        // fila lejana (tenue, más alta)
        ...Array.from({ length: 15 }, (_, k) => ({ x: -20 + k * 100, y: 336 + (k * 47 % 88), w: 46 + (k % 3) * 12, op: 0.45, base: '#A6C0DC', d: 10 })),
        // fila media (más marcada, más baja)
        ...Array.from({ length: 10 }, (_, k) => ({ x: 20 + k * 150, y: 408 + (k * 33 % 66), w: 78 + (k % 2) * 26, op: 0.72, base: '#8FB1D2', d: 16 })),
      ].map(({ x, y, w, op, base, d }, i) => {
        const h = 524 - y;
        const rows = Math.max(1, Math.floor(h / 28));
        const cols = Math.max(1, Math.floor((w - 12) / 18));
        return (
          <g key={`bld${i}`} opacity={op}>
            <polygon points={`${x},${y} ${x + w},${y} ${x + w},${y + h} ${x},${y + h}`} fill={base}/>
            <polygon points={`${x},${y} ${x + d},${y - d * 0.6} ${x + w + d},${y - d * 0.6} ${x + w},${y}`} fill="#C8DBED"/>
            <polygon points={`${x + w},${y} ${x + w + d},${y - d * 0.6} ${x + w + d},${y + h - d * 0.6} ${x + w},${y + h}`} fill="#87A6C6"/>
            {Array.from({ length: rows }).map((_, r) =>
              Array.from({ length: cols }).map((__, c) => (
                <rect key={`${r}-${c}`} x={x + 8 + c * 18} y={y + 12 + r * 28} width="9" height="12" fill="#E9F2F9" opacity=".6"/>
              ))
            )}
          </g>
        );
      })}

      {/* Colinas facetadas */}
      <polygon points="0,520 240,470 520,506 760,468 1060,500 1440,472 1440,540 0,540" fill="#B7D9BF"/>
      <polygon points="0,520 240,470 520,506 300,540 0,540" fill="#A6CEAE"/>
      <polygon points="760,468 1060,500 1440,472 1440,540 900,540" fill="#A6CEAE"/>

      {/* Suelo */}
      <rect x="0" y="512" width="1440" height="188" fill="url(#czGround)"/>
      <rect x="0" y="586" width="1440" height="10" fill="#BFDCC4"/>
      <rect x="0" y="512" width="1440" height="10" fill="rgba(255,255,255,.28)"/>

      {/* ── Casa moderna (izquierda), volúmenes facetados ───────── */}
      {/* Sombra proyectada de la casa hacia la izquierda */}
      <polygon points="20,540 120,540 40,566 -60,566" fill="rgba(28,44,74,.10)"/>
      {/* Garaje */}
      {IsoBox(20, 372, 96, 168, 22, '#F4F8FC', '#DCE8F4', '#CBDDEE', 'g')}
      <rect x="30" y="392" width="76" height="130" fill="#BDD2E6"/>
      {[0, 1, 2, 3, 4, 5].map(k => <line key={`gl${k}`} x1={30} y1={392 + k * 22} x2={106} y2={392 + k * 22} stroke="#A9C2DA" strokeWidth="2.5"/>)}
      {/* Ala baja derecha */}
      {IsoBox(268, 336, 188, 204, 26, '#F1F6FB', '#D7E5F2', '#C6DAEC', 'w')}
      <rect x="296" y="356" width="120" height="24" fill="url(#czGlass)" stroke="#B7CFE4" strokeWidth="1.5"/>
      <rect x="296" y="420" width="120" height="24" fill="url(#czGlass)" stroke="#B7CFE4" strokeWidth="1.5"/>
      {/* Cuerpo principal con techo a un agua */}
      {IsoBox(116, 262, 150, 278, 30, '#F6FAFD', '#DCEAF6', '#D4E4F1', 'b')}
      {/* Techo inclinado (cara propia, más clara) */}
      <polygon points="116,262 146,238 326,214 296,262" fill="#FBFDFF"/>
      <polygon points="296,262 326,214 326,232 296,282" fill="#E4EEF7"/>
      {/* Ventana grande */}
      <rect x="134" y="292" width="52" height="60" fill="url(#czGlass)" stroke="#B7CFE4" strokeWidth="1.5"/>
      <line x1="160" y1="292" x2="160" y2="352" stroke="#B7CFE4" strokeWidth="1.5"/>
      {/* Charco de luz cálida en el piso */}
      <ellipse cx="206" cy="546" rx="90" ry="26" fill="url(#czDoorPool)"/>
      {/* Entrada: marco + hueco iluminado (recesado) */}
      <polygon points="170,352 236,352 236,542 170,542" fill="#1B7C90"/>
      <polygon points="236,352 246,344 246,534 236,542" fill="#155F70"/>
      <rect x="180" y="360" width="46" height="182" fill="url(#czDoor)"/>
      <polygon points="180,360 226,360 220,372 186,372" fill="#FFF0C4"/>
      {/* Escalón facetado */}
      <polygon points="150,540 316,540 300,556 134,556" fill="#DCE7F1"/>
      <polygon points="134,556 300,556 300,562 134,562" fill="#C7D6E5"/>

      {/* Jardinera con flores (volumen) */}
      {IsoBox(250, 508, 120, 28, 14, '#8FBE9C', '#5E9E7A', '#4F8F6B', 'j')}
      {[262, 284, 306, 328, 350, 362].map((fx, i) => (
        <g key={`fl${i}`}>
          <polygon points={`${fx},${503 - (i % 2) * 4} ${fx + 5},${509 - (i % 2) * 4} ${fx},${515 - (i % 2) * 4} ${fx - 5},${509 - (i % 2) * 4}`}
            fill={['#F4C453', '#EC6A82', '#F4C453', '#84BEE6', '#EC6A82', '#F4C453'][i]}/>
        </g>
      ))}

      {/* Mudanza en la vereda — cajas + muebles. Todo se va al arrancar el camión. */}
      <g style={{
        opacity: packed ? 0 : 1,
        transform: packed ? 'translateY(12px) scale(0.95)' : 'none',
        transformOrigin: '190px 560px',
        transition: 'opacity .7s ease, transform .7s ease',
      }}>
        {shadow(210, 566, 190)}
        {/* muebles detrás */}
        {Dresser(292, 566)}
        {Lamp(66, 566)}
        {/* cajas */}
        {BOXES.map(([x, y, w, h], i) => (
          <g key={`bx${i}`}>
            {IsoBox(x, y, w, h, 15, '#F0DCBB', '#CBA678', '#DFC099', i)}
            <rect x={x + w / 2 - 3} y={y} width="6" height={h} fill="#F7ECD5" opacity=".9"/>
            <polygon points={`${x + w / 2 - 3},${y} ${x + w / 2 - 3 + 15},${y - 7.8} ${x + w / 2 + 3 + 15},${y - 7.8} ${x + w / 2 + 3},${y}`} fill="#F7ECD5" opacity=".9"/>
          </g>
        ))}
        {/* muebles delante */}
        {Sofa(96, 584)}
        {Chair(250, 584)}
        {Plant(228, 560)}
      </g>

      {/* Rocas facetadas (3 caras) */}
      {ROCKS.map(([x, y, s], i) => (
        <g key={`rk${i}`}>
          <polygon points={`${x - 20 * s},${y} ${x - 6 * s},${y - 15 * s} ${x + 8 * s},${y - 11 * s} ${x + 20 * s},${y}`} fill="#C7D3E2"/>
          <polygon points={`${x - 6 * s},${y - 15 * s} ${x + 8 * s},${y - 11 * s} ${x + 2 * s},${y - 2 * s}`} fill="#E1E9F2"/>
          <polygon points={`${x + 8 * s},${y - 11 * s} ${x + 20 * s},${y} ${x + 2 * s},${y - 2 * s}`} fill="#AFBFD3"/>
        </g>
      ))}

      {/* Coníferas facetadas (cada tier: mitad luz / mitad sombra + tope) */}
      {CONIFERS.map(([cx, by, s], i) => (
        <g key={`cf${i}`}>
          {shadow(cx + 14 * s, by + 2, 40 * s)}
          <polygon points={`${cx - 4 * s},${by - 12 * s} ${cx + 4 * s},${by - 12 * s} ${cx + 4 * s},${by + 6 * s} ${cx - 4 * s},${by + 6 * s}`} fill="#B98D63"/>
          {[0, 1, 2].map(t => {
            const w = (66 - t * 17) * s, h = 46 * s, ty = by - 20 * s - t * 32 * s, tx = cx;
            return (
              <g key={t}>
                <polygon points={`${tx},${ty - h} ${tx - w / 2},${ty} ${tx},${ty}`} fill="#5CA07E"/>
                <polygon points={`${tx},${ty - h} ${tx},${ty} ${tx + w / 2},${ty}`} fill="#7FC09E"/>
                <polygon points={`${tx},${ty - h} ${tx - w / 6},${ty - h + 12 * s} ${tx + w / 6},${ty - h + 12 * s}`} fill="#A9D8BC"/>
              </g>
            );
          })}
        </g>
      ))}

      {/* Árboles redondos: gema facetada */}
      {BLOBS.map(([cx, by, s], i) => {
        const R = 36 * s, cy = by - R - 6 * s;
        const pts = Array.from({ length: 7 }, (_, k) => {
          const a = -Math.PI / 2 + (k / 7) * Math.PI * 2;
          return [cx + Math.cos(a) * R, cy + Math.sin(a) * R];
        });
        return (
          <g key={`bl${i}`}>
            {shadow(cx + 12 * s, by + 2, 34 * s)}
            <polygon points={`${cx - 4 * s},${by - 14 * s} ${cx + 4 * s},${by - 14 * s} ${cx + 4 * s},${by + 4 * s} ${cx - 4 * s},${by + 4 * s}`} fill="#B98D63"/>
            {pts.map((p, k) => {
              const q = pts[(k + 1) % 7];
              const g = ['#5CA07E', '#7FC09E', '#6BB490', '#A9D8BC', '#7FC09E', '#5CA07E', '#8FCBAA'][k];
              return <polygon key={k} points={`${cx},${cy} ${p[0]},${p[1]} ${q[0]},${q[1]}`} fill={g}/>;
            })}
          </g>
        );
      })}

      {/* Matas de pasto facetadas */}
      {[130, 250, 470, 660, 850, 1050, 1250, 1400].map((x, i) => (
        <g key={`gt${i}`}>
          <polygon points={`${x - 5},560 ${x - 2},546 ${x + 1},560`} fill="#8FC0A0"/>
          <polygon points={`${x},560 ${x + 3},544 ${x + 6},560`} fill="#A9D2B6"/>
        </g>
      ))}

      {/* ── PISTA — recta y horizontal, misma geometría de siempre ── */}
      <rect x="0" y="591" width="1440" height="2" fill="rgba(120,140,165,.25)"/>
      <rect x="0" y="593" width="1440" height="107" fill="#ABB9C9"/>
      <rect x="0" y="596" width="1440" height="4" fill="rgba(255,255,255,.30)"/>
      <rect x="0" y="672" width="1440" height="28" fill="rgba(28,44,74,.06)"/>
      {Array.from({ length: 14 }, (_, i) => (
        <rect key={`d${i}`} x={i * 110} y="644" width="72" height="5" rx="2" fill="rgba(255,255,255,.95)"/>
      ))}

      {/* Destellos */}
      {SPARKS.map(([x, y, s], i) => (
        <path key={`sp${i}`}
          d={`M${x},${y - 7 * s} L${x + 2 * s},${y - 2 * s} L${x + 7 * s},${y} L${x + 2 * s},${y + 2 * s} L${x},${y + 7 * s} L${x - 2 * s},${y + 2 * s} L${x - 7 * s},${y} L${x - 2 * s},${y - 2 * s} Z`}
          fill="#fff" opacity=".8"/>
      ))}
    </svg>
  );
}

// ─── Truck cab art — cropped from the same coordinate space as the old full-truck
// drawing (just the cab + front wheel), reused wherever a cab needs to attach to a
// cargo box. Pure presentational: no positioning, no animation. ──────────────────
function CabArt({ width, height, spin }) {
  return (
    <svg width={width} height={height} viewBox="574 138 256 270" preserveAspectRatio="none" style={{ display: 'block' }}>
      <ellipse cx="722" cy="400" rx="150" ry="12" fill="rgba(10,20,40,.14)"/>
      <path d="M574 148 L730 148 C750 148 764 160 772 178 L814 265 L814 332 L574 332 Z" fill="#0F172A"/>
      <path d="M592 168 L718 168 C732 168 742 176 748 193 L778 258 L592 258 Z" fill="#7EC8E3" opacity=".88"/>
      <line x1="592" y1="168" x2="616" y2="258" stroke="rgba(255,255,255,.2)" strokeWidth="3.5"/>
      <rect x="574" y="260" width="184" height="72" fill="#1A2535"/>
      <line x1="574" y1="260" x2="758" y2="260" stroke="#2A3A50" strokeWidth="2"/>
      <rect x="740" y="290" width="20" height="6" rx="3" fill="#4B5563"/>
      <rect x="770" y="302" width="50" height="30" rx="7" fill="#2A3A50"/>
      <rect x="765" y="155" width="13" height="48" rx="5" fill="#374151"/>
      <rect x="804" y="272" width="22" height="15" rx="4" fill="#FCD34D"/>
      <g className={spin ? 'czWheelSpin' : ''} style={{ transformBox: 'fill-box', transformOrigin: '50% 50%' }}>
        <circle cx="722" cy="336" r="54" fill="#1E293B"/>
        <circle cx="722" cy="336" r="26" fill="#94A3B8"/>
        <circle cx="722" cy="336" r="10" fill="#CBD5E1"/>
        {/* Spoke so the rotation actually reads as spinning, not just a static disc —
            kept within the rim (r=26) so it doesn't poke out over the tire. */}
        <rect x="718" y="310" width="8" height="52" fill="#64748B" opacity=".8"/>
      </g>
    </svg>
  );
}

// ─── Rear wheel — the card (cargo box) needs one too, or only the cab looks like it's
// rolling. Sits behind the card (lower z-index) so its top half is hidden by the card's
// own white background and only the bottom half pokes out past its edge, like a wheel
// tucked under a truck box. While the card is still cropped short (doorOpen false), it
// has to anchor to that CROPPED visible edge, not the card's true (taller, invisible)
// full-height box — .cz-inner's clip-path only changes what's painted, not its layout
// size, so anchoring to "bottom:0" here would leave the wheel dangling in the empty
// space below the visible edge instead of tucked right into it. Tracks the same
// crop→full transition as the card, so it "rides" the edge down as it unfolds. ────────
function RearWheel({ doorOpen, spinning, diameter, centerFromBottom }) {
  const peek = diameter * 0.34;
  return (
    <div style={{
      position: 'absolute', zIndex: 1, left: 64,
      // Level with the front wheel while visible (its own center at the same height
      // above the ground); tucked back to barely poking out once parked + hidden.
      bottom: doorOpen ? -peek : centerFromBottom - diameter / 2,
      opacity: doorOpen ? 0 : 1,
      transition: 'bottom 900ms cubic-bezier(.65,0,.35,1), opacity 500ms ease',
    }}>
      <svg width={diameter} height={diameter} viewBox="0 0 64 64" style={{ display: 'block' }}>
        <g className={spinning ? 'czWheelSpin' : ''} style={{ transformBox: 'fill-box', transformOrigin: '50% 50%' }}>
          <circle cx="32" cy="32" r="30" fill="#1E293B"/>
          <circle cx="32" cy="32" r="15" fill="#94A3B8"/>
          <circle cx="32" cy="32" r="6" fill="#CBD5E1"/>
          <rect x="28" y="12" width="8" height="26" fill="#64748B" opacity=".8"/>
        </g>
      </svg>
    </div>
  );
}

// ─── The one truck. Rendered as a flex sibling right after the quote card (see the
// `.czRig` wrapper in the main component) so it's always physically glued to the
// card's edge and scales with it — no separate positioning math to fall out of sync.
// Same cab for the whole lifecycle: rolls in from the left on page load, holds that
// exact spot while the form is filled, then rolls back out to the left once the quote
// is submitted. Wheels only spin while it's actually moving (entering/departing). ────
function Cab({ phase, widthDesign, heightDesign }) {
  return (
    // Absolutely positioned off .czRig's right edge, not a flex sibling — so it doesn't
    // count toward the card's own box when the card gets centered. It's fine for the
    // cab to spill past the viewport edge on a narrow window; the card is what has to
    // stay centered.
    <div style={{ position: 'absolute', left: '100%', bottom: 0 }}>
      <CabArt width={widthDesign} height={heightDesign} spin={phase === 'entering' || phase === 'departing'}/>
    </div>
  );
}

// Inline transform/opacity per rig phase — see the .czRig comment in CZ_CSS for why
// this lives in JS/inline style rather than as CSS animation classes.
const RIG_ENTER_MS = 3000;
const RIG_POSE = {
  pending:   { transform: 'translateX(-140vw) translateY(46px)', opacity: 0 },
  entering:  { transform: 'translateX(0) translateY(0)',         opacity: 1 },
  attached:  { transform: 'translateX(0) translateY(0)',         opacity: 1 },
  departing: { transform: 'translateX(160vw) translateY(0)',     opacity: 0 },
};
const RIG_TRANSITION = {
  pending:   'none',
  entering:  `transform ${RIG_ENTER_MS}ms cubic-bezier(.16,.84,.44,1), opacity 900ms ease`,
  attached:  `transform ${RIG_ENTER_MS}ms cubic-bezier(.16,.84,.44,1), opacity 900ms ease`,
  departing: 'transform 1.6s cubic-bezier(.45,0,1,.55), opacity 1.6s cubic-bezier(.45,0,1,.55) .3s',
};

// ─── Ripple click feedback ────────────────────────────────────
function addRipple(e) {
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 2.4;
  const s = document.createElement('span');
  Object.assign(s.style, {
    position: 'absolute', borderRadius: '50%', pointerEvents: 'none',
    width: size + 'px', height: size + 'px',
    left: (e.clientX - rect.left - size / 2) + 'px',
    top:  (e.clientY - rect.top  - size / 2) + 'px',
    background: 'rgba(255,255,255,.32)',
    transform: 'scale(0)',
    animation: 'czRipple .55s cubic-bezier(.4,0,.2,1) forwards',
  });
  s.addEventListener('animationend', () => s.remove());
  el.appendChild(s);
}

// ─── Floating WhatsApp button (descartable) ───────────────────
function FloatingWA() {
  const [hidden, setHidden] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const url = `https://wa.me/56952023504?text=${encodeURIComponent('Hola MUVE! 👋 Quiero consultar sobre un traslado.')}`;
  if (hidden) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 96, left: 12, zIndex: 200,
      display: 'flex', alignItems: 'center', gap: 0,
      filter: 'drop-shadow(0 4px 12px rgba(37,211,102,.40))',
    }}>
      {!collapsed ? (
        <div style={{ display: 'flex', alignItems: 'center', borderRadius: 99, overflow: 'hidden', background: WA }}>
          <a href={url} target="_blank" rel="noreferrer" style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '10px 14px 10px 12px', textDecoration: 'none',
          }}>
            <svg width={20} height={20} viewBox="0 0 24 24" fill="white">
              <path d="M20.5 3.5A11 11 0 003.4 17.4L2 22l4.7-1.4A11 11 0 1020.5 3.5z"/>
            </svg>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap' }}>¿Dudas?</span>
          </a>
          <button onClick={() => setCollapsed(true)} style={{
            background: 'rgba(0,0,0,.18)', border: 'none', cursor: 'pointer',
            padding: '10px 10px', color: '#fff', fontSize: 13, lineHeight: 1,
          }}>‹</button>
          <button onClick={() => setHidden(true)} style={{
            background: 'rgba(0,0,0,.18)', border: 'none', cursor: 'pointer',
            padding: '10px 10px', color: '#fff', fontSize: 13, lineHeight: 1,
          }}>✕</button>
        </div>
      ) : (
        <button onClick={() => setCollapsed(false)} style={{
          width: 42, height: 42, borderRadius: '50%', border: 'none',
          background: WA, cursor: 'pointer', display: 'grid', placeItems: 'center',
        }}>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="white">
            <path d="M20.5 3.5A11 11 0 003.4 17.4L2 22l4.7-1.4A11 11 0 1020.5 3.5z"/>
          </svg>
        </button>
      )}
    </div>
  );
}

// ─── SCREEN 0 — WELCOME ──────────────────────────────────────

const CASES = [
  {
    type:'Mini flete — 1 cama', icon:'🛏️', photo:'/testimonials/mini-flete.jpg',
    items:['🛏️ Cama 1 plaza','🛌 Colchón','📦 2 cajas'],
    km:5, price:32000,
    name:'Valentina S.',
    comment:'En menos de una hora tenía la cama instalada en mi nuevo depto. ¡Súper rápido y cuidadoso!',
  },
  {
    type:'Flete camión 3/4', icon:'🚚', photo:'/testimonials/flete-camion.jpg',
    items:['🛏️ Cama 2 plazas','🪞 Clóset','🧊 Refrigerador'],
    km:8, price:58000,
    name:'Felipe A.',
    comment:'Llegaron con el equipo correcto para los muebles pesados. Sin rasguños y exactamente a la hora.',
  },
  {
    type:'Mudanza mediana', icon:'🏘️', photo:'/testimonials/mudanza-mediana.jpg',
    items:['🛏️ Cama 2 plazas','🪞 Clóset','🛋️ Sofá 2 plazas','🧊 Refrigerador','🫧 Lavadora','🍽️ Mesa comedor','💻 Escritorio','📦 8 cajas'],
    km:14, price:79990,
    name:'Ana M.',
    comment:'Todo organizado y sin contratiempos. Los muebles llegaron perfectos. ¡Los recomiendo al 100%!',
  },
  {
    type:'Mudanza grande', icon:'🏡', photo:'/testimonials/mudanza-grande.jpg',
    items:['🛏️ Cama Queen','🛏️ Cama 1 plaza','🪞 Clóset doble','🛋️ Sofá 3 plazas','🧊 Refrigerador','🫧 Lavadora','🌀 Secadora','🍳 Cocina','🍽️ Mesa comedor','🪑 6 sillas','🗄️ Cómoda','💻 Escritorio','📚 Librero','📺 TV 65"','🎨 Cuadros','📦 15 cajas','🌿 Plantas'],
    km:25, price:169990,
    name:'Jorge & Claudia R.',
    comment:'Mudanza completa de 3 dormitorios, impecables. Cuidaron cada mueble como si fuera de ellos.',
  },
];

// The card's item chip list is capped so its height never grows with the case's
// full inventory (some demo cases list 3 items, others 17) — that used to make the
// card visibly resize every 4.5s as it cycled. Overflow collapses into one "+N más" chip.
const CARD_ITEMS_VISIBLE = 4;

function ScreenWelcome({ onStart }) {
  const [activeCase, setActiveCase] = useState(0);
  const [fading, setFading] = useState(false);
  useEffect(() => {
    const t = setInterval(() => {
      setFading(true);
      setTimeout(() => { setActiveCase(i => (i + 1) % CASES.length); setFading(false); }, 320);
    }, 4500);
    return () => clearInterval(t);
  }, []);
  const c = CASES[activeCase];
  return (
    <div style={{ height: '100dvh', background: 'linear-gradient(175deg,#E8F3FF 0%,#F7FAFF 50%,#FFFFFF 100%)', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <style>{`
        @keyframes czRipple { to { transform: scale(1); opacity: 0; } }
        @keyframes czBtnShimmer {
          0%   { background-position: -220% center; }
          100% { background-position: 220% center; }
        }
        @keyframes czStepPop {
          0%,100% { transform: scale(1);    box-shadow: 0 3px 10px rgba(27,108,245,.3); }
          50%      { transform: scale(1.10); box-shadow: 0 5px 22px rgba(27,108,245,.65), 0 0 0 6px rgba(27,108,245,.10); }
        }
        .czStep1 { animation: czStepPop 2.4s ease-in-out 0.1s  infinite; }
        .czStep2 { animation: czStepPop 2.4s ease-in-out 0.75s infinite; }
        .czStep3 { animation: czStepPop 2.4s ease-in-out 1.4s  infinite; }
        .czCta {
          background: linear-gradient(90deg,#0A46C0,#1B6CF5 28%,#3FBEED 52%,#1B6CF5 72%,#0A46C0);
          background-size: 260% auto;
          animation: czBtnShimmer 3s linear infinite, czCtaNudge 5s ease-in-out 2s infinite;
        }
        .czCta:active { transform: scale(0.97) !important; transition: transform .1s ease !important; }
        @keyframes czCtaNudge {
          0%, 86%, 100% { transform: scale(1) rotate(0deg); }
          88%  { transform: scale(1.04) rotate(-1.2deg); }
          90%  { transform: scale(1.04) rotate(1.2deg); }
          92%  { transform: scale(1.05) rotate(-0.8deg); }
          94%  { transform: scale(1.02) rotate(0.5deg); }
          96%  { transform: scale(1) rotate(0deg); }
        }
        @keyframes czCtaRing {
          0%   { transform: scale(0.94); opacity: .55; }
          70%  { transform: scale(1.18); opacity: 0; }
          100% { transform: scale(1.18); opacity: 0; }
        }
        .czCtaWrap { position: relative; width: 100%; max-width: 380px; }
        .czCtaWrap::before, .czCtaWrap::after {
          content: ''; position: absolute; inset: 0; border-radius: 18px;
          border: 2.5px solid #1B6CF5; pointer-events: none;
          animation: czCtaRing 2.6s ease-out infinite;
        }
        .czCtaWrap::after { animation-delay: 1.3s; }
        @keyframes czArrowGo {
          0%, 100% { transform: translateX(0); }
          50%      { transform: translateX(6px); }
        }
        .czCtaArrow { display: flex; animation: czArrowGo 1.1s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .czCta { animation: none; }
          .czCtaWrap::before, .czCtaWrap::after { animation: none; opacity: 0; }
          .czCtaArrow { animation: none; }
        }
        @media (min-width: 640px) {
          .czContent { flex: 1 !important; padding: 0 40px !important; flex-direction: row !important; align-items: center; gap: 36px; }
          .czHeroInner { align-items: flex-start !important; text-align: left !important; }
          .czHeroTitle { font-size: 54px !important; letter-spacing: -2.4px !important; line-height: 1.05 !important; }
          .czHeroSub { font-size: 17px !important; max-width: 100% !important; }
          .czActionBlock { max-width: 400px !important; }
          .czCtaBtn { font-size: 22px !important; padding: 22px 26px !important; }
          .czStepCircle { width: 48px !important; height: 48px !important; }
          .czStepLabel { font-size: 12px !important; }
          .czTrustChips { justify-content: flex-start !important; }
          .czChipIcon { width: 32px !important; height: 32px !important; }
          .czChipTitle { font-size: 12px !important; }
          .czChipSub { font-size: 10.5px !important; }
          .czSideCards { display: flex !important; flex-direction: column; width: 340px; flex-shrink: 0; }
          .czCardPhoto { height: 148px !important; }
          .czCardHeader { padding: 18px 22px !important; gap: 12px !important; }
          .czCardIcon { width: 48px !important; height: 48px !important; font-size: 24px !important; }
          .czCardType { font-size: 16px !important; }
          .czCardKm { font-size: 12px !important; }
          .czItemsSection { padding: 16px 20px !important; }
          .czItemsLabel { font-size: 10.5px !important; }
          .czItemsWrap { height: 102px !important; gap: 7px !important; }
          .czItemChip { font-size: 13px !important; padding: 5px 11px !important; }
          .czPriceSection { padding: 16px 20px 14px !important; }
          .czPriceLabel { font-size: 10.5px !important; }
          .czPriceVal { font-size: 32px !important; }
          .czTestimonialSection { padding: 16px 20px !important; }
          .czTestimonialInner { padding: 14px 16px !important; }
          .czTestimonialText { font-size: 13px !important; }
          .czAvatar { width: 26px !important; height: 26px !important; font-size: 12px !important; }
          .czReviewerName { font-size: 13px !important; }
          /* Only .czContent should absorb the extra vertical space on tall/large cards —
             otherwise both it and this footer split the leftover 50/50, leaving a big dead
             gap in the middle on tall screens instead of centering the hero content. */
          .czFooterMove { flex: 0 0 auto !important; padding-top: 24px !important; }
        }
      `}</style>

      {/* Background glow blobs */}
      <div style={{ position:'absolute', top:-80, right:-60, width:300, height:300, borderRadius:'50%', background:`radial-gradient(circle,${C}1E,transparent 65%)`, pointerEvents:'none' }}/>
      <div style={{ position:'absolute', bottom:0, left:-80, width:260, height:260, borderRadius:'50%', background:`radial-gradient(circle,${B}10,transparent 68%)`, pointerEvents:'none' }}/>

      {/* Logo bar */}
      <div style={{ padding:'16px 22px 0', flexShrink:0, position:'relative', zIndex:2, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <img src="/logo_reducido.png" alt="MUVE" style={{ height:52, objectFit:'contain' }}/>
        <a href={WA_URL} target="_blank" rel="noreferrer" style={{
          width:36, height:36, borderRadius:10,
          background:'rgba(37,211,102,.12)', border:'1px solid rgba(37,211,102,.28)',
          display:'grid', placeItems:'center', textDecoration:'none',
        }}>
          <WaIcon size={19}/>
        </a>
      </div>

      {/* Content: hero left + service cards right (desktop two-col) */}
      <div className="czContent" style={{ flexShrink:0, position:'relative', zIndex:2, display:'flex', flexDirection:'column', padding:'14px 28px 0' }}>

        {/* Hero inner column */}
        <div className="czHeroInner" style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', flex:1 }}>
          <div style={{ fontSize:10, fontWeight:800, color:B, textTransform:'uppercase', letterSpacing:1.8, marginBottom:10 }}>
            Fletes · Mudanzas · Santiago
          </div>
          <h1 className="czHeroTitle" style={{ margin:'0 0 10px', fontSize:34, lineHeight:1.1, fontWeight:900, letterSpacing:'-1.4px', color:N }}>
            Tu traslado,<br/>
            <span style={{ background:GRAD, WebkitBackgroundClip:'text', backgroundClip:'text', color:'transparent' }}>precio real al instante</span>
          </h1>
          <p className="czHeroSub" style={{ color:T2, fontSize:14, lineHeight:1.55, margin:'0 0 14px', maxWidth:290 }}>
            Ingresa tu ruta, artículos y datos de contacto — te damos el precio exacto sin llamadas.
          </p>

          {/* Step bar + CTA en el mismo contenedor y mismo ancho */}
          <div className="czActionBlock" style={{ width:'100%', maxWidth:340, alignSelf:'center', marginBottom:12 }}>
            <div style={{ display:'flex', alignItems:'center', width:'100%', marginBottom:14 }}>
              {[
                { n:'1', t:'Ruta',      cls:'czStep1', icon:<MapPin size={17} strokeWidth={2.2}/> },
                { n:'2', t:'Artículos', cls:'czStep2', icon:<IcoBox size={16}/> },
                { n:'3', t:'Precio',    cls:'czStep3', icon:<IcoBolt size={16}/> },
              ].map((s,i) => (
                <React.Fragment key={s.n}>
                  {i > 0 && <div style={{ flex:1, height:2, background:`linear-gradient(90deg,${B}55,${C}55)`, borderRadius:99 }}/>}
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                    <div className={`${s.cls} czStepCircle`} style={{ width:40, height:40, borderRadius:'50%', background:GRAD, display:'grid', placeItems:'center', color:'#fff', flexShrink:0, boxShadow:`0 3px 10px ${B}35` }}>{s.icon}</div>
                    <div className="czStepLabel" style={{ fontSize:10, fontWeight:700, color:T2 }}>{s.t}</div>
                  </div>
                  {i < 2 && <div style={{ flex:1, height:2, background:`linear-gradient(90deg,${B}55,${C}55)`, borderRadius:99 }}/>}
                </React.Fragment>
              ))}
            </div>

            <button
              type="button"
              onClick={onStart}
              onMouseDown={addRipple}
              className="czCta czCtaBtn"
              style={{
                width:'100%', padding:'18px 20px', borderRadius:18, border:'none',
                color:'#fff', fontSize:19, fontWeight:900, cursor:'pointer', letterSpacing:'-0.4px',
                boxShadow:`0 14px 36px rgba(27,108,245,.50), 0 4px 12px rgba(27,108,245,.28)`,
                display:'flex', alignItems:'center', justifyContent:'center', gap:12,
                position:'relative', overflow:'hidden',
              }}
            >
              <span>Cotizar mi traslado</span>
              <span className="czCtaArrow"><ArrowRight size={21} color="#fff" strokeWidth={2.7}/></span>
            </button>
          </div>

          {/* Trust chips — mismo ancho que el botón */}
          <div className="czActionBlock" style={{ width:'100%', maxWidth:340, alignSelf:'center' }}>
            <div className="czTrustChips" style={{ display:'flex', gap:0, background:'rgba(255,255,255,.7)', borderRadius:14, border:`1px solid ${BDR}`, overflow:'hidden', backdropFilter:'blur(8px)' }}>
              {[
                { icon:<IcoBolt size={15}/>,    t:'Menos de 1 min',   sub:'Precio al instante',   c:'#F59E0B' },
                { icon:<IcoLock size={15}/>,    t:'Sin compromiso',    sub:'Cancela cuando quieras', c:'#10B981' },
                { icon:<IcoDiamond size={15}/>, t:'Precio real',       sub:'Sin letra chica',       c:B         },
              ].map((b,i) => (
                <div key={b.t} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2, padding:'10px 6px', borderRight: i < 2 ? `1px solid ${BDR}` : 'none' }}>
                  <div className="czChipIcon" style={{ width:28, height:28, borderRadius:8, background:`${b.c}15`, display:'grid', placeItems:'center', color:b.c }}>{b.icon}</div>
                  <span className="czChipTitle" style={{ fontSize:10, fontWeight:800, color:N, textAlign:'center', lineHeight:1.2 }}>{b.t}</span>
                  <span className="czChipSub" style={{ fontSize:9, fontWeight:500, color:T3, textAlign:'center', lineHeight:1.2 }}>{b.sub}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Side panel — desktop right column (hidden on mobile) */}
        <div className="czSideCards" style={{ display:'none', gap:10 }}>

          {/* Rotating testimonial card */}
          <div style={{ borderRadius:18, overflow:'hidden', boxShadow:`0 4px 24px ${B}22`, opacity: fading ? 0 : 1, transition:'opacity .32s ease' }}>
            {/* Photo — fixed height so the card never resizes as it cycles cases */}
            <div className="czCardPhoto" style={{ position:'relative', height:110, background:'#e2e8f0' }}>
              <img src={c.photo} alt={c.type} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
              <div style={{ position:'absolute', top:8, right:10, color:'#FFD700', fontSize:14, letterSpacing:1.5, textShadow:'0 1px 3px rgba(0,0,0,.5)' }}>★★★★★</div>
            </div>

            {/* Header */}
            <div className="czCardHeader" style={{ background:GRAD, padding:'14px 18px', display:'flex', alignItems:'center', gap:10 }}>
              <div className="czCardIcon" style={{ width:40, height:40, borderRadius:10, background:'rgba(255,255,255,.2)', display:'grid', placeItems:'center', fontSize:20, flexShrink:0 }}>{c.icon}</div>
              <div>
                <div className="czCardType" style={{ fontSize:13, fontWeight:800, color:'#fff', letterSpacing:'-0.2px' }}>{c.type}</div>
                <div className="czCardKm" style={{ fontSize:10, color:'rgba(255,255,255,.75)', marginTop:1 }}>{c.km} km recorridos</div>
              </div>
            </div>

            {/* Items — capped at CARD_ITEMS_VISIBLE with a fixed-height wrap, so a case
                with 3 items and one with 17 take up exactly the same space. */}
            <div className="czItemsSection" style={{ background:'#fff', padding:'12px 16px', borderBottom:`1px solid ${BDR}` }}>
              <div className="czItemsLabel" style={{ fontSize:9, fontWeight:700, color:T3, textTransform:'uppercase', letterSpacing:.8, marginBottom:6 }}>Lo que llevamos</div>
              <div className="czItemsWrap" style={{ display:'flex', flexWrap:'wrap', alignContent:'flex-start', gap:5, height:54 }}>
                {c.items.slice(0, CARD_ITEMS_VISIBLE).map(item => (
                  <span key={item} className="czItemChip" style={{ fontSize:11, fontWeight:600, color:T2, background:`${B}08`, border:`1px solid ${B}18`, borderRadius:6, padding:'3px 9px' }}>{item}</span>
                ))}
                {c.items.length > CARD_ITEMS_VISIBLE && (
                  <span className="czItemChip" style={{ fontSize:11, fontWeight:700, color:T3, background:'#f1f5f9', border:`1px solid ${BDR}`, borderRadius:6, padding:'3px 9px' }}>
                    +{c.items.length - CARD_ITEMS_VISIBLE} más
                  </span>
                )}
              </div>
            </div>

            {/* Price + km */}
            <div className="czPriceSection" style={{ background:'#fff', padding:'12px 16px 10px', borderBottom:`1px solid ${BDR}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
                <div>
                  <div className="czPriceLabel" style={{ fontSize:9, color:T3, fontWeight:700, textTransform:'uppercase', letterSpacing:.6 }}>Precio cobrado</div>
                  <div className="czPriceVal" style={{ fontSize:26, fontWeight:900, color:B, letterSpacing:'-1px', lineHeight:1.1 }}>{'$' + String(c.price).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div className="czPriceLabel" style={{ fontSize:9, color:T3, fontWeight:700, textTransform:'uppercase', letterSpacing:.6 }}>Distancia</div>
                  <div className="czPriceVal" style={{ fontSize:26, fontWeight:900, color:N, letterSpacing:'-1px', lineHeight:1.1 }}>{c.km} km</div>
                </div>
              </div>
            </div>

            {/* Testimonial */}
            <div className="czTestimonialSection" style={{ background:'#FAFBFF', padding:'12px 16px' }}>
              <div className="czTestimonialInner" style={{ background:'#fff', borderRadius:10, padding:'10px 13px', border:`1px solid ${BDR}`, boxShadow:'0 1px 6px rgba(0,0,0,.04)' }}>
                <div className="czTestimonialText" style={{ fontSize:11, color:T2, lineHeight:1.6, fontStyle:'italic' }}>"{c.comment}"</div>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:8 }}>
                  <div className="czAvatar" style={{ width:22, height:22, borderRadius:'50%', background:GRAD, display:'grid', placeItems:'center', fontSize:10, color:'#fff', fontWeight:800, flexShrink:0 }}>
                    {c.name[0]}
                  </div>
                  <div className="czReviewerName" style={{ fontSize:11, fontWeight:800, color:N }}>{c.name}</div>
                  <div style={{ marginLeft:'auto', color:'#FFD700', fontSize:11 }}>★★★★★</div>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation dots */}
          <div style={{ display:'flex', justifyContent:'center', gap:6 }}>
            {CASES.map((_, i) => (
              <div key={i} onClick={() => { setActiveCase(i); setFading(false); }}
                style={{ width: i === activeCase ? 22 : 7, height:7, borderRadius:99, background: i === activeCase ? B : BDR, cursor:'pointer', transition:'all .35s' }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── What we move — flat icon grid ───────────────────────── */}
      <div className="czFooterMove" style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', paddingBottom:'max(20px,env(safe-area-inset-bottom,20px))', position:'relative', zIndex:2, padding:'0 22px max(20px,env(safe-area-inset-bottom,20px))' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
          <div style={{ flex:1, height:1, background:BDR }}/>
          <span style={{ fontSize:9, fontWeight:800, color:T3, textTransform:'uppercase', letterSpacing:1.4, whiteSpace:'nowrap' }}>
            Lo que movemos
          </span>
          <div style={{ flex:1, height:1, background:BDR }}/>
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, justifyContent:'center' }}>
          {[
            { icon: <IcoSofa size={15}/>,   label: 'Sillones'    },
            { icon: <IcoBox size={15}/>,    label: 'Cajas'       },
            { icon: <IcoFridge size={15}/>, label: 'Refrigerador'},
            { icon: <IcoBed size={15}/>,    label: 'Camas'       },
            { icon: <IcoTable size={15}/>,  label: 'Comedor'     },
            { icon: <IcoTv size={15}/>,     label: 'Televisores' },
            { icon: <IcoChair size={15}/>,  label: 'Muebles'     },
            { icon: <IcoDesk size={15}/>,   label: 'Oficina'     },
          ].map(({ icon, label }) => (
            <div key={label} style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 11px', borderRadius:9, background:'rgba(255,255,255,.85)', border:`1px solid ${BDR}`, boxShadow:'0 1px 4px rgba(27,108,245,.06)' }}>
              <span style={{ color:T3 }}>{icon}</span>
              <span style={{ fontSize:11, fontWeight:700, color:T2 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── SCREEN 1 — DIRECCIONES ───────────────────────────────────
function ScreenAddresses({ state, setState, onNext, onBack }) {
  const { from, to, distanceKm } = state;
  const [loadingDist, setLoadingDist] = useState(false);
  const [name,  setName]  = useState(state.name  || '');
  const [phone, setPhone] = useState(state.phone || '');
  const [email, setEmail] = useState(state.email || '');

  const phoneOk = phone.replace(/\D/g, '').length >= 8;
  const canContinue = from.address && to.address && name.trim().length >= 2 && phoneOk;

  useEffect(() => {
    if (!from.lat || !to.lat || distanceKm || loadingDist) return;
    setLoadingDist(true);
    api.calculateDistance({ originLat: from.lat, originLng: from.lng, destLat: to.lat, destLng: to.lng })
      .then(({ distanceKm: km, durationMin: min }) => setState(s => ({ ...s, distanceKm: km, durationMin: min })))
      .catch(() => {})
      .finally(() => setLoadingDist(false));
  }, [from.lat, to.lat]);

  const handleNext = () => {
    setState(s => ({ ...s, name, phone, email }));
    api.saveLead({ name, phone, from: from.address, to: to.address }).catch(() => {});
    onNext();
  };

  return (
    <div style={{ height: '100dvh', background: BG, display: 'flex', flexDirection: 'column' }}>
      <Header step={1} total={4} title="¿Desde dónde?" onBack={onBack}/>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '10px 16px 0' }}>

        {/* Mapa compacto */}
        <LeafletRouteMap from={from} to={to} distanceKm={distanceKm}/>

        {/* Direcciones */}
        <div style={{ background: SURF, borderRadius: 16, border: `1px solid ${BDR}`, padding: '4px 14px', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px dashed ${BDR}` }}>
            <div style={{ width: 9, height: 9, borderRadius: 99, background: B, flexShrink: 0 }}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1 }}>Retiro</div>
              <AddressAutocomplete
                value={from.address}
                onChange={v => setState(s => ({ ...s, from: { address: v, lat: null, lng: null }, distanceKm: null, durationMin: null }))}
                onSelect={({ address, lat, lng }) => setState(s => ({ ...s, from: { address, lat, lng } }))}
                placeholder="Dirección de retiro…"
                style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, fontWeight: 600, color: N, width: '100%', padding: 0, fontFamily: 'Inter,system-ui,sans-serif' }}
              />
            </div>
            {from.lat && <Check size={15} color={SUC} strokeWidth={2.5}/>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
            <div style={{ width: 9, height: 9, borderRadius: 99, background: SUC, flexShrink: 0 }}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1 }}>Entrega</div>
              <AddressAutocomplete
                value={to.address}
                onChange={v => setState(s => ({ ...s, to: { address: v, lat: null, lng: null }, distanceKm: null, durationMin: null }))}
                onSelect={({ address, lat, lng }) => setState(s => ({ ...s, to: { address, lat, lng } }))}
                placeholder="Dirección de entrega…"
                style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, fontWeight: 600, color: N, width: '100%', padding: 0, fontFamily: 'Inter,system-ui,sans-serif' }}
              />
            </div>
            {to.lat && <Check size={15} color={SUC} strokeWidth={2.5}/>}
          </div>
        </div>

        {/* Distancia inline */}
        {(distanceKm || loadingDist) && (
          <div style={{ fontSize: 12, color: loadingDist ? T3 : SUC, fontWeight: 700, marginBottom: 8, display:'flex', alignItems:'center', gap:5 }}>
            {loadingDist ? '⏳ Calculando…' : <><Check size={13} color={SUC} strokeWidth={2.5}/>{distanceKm} km calculados</>}
          </div>
        )}

        {/* Datos de contacto */}
        <div style={{ background: SURF, borderRadius: 16, border: `1px solid ${BDR}`, padding: '10px 14px', marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: B, marginBottom: 8, display:'flex', alignItems:'center', gap:5 }}>
            <Phone size={13} color={B} strokeWidth={2}/> Tus datos de contacto
          </div>

          {/* Nombre + Teléfono en dos columnas */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: T3, marginBottom: 4 }}>Nombre <span style={{ color:'#EF4444' }}>*</span></div>
              <div style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 10px', borderRadius:10, border:`1.5px solid ${name.trim().length>=2?B:BDR}`, background:BG, transition:'border-color .15s' }}>
                <Users size={13} color={B} strokeWidth={1.8}/>
                <input type="text" value={name} onChange={e=>setName(e.target.value)} autoComplete="name"
                  placeholder="Juan Pérez"
                  style={{ border:'none', outline:'none', background:'transparent', fontSize:13, color:N, fontFamily:'Inter,system-ui,sans-serif', width:'100%', padding:0 }}/>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: T3, marginBottom: 4 }}>WhatsApp <span style={{ color:'#EF4444' }}>*</span></div>
              <div style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 10px', borderRadius:10, border:`1.5px solid ${phoneOk?B:BDR}`, background:BG, transition:'border-color .15s' }}>
                <Phone size={13} color={B} strokeWidth={1.8}/>
                <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} autoComplete="tel"
                  placeholder="+56 9…"
                  style={{ border:'none', outline:'none', background:'transparent', fontSize:13, color:N, fontFamily:'Inter,system-ui,sans-serif', width:'100%', padding:0 }}/>
              </div>
            </div>
          </div>

          {/* Email opcional */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: T3, marginBottom: 4 }}>Email <span style={{ color:T3, fontWeight:500 }}>(opcional)</span></div>
            <div style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 10px', borderRadius:10, border:`1.5px solid ${BDR}`, background:BG }}>
              <Mail size={13} color={B} strokeWidth={1.8}/>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"
                placeholder="juan@correo.cl"
                style={{ border:'none', outline:'none', background:'transparent', fontSize:13, color:N, fontFamily:'Inter,system-ui,sans-serif', width:'100%', padding:0 }}/>
            </div>
          </div>
        </div>

        <div style={{ fontSize: 11, color: T3, marginBottom: 12 }}>🔒 Datos privados — solo para coordinar tu traslado.</div>
      </div>

      <CtaBar>
        <BtnBack onClick={onBack}/>
        <BtnPrimary onClick={handleNext} disabled={!canContinue}>
          Continuar <ArrowRight size={18} strokeWidth={2.4}/>
        </BtnPrimary>
      </CtaBar>
    </div>
  );
}

// ─── SCREEN 2 — ARTÍCULOS ─────────────────────────────────────
function ScreenItems({ state, setState, onNext, onBack }) {
  const { inventory, freeText } = state;
  const [activeTab, setActiveTab] = useState(GROUPED[0].id);
  const [atBottom, setAtBottom]   = useState(false);
  const [search, setSearch]       = useState('');
  const tabsRef    = useRef(null);
  const contentRef = useRef(null);

  const onWheelTabs = e => {
    if (!tabsRef.current) return;
    e.preventDefault();
    tabsRef.current.scrollLeft += e.deltaY * 1.2;
  };

  const onScroll = () => {
    const el = contentRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 32);
  };

  const getQty = id => inventory[id] || 0;
  const setQty = (id, qty) => setState(s => ({ ...s, inventory: { ...s.inventory, [id]: Math.max(0, qty) } }));
  const removeItem = id => setState(s => {
    const next = { ...s.inventory };
    delete next[id];
    return { ...s, inventory: next };
  });
  const totalItems = Object.values(inventory).reduce((s, q) => s + q, 0);
  const clearAll = () => setState(s => ({ ...s, inventory: {}, freeText: '' }));

  const countCat = catId => {
    const g = GROUPED.find(g => g.id === catId);
    return g ? g.items.reduce((s, it) => s + getQty(it.id), 0) : 0;
  };

  const selectedItems = CATALOG.filter(c => (inventory[c.id] || 0) > 0).sort((a, b) => b.vol - a.vol);
  const searchResults = search.trim()
    ? CATALOG.filter(c => c.name.toLowerCase().includes(search.trim().toLowerCase()))
    : null;

  return (
    <div style={{ height: '100dvh', background: BG, display: 'flex', flexDirection: 'column' }}>
      <Header step={2} total={4} title="¿Qué llevas?" onBack={onBack}/>

      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
      <div ref={contentRef} onScroll={onScroll} style={{ overflowY: 'auto', height: '100%', padding: '14px 16px 0' }}>

        {/* Search bar */}
        <div style={{ position:'relative', marginBottom:10 }}>
          <div style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
            <Search size={15} color={search ? B : T3} strokeWidth={2}/>
          </div>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar artículo — ej: sofá, nevera, cama…"
            style={{ width:'100%', boxSizing:'border-box', paddingLeft:36, paddingRight: search ? 36 : 12, paddingTop:11, paddingBottom:11, borderRadius:12, border:`1.5px solid ${search ? B : BDR}`, background:SURF, fontSize:14, color:N, fontFamily:'Inter,system-ui,sans-serif', outline:'none' }}
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', padding:4, display:'grid', placeItems:'center' }}>
              <X size={14} color={T3} strokeWidth={2.5}/>
            </button>
          )}
        </div>

        {/* Counter + clear */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T2 }}>
            {totalItems > 0 ? `${totalItems} artículo${totalItems !== 1 ? 's' : ''} seleccionado${totalItems !== 1 ? 's' : ''}` : 'Selecciona tus artículos'}
          </div>
          {(totalItems > 0 || freeText) && (
            <button type="button" onClick={clearAll} style={{ background: 'none', border: 'none', color: B, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Limpiar</button>
          )}
        </div>

        {searchResults ? (
          /* ── Resultados de búsqueda ── */
          <div style={{ marginBottom: 14 }}>
            {searchResults.length === 0 ? (
              <div style={{ textAlign:'center', padding:'28px 0', color:T3, fontSize:13 }}>
                No encontramos "{search}" — escríbelo abajo y lo incluimos igual.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(148px,1fr))', gap: 8 }}>
                {searchResults.map(item => {
                  const qty = getQty(item.id);
                  return (
                    <div key={item.id} style={{ background:SURF, borderRadius:14, padding:'12px 10px', border:`1.5px solid ${qty>0?B:BDR}`, display:'flex', flexDirection:'column', alignItems:'center', gap:6, boxShadow:qty>0?`0 0 0 3px ${B}16`:'none' }}>
                      <span style={{ fontSize:28 }}>{item.icon}</span>
                      <div style={{ fontSize:12, fontWeight:700, color:N, textAlign:'center', lineHeight:1.3 }}>{item.name}</div>
                      <Stepper value={qty} onChange={n => setQty(item.id, n)}/>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* ── Vista por categorías ── */
          <>
            <div ref={tabsRef} onWheel={onWheelTabs} style={{ display:'flex', gap:6, overflowX:'auto', margin:'0 -16px', padding:'0 16px 8px', scrollbarWidth:'none' }}>
              {GROUPED.map(g => {
                const cnt = countCat(g.id);
                const active = activeTab === g.id;
                return (
                  <button key={g.id} type="button" onClick={() => setActiveTab(g.id)} style={{ flex:'0 0 auto', padding:'7px 13px', borderRadius:99, cursor:'pointer', background:active?N:SURF, color:active?'#fff':T2, fontSize:13, fontWeight:700, display:'flex', alignItems:'center', gap:5, border:`1.5px solid ${active?N:BDR}`, fontFamily:'Inter,system-ui,sans-serif' }}>
                    <span>{g.emoji}</span>{g.label}
                    {cnt > 0 && <span style={{ background:B, color:'#fff', fontSize:11, fontWeight:800, padding:'1px 7px', borderRadius:99 }}>{cnt}</span>}
                  </button>
                );
              })}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(148px,1fr))', gap:8, marginBottom:14, marginTop:8 }}>
              {GROUPED.find(g => g.id === activeTab)?.items.map(item => {
                const qty = getQty(item.id);
                return (
                  <div key={item.id} style={{ background:SURF, borderRadius:14, padding:'12px 10px', border:`1.5px solid ${qty>0?B:BDR}`, display:'flex', flexDirection:'column', alignItems:'center', gap:6, boxShadow:qty>0?`0 0 0 3px ${B}16`:'none' }}>
                    <span style={{ fontSize:28 }}>{item.icon}</span>
                    <div style={{ fontSize:12, fontWeight:700, color:N, textAlign:'center', lineHeight:1.3 }}>{item.name}</div>
                    <Stepper value={qty} onChange={n => setQty(item.id, n)}/>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Selección activa */}
        {selectedItems.length > 0 && (
          <div style={{ background:SURF, borderRadius:14, border:`1.5px solid ${B}22`, padding:'10px 14px', marginBottom:10 }}>
            <div style={{ fontSize:11, fontWeight:700, color:T3, textTransform:'uppercase', letterSpacing:0.7, marginBottom:6 }}>Lo que llevas</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
              {selectedItems.map(item => (
                <span key={item.id} style={{ fontSize:12, fontWeight:600, padding:'4px 8px 4px 10px', borderRadius:99, background:'#EFF5FF', border:`1.5px solid ${B}28`, color:N, display:'inline-flex', alignItems:'center', gap:4 }}>
                  <span>{item.icon}</span>
                  {inventory[item.id]>1 && <strong style={{ color:B }}>{inventory[item.id]}×</strong>}
                  <span>{item.name}</span>
                  <button type="button" onClick={() => removeItem(item.id)} style={{ background:`${B}18`, border:'none', borderRadius:'50%', cursor:'pointer', width:18, height:18, display:'grid', placeItems:'center', flexShrink:0, padding:0, marginLeft:2 }}>
                    <X size={10} color={B} strokeWidth={2.5}/>
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Campo libre — siempre visible y destacado */}
        <div style={{ marginBottom:14, background:`${B}06`, borderRadius:14, border:`1.5px solid ${freeText.trim()?B:`${B}30`}`, padding:'12px 14px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
            <Sparkles size={14} color={B} strokeWidth={2}/>
            <span style={{ fontSize:12, fontWeight:800, color:B }}>¿Llevas algo que no está arriba?</span>
          </div>
          <textarea
            value={freeText}
            onChange={e => setState(s => ({ ...s, freeText: e.target.value }))}
            placeholder="Escríbelo aquí — bicicleta, piano, plantas, moto, herramientas… lo incluimos en el precio."
            rows={2}
            style={{ width:'100%', boxSizing:'border-box', resize:'none', border:'none', background:'transparent', padding:0, fontSize:13, color:N, fontFamily:'Inter,system-ui,sans-serif', outline:'none', lineHeight:1.5 }}
          />
        </div>
      </div>

      {/* Scroll hint — gradient + bounce arrow, desaparece al llegar al fondo */}
      {!atBottom && (
        <div style={{ position:'absolute', bottom:0, left:0, right:0, height:52, background:`linear-gradient(to bottom, transparent, ${BG} 72%)`, display:'flex', alignItems:'flex-end', justifyContent:'center', paddingBottom:6, pointerEvents:'none' }}>
          <div style={{ fontSize:18, color:T3, animation:'czScrollBounce 1.4s ease-in-out infinite' }}>⌄</div>
        </div>
      )}
      </div>{/* end wrapper */}

      <CtaBar>
        <BtnBack onClick={onBack}/>
        <BtnPrimary onClick={onNext} disabled={totalItems === 0 && !freeText.trim()}>
          Continuar
          {totalItems > 0 && <span style={{ background: 'rgba(255,255,255,.22)', padding: '2px 9px', borderRadius: 99, fontSize: 12, fontWeight: 900 }}>{totalItems}</span>}
          <ArrowRight size={18} strokeWidth={2.4}/>
        </BtnPrimary>
      </CtaBar>
    </div>
  );
}

// ─── SCREEN 3 — ADICIONALES ───────────────────────────────────
function ScreenExtras({ state, setState, onNext, onBack }) {
  const { extras, inventory, freeText } = state;
  const set = (k, v) => setState(s => ({ ...s, extras: { ...s.extras, [k]: v } }));
  const selectedItems = CATALOG.filter(c => (inventory[c.id] || 0) > 0).sort((a, b) => b.vol - a.vol);

  return (
    <div style={{ height: '100dvh', background: BG, display: 'flex', flexDirection: 'column' }}>
      <Header step={3} total={4} title="Detalles del traslado" onBack={onBack}/>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '14px 16px 0' }}>
        <p style={{ fontSize: 13, color: T2, lineHeight: 1.5, margin: '0 0 14px' }}>
          Cuéntanos un par de detalles para ajustar el precio. Todo es opcional.
        </p>

        {/* Pisos */}
        <div style={{ background: SURF, borderRadius: 16, border: `1px solid ${BDR}`, padding: '16px', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#EFF5FF,#E0EBFF)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Building2 size={22} color={B} strokeWidth={1.8}/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: N }}>Pisos sin ascensor</div>
              <div style={{ fontSize: 12, color: T2, marginTop: 2 }}>Suma pisos de retiro + entrega · +{fmt(5000)}/piso</div>
            </div>
            <Stepper value={extras.floors} onChange={n => set('floors', n)}/>
          </div>
          {extras.floors > 0 && (
            <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: B }}>
              Suma adicional: {fmt(extras.floors * 5000)}
            </div>
          )}
        </div>

        {/* Embalaje */}
        <div style={{ background: SURF, borderRadius: 16, border: `1px solid ${BDR}`, padding: '16px', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#EFF5FF,#E0EBFF)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Shield size={22} color={B} strokeWidth={1.8}/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: N }}>Embalaje profesional</div>
              <div style={{ fontSize: 12, color: T2, marginTop: 2 }}>Empacamos todo antes de cargar · +{fmt(12000)}–{fmt(20000)}</div>
            </div>
            <button type="button" onClick={() => set('packing', !extras.packing)} style={{
              width: 48, height: 28, borderRadius: 999, border: 'none', cursor: 'pointer',
              background: extras.packing ? B : BDR, position: 'relative', transition: 'background .2s', flexShrink: 0,
            }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: extras.packing ? 23 : 3, transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }}/>
            </button>
          </div>
        </div>

        {/* Reassurance */}
        <div style={{ padding: '14px', borderRadius: 14, background: 'rgba(24,169,87,.07)', border: '1px solid rgba(24,169,87,.18)', display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
          <Shield size={20} color={SUC} strokeWidth={1.8}/>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: N }}>Mudanzas con cobertura</div>
            <div style={{ fontSize: 12, color: T2, lineHeight: 1.45, marginTop: 2 }}>Tus pertenencias están protegidas durante todo el traslado, sin costo extra.</div>
          </div>
        </div>

        {/* Items summary */}
        {(selectedItems.length > 0 || freeText) && (
          <div style={{ background: SURF, borderRadius: 16, border: `1px solid ${BDR}`, padding: '14px 16px', marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10 }}>Lo que llevas</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {selectedItems.map(it => (
                <span key={it.id} style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 99, background: BG, border: `1px solid ${BDR}`, color: N, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>{it.icon}</span>
                  {(inventory[it.id] || 0) > 1 && <strong>{inventory[it.id]}×</strong>}
                  {it.name}
                </span>
              ))}
              {freeText && (
                <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 99, background: BG, border: `1px solid ${BDR}`, color: T2 }}>+ {freeText}</span>
              )}
            </div>
          </div>
        )}
      </div>

      <CtaBar>
        <BtnBack onClick={onBack}/>
        <BtnPrimary onClick={onNext}>
          Calcular precio <Sparkles size={16} strokeWidth={2}/>
        </BtnPrimary>
      </CtaBar>
    </div>
  );
}

// ─── SCREEN 4 — RESULTADO ─────────────────────────────────────
function ScreenResult({ state, onRestart, onBack, onNext }) {
  const { result } = state;
  const [helpers, setHelpers] = useState(state.selectedHelpers ?? 0);

  const items = Object.keys(state.inventory)
    .filter(id => state.inventory[id] > 0)
    .map(id => { const c = CATALOG.find(x => x.id === id); return c ? { ...c, qty: state.inventory[id] } : null; })
    .filter(Boolean).sort((a, b) => b.vol - a.vol);

  const helpersRate = result.detectedType === 'mudanza' ? 20000 : 10000;
  const floorsTotal = state.extras.floors * 5000;
  const packingCost = state.extras.packing ? (result.vehicle === 'furgon' ? 12000 : 20000) : 0;

  const helpersTotal = helpers * helpersRate;
  const adjustedPrice = Math.max(15000, Math.round(
    (result.price + helpersTotal + floorsTotal + packingCost + (result.tollEstimate || 0)) / 1000
  ) * 1000);

  const distLabel = state.distanceKm
    ? `Traslado · ${state.distanceKm} km recorridos`
    : 'Tarifa base del servicio';

  const breakdown = [
    { label: distLabel, value: fmt(result.price) },
    helpers > 0 && { label: `${helpers} ayudante${helpers > 1 ? 's' : ''}`, value: `+ ${fmt(helpersTotal)}` },
    state.extras.floors > 0 && { label: `${state.extras.floors} piso${state.extras.floors > 1 ? 's' : ''} sin ascensor`, value: `+ ${fmt(floorsTotal)}` },
    state.extras.packing && { label: 'Embalaje profesional', value: `+ ${fmt(packingCost)}` },
    result.tollEstimate > 0 && { label: 'Peaje autopista estimado', value: `+ ${fmt(result.tollEstimate)}` },
  ].filter(Boolean);

  return (
    <div style={{ height: '100dvh', background: BG, display: 'flex', flexDirection: 'column' }}>
      <Header step={4} total={4} title="Tu cotización" onBack={onBack}/>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '14px 16px 0' }}>
        {/* Vehicle hero */}
        <div style={{ background: GRAD_DEEP, borderRadius: 20, padding: '20px', marginBottom: 14, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -40, right: -30, width: 180, height: 180, borderRadius: '50%', background: 'rgba(63,190,237,.15)', pointerEvents: 'none' }}/>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, position: 'relative' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.6)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Vehículo recomendado</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: '-0.6px', marginBottom: 8 }}>{result.vehicleName}</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: 'rgba(255,255,255,.18)', color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 }}>{result.detectedType}</span>
                {state.distanceKm && <span style={{ fontSize: 12, color: 'rgba(255,255,255,.7)' }}>· {state.distanceKm} km</span>}
              </div>
            </div>
            <div style={{ width: 72, height: 72, borderRadius: 16, background: 'rgba(255,255,255,.12)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 38 }}>{result.vehicleIcon}</span>
            </div>
          </div>
          <p style={{ margin: '14px 0 0', fontSize: 13, color: 'rgba(255,255,255,.8)', lineHeight: 1.5, position: 'relative' }}>{result.clientExplanation}</p>

        </div>

        {/* Price card */}
        <div style={{ background: SURF, borderRadius: 20, border: `1px solid ${BDR}`, padding: '18px', marginBottom: 14, boxShadow: '0 4px 14px rgba(10,31,61,.06)' }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 4 }}>Precio estimado</div>
            <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: '-1.4px', background: GRAD, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', lineHeight: 1, marginBottom: 12 }}>
              {fmt(adjustedPrice)}
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10, background: '#f0fdf4', border: `1.5px solid rgba(24,169,87,.25)` }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: N }}>
                Rango: <span style={{ color: SUC }}>{fmt(Math.round(adjustedPrice * 0.88 / 1000) * 1000)}</span> – <span style={{ color: SUC }}>{fmt(Math.round(adjustedPrice * 1.15 / 1000) * 1000)}</span>
              </span>
            </div>
          </div>

          {/* Helpers adjuster */}
          <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 12, background: '#EFF5FF', border: `1.5px solid ${B}22` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>👤</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: B }}>Ayudantes</div>
                  <div style={{ fontSize: 11, color: T2, marginTop: 1 }}>
                    {helpers === 0
                      ? <>Solo el chofer{result.recommendedHelpers > 0 && <span style={{ color: '#D97706', marginLeft: 4 }}>· Recomendamos {result.recommendedHelpers} ayudante{result.recommendedHelpers > 1 ? 's' : ''}</span>}</>
                      : <>{helpers} ayudante{helpers > 1 ? 's' : ''} · +{fmt(helpersTotal)}{helpers === (result.recommendedHelpers || 0) && <span style={{ color: SUC, marginLeft: 4 }}>✓ Recomendado</span>}</>
                    }
                  </div>
                </div>
              </div>
              <Stepper value={helpers} onChange={setHelpers} max={4}/>
            </div>
            <div style={{ fontSize: 11, color: T3, marginTop: 8 }}>
              +{fmt(helpersRate)}/ayudante · El chofer siempre va incluido
            </div>
          </div>

          {/* Breakdown */}
          <div style={{ borderTop: `1px dashed ${BDR}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            {breakdown.map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: T2 }}>{r.label}</span>
                <span style={{ fontWeight: 700, color: N }}>{r.value}</span>
              </div>
            ))}
          </div>

          {/* Disclaimer */}
          {state.preliminary ? (
            <div style={{ padding: '10px 14px', borderRadius: 12, background: '#FFF7ED', border: '1px solid rgba(234,88,12,.3)', fontSize: 12, color: '#7C2D12', lineHeight: 1.55 }}>
              <strong>Estimación preliminar.</strong> Un asesor MUVE revisa tu traslado y te confirma el valor final antes de agendar — sin compromiso.
            </div>
          ) : (
            <div style={{ padding: '10px 14px', borderRadius: 12, background: '#FFFBEB', border: '1px solid rgba(234,179,8,.25)', fontSize: 12, color: '#78350F', lineHeight: 1.55 }}>
              Este es un <strong>precio estimado</strong>. Al aceptar la cotización te contactaremos para coordinar fecha, horario y detalles finales.
            </div>
          )}
        </div>

        {/* Summary */}
        <div style={{ background: SURF, borderRadius: 20, border: `1px solid ${BDR}`, padding: '16px', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: 0.5 }}>Resumen</div>
            <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', color: B, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <PenLine size={12} color={B} strokeWidth={2}/> Editar
            </button>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: 99, background: B }}/>
              <div style={{ width: 2, height: 24, background: BDR, margin: '3px 0' }}/>
              <div style={{ width: 8, height: 8, borderRadius: 99, background: SUC }}/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: N }}>{state.from.address || '—'}</div>
              <div style={{ fontSize: 11, color: T3, margin: '3px 0 6px' }}>{state.distanceKm ? `${state.distanceKm} km` : ''}{state.durationMin ? ` · ~${state.durationMin} min` : ''}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: N }}>{state.to.address || '—'}</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 12, borderTop: `1px dashed ${BDR}` }}>
            {items.map(it => (
              <span key={it.id} style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 99, background: BG, border: `1px solid ${BDR}`, color: N, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>{it.icon}</span>{it.qty > 1 && <strong>{it.qty}×</strong>} {it.name}
              </span>
            ))}
            {state.freeText && <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 99, background: BG, border: `1px solid ${BDR}`, color: T2 }}>+ {state.freeText}</span>}
          </div>
        </div>
      </div>

      <CtaBar>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T3, textAlign: 'center' }}>
            ¿Te sirve esta cotización?
          </div>
          <BtnPrimary onClick={() => onNext(helpers)}>
            Aceptar cotización <ArrowRight size={18} strokeWidth={2.4}/>
          </BtnPrimary>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onBack} style={{ flex: 1, background: SURF, border: `1.5px solid ${BDR}`, color: T2, fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: '10px', borderRadius: 12, fontFamily: 'Inter,system-ui,sans-serif' }}>
              Ajustar detalles
            </button>
            <button type="button" onClick={onRestart} style={{ flex: 1, background: 'none', border: `1.5px solid ${BDR}`, color: T3, fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: '10px', borderRadius: 12, fontFamily: 'Inter,system-ui,sans-serif' }}>
              Descartar
            </button>
          </div>
        </div>
      </CtaBar>
    </div>
  );
}

// ─── SCREEN 5 — CONTACT FORM ─────────────────────────────────
function ScreenContact({ state, onBack, onSubmit, saving }) {
  const [name, setName]   = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const firedStep8 = useRef(false);

  const phoneOk = phone.replace(/\D/g, '').length >= 8;
  const valid = name.trim().length >= 2 && phoneOk;

  useEffect(() => {
    if (phoneOk && !firedStep8.current) {
      firedStep8.current = true;
      _trackEventDB(8);
    }
  }, [phoneOk]);

  const inputStyle = { flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, fontWeight: 600, color: N, fontFamily: 'Inter,system-ui,sans-serif' };

  return (
    <div style={{ height: '100dvh', background: BG, display: 'flex', flexDirection: 'column' }}>
      <Header step={4} total={4} title="Tus datos" onBack={onBack}/>

      <div style={{ flex: 1, display:'flex', flexDirection:'column', justifyContent:'center', padding: '12px 16px' }}>
        <p style={{ fontSize: 13, color: T2, lineHeight: 1.45, margin: '0 0 14px' }}>
          {state.manualReview
            ? 'Completa tus datos y te entregamos el precio exacto para tu traslado.'
            : 'Ingresa tus datos para ver tu precio al instante.'
          }
        </p>

        {/* Name */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T2, marginBottom: 5 }}>Nombre <span style={{ color: '#EF4444' }}>*</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${name.trim().length >= 2 ? B : BDR}`, background: SURF, transition: 'border-color .15s' }}>
            <Users size={15} color={B} strokeWidth={1.8}/>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Juan Pérez" autoComplete="name" style={inputStyle}/>
          </div>
        </div>

        {/* Phone */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T2, marginBottom: 5 }}>Teléfono / WhatsApp <span style={{ color: '#EF4444' }}>*</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${phoneOk ? B : BDR}`, background: SURF, transition: 'border-color .15s' }}>
            <Phone size={15} color={B} strokeWidth={1.8}/>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="+56 9 1234 5678" autoComplete="tel" style={inputStyle}/>
          </div>
        </div>

        {/* Email optional */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T2, marginBottom: 5 }}>Email <span style={{ color: T3, fontWeight: 500 }}>(opcional)</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${BDR}`, background: SURF }}>
            <Mail size={15} color={B} strokeWidth={1.8}/>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="juan@correo.cl" autoComplete="email" style={inputStyle}/>
          </div>
        </div>

        {/* Privacy + WA inline */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
          <span style={{ fontSize:11, color:T3, lineHeight:1.4 }}>🔒 Datos privados. Solo te contactamos para tu traslado.</span>
          <a href="https://wa.me/56952023504" target="_blank" rel="noreferrer"
            style={{ flexShrink:0, display:'flex', alignItems:'center', gap:5, padding:'6px 10px', borderRadius:99, background:'#f0fdf4', border:'1px solid rgba(37,211,102,.3)', textDecoration:'none', fontSize:11, fontWeight:700, color:'#15803D', whiteSpace:'nowrap' }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="#25D366"><path d="M20.5 3.5A11 11 0 003.4 17.4L2 22l4.7-1.4A11 11 0 1020.5 3.5z"/></svg>
            WhatsApp
          </a>
        </div>
      </div>

      <CtaBar>
        <BtnBack onClick={onBack}/>
        <BtnPrimary onClick={() => valid && !saving && onSubmit(name.trim(), phone.trim(), email.trim())} disabled={!valid || saving}>
          {saving
            ? <><span className="czSavingDot">●</span> Calculando…</>
            : state.manualReview
              ? <>Saber el precio exacto <ArrowRight size={16} strokeWidth={2.4}/></>
              : <>Ver mi precio <ArrowRight size={16} strokeWidth={2.4}/></>
          }
        </BtnPrimary>
      </CtaBar>
    </div>
  );
}

// ─── Success — a small centered window, independent of the quote card's size/frame.
// Appears once the truck has fully driven off (see the main component: rendered as
// its own fixed overlay, not inside .cz-inner), so it always shows at the same
// compact size and centered position regardless of how big the card/rig was. ────────
function SuccessNote({ state, onRestart }) {
  const { result, from, to, manualReview, preliminary } = state;
  const waMsg = manualReview
    ? `Hola MUVE! 👋 Solicité una cotización de mudanza grande.\n📍 ${from?.address || ''} → ${to?.address || ''}`
    : `Hola MUVE! 👋 Acabo de solicitar una cotización.\n🚚 ${result?.vehicleName || ''}\n📍 ${from?.address || ''} → ${to?.address || ''}\n💰 Estimado: ${fmt(result?.price)}`;
  const waUrl = `https://wa.me/56952023504?text=${encodeURIComponent(waMsg)}`;

  return (
    <div className="czNoteOverlay">
      <style>{`
        @keyframes czNoteBackdropIn { from{opacity:0} to{opacity:1} }
        @keyframes czNoteIn { from{opacity:0;transform:scale(.92) translateY(8px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes czCheckPop { 0%{transform:scale(0.4);opacity:0} 70%{transform:scale(1.12)} 100%{transform:scale(1);opacity:1} }
        .czNoteOverlay {
          position: fixed; inset: 0; z-index: 6;
          display: flex; align-items: center; justify-content: center;
          padding: 20px; background: rgba(10,31,61,.32);
          animation: czNoteBackdropIn .3s ease both;
        }
        .czNoteCard {
          width: 100%; max-width: 380px; background: ${SURF}; border-radius: 24px;
          padding: 32px 28px 24px; text-align: center;
          box-shadow: 0 30px 80px rgba(10,31,61,.35), 0 0 0 1px rgba(0,0,0,.05);
          animation: czNoteIn .4s cubic-bezier(.22,.68,.36,1) both;
        }
      `}</style>
      <div className="czNoteCard">
        <div style={{
          width: 64, height: 64, borderRadius: '50%', margin: '0 auto 16px',
          background: `linear-gradient(135deg,${SUC},#16D760)`,
          display: 'grid', placeItems: 'center',
          boxShadow: `0 10px 28px ${SUC}44`,
          animation: 'czCheckPop .55s cubic-bezier(.34,1.56,.64,1) both',
        }}>
          <Check size={32} color="#fff" strokeWidth={3}/>
        </div>
        <h2 style={{ fontSize: 21, fontWeight: 900, color: N, margin: '0 0 6px', letterSpacing: '-0.5px' }}>
          {manualReview ? '¡Solicitud enviada!' : '¡Cotización aceptada!'}
        </h2>
        <p style={{ fontSize: 13, color: T2, margin: '0 0 18px', lineHeight: 1.5 }}>
          {manualReview
            ? 'Tienes muchas cosas — un asesor MUVE se comunicará contigo en un instante.'
            : preliminary
              ? 'Guardamos tu cotización con el precio estimado. Un asesor MUVE te confirma el valor final muy pronto.'
              : 'Revisaremos tu solicitud y te contactaremos para coordinar los detalles.'
          }
        </p>

        {result?.price && (
          <div style={{ background: BG, borderRadius: 14, border: `1px solid ${BDR}`, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, textAlign: 'left' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>{result?.vehicleIcon || '🚐'}</span>
              <div style={{ fontSize: 12, fontWeight: 700, color: N, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{result?.vehicleName}</div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: B, letterSpacing: '-0.4px', flexShrink: 0 }}>{fmt(result.price)}</div>
          </div>
        )}

        <a href={waUrl} target="_blank" rel="noreferrer" style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
          padding: '11px 14px', borderRadius: 14,
          background: 'linear-gradient(135deg,#f0fdf6,#e8fbf0)',
          border: '1px solid rgba(37,211,102,.25)', textDecoration: 'none',
        }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: WA, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="white"><path d="M20.5 3.5A11 11 0 003.4 17.4L2 22l4.7-1.4A11 11 0 1020.5 3.5z"/></svg>
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#15803D', textAlign: 'left' }}>¿Preguntas? Escríbenos por WhatsApp</div>
        </a>

        <button type="button" onClick={onRestart} style={{
          width: '100%', padding: '12px', borderRadius: 14, border: `1.5px solid ${BDR}`,
          background: BG, color: T2, fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
          fontFamily: 'Inter,system-ui,sans-serif',
        }}>Nueva cotización</button>
      </div>
    </div>
  );
}

// ─── LOADING ──────────────────────────────────────────────────
function ScreenCalculating() {
  const STEPS = [
    { icon: MapPin,   label: 'Midiendo la ruta',        hint: 'Distancia y peajes del trayecto' },
    { icon: Truck,    label: 'Eligiendo el vehículo',   hint: 'Furgón, 3/4 o camión según volumen' },
    { icon: Building2,label: 'Revisando tus artículos', hint: 'Ayudantes, pisos y embalaje' },
    { icon: Sparkles, label: 'Aplicando tarifas MUVE',  hint: 'Precio de red, sin sorpresas' },
    { icon: Check,    label: 'Preparando tu cotización',hint: 'Ajustando el rango final' },
  ];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(i => Math.min(i + 1, STEPS.length - 1)), 1250);
    return () => clearInterval(t);
  }, []);
  const pct = Math.round(((idx + 1) / STEPS.length) * 100);

  return (
    <div style={{ height: '100dvh', background: GRAD_DEEP, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', fontFamily: 'Inter,system-ui,sans-serif' }}>
      <style>{`
        @keyframes czCalcRing  { from{transform:scale(.55);opacity:.5} to{transform:scale(2.5);opacity:0} }
        @keyframes czCalcFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes czCalcSpin  { to{transform:rotate(360deg)} }
        @keyframes czCalcRoad  { to{background-position:-48px 0} }
        @keyframes czCalcPop   { 0%{transform:scale(.4);opacity:0} 60%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
        @keyframes czCalcPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.45;transform:scale(.82)} }
        @keyframes czCalcRow   { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Radial glow */}
      <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at 50% 38%, rgba(63,190,237,.24), transparent 60%)', pointerEvents:'none' }}/>

      {/* Wordmark */}
      <div style={{ position:'absolute', top:'max(26px, env(safe-area-inset-top))', left:0, right:0, textAlign:'center', zIndex:3 }}>
        <span style={{ fontSize:15, fontWeight:900, letterSpacing:3, color:'rgba(255,255,255,.9)' }}>MUVE</span>
      </div>

      {/* Halo + spinning conic ring + floating vehicle */}
      <div style={{ position:'relative', zIndex:2, marginBottom:30, display:'grid', placeItems:'center' }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            gridArea:'1/1', width:150, height:150, borderRadius:'50%',
            border:'1.5px solid rgba(255,255,255,.18)',
            animation:`czCalcRing 2.7s ease-out ${i * 0.9}s infinite`,
          }}/>
        ))}
        <div style={{
          gridArea:'1/1', width:132, height:132, borderRadius:'50%',
          background:'conic-gradient(from 0deg, transparent 0 62%, rgba(120,210,255,.95) 88%, transparent 100%)',
          animation:'czCalcSpin 1.15s linear infinite',
          maskImage:'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px))',
          WebkitMaskImage:'radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px))',
        }}/>
        <div style={{
          gridArea:'1/1', width:96, height:96, borderRadius:28,
          background:'rgba(255,255,255,.14)', border:'1px solid rgba(255,255,255,.24)',
          display:'grid', placeItems:'center',
          animation:'czCalcFloat 2.4s ease-in-out infinite',
          boxShadow:'0 24px 60px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.25)',
        }}>
          <Truck size={40} color="#fff" strokeWidth={1.7}/>
        </div>
      </div>

      {/* Title + live percentage */}
      <div style={{ position:'relative', zIndex:2, textAlign:'center', padding:'0 32px' }}>
        <div style={{ fontSize:22, fontWeight:900, color:'#fff', letterSpacing:'-0.4px' }}>
          Calculando tu precio
        </div>
        <div style={{ fontSize:12.5, color:'rgba(255,255,255,.62)', fontWeight:600, marginTop:5 }}>
          {STEPS[idx].hint}
        </div>
      </div>

      {/* Progress track */}
      <div style={{ position:'relative', zIndex:2, width:'min(300px, 78vw)', marginTop:22 }}>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, fontWeight:700, color:'rgba(255,255,255,.55)', marginBottom:7 }}>
          <span>Analizando…</span><span>{pct}%</span>
        </div>
        <div style={{ height:7, borderRadius:99, background:'rgba(255,255,255,.14)', overflow:'hidden' }}>
          <div style={{
            height:'100%', width:`${pct}%`, borderRadius:99,
            background:'linear-gradient(90deg,#7FD4FF,#2E9BF0)',
            boxShadow:'0 0 12px rgba(127,212,255,.7)',
            transition:'width .7s cubic-bezier(.4,0,.2,1)',
          }}/>
        </div>
      </div>

      {/* Step checklist */}
      <div style={{ position:'relative', zIndex:2, width:'min(320px, 82vw)', marginTop:22, display:'flex', flexDirection:'column', gap:9 }}>
        {STEPS.map((s, i) => {
          const done = i < idx, active = i === idx;
          const StepIcon = s.icon;
          return (
            <div key={s.label} style={{
              display:'flex', alignItems:'center', gap:11,
              opacity: done || active ? 1 : 0.4,
              animation: active ? 'czCalcRow .35s ease both' : undefined,
              transition:'opacity .4s ease',
            }}>
              <div style={{
                width:26, height:26, borderRadius:'50%', flexShrink:0,
                display:'grid', placeItems:'center',
                background: done ? 'rgba(120,220,170,.22)' : active ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.07)',
                border:`1px solid ${done ? 'rgba(120,220,170,.55)' : 'rgba(255,255,255,.2)'}`,
              }}>
                {done
                  ? <div style={{ animation:'czCalcPop .3s ease both', display:'grid', placeItems:'center' }}><Check size={14} color="#78E0AA" strokeWidth={3}/></div>
                  : active
                    ? <div style={{ width:8, height:8, borderRadius:'50%', background:'#7FD4FF', animation:'czCalcPulse 1s ease-in-out infinite' }}/>
                    : <StepIcon size={12} color="rgba(255,255,255,.55)" strokeWidth={2}/>}
              </div>
              <span style={{ fontSize:13, fontWeight: active ? 800 : 600, color: done ? 'rgba(255,255,255,.8)' : '#fff' }}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Moving road */}
      <div style={{
        position:'absolute', left:0, right:0, bottom:0, height:34, zIndex:1,
        background:'rgba(255,255,255,.05)',
        borderTop:'1px solid rgba(255,255,255,.12)',
      }}>
        <div style={{
          position:'absolute', top:'50%', left:0, right:0, height:3, transform:'translateY(-50%)',
          background:'repeating-linear-gradient(90deg, rgba(255,255,255,.55) 0 16px, transparent 16px 32px)',
          backgroundSize:'48px 3px',
          animation:'czCalcRoad .6s linear infinite',
        }}/>
      </div>
    </div>
  );
}

// ─── Desktop shell CSS ────────────────────────────────────────
const CZ_CSS = `
  .cz-anim { display: none; }
  .czScaleWrap { display: contents; }
  .czRig { display: contents; }
  .cz-outer { background: #EBF4FF; }
  .czTestBtn { display: none; }
  @keyframes czRipple       { to { transform: scale(1); opacity: 0; } }
  @keyframes czSavingPulse  { 0%,100%{opacity:1}50%{opacity:.3} }
  @keyframes czScrollBounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(5px)} }
  .czSavingDot { animation: czSavingPulse 0.8s ease infinite; }

  @media (min-width: 640px) {
    body { margin: 0; overflow: hidden; }
    .cz-outer {
      position: fixed; inset: 0; overflow: hidden;
      background: linear-gradient(180deg,#9CCBEE 0%,#C3E0F3 45%,#E4F1FB 100%);
      display: flex; align-items: center; justify-content: center;
      /* --cz-scale is set inline via JS (computeCzScale in the component) — computed there,
         not with CSS clamp()/calc() division, because that formula resolves unreliably across
         browsers (Safari in particular mis-computes nested var()/calc()/min() viewport-unit chains). */
    }
    .cz-anim {
      display: block; position: absolute; inset: 0;
      pointer-events: none; z-index: 1; overflow: hidden;
      contain: layout style paint;
      transform: translateZ(0);
    }
    .cz-inner {
      width: 820px; height: 960px;
      /* transform is set inline (JS, local pop-in/out only — overall scale lives on
         the .czScaleWrap ancestor, position/slide on .czRig) — see the component's render */
      border-radius: 24px; overflow: hidden;
      box-shadow: 0 40px 100px rgba(10,31,61,.28), 0 0 0 1px rgba(0,0,0,.07);
      position: relative; z-index: 2; display: flex; flex-direction: column;
      flex-shrink: 0;
    }
    .cz-inner > div {
      flex: 1; min-height: 0 !important; height: 100% !important;
      display: flex; flex-direction: column;
    }
    .czTestBtn {
      display: block; position: absolute; bottom: 18px; right: 22px; z-index: 10;
      padding: 8px 18px; border-radius: 20px; border: none; cursor: pointer;
      background: rgba(255,255,255,.88); backdrop-filter: blur(6px);
      font-size: 13px; font-weight: 700; color: #0A1F3D;
      box-shadow: 0 2px 10px rgba(0,0,0,.18); transition: transform .12s;
    }
    .czTestBtn:hover { transform: scale(1.04); }

    /* Two separate layers so the responsive scale and the drive-in/out slide never
       fight over the same transform property (mixing both in one animated transform
       was causing the whole rig to visibly drift instead of holding a fixed spot):
       .czScaleWrap only ever scales (static per render, never animated) — it's the
       single source of truth for size, so the card and the cab are always exactly the
       same scale. .czRig, its only child, only ever translates on X — it sits still at
       translateX(0) here holding its place ("el mismo sitio") the entire time the form
       is being filled, and only moves when entering/departing. */
    .czScaleWrap {
      display: flex; align-items: center; justify-content: center;
      transform: scale(var(--cz-scale));
      position: relative; z-index: 2;
    }
    /* Position/opacity here are driven entirely by inline style in JS (RIG_POSE), not
       by CSS classes — a plain CSS transition on values that change between two
       separately-committed inline styles, instead of a @keyframes animation that has
       to be "kicked off" correctly. Inline styles apply in the same render as the
       elements they're on, with no dependency on this <style> tag having already been
       parsed — the most reliable way to guarantee the very first pose (off-screen,
       invisible) actually paints before the drive-in starts animating toward it. */
    /* Sized by the card alone (its only in-flow child) — the cab attaches via absolute
       positioning (see the Cab component) instead of being a flex sibling, so
       .czScaleWrap centers the CARD, not the card+cab pair. The cab is free to hang
       off the right edge, even past the viewport, without pulling the card off-center. */
    .czRig {
      display: block; position: relative; z-index: 2;
    }
    .czWheelSpin { animation: czWheelSpin .55s linear infinite; }
    @keyframes czWheelSpin { to { transform: rotate(360deg); } }
  }
`;

// ─── State ────────────────────────────────────────────────────
const INIT = {
  step: 0,
  from: { address: '', lat: null, lng: null },
  to:   { address: '', lat: null, lng: null },
  distanceKm: null, durationMin: null,
  inventory: {},
  freeText: '',
  extras: { floors: 0, packing: false },
  result: null,
  selectedHelpers: 0,
  manualReview: false,
  preliminary: false,
  name: '', phone: '', email: '',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Card is designed at a fixed 820×960 canvas, then scaled as one unit to fill whatever
// room the screen actually has. Computed in JS (not CSS clamp/calc division) because that
// formula is unreliable across browsers — Safari in particular mis-resolves nested
// var()/calc()/min() chains dividing viewport units, producing a wildly oversized scale.
//
// scale drives overall content size (fonts, icons, padding — everything), based on
// available height so text/buttons never get absurdly huge on a merely-wide screen.
// designWidth is the pre-scale width fed to .cz-inner: on screens much wider than tall
// (ultrawide/big monitors), it stretches beyond the plain 820*scale so the card actually
// spreads sideways into that space instead of just floating there as a taller sliver.
// Below 640px the floating-card treatment doesn't apply at all (.cz-anim/.cz-outer's
// desktop CSS is gated behind that same breakpoint) — the scene is plain full-bleed mobile
// flow instead, so scale/designWidth must stay unset there or they'd force the desktop
// card's sizing onto mobile through the inline style regardless of the CSS breakpoint.
function computeCzLayout() {
  if (typeof window === 'undefined') return { isDesktop: false, scale: 1, designWidth: 820 };
  const vw = window.innerWidth, vh = window.innerHeight;
  if (vw < 640) return { isDesktop: false, scale: 1, designWidth: 820 };
  const sx = (vw - 48) / 820;
  const sy = (vh - 48) / 960;
  // sx is a floor here (not just a max cap) so a narrow-but-tall window can never make
  // the proportional width exceed what's actually available — the stretch bonus below
  // only ever adds width, it never causes an overflow scale on its own.
  const scale = Math.min(Math.max(Math.min(sx, sy), 0.65), 1.6);
  const proportionalWidthPx = 820 * scale;
  const stretchedWidthPx = Math.min(vw - 48, proportionalWidthPx * 1.45, 1300);
  const widthPx = Math.max(proportionalWidthPx, stretchedWidthPx);
  return { isDesktop: true, scale, designWidth: widthPx / scale };
}

// ─── MAIN ─────────────────────────────────────────────────────
export default function CotizadorView() {
  const [state, setState]           = useState(INIT);
  const [calculating, setCalc]      = useState(false);
  const [saving, setSaving]         = useState(false);
  const [czLayout, setCzLayout] = useState(computeCzLayout);
  const { isDesktop: isDesktopScene, scale: cardScale, designWidth: cardDesignWidth } = czLayout;
  // Always plays on desktop — deliberately not gated behind prefers-reduced-motion,
  // since this truck entrance/exit is the point of the landing, not incidental chrome.
  const playIntro = isDesktopScene;
  // Card starts visible (not hidden-then-revealed) — it's glued to the cab as one
  // object, so it rides in together with it, not fading in separately afterward.
  const [frameHidden, setFrameHidden] = useState(false);
  const [showCab, setShowCab] = useState(isDesktopScene);
  // Starts 'pending' (held statically off-screen, see RIG_POSE), not 'entering' directly
  // — flipping to 'entering' a frame later (below) guarantees the browser has already
  // painted the off-screen pose separately, so the transition to the on-screen pose
  // actually plays instead of the rig just appearing there on the very first paint.
  const [rigPhase, setRigPhase] = useState(playIntro ? 'pending' : 'attached');
  // While the truck is still on its way, the card shows a blank cover (white + big
  // logo) instead of the real form — it "opens" like a roll-up door once the truck
  // has arrived. See the .czDoor cover inside .cz-inner in the main render.
  const [doorOpen, setDoorOpen] = useState(!playIntro);
  const frameRef = useRef(null);
  const submittingRef = useRef(false); // evita doble envío si tocan "Aceptar" dos veces

  useEffect(() => {
    if (!playIntro) return;
    const t1 = setTimeout(() => setRigPhase('entering'), 50);
    const t2 = setTimeout(() => setRigPhase('attached'), 50 + RIG_ENTER_MS);
    const t3 = setTimeout(() => setDoorOpen(true), 50 + RIG_ENTER_MS + 550);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  useEffect(() => {
    const onResize = () => setCzLayout(computeCzLayout());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // step → pageTracker level (1=landing, 9=submit handled separately)
  const STEP_DB_LEVEL = { 1: 2, 2: 3, 3: 4, 5: 7 };

  useEffect(() => {
    initMetaPixel();
    trackStep(0);
    _trackLandingDB();
  }, []);

  const go = step => {
    setState(s => ({ ...s, step }));
    frameRef.current?.scrollTo?.({ top: 0 });
    trackStep(step);
    const lvl = STEP_DB_LEVEL[step];
    if (lvl) _trackEventDB(lvl);
  };

  const calculate = async () => {
    setCalc(true);
    _trackEventDB(5); // usuario solicitó cálculo — alta intención
    const { inventory, freeText, extras, distanceKm, from, to } = state;
    const items = Object.keys(inventory)
      .filter(id => inventory[id] > 0)
      .map(id => {
        const cat = CATALOG.find(c => c.id === id);
        return cat ? { name: cat.name, qty: inventory[id], icon: cat.icon, vol: cat.vol } : null;
      }).filter(Boolean);

    try {
      const res = await api.aiQuote({
        originAddress: from.address,
        destinationAddress: to.address,
        distanceKm: distanceKm || 0,
        items,
        freeText: freeText.trim(),
        numFloors: extras.floors,
        numHelpers: 0,
        needsPacking: extras.packing,
      });

      const price = Number(res?.price) || 0;
      // "Sin precio online" de verdad: el cliente ya marcó la carga como sobre-dimensionada
      // (volumen > 30 m³ antes de llamar) o el motor no devolvió ningún monto.
      const noOnlinePrice = state.manualReview === true || price <= 0;
      // Hay estimación, pero sujeta a que un asesor la confirme (IA caída / fallback,
      // baja confianza, o monto muy alto). Igual SE MUESTRA el precio y el cliente decide.
      const preliminary = !noOnlinePrice && (
        Boolean(res.needsManualReview) || res.confidence === 'low' || price > 400000
      );

      if (noOnlinePrice) {
        // Aun sin precio online, la cotización se GUARDA y NOTIFICA — así el
        // operador la ve en el admin y puede escribirle al cliente.
        // Se guarda en segundo plano: no bloquear la pantalla.
        setState(s => ({ ...s, result: res, manualReview: true, preliminary: false, step: 5 }));
        trackStep(6);
        _trackEventDB(7);
        persistQuote({ result: res, manualReview: true, preliminary: false });
      } else {
        setState(s => ({ ...s, result: res, manualReview: false, preliminary, step: 4 }));
        trackStep(5);
        _trackEventDB(6, res.detectedType);
      }
    } catch {
      setState(s => ({ ...s, step: 3 }));
    } finally {
      setCalc(false);
    }
  };

  // Guarda la cotización en el backend (crea/promueve el registro y dispara la
  // notificación al admin). `extra` sobrescribe el state cuando aún no se aplicó
  // el setState (p. ej. el `result` recién llegado).
  const persistQuote = async (extra = {}) => {
    const s = { ...state, ...extra };
    const { from, to, extras, freeText, inventory, distanceKm, result, manualReview, preliminary, name, phone, email, selectedHelpers } = s;
    const inventoryArray = Object.keys(inventory)
      .filter(id => inventory[id] > 0)
      .map(id => {
        const cat = CATALOG.find(c => c.id === id);
        return cat ? { id, name: cat.name, qty: inventory[id] } : null;
      }).filter(Boolean);
    const itemsDesc = serializeInventory(inventoryArray, freeText || '');

    try {
      await api.createPublicQuote({
        serviceType: (manualReview && !result) ? 'mudanza' : (result?.detectedType === 'mudanza' ? 'mudanza' : 'flete'),
        contactPerson: name,
        contactPhone: phone,
        contactEmail: email || null,
        originAddress: from.address,
        destinationAddress: to.address,
        distanceKm: distanceKm || null,
        vehicleType: result?.vehicle || '',
        numHelpers: selectedHelpers ?? result?.recommendedHelpers ?? 0,
        numFloors: extras.floors,
        needsPacking: extras.packing,
        itemsDescription: itemsDesc,
        priceMin: result?.priceMin || null,
        priceMax: result?.priceMax || null,
        clientNotes: `Cotizador 2.0 | ${result?.vehicleName || ''}${manualReview ? ' | REVISIÓN MANUAL' : preliminary ? ' | ESTIMACIÓN PRELIMINAR — confirmar con asesor' : ''}`,
      });
      trackMetaEvent('Lead', { content_name: 'Cotizador 2.0', value: result?.price });
      _trackSubmitDB(result?.detectedType || 'flete_mudanza');
    } catch { /* non-blocking */ }
  };

  const submitContact = async (extra = {}) => {
    if (submittingRef.current) return;   // ya se tocó "Aceptar"
    submittingRef.current = true;
    setSaving(true);
    // La cotización se guarda + notifica en SEGUNDO PLANO. El botón responde al
    // instante: el camión arranca ya, sin esperar la red.
    persistQuote(extra).finally(() => setSaving(false));

    if (typeof window !== 'undefined' && window.innerWidth >= 640) {
      // Reverse the arrival first: card re-crops (the rear wheel reappears) and the
      // cover closes back over the content (logo + slogan again) — then the whole rig
      // rolls off to the right, wheels spinning, before the SuccessNote overlay
      // (rendered independently, see the main return) takes over.
      setDoorOpen(false);
      await sleep(900);
      setRigPhase('departing');
      await sleep(1600);
      setShowCab(false);
      setFrameHidden(true);
      setRigPhase('attached');
    }

    setState(s => ({ ...s, step: 5 }));
    trackStep(5);
  };

  const restart = () => {
    submittingRef.current = false;
    setState(INIT);
    if (!playIntro) return;
    // The cab retired off-screen when the last quote finished — bring it back for
    // the next one, replaying the same drive-in it did on first page load (same
    // pending → entering handoff, see the mount effect above).
    // Card stays visible the whole time — it's glued to the cab, riding in together.
    setShowCab(true);
    setFrameHidden(false);
    setDoorOpen(false);
    setRigPhase('pending');
    setTimeout(() => setRigPhase('entering'), 50);
    setTimeout(() => setRigPhase('attached'), 50 + RIG_ENTER_MS);
    setTimeout(() => setDoorOpen(true), 50 + RIG_ENTER_MS + 550);
  };

  const triggerTruckTest = async () => {
    // Inject mock data so SuccessNote renders correctly
    setState(s => ({
      ...s,
      step: s.step,
      result: s.result || {
        price: 85000, priceMin: 75000, priceMax: 98000,
        vehicleName: 'Furgón N400', vehicleIcon: '🚐',
        detectedType: 'flete', vehicle: 'furgon',
        clientExplanation: 'Tu traslado está listo.',
        recommendedHelpers: 1, twoTrips: false, tollEstimate: 0,
      },
      from: s.from?.address ? s.from : { address: 'Las Condes, Santiago', lat: -33.41, lng: -70.58 },
      to:   s.to?.address   ? s.to   : { address: 'Providencia, Santiago', lat: -33.43, lng: -70.62 },
      distanceKm: s.distanceKm || 8,
    }));
    // Reproducir la secuencia de cierre completa: primero se re-cierra (reaparece la
    // rueda, vuelve el logo), luego el rig se va rodando a la derecha, y por último
    // aparece la ventanita de éxito.
    setDoorOpen(false);
    await sleep(900);
    setRigPhase('departing');
    await sleep(1600);
    setShowCab(false);
    setFrameHidden(true);
    setRigPhase('attached');
    setState(s => ({ ...s, step: 5 }));
  };

  const cabWidthDesign = Math.min(480, 320 / cardScale) * (256 / 270) * 1.1;
  const cabHeightDesign = Math.min(702, 513 / cardScale);
  // CabArt's cab is stretched taller without going wider (preserveAspectRatio="none"),
  // which also stretches its tire into a taller ellipse, not a plain circle anymore —
  // so the rear wheel (a plain circle) has to match the front tire's VERTICAL size
  // (height-based scale), not its width-based scale, or it comes out visibly smaller.
  const wheelDiameter = cabHeightDesign * (108 / 270);
  // Front wheel's own center sits 72/270 of the cab's height above the cab's bottom
  // edge (that's where cy=336 falls inside CabArt's 138–408 viewBox) — matching that
  // same height for the rear wheel's center keeps both wheels level with each other.
  const frontWheelCenterFromBottom = cabHeightDesign * (72 / 270);
  // Crop line sits right at the rear wheel's center — the white edge only needs to
  // cover the top half of the wheel; the bottom half shows fully below it.
  const cardCropPx = frontWheelCenterFromBottom;

  const screen = calculating ? <ScreenCalculating/> : (() => {
    switch (state.step) {
      case 0: return <ScreenWelcome onStart={() => go(1)}/>;
      case 1: return <ScreenAddresses state={state} setState={setState} onNext={() => go(2)} onBack={() => go(0)}/>;
      case 2: return <ScreenItems state={state} setState={setState}
        onNext={() => {
          const invArr = Object.keys(state.inventory)
            .filter(id => state.inventory[id] > 0)
            .map(id => ({ id, qty: state.inventory[id] }));
          const vol = totalVol(invArr);
          if (vol > 30) {
            setState(s => ({ ...s, manualReview: true }));
            calculate();
            trackStep(3); _trackEventDB(7);
            frameRef.current?.scrollTo?.({ top: 0 });
          } else {
            setState(s => ({ ...s, manualReview: false }));
            go(3);
          }
        }}
        onBack={() => go(1)}/>;
      case 3: return <ScreenExtras state={state} setState={setState} onNext={() => calculate()} onBack={() => go(2)}/>;
      case 4: return <ScreenResult state={state} onRestart={restart} onBack={() => go(3)} onNext={h => { setState(s => ({...s, selectedHelpers: h})); submitContact({ selectedHelpers: h }); }}/>;
      case 5: return null;
      default: return <ScreenWelcome onStart={() => go(1)}/>;
    }
  })();

  return (
    <>
      <style>{CZ_CSS}</style>
      <div className="cz-outer" style={{ '--cz-scale': String(cardScale) }}>
        <div className="cz-anim">
          <SceneStatic packed={rigPhase === 'departing' || frameHidden}/>
        </div>
        {/* .czScaleWrap only scales (static — the single source of truth for size).
            .czRig, its only child, only slides on X and holds a fixed spot ("el mismo
            sitio") the whole time the form is filled; card + cab are glued together in
            one flex row so there's never a gap between them. */}
        <div className="czScaleWrap">
          <div className="czRig" style={{ ...RIG_POSE[rigPhase], transition: RIG_TRANSITION[rigPhase] }}>
            <div className="cz-inner" ref={frameRef} style={{
              opacity: frameHidden ? 0 : 1,
              ...(isDesktopScene ? {
                width: cardDesignWidth,
                transform: `scale(${frameHidden ? 0.96 : 1})`,
              } : {
                transform: frameHidden ? 'scale(0.96)' : 'scale(1)',
              }),
              // Cropped short (bottom hidden) while the truck is still en route — the
              // rear wheel sits in that gap (see RearWheel below) — then unfolds down to
              // the card's real full height once parked, completing the form's layout.
              // clip-path (not a height/layout change) so the crop never nudges the cab,
              // wheel or tail light, which are all positioned relative to this box's
              // real, constant layout size.
              clipPath: doorOpen ? 'inset(0 round 24px)' : `inset(0 0 ${cardCropPx}px 0 round 24px)`,
              transition: frameHidden
                ? 'opacity 0.38s ease, transform 0.38s ease'
                : 'opacity 0.45s ease 0.1s, transform 0.45s ease 0.1s, clip-path 900ms cubic-bezier(.65,0,.35,1)',
              pointerEvents: frameHidden ? 'none' : 'auto',
            }}>
              {screen}
              {/* Blank + logo cover for the entire trip — real content only shows once
                  the card unfolds (doorOpen): splits open from the middle, top half up
                  and bottom half down (stretching a bit as it goes). Clipped by the same
                  clip-path as the card itself, so it never shows below the crop line.
                  The logo lives INSIDE each panel (each one clipped to its own half of
                  a full-card-size copy) rather than on a layer behind both — otherwise,
                  once the two solid panels meet in the middle, they'd cover the logo
                  completely and the "closed" state would just be blank white. */}
              <div style={{ position: 'absolute', inset: 0, zIndex: 5, pointerEvents: doorOpen ? 'none' : 'auto' }}>
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: '50%', background: '#fff', overflow: 'hidden',
                  transform: doorOpen ? 'translateY(-100%)' : 'translateY(0)',
                  transition: 'transform 900ms cubic-bezier(.65,0,.35,1)',
                }}>
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: '200%',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
                  }}>
                    <img src="/logo_reducido.png" alt="MUVE" style={{ width: '62%', maxWidth: 380, objectFit: 'contain' }}/>
                    <div style={{ fontSize: 18, fontWeight: 800, color: B, textTransform: 'uppercase', letterSpacing: 3 }}>
                      Fletes · Mudanzas · Santiago
                    </div>
                  </div>
                </div>
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%', background: '#fff', overflow: 'hidden',
                  transformOrigin: 'top',
                  transform: doorOpen ? 'translateY(100%) scaleY(1.3)' : 'translateY(0) scaleY(1)',
                  transition: 'transform 900ms cubic-bezier(.65,0,.35,1)',
                }}>
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, height: '200%',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
                  }}>
                    <img src="/logo_reducido.png" alt="MUVE" style={{ width: '62%', maxWidth: 380, objectFit: 'contain' }}/>
                    <div style={{ fontSize: 18, fontWeight: 800, color: B, textTransform: 'uppercase', letterSpacing: 3 }}>
                      Fletes · Mudanzas · Santiago
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {showCab && <Cab phase={rigPhase} widthDesign={cabWidthDesign} heightDesign={cabHeightDesign}/>}
            {/* Tail light — the cab attaches on the right, so this is the true rear of
                the whole "truck" (card = cargo box), flush against its left edge. */}
            {showCab && (
              <div style={{ position: 'absolute', right: '100%', top: '50%', marginTop: -18, width: 13, height: 36, borderRadius: 4, background: '#DC2626' }}>
                <div style={{ position: 'absolute', top: 6, left: 3.5, width: 6, height: 13, borderRadius: 2, background: '#FCA5A5', opacity: .85 }}/>
              </div>
            )}
            {showCab && <RearWheel doorOpen={doorOpen} spinning={rigPhase === 'entering' || rigPhase === 'departing'} diameter={wheelDiameter} centerFromBottom={frontWheelCenterFromBottom}/>}
          </div>
        </div>
        {/* Independent of the card/rig sizing entirely — always the same compact size,
            centered on the real viewport (not the scaled truck scene). */}
        {state.step === 5 && <SuccessNote state={state} onRestart={restart}/>}
        {import.meta.env.DEV && (
          <button type="button" className="czTestBtn" onClick={triggerTruckTest}>🚚 Probar animación</button>
        )}
      </div>
    </>
  );
}
