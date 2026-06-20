import React, { useState, useEffect, useRef } from 'react';
import { loadGoogleMaps } from '../../utils/googleMaps.js';
import {
  ArrowLeft, ArrowRight, Check, X, Sparkles,
  Building2, Shield, PenLine, Phone, Users, Mail,
  Truck, MapPin, ChevronRight,
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
const CAT_EMOJI = { 'Dormitorio':'🛏️','Living':'🛋️','Comedor':'🍽️','Cocina':'🧊','Electrodomésticos':'🫧','Oficina':'💻','Cajas':'📦' };
const CATS_ORDER = ['Dormitorio','Living','Comedor','Cocina','Electrodomésticos','Oficina','Cajas'];
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

    fetch(`https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?geometries=geojson&overview=simplified`)
      .then(r => r.json())
      .then(data => {
        if (!mapRef.current) return;
        const path = data.routes[0].geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
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
    <div style={{ borderRadius: 14, overflow: 'hidden', height: 160, marginBottom: 14, border: `1px solid ${BDR}`, position: 'relative', background: '#EEF3FF' }}>
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
function SceneStatic() {
  const WF = 'rgba(10,35,100,.27)';
  const WS = 'rgba(65,115,195,.28)';

  // [x, y, w, h, opacity, cols]
  const LBUILDS = [
    [28,  375, 72,  255, .22, 2],
    [108, 320, 54,  310, .26, 2],
    [170, 362, 90,  268, .18, 3],
    [268, 302, 48,  328, .24, 1],
    [324, 352, 78,  278, .20, 2],
    [408, 282, 62,  348, .26, 2],
  ];
  const RBUILDS = [
    [870,  352, 75,  278, .20, 2],
    [952,  296, 58,  334, .26, 2],
    [1018, 338, 92,  292, .18, 3],
    [1118, 312, 65,  318, .24, 2],
    [1190, 358, 80,  272, .20, 2],
    [1278, 288, 58,  342, .26, 2],
    [1344, 362, 96,  268, .18, 3],
  ];
  const ALL = [...LBUILDS, ...RBUILDS];

  // Generate window grid coords for a building — clipPath clips anything outside
  function winGrid(bx, by, bw, bh, cols) {
    const WW = 10, WH = 8, ROW_STEP = 22, TOP_PAD = 22, BOT_PAD = 14;
    const avail = bw - 16;
    const gap   = cols > 1 ? (avail - cols * WW) / (cols - 1) : 0;
    const out   = [];
    for (let wy = by + TOP_PAD; wy + WH <= by + bh - BOT_PAD; wy += ROW_STEP) {
      for (let c = 0; c < cols; c++) {
        out.push([Math.round(bx + 8 + c * (WW + gap)), wy]);
      }
    }
    return out;
  }

  return (
    <svg width="100%" height="100%" viewBox="0 0 1440 700" preserveAspectRatio="xMidYMax slice"
         xmlns="http://www.w3.org/2000/svg" style={{ display:'block', position:'absolute', inset:0 }}>
      <defs>
        <linearGradient id="czTG" x1="0" x2="1">
          <stop offset="0" stopColor={B}/><stop offset="1" stopColor={C}/>
        </linearGradient>
        {/* One clipPath per building so windows never bleed outside */}
        {ALL.map(([x,y,w,h], i) => (
          <clipPath key={i} id={`czB${i}`}>
            <rect x={x} y={y} width={w} height={h} rx="4"/>
          </clipPath>
        ))}
      </defs>

      {/* Sun */}
      <circle cx="1250" cy="115" r="78" fill="rgba(255,230,80,.2)"/>
      <circle cx="1250" cy="115" r="50" fill="rgba(255,235,100,.3)"/>

      {/* Clouds — slowly drifting */}
      <g opacity=".9">
        <animateTransform attributeName="transform" type="translate" from="0 0" to="90 0" dur="90s" repeatCount="indefinite"/>
        <ellipse cx="175" cy="88"  rx="95" ry="38" fill="white"/>
        <ellipse cx="242" cy="70"  rx="68" ry="34" fill="white"/>
        <ellipse cx="122" cy="84"  rx="52" ry="28" fill="white"/>
      </g>
      <g opacity=".72">
        <animateTransform attributeName="transform" type="translate" from="0 0" to="70 0" dur="115s" repeatCount="indefinite"/>
        <ellipse cx="680" cy="130" rx="115" ry="44" fill="white"/>
        <ellipse cx="768" cy="110" rx="82"  ry="38" fill="white"/>
        <ellipse cx="618" cy="126" rx="58"  ry="30" fill="white"/>
      </g>
      <g opacity=".55">
        <animateTransform attributeName="transform" type="translate" from="0 0" to="55 0" dur="140s" repeatCount="indefinite"/>
        <ellipse cx="1040" cy="72" rx="80" ry="32" fill="white"/>
        <ellipse cx="1104" cy="56" rx="55" ry="28" fill="white"/>
      </g>

      {/* Birds in the sky */}
      {[
        { sy:210, ey:188, dur:'14s',  begin:'0s',   sc:1.0  },
        { sy:260, ey:242, dur:'10s',  begin:'4.5s', sc:0.7  },
        { sy:175, ey:158, dur:'19s',  begin:'8s',   sc:0.85 },
        { sy:300, ey:284, dur:'12s',  begin:'13s',  sc:0.6  },
        { sy:238, ey:218, dur:'16s',  begin:'2s',   sc:0.75 },
        { sy:148, ey:134, dur:'22s',  begin:'6s',   sc:0.55 },
        { sy:330, ey:318, dur:'9.5s', begin:'17s',  sc:0.5  },
      ].map((b, i) => {
        const s = b.sc;
        return (
          <path key={i} d={`M0,0 Q${9*s},${-11*s} ${18*s},0 Q${27*s},${-11*s} ${36*s},0`}
                stroke="rgba(20,50,115,.65)" strokeWidth={2.2*s} fill="none" opacity="0.72">
            <animateTransform attributeName="transform" type="translate"
              from={`-60 ${b.sy}`} to={`1520 ${b.ey}`}
              dur={b.dur} begin={b.begin} repeatCount="indefinite"/>
          </path>
        );
      })}

      {/* Mid-distance buildings (faint, fill centre gap for depth) */}
      <rect x="490" y="368" width="82"  height="232" rx="3" fill="rgba(255,255,255,.09)"/>
      <rect x="582" y="308" width="68"  height="292" rx="3" fill="rgba(255,255,255,.11)"/>
      <rect x="662" y="350" width="88"  height="250" rx="3" fill="rgba(255,255,255,.08)"/>
      <rect x="762" y="318" width="74"  height="282" rx="3" fill="rgba(255,255,255,.10)"/>

      {/* Left buildings with clipped windows */}
      {LBUILDS.map(([x,y,w,h,op,cols], i) => (
        <g key={`lb${i}`}>
          <rect x={x} y={y} width={w} height={h} rx="4" fill={`rgba(255,255,255,${op})`}/>
          <g clipPath={`url(#czB${i})`}>
            {winGrid(x,y,w,h,cols).map(([wx,wy], j) => (
              <rect key={j} x={wx} y={wy} width={10} height={8} rx={1.5} fill={WF} stroke={WS} strokeWidth="0.8"/>
            ))}
          </g>
        </g>
      ))}

      {/* Right buildings with clipped windows */}
      {RBUILDS.map(([x,y,w,h,op,cols], i) => (
        <g key={`rb${i}`}>
          <rect x={x} y={y} width={w} height={h} rx="4" fill={`rgba(255,255,255,${op})`}/>
          <g clipPath={`url(#czB${LBUILDS.length+i})`}>
            {winGrid(x,y,w,h,cols).map(([wx,wy], j) => (
              <rect key={j} x={wx} y={wy} width={10} height={8} rx={1.5} fill={WF} stroke={WS} strokeWidth="0.8"/>
            ))}
          </g>
        </g>
      ))}

      {/* Grass */}
      <rect x="0" y="575" width="1440" height="125" fill="#4CAF50" opacity=".52"/>
      <rect x="0" y="575" width="1440" height="18"  fill="#66BB6A" opacity=".58"/>

      {/* Sidewalk */}
      <rect x="0" y="557" width="1440" height="20" fill="rgba(210,228,248,.44)"/>
      <rect x="0" y="575" width="1440" height="3"  fill="rgba(135,168,198,.45)"/>

      {/* Street trees (foliage double-layer + trunk) */}
      <ellipse cx="510"  cy="528" rx="31" ry="28" fill="rgba(55,152,72,.62)"/>
      <ellipse cx="510"  cy="519" rx="21" ry="17" fill="rgba(80,178,88,.36)"/>
      <rect    x="507"   y="554"  width="6" height="6" rx="1" fill="rgba(78,46,16,.72)"/>

      <ellipse cx="716"  cy="530" rx="27" ry="25" fill="rgba(52,148,68,.6)"/>
      <ellipse cx="716"  cy="521" rx="17" ry="14" fill="rgba(76,172,84,.33)"/>
      <rect    x="713"   y="554"  width="6" height="5" rx="1" fill="rgba(78,46,16,.72)"/>

      <ellipse cx="880"  cy="529" rx="28" ry="25" fill="rgba(60,156,70,.58)"/>
      <ellipse cx="880"  cy="520" rx="18" ry="15" fill="rgba(84,178,88,.32)"/>
      <rect    x="877"   y="552"  width="6" height="5" rx="1" fill="rgba(78,46,16,.72)"/>

      <ellipse cx="1090" cy="527" rx="26" ry="24" fill="rgba(55,150,68,.60)"/>
      <ellipse cx="1090" cy="518" rx="17" ry="14" fill="rgba(78,174,85,.33)"/>
      <rect    x="1087"  y="550"  width="6" height="5" rx="1" fill="rgba(78,46,16,.72)"/>

      <ellipse cx="1322" cy="528" rx="29" ry="26" fill="rgba(58,152,68,.60)"/>
      <ellipse cx="1322" cy="519" rx="19" ry="16" fill="rgba(82,174,85,.34)"/>
      <rect    x="1319"  y="552"  width="6" height="6" rx="1" fill="rgba(78,46,16,.72)"/>

      {/* Lamp posts */}
      <rect x="630" y="490" width="5" height="70" fill="rgba(105,124,150,.73)"/>
      <path d="M632 494 Q654 476 670 476" fill="none" stroke="rgba(105,124,150,.73)" strokeWidth="4" strokeLinecap="round"/>
      <circle cx="671" cy="476" r="7" fill="rgba(255,248,158,.9)"/>
      <circle cx="671" cy="476" r="4" fill="rgba(255,240,100,.95)"/>

      <rect x="1058" y="492" width="5" height="68" fill="rgba(105,124,150,.73)"/>
      <path d="M1060 496 Q1082 478 1098 478" fill="none" stroke="rgba(105,124,150,.73)" strokeWidth="4" strokeLinecap="round"/>
      <circle cx="1099" cy="478" r="7" fill="rgba(255,248,158,.9)"/>
      <circle cx="1099" cy="478" r="4" fill="rgba(255,240,100,.95)"/>

      {/* Traffic light */}
      <rect x="818" y="504" width="5" height="56" fill="rgba(88,108,130,.70)"/>
      <rect x="812" y="502" width="22" height="50" rx="4" fill="rgba(28,42,62,.75)"/>
      <circle cx="823" cy="512" r="4.5" fill="rgba(255,72,72,.9)"/>
      <circle cx="823" cy="523" r="4.5" fill="rgba(255,200,48,.9)"/>
      <circle cx="823" cy="534" r="4.5" fill="rgba(72,210,72,.9)"/>

      {/* Pigeons on sidewalk */}
      <ellipse cx="592" cy="568" rx="11" ry="7"  fill="rgba(118,120,152,.70)"/>
      <ellipse cx="600" cy="564" rx="6"  ry="5"  fill="rgba(133,134,166,.63)"/>
      <circle  cx="604" cy="562" r="3"   fill="rgba(104,105,138,.72)"/>
      <line x1="586" y1="573" x2="584" y2="578" stroke="rgba(152,108,52,.72)" strokeWidth="1.5"/>
      <line x1="592" y1="573" x2="594" y2="578" stroke="rgba(152,108,52,.72)" strokeWidth="1.5"/>

      <ellipse cx="638" cy="570" rx="10" ry="6"  fill="rgba(126,128,160,.67)"/>
      <ellipse cx="645" cy="566" rx="5"  ry="4"  fill="rgba(140,142,172,.60)"/>
      <circle  cx="649" cy="564" r="2.5" fill="rgba(110,112,144,.70)"/>
      <line x1="633" y1="574" x2="631" y2="579" stroke="rgba(152,108,52,.70)" strokeWidth="1.5"/>
      <line x1="639" y1="574" x2="641" y2="579" stroke="rgba(152,108,52,.70)" strokeWidth="1.5"/>

      <ellipse cx="1102" cy="567" rx="10" ry="6" fill="rgba(122,124,156,.68)"/>
      <ellipse cx="1109" cy="563" rx="5"  ry="4" fill="rgba(138,140,168,.61)"/>
      <circle  cx="1113" cy="561" r="2.5" fill="rgba(108,110,142,.70)"/>
      <line x1="1097" y1="571" x2="1095" y2="576" stroke="rgba(152,108,52,.70)" strokeWidth="1.5"/>
      <line x1="1103" y1="571" x2="1105" y2="576" stroke="rgba(152,108,52,.70)" strokeWidth="1.5"/>

      {/* Airplane with MUVE banner — single plane, S-curve path across sky */}
      <g opacity="0.92">
        <animateMotion dur="26s" repeatCount="indefinite" rotate="auto"
          path="M-300,230 C150,70 480,410 720,210 C960,20 1260,390 1780,185"/>
        {/* Tow rope */}
        <line x1="-30" y1="0" x2="-128" y2="0"
              stroke="rgba(25,50,110,.48)" strokeWidth="1.6" strokeDasharray="7,5"/>
        {/* Banner */}
        <rect x="-200" y="-16" width="72" height="30" rx="5"
              fill="rgba(255,255,255,.93)" stroke="rgba(27,108,245,.75)" strokeWidth="2"/>
        <text x="-164" y="8" textAnchor="middle"
              fontFamily="Inter,Arial,system-ui,sans-serif" fontWeight="900"
              fontSize="17" fill="rgba(27,108,245,1)" letterSpacing="2">MUVE</text>
        {/* Banner attachment point triangle */}
        <path d="M-128,-7 L-120,0 L-128,7" fill="rgba(27,108,245,.55)"/>
        {/* Fuselage */}
        <ellipse cx="0" cy="0" rx="26" ry="6" fill="rgba(255,255,255,.96)" stroke="rgba(27,108,245,.65)" strokeWidth="1.4"/>
        {/* Wings */}
        <path d="M-4,-4 L12,-4 L14,-26 L-14,-24 L-11,-4 Z"
              fill="rgba(190,218,255,.92)" stroke="rgba(27,108,245,.55)" strokeWidth="1"/>
        <path d="M-4,4 L12,4 L14,26 L-14,24 L-11,4 Z"
              fill="rgba(190,218,255,.92)" stroke="rgba(27,108,245,.55)" strokeWidth="1"/>
        {/* Tail fins */}
        <path d="M-21,-4 L-30,-16 L-26,-4" fill="rgba(190,218,255,.90)" stroke="rgba(27,108,245,.45)" strokeWidth="0.8"/>
        <path d="M-21,4  L-30,16  L-26,4"  fill="rgba(190,218,255,.90)" stroke="rgba(27,108,245,.45)" strokeWidth="0.8"/>
        {/* Cockpit */}
        <ellipse cx="16" cy="0" rx="6" ry="4" fill="rgba(100,172,255,.78)" stroke="rgba(27,108,245,.42)" strokeWidth="0.9"/>
        {/* Engine pods */}
        <ellipse cx="1" cy="-24" rx="4" ry="2.5" fill="rgba(125,178,232,.82)" stroke="rgba(27,108,245,.38)" strokeWidth="0.7"/>
        <ellipse cx="1" cy="24"  rx="4" ry="2.5" fill="rgba(125,178,232,.82)" stroke="rgba(27,108,245,.38)" strokeWidth="0.7"/>
      </g>

      {/* Road */}
      <rect x="0" y="593" width="1440" height="107" fill="#546E7A" opacity=".88"/>
      {Array.from({ length: 14 }, (_, i) => (
        <rect key={i} x={i * 110} y="644" width="72" height="5" rx="2" fill="rgba(255,255,255,.52)"/>
      ))}
      <rect x="0" y="596" width="1440" height="3" fill="rgba(255,255,255,.22)"/>
    </svg>
  );
}

// ─── Animated truck — 6 cardboard boxes, smoke on depart ─────
const N_BOXES = 6;
const BOX_DEFS = [
  { x: 74,  y: 120, w: 136, h: 96 }, // row1-col1
  { x: 220, y: 120, w: 136, h: 96 }, // row1-col2
  { x: 366, y: 120, w: 136, h: 96 }, // row1-col3
  { x: 74,  y: 222, w: 136, h: 96 }, // row2-col1
  { x: 220, y: 222, w: 136, h: 96 }, // row2-col2
  { x: 366, y: 222, w: 136, h: 96 }, // row2-col3
];
const BOX_FILL   = '#C8956C';
const BOX_STROKE = '#8B5E3C';
const BOX_LINE   = '#A07040';
const BOX_DARK   = '#7A4F2A';

function TruckAnim({ phase }) {
  const initReady = Array(N_BOXES).fill(false);
  const [boxReady, setBoxReady] = useState(initReady);

  useEffect(() => {
    if (phase === 'loading') {
      const ts = BOX_DEFS.map((_, i) =>
        setTimeout(() => setBoxReady(prev => { const n = [...prev]; n[i] = true; return n; }), 100 + i * 160)
      );
      return () => ts.forEach(clearTimeout);
    }
    if (phase === 'entering' || phase === 'parked') {
      setBoxReady(Array(N_BOXES).fill(false));
    }
  }, [phase]);

  const showBoxes = phase === 'loading' || phase === 'departing';
  const showSmoke = phase === 'departing' || phase === 'loading';

  return (
    <div className={`czTruckOuter czTruck-${phase}`}>
      <svg width="576" height="269" viewBox="0 0 900 420" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="tG" x1="0" x2="1">
            <stop offset="0" stopColor={B}/><stop offset="1" stopColor={C}/>
          </linearGradient>
        </defs>

        {/* Shadow */}
        <ellipse cx="420" cy="408" rx="380" ry="14" fill="rgba(0,0,0,.18)"/>

        {/* Cargo body */}
        <rect x="60" y="86" width="514" height="244" rx="18" fill="#FFFFFF" stroke="#D7E2F0" strokeWidth="3"/>
        {/* Blue top stripe */}
        <rect x="60" y="86" width="514" height="32" rx="18" fill="url(#tG)"/>

        {/* MUVE brand (hidden when cargo is full) */}
        {!showBoxes && (
          <>
            <rect x="220" y="125" width="194" height="104" rx="12" fill="#EFF5FF"/>
            <text x="317" y="202" textAnchor="middle" fontFamily="Inter,system-ui,sans-serif"
                  fontWeight="900" fontSize="78" fill={B}>MUVE</text>
          </>
        )}

        {/* 6 cardboard boxes — scale-in from center */}
        {BOX_DEFS.map((b, i) => {
          const ready = showBoxes && boxReady[i];
          return (
            <g key={i} style={{
              transformBox: 'fill-box',
              transformOrigin: '50% 50%',
              transform: ready ? 'scale(1)' : 'scale(0.05)',
              opacity: ready ? 1 : 0,
              transition: ready
                ? `transform 0.45s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.02}s, opacity 0.15s ease ${i * 0.02}s`
                : 'none',
            }}>
              {/* Box body */}
              <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="8" fill={BOX_FILL} stroke={BOX_STROKE} strokeWidth="3"/>
              {/* Top flap highlight */}
              <rect x={b.x} y={b.y} width={b.w} height={22} rx="8" fill={BOX_DARK} opacity=".35"/>
              {/* Tape horizontal */}
              <rect x={b.x} y={b.y + b.h/2 - 5} width={b.w} height={10} fill={BOX_DARK} opacity=".25"/>
              {/* Tape vertical */}
              <rect x={b.x + b.w/2 - 5} y={b.y} width={10} height={b.h} fill={BOX_DARK} opacity=".25"/>
              {/* Corner shadow */}
              <line x1={b.x+3} y1={b.y+3} x2={b.x+3} y2={b.y+b.h-3} stroke={BOX_DARK} strokeWidth="3" opacity=".18"/>
            </g>
          );
        })}

        {/* Smoke — SVG native animate (no CSS px/SVG unit issues) */}
        {showSmoke && [0, 0.4, 0.8, 1.2].map((delay, i) => (
          <circle key={i} cx={771} cy={152} r={14 + i * 2} fill={`rgba(80,80,80,${0.5 - i*0.08})`}>
            <animate attributeName="cy"      from="152" to="72"  dur="1.5s" begin={`${delay}s`} repeatCount="indefinite"/>
            <animate attributeName="r"       from={14+i*2} to={38+i*4} dur="1.5s" begin={`${delay}s`} repeatCount="indefinite"/>
            <animate attributeName="opacity" from="0.6" to="0"   dur="1.5s" begin={`${delay}s`} repeatCount="indefinite"/>
          </circle>
        ))}

        {/* Cab — drawn last so it covers cargo-cab seam */}
        <path d="M574 148 L730 148 C750 148 764 160 772 178 L814 265 L814 332 L574 332 Z" fill="#0F172A"/>
        <path d="M592 168 L718 168 C732 168 742 176 748 193 L778 258 L592 258 Z" fill="#7EC8E3" opacity=".88"/>
        <line x1="592" y1="168" x2="616" y2="258" stroke="rgba(255,255,255,.2)" strokeWidth="3.5"/>
        <rect x="574" y="260" width="184" height="72" fill="#1A2535"/>
        <line x1="574" y1="260" x2="758" y2="260" stroke="#2A3A50" strokeWidth="2"/>
        <rect x="740" y="290" width="20" height="6" rx="3" fill="#4B5563"/>
        <rect x="770" y="302" width="50" height="30" rx="7" fill="#2A3A50"/>
        <rect x="765" y="155" width="13" height="48" rx="5" fill="#374151"/>
        <rect x="804" y="272" width="22" height="15" rx="4" fill="#FCD34D"/>
        {[[164,336],[418,336],[722,336]].map(([cx,cy]) => (
          <g key={cx}>
            <circle cx={cx} cy={cy} r={54} fill="#1E293B"/>
            <circle cx={cx} cy={cy} r={26} fill="#94A3B8"/>
            <circle cx={cx} cy={cy} r={10} fill="#CBD5E1"/>
          </g>
        ))}
        <rect x="348" y="308" width="122" height="20" rx="5" fill="#374151"/>
      </svg>
    </div>
  );
}

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
    type:'Mini flete — 1 cama', icon:'🛏️',
    items:['🛏️ Cama 1 plaza','🛌 Colchón','📦 2 cajas'],
    km:5, price:32000,
    name:'Valentina S.',
    comment:'En menos de una hora tenía la cama instalada en mi nuevo depto. ¡Súper rápido y cuidadoso!',
  },
  {
    type:'Flete camión 3/4', icon:'🚚',
    items:['🛏️ Cama 2 plazas','🪞 Clóset','🧊 Refrigerador'],
    km:8, price:58000,
    name:'Felipe A.',
    comment:'Llegaron con el equipo correcto para los muebles pesados. Sin rasguños y exactamente a la hora.',
  },
  {
    type:'Mudanza mediana', icon:'🏘️',
    items:['🛏️ Cama 2 plazas','🪞 Clóset','🛋️ Sofá 2 plazas','🧊 Refrigerador','🫧 Lavadora','🍽️ Mesa comedor','💻 Escritorio','📦 8 cajas'],
    km:14, price:79990,
    name:'Ana M.',
    comment:'Todo organizado y sin contratiempos. Los muebles llegaron perfectos. ¡Los recomiendo al 100%!',
  },
  {
    type:'Mudanza grande', icon:'🏡',
    items:['🛏️ Cama Queen','🛏️ Cama 1 plaza','🪞 Clóset doble','🛋️ Sofá 3 plazas','🧊 Refrigerador','🫧 Lavadora','🌀 Secadora','🍳 Cocina','🍽️ Mesa comedor','🪑 6 sillas','🗄️ Cómoda','💻 Escritorio','📚 Librero','📺 TV 65"','🎨 Cuadros','📦 15 cajas','🌿 Plantas'],
    km:25, price:169990,
    name:'Jorge & Claudia R.',
    comment:'Mudanza completa de 3 dormitorios, impecables. Cuidaron cada mueble como si fuera de ellos.',
  },
];

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
          .czHeroTitle { font-size: 46px !important; letter-spacing: -2px !important; line-height: 1.05 !important; }
          .czHeroSub { font-size: 15px !important; max-width: 100% !important; }
          .czHeroCta { max-width: 300px !important; }
          .czTrustChips { justify-content: flex-start !important; }
          .czSideCards { display: flex !important; flex-direction: column; width: 296px; flex-shrink: 0; }
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
            Tu precio de traslado,<br/>
            <span style={{ background:GRAD, WebkitBackgroundClip:'text', backgroundClip:'text', color:'transparent' }}>en 30 segundos</span>
          </h1>
          <p className="czHeroSub" style={{ color:T2, fontSize:14, lineHeight:1.55, margin:'0 0 14px', maxWidth:290 }}>
            Sin registro ni llamadas. Ingresa origen, destino y artículos — precio al instante.
          </p>

          {/* Step bar */}
          <div style={{ display:'flex', alignItems:'center', width:'100%', maxWidth:300, marginBottom:14 }}>
            {[
              { n:'1', t:'Ruta',      cls:'czStep1', icon:<MapPin size={17} strokeWidth={2.2}/> },
              { n:'2', t:'Artículos', cls:'czStep2', icon:<IcoBox size={16}/> },
              { n:'3', t:'Precio',    cls:'czStep3', icon:<IcoBolt size={16}/> },
            ].map((s,i) => (
              <React.Fragment key={s.n}>
                {i > 0 && <div style={{ flex:1, height:2, background:`linear-gradient(90deg,${B}55,${C}55)`, borderRadius:99 }}/>}
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                  <div className={s.cls} style={{ width:40, height:40, borderRadius:'50%', background:GRAD, display:'grid', placeItems:'center', color:'#fff', flexShrink:0, boxShadow:`0 3px 10px ${B}35` }}>{s.icon}</div>
                  <div style={{ fontSize:10, fontWeight:700, color:T2 }}>{s.t}</div>
                </div>
                {i < 2 && <div style={{ flex:1, height:2, background:`linear-gradient(90deg,${B}55,${C}55)`, borderRadius:99 }}/>}
              </React.Fragment>
            ))}
          </div>

          {/* CTA */}
          <div className="czCtaWrap czHeroCta" style={{ marginBottom:12 }}>
            <button
              type="button"
              onClick={onStart}
              onMouseDown={addRipple}
              className="czCta"
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

          {/* Trust chips */}
          <div className="czTrustChips" style={{ display:'flex', gap:0, justifyContent:'center', marginBottom:10, background:'rgba(255,255,255,.7)', borderRadius:14, border:`1px solid ${BDR}`, overflow:'hidden', backdropFilter:'blur(8px)' }}>
            {[
              { icon:<IcoBolt size={15}/>,    t:'Menos de 1 min', c:'#F59E0B' },
              { icon:<IcoLock size={15}/>,    t:'Sin registro',   c:'#10B981' },
              { icon:<IcoDiamond size={15}/>, t:'Precio real',    c:B         },
            ].map((b,i) => (
              <div key={b.t} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, padding:'10px 6px', borderRight: i < 2 ? `1px solid ${BDR}` : 'none' }}>
                <div style={{ width:28, height:28, borderRadius:8, background:`${b.c}15`, display:'grid', placeItems:'center', color:b.c }}>{b.icon}</div>
                <span style={{ fontSize:10, fontWeight:700, color:T2, textAlign:'center', lineHeight:1.2 }}>{b.t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Side panel — desktop right column (hidden on mobile) */}
        <div className="czSideCards" style={{ display:'none', gap:10 }}>

          {/* Rotating testimonial card */}
          <div style={{ borderRadius:18, overflow:'hidden', boxShadow:`0 4px 24px ${B}22`, opacity: fading ? 0 : 1, transition:'opacity .32s ease' }}>
            {/* Header */}
            <div style={{ background:GRAD, padding:'14px 18px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:40, height:40, borderRadius:10, background:'rgba(255,255,255,.2)', display:'grid', placeItems:'center', fontSize:20, flexShrink:0 }}>{c.icon}</div>
                <div>
                  <div style={{ fontSize:13, fontWeight:800, color:'#fff', letterSpacing:'-0.2px' }}>{c.type}</div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,.75)', marginTop:1 }}>{c.km} km recorridos</div>
                </div>
              </div>
              <div style={{ color:'#FFD700', fontSize:15, letterSpacing:2 }}>★★★★★</div>
            </div>

            {/* Items */}
            <div style={{ background:'#fff', padding:'12px 16px', borderBottom:`1px solid ${BDR}` }}>
              <div style={{ fontSize:9, fontWeight:700, color:T3, textTransform:'uppercase', letterSpacing:.8, marginBottom:6 }}>Lo que llevamos</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                {c.items.map(item => (
                  <span key={item} style={{ fontSize:11, fontWeight:600, color:T2, background:`${B}08`, border:`1px solid ${B}18`, borderRadius:6, padding:'3px 9px' }}>{item}</span>
                ))}
              </div>
            </div>

            {/* Price + km */}
            <div style={{ background:'#fff', padding:'12px 16px 10px', borderBottom:`1px solid ${BDR}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
                <div>
                  <div style={{ fontSize:9, color:T3, fontWeight:700, textTransform:'uppercase', letterSpacing:.6 }}>Precio cobrado</div>
                  <div style={{ fontSize:26, fontWeight:900, color:B, letterSpacing:'-1px', lineHeight:1.1 }}>{'$' + String(c.price).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:9, color:T3, fontWeight:700, textTransform:'uppercase', letterSpacing:.6 }}>Distancia</div>
                  <div style={{ fontSize:26, fontWeight:900, color:N, letterSpacing:'-1px', lineHeight:1.1 }}>{c.km} km</div>
                </div>
              </div>
            </div>

            {/* Testimonial */}
            <div style={{ background:'#FAFBFF', padding:'12px 16px' }}>
              <div style={{ background:'#fff', borderRadius:10, padding:'10px 13px', border:`1px solid ${BDR}`, boxShadow:'0 1px 6px rgba(0,0,0,.04)' }}>
                <div style={{ fontSize:11, color:T2, lineHeight:1.6, fontStyle:'italic' }}>"{c.comment}"</div>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:8 }}>
                  <div style={{ width:22, height:22, borderRadius:'50%', background:GRAD, display:'grid', placeItems:'center', fontSize:10, color:'#fff', fontWeight:800, flexShrink:0 }}>
                    {c.name[0]}
                  </div>
                  <div style={{ fontSize:11, fontWeight:800, color:N }}>{c.name}</div>
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
      <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'flex-end', paddingBottom:'max(20px,env(safe-area-inset-bottom,20px))', position:'relative', zIndex:2, padding:'0 22px max(20px,env(safe-area-inset-bottom,20px))' }}>
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
  const { from, to, distanceKm, durationMin } = state;
  const [loadingDist, setLoadingDist] = useState(false);

  useEffect(() => {
    if (!from.lat || !to.lat || distanceKm || loadingDist) return;
    setLoadingDist(true);
    api.calculateDistance({ originLat: from.lat, originLng: from.lng, destLat: to.lat, destLng: to.lng })
      .then(({ distanceKm: km, durationMin: min }) => setState(s => ({ ...s, distanceKm: km, durationMin: min })))
      .catch(() => {})
      .finally(() => setLoadingDist(false));
  }, [from.lat, to.lat]);

  return (
    <div style={{ height: '100dvh', background: BG, display: 'flex', flexDirection: 'column' }}>
      <Header step={1} total={4} title="¿Desde dónde?" onBack={onBack}/>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '16px 16px 0' }}>

        {/* Leaflet map */}
        <LeafletRouteMap from={from} to={to} distanceKm={distanceKm}/>

        {/* Address inputs */}
        <div style={{ background: SURF, borderRadius: 16, border: `1px solid ${BDR}`, padding: '4px 14px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderBottom: `1px dashed ${BDR}` }}>
            <div style={{ width: 10, height: 10, borderRadius: 99, background: B, flexShrink: 0 }}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Retiro</div>
              <AddressAutocomplete
                value={from.address}
                onChange={v => setState(s => ({ ...s, from: { address: v, lat: null, lng: null }, distanceKm: null, durationMin: null }))}
                onSelect={({ address, lat, lng }) => setState(s => ({ ...s, from: { address, lat, lng } }))}
                placeholder="Dirección de retiro…"
                style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 14, fontWeight: 600, color: N, width: '100%', padding: 0, fontFamily: 'Inter,system-ui,sans-serif' }}
              />
            </div>
            {from.lat && <Check size={16} color={SUC} strokeWidth={2.5}/>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0' }}>
            <div style={{ width: 10, height: 10, borderRadius: 99, background: SUC, flexShrink: 0 }}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Entrega</div>
              <AddressAutocomplete
                value={to.address}
                onChange={v => setState(s => ({ ...s, to: { address: v, lat: null, lng: null }, distanceKm: null, durationMin: null }))}
                onSelect={({ address, lat, lng }) => setState(s => ({ ...s, to: { address, lat, lng } }))}
                placeholder="Dirección de entrega…"
                style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 14, fontWeight: 600, color: N, width: '100%', padding: 0, fontFamily: 'Inter,system-ui,sans-serif' }}
              />
            </div>
            {to.lat && <Check size={16} color={SUC} strokeWidth={2.5}/>}
          </div>
        </div>

        {/* Distance badge */}
        {distanceKm && !loadingDist && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 12, background: '#f0fdf4', border: `1.5px solid ${SUC}30`, marginBottom: 14 }}>
            <div>
              <span style={{ fontSize: 22, fontWeight: 900, color: B, letterSpacing: '-0.5px' }}>{distanceKm} km</span>
              {durationMin && <span style={{ fontSize: 13, color: T2, marginLeft: 10 }}>· ~{durationMin} min</span>}
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: SUC, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Check size={13} color={SUC} strokeWidth={2.5}/> Calculada
            </span>
          </div>
        )}
        {loadingDist && <div style={{ fontSize: 12, color: T3, fontWeight: 600, marginBottom: 14 }}>⏳ Calculando distancia…</div>}

        <div style={{ padding: '10px 14px', borderRadius: 12, background: `${C}12`, border: `1px solid ${C}30`, fontSize: 12, color: T2, lineHeight: 1.45, marginBottom: 16 }}>
          <strong style={{ color: N }}>💡 Tip:</strong> Selecciona la sugerencia al escribir para calcular la distancia exacta.
        </div>
      </div>

      <CtaBar>
        <BtnBack onClick={onBack}/>
        <BtnPrimary onClick={onNext} disabled={!from.address || !to.address}>
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

  return (
    <div style={{ height: '100dvh', background: BG, display: 'flex', flexDirection: 'column' }}>
      <Header step={2} total={4} title="¿Qué llevas?" onBack={onBack}/>

      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
      <div ref={contentRef} onScroll={onScroll} style={{ overflowY: 'auto', height: '100%', padding: '14px 16px 0' }}>

        {/* Tip banner */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '10px 13px', borderRadius: 12, background: `${B}09`, border: `1px solid ${B}20`, marginBottom: 12 }}>
          <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.3 }}>💡</span>
          <span style={{ fontSize: 12, color: B, fontWeight: 600, lineHeight: 1.5 }}>
            Selecciona del catálogo <strong>o escribe abajo</strong> lo que llevas — analizamos todo y calculamos el precio igual.
          </span>
        </div>

        {/* Counter */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T2 }}>
            {totalItems > 0 ? `${totalItems} artículo${totalItems !== 1 ? 's' : ''} seleccionado${totalItems !== 1 ? 's' : ''}` : 'Selecciona tus artículos'}
          </div>
          {(totalItems > 0 || freeText) && (
            <button type="button" onClick={clearAll} style={{ background: 'none', border: 'none', color: B, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Limpiar</button>
          )}
        </div>

        {/* Category tabs — mouse wheel scrolls horizontally on desktop */}
        <div ref={tabsRef} onWheel={onWheelTabs} style={{ display: 'flex', gap: 6, overflowX: 'auto', margin: '0 -16px', padding: '0 16px 8px', scrollbarWidth: 'thin', scrollbarColor: `${BDR} transparent` }}>
          {GROUPED.map(g => {
            const cnt = countCat(g.id);
            const active = activeTab === g.id;
            return (
              <button key={g.id} type="button" onClick={() => setActiveTab(g.id)} style={{
                flex: '0 0 auto', padding: '7px 13px', borderRadius: 99, cursor: 'pointer',
                background: active ? N : SURF, color: active ? '#fff' : T2,
                fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5,
                border: `1.5px solid ${active ? N : BDR}`, fontFamily: 'Inter,system-ui,sans-serif',
              }}>
                <span>{g.emoji}</span>{g.label}
                {cnt > 0 && <span style={{ background: B, color: '#fff', fontSize: 11, fontWeight: 800, padding: '1px 7px', borderRadius: 99 }}>{cnt}</span>}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: T3, textAlign: 'right', marginBottom: 10, marginTop: 1 }}>
          ← desliza o usa la rueda del ratón →
        </div>

        {/* Item grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(148px,1fr))', gap: 8, marginBottom: 14 }}>
          {GROUPED.find(g => g.id === activeTab)?.items.map(item => {
            const qty = getQty(item.id);
            return (
              <div key={item.id} style={{
                background: SURF, borderRadius: 14, padding: '12px 10px',
                border: `1.5px solid ${qty > 0 ? B : BDR}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                boxShadow: qty > 0 ? `0 0 0 3px ${B}16` : 'none',
              }}>
                <span style={{ fontSize: 28 }}>{item.icon}</span>
                <div style={{ fontSize: 12, fontWeight: 700, color: N, textAlign: 'center', lineHeight: 1.3 }}>{item.name}</div>
                <Stepper value={qty} onChange={n => setQty(item.id, n)}/>
              </div>
            );
          })}
        </div>

        {/* Live selection summary with X buttons */}
        {selectedItems.length > 0 && (
          <div style={{ background: SURF, borderRadius: 14, border: `1.5px solid ${B}22`, padding: '12px 14px', marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8 }}>Lo que llevas</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {selectedItems.map(item => (
                <span key={item.id} style={{
                  fontSize: 12, fontWeight: 600, padding: '5px 8px 5px 10px', borderRadius: 99,
                  background: '#EFF5FF', border: `1.5px solid ${B}28`, color: N,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  <span>{item.icon}</span>
                  {inventory[item.id] > 1 && <strong style={{ color: B }}>{inventory[item.id]}×</strong>}
                  <span>{item.name}</span>
                  <button type="button" onClick={() => removeItem(item.id)} style={{
                    background: `${B}18`, border: 'none', borderRadius: '50%', cursor: 'pointer',
                    width: 18, height: 18, display: 'grid', placeItems: 'center', flexShrink: 0,
                    padding: 0, marginLeft: 2,
                  }}>
                    <X size={10} color={B} strokeWidth={2.5}/>
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Free text */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T3, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 2 }}>¿Llevas algo que no está en el catálogo?</div>
          <div style={{ fontSize: 11, color: T2, marginBottom: 7 }}>Escríbelo con palabras — lo analizamos y lo incluimos en el precio.</div>
          <textarea
            value={freeText}
            onChange={e => setState(s => ({ ...s, freeText: e.target.value }))}
            placeholder="Ej: bicicleta, piano, caja de herramientas, plantas grandes, moto…"
            rows={2}
            style={{ width: '100%', boxSizing: 'border-box', resize: 'none', borderRadius: 12, border: `1.5px solid ${freeText.trim() ? B : BDR}`, padding: '10px 12px', fontSize: 13, color: N, fontFamily: 'Inter,system-ui,sans-serif', outline: 'none', background: SURF }}
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
          <div style={{ padding: '10px 14px', borderRadius: 12, background: '#FFFBEB', border: '1px solid rgba(234,179,8,.25)', fontSize: 12, color: '#78350F', lineHeight: 1.55 }}>
            Este es un <strong>precio estimado</strong>. Tras solicitar la cotización te contactaremos para coordinar fecha, horario y detalles finales.
          </div>
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
          <BtnPrimary onClick={() => onNext(helpers)}>
            Solicitar cotización <ArrowRight size={18} strokeWidth={2.4}/>
          </BtnPrimary>
          <button type="button" onClick={onRestart} style={{ background: 'none', border: 'none', color: T2, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '4px 0' }}>
            Nueva cotización
          </button>
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

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '18px 16px 0' }}>
        <p style={{ fontSize: 14, color: T2, lineHeight: 1.55, margin: '0 0 14px' }}>
          {state.manualReview
            ? 'Completa tus datos y te entregamos el precio exacto para tu traslado.'
            : 'Déjanos tus datos y te contactamos para confirmar detalles y coordinar el traslado.'
          }
        </p>

        {/* WA direct link */}
        <a href="https://wa.me/56952023504?text=Hola%20MUVE!%20%F0%9F%91%8B%20Quiero%20consultar%20sobre%20un%20traslado." target="_blank" rel="noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, background: '#f0fdf4', border: '1.5px solid rgba(37,211,102,.30)', textDecoration: 'none', marginBottom: 18 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: '#25D366', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="white"><path d="M20.5 3.5A11 11 0 003.4 17.4L2 22l4.7-1.4A11 11 0 1020.5 3.5z"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#15803D' }}>¿Preferís coordinar directo?</div>
            <div style={{ fontSize: 11, color: '#16A34A', fontWeight: 600, marginTop: 1 }}>Escríbenos por WhatsApp →</div>
          </div>
        </a>

        {/* Price mini recap — solo si hay precio calculado */}
        {state.result && !state.manualReview && (
          <div style={{ background: GRAD_DEEP, borderRadius: 16, padding: '14px 18px', marginBottom: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.6)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Tu estimado</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: '-0.7px' }}>{fmt(state.result?.price)}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', marginTop: 2 }}>{state.result?.vehicleName}</div>
            </div>
            <span style={{ fontSize: 38 }}>{state.result?.vehicleIcon}</span>
          </div>
        )}

        {/* Name */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T2, marginBottom: 6 }}>Nombre <span style={{ color: '#EF4444' }}>*</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', borderRadius: 12, border: `1.5px solid ${name.trim().length >= 2 ? B : BDR}`, background: SURF, transition: 'border-color .15s' }}>
            <Users size={16} color={B} strokeWidth={1.8}/>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Juan Pérez" style={inputStyle}/>
          </div>
        </div>

        {/* Phone */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T2, marginBottom: 6 }}>Teléfono / WhatsApp <span style={{ color: '#EF4444' }}>*</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', borderRadius: 12, border: `1.5px solid ${phoneOk ? B : BDR}`, background: SURF, transition: 'border-color .15s' }}>
            <Phone size={16} color={B} strokeWidth={1.8}/>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="+56 9 1234 5678" style={inputStyle}/>
          </div>
        </div>

        {/* Email optional */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T2, marginBottom: 6 }}>Email <span style={{ color: T3, fontWeight: 500 }}>(opcional)</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', borderRadius: 12, border: `1.5px solid ${BDR}`, background: SURF }}>
            <Mail size={16} color={B} strokeWidth={1.8}/>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="juan@correo.cl" style={inputStyle}/>
          </div>
        </div>

        <div style={{ padding: '11px 14px', borderRadius: 12, background: '#f0fdf4', border: '1px solid rgba(24,169,87,.2)', fontSize: 12, color: T2, lineHeight: 1.5, marginBottom: 16 }}>
          🔒 Tus datos son privados. Te contactamos solo para coordinar tu traslado.
        </div>
      </div>

      <CtaBar>
        <BtnBack onClick={onBack}/>
        <BtnPrimary onClick={() => valid && !saving && onSubmit(name.trim(), phone.trim(), email.trim())} disabled={!valid || saving}>
          {saving
            ? <><span className="czSavingDot">●</span> Enviando…</>
            : state.manualReview
              ? <>Saber el precio exacto <ArrowRight size={16} strokeWidth={2.4}/></>
              : <><Check size={16} strokeWidth={2.5}/> Solicitar cotización</>
          }
        </BtnPrimary>
      </CtaBar>
    </div>
  );
}

// ─── SCREEN 6 — SUCCESS ───────────────────────────────────────
const SUCCESS_TIPS = [
  { icon: '📱', text: 'Recibirás respuesta pronto — normalmente en menos de 30 minutos.' },
  { icon: '⭐', text: 'Más de 500 traslados realizados · Calificación promedio 4.9 / 5.' },
  { icon: '🚚', text: 'Nuestros conductores conocen tu ciudad y cuidan cada artículo.' },
  { icon: '💬', text: '¿Cambió algo? Sin problema — avísanos por WhatsApp cuando quieras.' },
  { icon: '🏠', text: 'Atendemos hogares, oficinas y pymes en todo Chile.' },
  { icon: '📦', text: '¿Necesitas embalaje extra? Solo pídelo al confirmar tu traslado.' },
];

function CyclingTips() {
  const [idx, setIdx]   = useState(0);
  const [show, setShow] = useState(true);

  useEffect(() => {
    const t = setInterval(() => {
      setShow(false);
      setTimeout(() => { setIdx(i => (i + 1) % SUCCESS_TIPS.length); setShow(true); }, 380);
    }, 3800);
    return () => clearInterval(t);
  }, []);

  const tip = SUCCESS_TIPS[idx];
  return (
    <div style={{ background: `${B}09`, borderRadius: 16, border: `1px solid ${B}16`, padding: '14px 16px' }}>
      <div style={{
        display: 'flex', gap: 10, alignItems: 'flex-start',
        opacity: show ? 1 : 0,
        transform: show ? 'translateY(0)' : 'translateY(6px)',
        transition: 'opacity .36s ease, transform .36s ease',
        minHeight: 44,
      }}>
        <span style={{ fontSize: 22, lineHeight: 1.3, flexShrink: 0 }}>{tip.icon}</span>
        <span style={{ fontSize: 13, color: T2, lineHeight: 1.55, fontWeight: 500 }}>{tip.text}</span>
      </div>
      {/* Progress dots */}
      <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginTop: 10 }}>
        {SUCCESS_TIPS.map((_, i) => (
          <div key={i} style={{
            height: 4, borderRadius: 99,
            width: i === idx ? 18 : 4,
            background: i === idx ? B : `${B}28`,
            transition: 'all .35s ease',
          }}/>
        ))}
      </div>
    </div>
  );
}

function ScreenSuccess({ state, onRestart }) {
  const { result, from, to, distanceKm, extras, selectedHelpers, manualReview } = state;
  const helpers = selectedHelpers ?? result?.recommendedHelpers ?? 0;
  const waMsg = manualReview
    ? `Hola MUVE! 👋 Solicité una cotización de mudanza grande.\n📍 ${from?.address || ''} → ${to?.address || ''}`
    : `Hola MUVE! 👋 Acabo de solicitar una cotización.\n🚚 ${result?.vehicleName || ''}\n📍 ${from?.address || ''} → ${to?.address || ''}\n💰 Estimado: ${fmt(result?.price)}`;
  const waUrl = `https://wa.me/56952023504?text=${encodeURIComponent(waMsg)}`;

  return (
    <div style={{ height: '100dvh', background: BG, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{`@keyframes czCheckPop { 0%{transform:scale(0.4);opacity:0} 70%{transform:scale(1.12)} 100%{transform:scale(1);opacity:1} }`}</style>

      {/* Header */}
      <div style={{ background: SURF, borderBottom: `1px solid ${BDR}`, padding: '12px 20px', paddingTop: 'max(12px,env(safe-area-inset-top,12px))', flexShrink: 0 }}>
        <img src="/logo_reducido.png" alt="MUVE" style={{ height: 38, objectFit: 'contain' }}/>
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: '20px 20px 0', display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>

        {/* Check + title */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{
            width: 76, height: 76, borderRadius: '50%',
            background: `linear-gradient(135deg,${SUC},#16D760)`,
            display: 'grid', placeItems: 'center', marginBottom: 14,
            boxShadow: `0 10px 28px ${SUC}44`,
            animation: 'czCheckPop .55s cubic-bezier(.34,1.56,.64,1) both',
          }}>
            <Check size={38} color="#fff" strokeWidth={3}/>
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 900, color: N, margin: '0 0 6px', letterSpacing: '-0.6px' }}>¡Solicitud enviada!</h2>
          <p style={{ fontSize: 13, color: T2, margin: 0, lineHeight: 1.5, maxWidth: 280 }}>
            {manualReview
              ? 'Tienes muchas cosas — para darte el mejor precio un asesor MUVE se comunicará contigo en un instante.'
              : 'Revisaremos tu solicitud y te contactaremos pronto.'
            }
          </p>
        </div>

        {/* Recap — normal si hay precio, tarjeta de agente si es manual */}
        {manualReview ? (
          <div style={{ background: GRAD_DEEP, borderRadius: 16, padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ fontSize: 40, flexShrink: 0 }}>📞</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Un asesor te contactará</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.75)', lineHeight: 1.5 }}>
                Revisamos artículo por artículo y te damos el precio justo para tu mudanza.
              </div>
            </div>
          </div>
        ) : (
          <div style={{ background: SURF, borderRadius: 16, border: `1px solid ${BDR}`, padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
                <span style={{ fontSize: 26, flexShrink: 0 }}>{result?.vehicleIcon || '🚐'}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: N }}>{result?.vehicleName}</div>
                  <div style={{ fontSize: 11, color: T3, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>
                    <MapPin size={10} style={{ verticalAlign: 'middle', marginRight: 2 }}/>{from?.address?.split(',')[0] || '—'} → {to?.address?.split(',')[0] || '—'}
                    {distanceKm ? ` · ${distanceKm} km` : ''}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: B, letterSpacing: '-0.5px' }}>{fmt(result?.price)}</div>
                {result?.priceMin && result?.priceMax && result.priceMin !== result.priceMax && (
                  <div style={{ fontSize: 10, color: T3 }}>{fmt(result.priceMin)} – {fmt(result.priceMax)}</div>
                )}
              </div>
            </div>
            {(helpers > 0 || extras?.floors > 0 || extras?.packing) && (
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
                {helpers > 0 && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: `${B}12`, color: B, fontWeight: 700 }}>👷 {helpers} ayudante{helpers !== 1 ? 's' : ''}</span>}
                {extras?.floors > 0 && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: `${B}12`, color: B, fontWeight: 700 }}>🏢 {extras.floors} piso{extras.floors !== 1 ? 's' : ''}</span>}
                {extras?.packing && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: `${B}12`, color: B, fontWeight: 700 }}>📦 Embalaje</span>}
              </div>
            )}
          </div>
        )}

        {/* Cycling tips */}
        <CyclingTips/>

        {/* Trust row — compact */}
        <div style={{ display: 'flex', gap: 7, justifyContent: 'center' }}>
          {[{e:'⭐',t:'4.9 / 5'},{e:'🏠',t:'+500 traslados'},{e:'📍',t:'Todo Chile'}].map(b => (
            <div key={b.t} style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 10px', borderRadius:99, background:SURF, border:`1px solid ${BDR}`, fontSize:10, color:T2, fontWeight:700 }}>
              <span style={{ fontSize:11 }}>{b.e}</span>{b.t}
            </div>
          ))}
        </div>

        {/* WA card */}
        <a href={waUrl} target="_blank" rel="noreferrer" style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 14px', borderRadius: 14,
          background: 'linear-gradient(135deg,#f0fdf6,#e8fbf0)',
          border: '1px solid rgba(37,211,102,.25)', textDecoration: 'none',
        }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: WA, display: 'grid', placeItems: 'center', flexShrink: 0, boxShadow: '0 3px 10px rgba(37,211,102,.32)' }}>
            <svg width={22} height={22} viewBox="0 0 24 24" fill="white"><path d="M20.5 3.5A11 11 0 003.4 17.4L2 22l4.7-1.4A11 11 0 1020.5 3.5z"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#15803D' }}>¿Preguntas? Escríbenos</div>
            <div style={{ fontSize: 11, color: '#16A34A', fontWeight: 600, marginTop: 1 }}>Respuesta por WhatsApp →</div>
          </div>
        </a>

      </div>

      <CtaBar>
        <button type="button" onClick={onRestart} style={{
          flex: 1, padding: '14px', borderRadius: 14, border: `1.5px solid ${BDR}`,
          background: BG, color: T2, fontSize: 14, fontWeight: 700, cursor: 'pointer',
          fontFamily: 'Inter,system-ui,sans-serif',
        }}>Nueva cotización</button>
      </CtaBar>
    </div>
  );
}

// ─── LOADING ──────────────────────────────────────────────────
function ScreenCalculating() {
  const MSGS = [
    'Calculando la distancia…',
    'Eligiendo el mejor vehículo…',
    'Analizando tus artículos…',
    'Aplicando tarifas vigentes…',
    'Preparando tu cotización…',
  ];
  const [msgIdx, setMsgIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setMsgIdx(i => (i + 1) % MSGS.length), 1500);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ height: '100dvh', background: GRAD_DEEP, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
      <style>{`
        @keyframes czCalcRing  { from{transform:scale(0.5);opacity:.55} to{transform:scale(2.4);opacity:0} }
        @keyframes czCalcFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }
        @keyframes czCalcMsg   { 0%{opacity:0;transform:translateY(10px)} 15%,85%{opacity:1;transform:translateY(0)} 100%{opacity:0;transform:translateY(-8px)} }
        @keyframes czCalcDot   { 0%,60%,100%{transform:scale(0.6);opacity:.3} 30%{transform:scale(1.15);opacity:1} }
      `}</style>

      {/* Radial glow */}
      <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at 50% 42%, rgba(63,190,237,.22), transparent 62%)', pointerEvents:'none' }}/>

      {/* Expanding rings */}
      {[0,1,2].map(i => (
        <div key={i} style={{
          position:'absolute', width:160, height:160, borderRadius:'50%',
          border:'1.5px solid rgba(255,255,255,.2)',
          animation:`czCalcRing 2.6s ease-out ${i * 0.86}s infinite`,
        }}/>
      ))}

      {/* Floating vehicle icon */}
      <div style={{
        position:'relative', zIndex:2,
        width:100, height:100, borderRadius:28,
        background:'rgba(255,255,255,.13)',
        border:'1px solid rgba(255,255,255,.22)',
        display:'grid', placeItems:'center',
        marginBottom:32,
        animation:'czCalcFloat 2.4s ease-in-out infinite',
        boxShadow:'0 24px 60px rgba(0,0,0,.25), 0 0 0 1px rgba(255,255,255,.08)',
      }}>
        <span style={{ fontSize:46 }}>🚐</span>
      </div>

      {/* Title */}
      <div style={{ position:'relative', zIndex:2, textAlign:'center', padding:'0 32px' }}>
        <div style={{ fontSize:22, fontWeight:900, color:'#fff', letterSpacing:'-0.5px', marginBottom:14 }}>
          Calculando tu precio
        </div>
        {/* Cycling message */}
        <div style={{ height:22, overflow:'hidden', position:'relative' }}>
          <div key={msgIdx} style={{ fontSize:13, color:'rgba(255,255,255,.65)', fontWeight:500, animation:'czCalcMsg 1.5s ease both' }}>
            {MSGS[msgIdx]}
          </div>
        </div>
      </div>

      {/* Bouncing dots */}
      <div style={{ display:'flex', gap:8, marginTop:30, position:'relative', zIndex:2 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width:8, height:8, borderRadius:'50%',
            background:'rgba(255,255,255,.65)',
            animation:`czCalcDot 1.4s ease-in-out ${i * 0.23}s infinite`,
          }}/>
        ))}
      </div>
    </div>
  );
}

// ─── Desktop shell CSS ────────────────────────────────────────
const CZ_CSS = `
  .cz-anim { display: none; }
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
      background: linear-gradient(180deg,#5BB8F5 0%,#89CFED 45%,#C4E8FF 100%);
      display: flex; align-items: center; justify-content: center;
    }
    .cz-anim {
      display: block; position: absolute; inset: 0;
      pointer-events: none; z-index: 1; overflow: hidden;
      contain: layout style paint;
      transform: translateZ(0);
    }
    .cz-inner {
      width: 100%; max-width: 820px;
      height: calc(100dvh - 48px); max-height: 960px;
      border-radius: 24px; overflow: hidden;
      box-shadow: 0 40px 100px rgba(10,31,61,.28), 0 0 0 1px rgba(0,0,0,.07);
      position: relative; display: flex; flex-direction: column;
      z-index: 2;
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
    /* Truck is 400×187 px — center offset = 400/2 = 200px */
    .czTruckOuter { position: absolute; bottom: calc(14.5vh - 19px); left: 0; width: 576px; height: 269px; will-change: transform, opacity; }
    .czTruck-entering { animation: czTruckEnter 2.5s cubic-bezier(.2,.65,.35,1) forwards; }
    @keyframes czTruckEnter {
      from { transform: translateX(-680px); opacity: 0; }
      8%   { opacity: 1; }
      to   { transform: translateX(calc(50vw - 288px)); opacity: 1; }
    }
    .czTruck-parked {
      transform: translateX(calc(50vw - 288px));
      animation: czTruckBob 3s ease-in-out 0.5s infinite;
    }
    @keyframes czTruckBob {
      0%,100% { transform: translateX(calc(50vw - 288px)) translateY(0); }
      50%      { transform: translateX(calc(50vw - 288px)) translateY(-4px); }
    }
    .czTruck-loading {
      transform: translateX(calc(50vw - 288px));
      animation: czTruckRev 0.2s ease-in-out infinite;
    }
    @keyframes czTruckRev {
      0%,100% { transform: translateX(calc(50vw - 288px)) translateY(0); }
      50%      { transform: translateX(calc(50vw - 288px)) translateY(-6px); }
    }
    .czTruck-departing { animation: czTruckDepart 1.9s cubic-bezier(.45,0,1,.55) forwards; }
    @keyframes czTruckDepart {
      from { transform: translateX(calc(50vw - 288px)); opacity: 1; }
      82%  { opacity: 1; }
      to   { transform: translateX(140vw); opacity: 0; }
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .czTruck-entering, .czTruck-departing {
      animation: none !important;
      transform: translateX(calc(50vw - 288px)) !important;
      opacity: 1 !important;
    }
    .czTruck-loading, .czTruck-parked {
      animation: none !important;
    }
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
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── MAIN ─────────────────────────────────────────────────────
export default function CotizadorView() {
  const [state, setState]           = useState(INIT);
  const [calculating, setCalc]      = useState(false);
  const [saving, setSaving]         = useState(false);
  const [truckPhase, setTruckPhase] = useState('entering');
  const [frameHidden, setFrameHidden] = useState(false);
  const frameRef = useRef(null);

  // step → pageTracker level (1=landing, 9=submit handled separately)
  const STEP_DB_LEVEL = { 1: 2, 2: 3, 3: 4, 5: 7 };

  useEffect(() => {
    initMetaPixel();
    trackStep(0);
    _trackLandingDB();
    const t = setTimeout(() => setTruckPhase('parked'), 2600);
    return () => clearTimeout(t);
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

      const isManualReview = res.needsManualReview || res.price > 400000;
      if (isManualReview) {
        setState(s => ({ ...s, result: res, manualReview: true, step: 5 }));
        trackStep(5);
        _trackEventDB(7); // llegó al formulario de contacto (revisión manual salta la pantalla de precio)
      } else {
        setState(s => ({ ...s, result: res, manualReview: false, step: 4 }));
        trackStep(4);
        _trackEventDB(6, res.detectedType);
      }
    } catch {
      setState(s => ({ ...s, step: 3 }));
    } finally {
      setCalc(false);
    }
  };

  const submitContact = async (name, phone, email) => {
    setSaving(true);
    const { from, to, extras, freeText, inventory, distanceKm, result, manualReview } = state;
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
        numHelpers: state.selectedHelpers ?? result?.recommendedHelpers ?? 0,
        numFloors: extras.floors,
        needsPacking: extras.packing,
        itemsDescription: itemsDesc,
        priceMin: manualReview ? null : (result?.priceMin || null),
        priceMax: manualReview ? null : (result?.priceMax || null),
        clientNotes: `Cotizador 2.0 | ${result?.vehicleName || ''}${manualReview ? ' | REVISIÓN MANUAL — mudanza grande' : ''}`,
      });
      trackMetaEvent('Lead', { content_name: 'Cotizador 2.0', value: result?.price });
      _trackSubmitDB(result?.detectedType || 'flete_mudanza');
    } catch { /* non-blocking */ }

    if (typeof window !== 'undefined' && window.innerWidth >= 640) {
      // Hide the phone frame so the animation is fully visible
      setFrameHidden(true);
      setTruckPhase('loading');
      await sleep(1100);
      setTruckPhase('departing');
      await sleep(1900);
    }

    setSaving(false);
    setState(s => ({ ...s, step: 6 }));
    setFrameHidden(false);
    trackStep(6);
  };

  const restart = () => setState(INIT);

  const triggerTruckTest = async () => {
    // Inject mock data so ScreenSuccess renders correctly
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
    // Camión ya estaba estacionado — saltar directo a carga
    setTruckPhase('parked');
    setFrameHidden(false);
    await sleep(350);
    // Ocultar formulario y cargar cajas
    setFrameHidden(true);
    setTruckPhase('loading');
    await sleep(1300);
    // Camión parte con humo
    setTruckPhase('departing');
    await sleep(2000);
    // Mostrar pantalla de éxito
    setState(s => ({ ...s, step: 6 }));
    setFrameHidden(false);
  };

  const screen = calculating ? <ScreenCalculating/> : (() => {
    switch (state.step) {
      case 0: return <ScreenWelcome onStart={() => go(1)}/>;
      case 1: return <ScreenAddresses state={state} setState={setState} onNext={() => go(2)} onBack={() => go(0)}/>;
      case 2: return <ScreenItems state={state} setState={setState}
        onNext={() => {
          const invArr = Object.keys(state.inventory)
            .filter(id => state.inventory[id] > 0)
            .map(id => ({ id, qty: state.inventory[id] }));
          const vol = totalVol(invArr); // m3 totales seleccionados
          if (vol > 30) {
            setState(s => ({ ...s, manualReview: true, step: 5 }));
            trackStep(5); _trackEventDB(7);
            frameRef.current?.scrollTo?.({ top: 0 });
          } else {
            setState(s => ({ ...s, manualReview: false }));
            go(3);
          }
        }}
        onBack={() => go(1)}/>;
      case 3: return <ScreenExtras state={state} setState={setState} onNext={calculate} onBack={() => go(2)}/>;
      case 4: return <ScreenResult state={state} onRestart={restart} onBack={() => go(3)} onNext={h => { setState(s => ({...s, selectedHelpers: h})); go(5); }}/>;
      case 5: return <ScreenContact state={state} onBack={() => go(state.manualReview ? 2 : 4)} onSubmit={submitContact} saving={saving}/>;
      case 6: return <ScreenSuccess state={state} onRestart={restart}/>;
      default: return <ScreenWelcome onStart={() => go(1)}/>;
    }
  })();

  return (
    <>
      <style>{CZ_CSS}</style>
      <div className="cz-outer">
        <div className="cz-anim">
          <SceneStatic/>
          <TruckAnim phase={truckPhase}/>
        </div>
        {import.meta.env.DEV && (
          <button type="button" className="czTestBtn" onClick={triggerTruckTest}>🚚 Probar animación</button>
        )}
        <div className="cz-inner" ref={frameRef} style={{
          opacity: frameHidden ? 0 : 1,
          transform: frameHidden ? 'scale(0.96)' : 'scale(1)',
          transition: frameHidden
            ? 'opacity 0.38s ease, transform 0.38s ease'
            : 'opacity 0.45s ease 0.1s, transform 0.45s ease 0.1s',
          pointerEvents: frameHidden ? 'none' : 'auto',
        }}>
          {screen}
        </div>
      </div>
    </>
  );
}
