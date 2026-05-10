import React, { useState, useMemo, useEffect } from 'react';
import { api } from '../../api/index.js';
import AddressAutocomplete from '../../components/AddressAutocomplete.jsx';
import InventoryPicker, { CATALOG, totalVol, recommendVehicleType, serializeInventory, VEHICLE_THRESHOLDS, inventoryHasTallItems } from '../../components/InventoryPicker.jsx';

const LARGE_ITEM_IDS = new Set(['camaQueen', 'cama2p', 'sofa3p', 'sofa2p', 'closet', 'nevera', 'lavadora', 'cocina']);

const BOXES = Array.from({ length: 8 });
const TRUCK_LOAD_ORDER = [7, 6, 5, 4, 3, 2, 1, 0];

// Ítems altos/voluminosos que requieren camión 3/4
// ── Flete m³ pricing ──────────────────────────────────────────────────────────
const FLETE_BASE_PRICE   = 35_000; // tarifa base (primeros 3 m³)
const FLETE_BASE_VOL     = 3;      // m³ incluidos en tarifa base
const FLETE_EXTRA_M3     = 16_000; // por cada m³ adicional
const FLETE_FLOOR_COST   = 6_000;  // por piso sin ascensor
const FLETE_DRIVER_HELP  = 10_000; // ayuda del chofer
const FLETE_HELPER_COST  = 15_000; // por ayudante adicional
const FLETE_PACKING_COST = 22_000; // embalaje profesional
const fmt = n => Number(n || 0).toLocaleString('es-CL');
const makeRange = (exact) => ({
  exact,
  lo: Math.round(exact * 0.88 / 1000) * 1000,
  hi: Math.round(exact * 1.15 / 1000) * 1000,
});

function tierPricePerKm(kmTiers = [], distanceKm = 0) {
  const tiers = (kmTiers || []).slice().sort((a, b) => Number(a.max_km) - Number(b.max_km));
  const tier = tiers.find(t => Number(distanceKm) <= Number(t.max_km)) || tiers[tiers.length - 1];
  return tier ? Number(tier.price_per_km || tier.pricePerKm || 0) : 0;
}

function roundToThousand(n) {
  return Math.round(Number(n || 0) / 1000) * 1000;
}

const STEP_TITLES = {
  flete:      ['Tipo de servicio', '¿De dónde a dónde?', '¿Qué llevas?',   'Tus datos'],
  mudanza:    ['Tipo de servicio', '¿De dónde a dónde?', '¿Qué llevas?',   'Tus datos'],
  paqueteria: ['Tipo de servicio', 'Datos de contacto'],
};

// ── SVG icons ─────────────────────────────────────────────────────────────────

const IconTruck = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="3" width="15" height="13" rx="1.5"/>
    <path d="M16 8h4l3 5v4H16z"/>
    <circle cx="5.5" cy="18.5" r="2.5"/>
    <circle cx="18.5" cy="18.5" r="2.5"/>
  </svg>
);

const IconHouse = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1z"/>
    <polyline points="9,21 9,13 15,13 15,21"/>
  </svg>
);

const IconPackage = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
    <line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
);

const IconChevron = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6"/>
  </svg>
);

// ── Service cards config ───────────────────────────────────────────────────────

const SERVICES = [
  {
    v: 'flete',
    icon: <IconTruck />,
    label: 'Flete',
    sub: 'Traslado de objetos o carga entre dos puntos',
    grad: ['#0052FF', '#00DAFF'],
  },
  {
    v: 'mudanza',
    icon: <IconHouse />,
    label: 'Mudanza',
    sub: 'Cambio de residencia o traslado completo de hogar',
    grad: ['#7C3AED', '#A78BFA'],
  },
  {
    v: 'paqueteria',
    icon: <IconPackage />,
    label: 'Paquetería',
    sub: 'Envíos y mensajería regular para tu empresa',
    grad: ['#059669', '#34D399'],
  },
];

// ── Main component ─────────────────────────────────────────────────────────────

export default function LandingView() {
  const [step,        setStep]        = useState(1);
  const [serviceType, setServiceType] = useState('');

  // Paquetería
  const [clientCompany, setClientCompany] = useState('');

  // Flete/Mudanza – addresses
  const [origin,          setOrigin]          = useState({ address: '', lat: null, lng: null });
  const [dest,            setDest]            = useState({ address: '', lat: null, lng: null });
  const [distanceKm,      setDistanceKm]      = useState(null);
  const [durationMin,     setDurationMin]     = useState(null);
  const [loadingDist,     setLoadingDist]     = useState(false);

  // Vehicle (fetched from API alongside distance, shown in step 3)
  const [vehicles,        setVehicles]        = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [vehicleConfigs,  setVehicleConfigs]  = useState([]);

  // Extras
  const [helpMode,        setHelpMode]        = useState('none'); // 'none' | 'driver' | 'helpers'
  const [helpModeManual,  setHelpModeManual]  = useState(false);
  const [numHelpers,      setNumHelpers]      = useState(1);
  const [numFloors,       setNumFloors]       = useState(0);
  const [needsPacking,    setNeedsPacking]    = useState(false);
  const [isConserjeria,   setIsConserjeria]   = useState(false);
  const [inventory,       setInventory]       = useState([]);
  const [inventoryExtras, setInventoryExtras] = useState('');

  // Contact
  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone,  setContactPhone]  = useState('');
  const [contactEmail,  setContactEmail]  = useState('');
  const [deliveryDate,  setDeliveryDate]  = useState(() => new Date().toISOString().split('T')[0]);
  const [deliveryTime,  setDeliveryTime]  = useState('');
  const [clientNotes,   setClientNotes]   = useState('');
  const [isUrgent,      setIsUrgent]      = useState(false);

  // UI
  const [submitting, setSubmitting] = useState(false);
  const [formGone,    setFormGone]    = useState(false); // form faded + boxes flew
  const [departed,    setDeparted]    = useState(false); // truck driving away
  const [success,     setSuccess]     = useState(null);
  const [animatedLoad, setAnimatedLoad] = useState([]);  // truck boxes filled one by one
  const [blurReady,   setBlurReady]   = useState(false); // blur + form appear after truck arrives
  const [error,      setError]      = useState('');
  const [priceRange, setPriceRange] = useState(null);

  const isFlete  = serviceType === 'flete' || serviceType === 'mudanza';
  const addressesVerified = !isFlete || Boolean(origin.lat && dest.lat);
  const maxSteps = serviceType === 'paqueteria' ? 2 : 4;
  const isLastStep = (step === 4 && isFlete) || (step === 2 && serviceType === 'paqueteria');

  const stepTitle = serviceType ? (STEP_TITLES[serviceType]?.[step - 1] ?? '') : '';

  useEffect(() => {
    api.getPublicVehicleConfigs()
      .then(cfgs => setVehicleConfigs(Array.isArray(cfgs) ? cfgs : []))
      .catch(() => setVehicleConfigs([]));
  }, []);

  // ── Navigation ──────────────────────────────────────────────────────────────

  const canGoNext = () => {
    if (step === 2 && isFlete) return !!(origin.address && dest.address);
    return true;
  };

  const goNext = async () => {
    if (!canGoNext() || step >= maxSteps) return;
    // Precio m³ al pasar de step 3 → 4
    if (step === 3 && isFlete) {
      const vol2 = totalVol(inventory);
      const finalExact = Math.max(fleteExact, vehicleBasePrice);
      setPriceRange({ exact: finalExact, lo: finalExact, hi: finalExact });
      // Recomendación de vehículo (solo si hay distancia calculada)
      if (distanceKm) {
        try {
          const { vehicles: vs } = await api.getQuoteEstimate({
            serviceType, distanceKm, numHelpers: helpMode === 'helpers' ? numHelpers : 0,
            driverHelps: helpMode !== 'none', numFloors, needsPacking,
          });
          if (vs?.length) {
            const recType = vol2 > 0 ? recommendVehicleType(vol2, inventory) : null;
            const rec = (recType && vs.find(v => v.vehicleType === recType)) || vs[0];
            if (rec) setSelectedVehicle(rec);
          }
        } catch {}
      }
    }
    setStep(s => s + 1);
  };
  const goBack = () => setStep(s => Math.max(1, s - 1));

  const resetQuoteFlow = () => {
    setStep(1);
    setServiceType('');
    setSuccess(null);
    setFormGone(false);
    setDeparted(false);
    setOrigin({ address: '', lat: null, lng: null });
    setDest({ address: '', lat: null, lng: null });
    setDistanceKm(null);
    setDurationMin(null);
    setLoadingDist(false);
    setVehicles([]);
    setSelectedVehicle(null);
    setHelpMode('none');
    setHelpModeManual(false);
    setNumHelpers(1);
    setNumFloors(0);
    setNeedsPacking(false);
    setIsConserjeria(false);
    setInventory([]);
    setInventoryExtras('');
    setContactPerson('');
    setContactPhone('');
    setContactEmail('');
    setDeliveryDate(new Date().toISOString().split('T')[0]);
    setDeliveryTime('');
    setClientNotes('');
    setClientCompany('');
    setPriceRange(null);
    setError('');
    setIsUrgent(false);
  };

  const selectServiceType = (v) => {
    resetQuoteFlow();
    setServiceType(v);
    setStep(2);
  };

  // ── Animation progress ──────────────────────────────────────────────────────
  // 0 → truck arrives empty
  // 1 → service selected
  // 3 → both addresses filled (+2)
  // 4 → any inventory item added (+1)
  // 5 → help mode selected (+1)
  // 8 → name + phone filled (remaining)

  const sceneCount = useMemo(() => {
    if (formGone || isLastStep) return 8;
    if (!serviceType) return 0;
    let n = 1; // service selected
    if (serviceType === 'paqueteria') {
      if (clientCompany.trim())                        n += 2;
      if (contactPerson.trim())                        n += 2;
      if (contactPhone.trim())                         n  = 8;
    } else {
      if (origin.address && dest.address)              n += 2; // ambas direcciones → +2
      if (inventory.some(i => i.qty > 0))              n += 1; // algún ítem → +1
      if (helpMode !== 'none')                         n += 1; // modo de entrega → +1
      if (contactPerson.trim()) n += 1; // nombre → +1
      if (contactPhone.trim())  n  = 8; // teléfono → completa todo
    }
    return Math.min(n, 8);
  }, [serviceType, formGone, isLastStep, clientCompany, contactPerson, contactPhone,
      origin, dest, inventory, helpMode]);

  const loadedTruck = TRUCK_LOAD_ORDER.slice(0, sceneCount);

  // ── Live m³ price (flete/mudanza) ──────────────────────────────────────────
  const invVol       = totalVol(inventory);
  const extraVol     = Math.max(0, invVol - FLETE_BASE_VOL);
  const hasTallItems = inventoryHasTallItems(inventory);
  const smartVehicleType = invVol > 0 ? recommendVehicleType(invVol, inventory) : 'furgon';
  const vehicleLabel = VEHICLE_THRESHOLDS.find(t => t.vehicleType === smartVehicleType);
  const configServiceType = serviceType === 'mudanza' ? 'mudanza' : 'flete';
  const activeVehicleConfig =
    vehicleConfigs.find(c => c.vehicleType === smartVehicleType && (c.serviceType || 'flete') === configServiceType) ||
    vehicleConfigs.find(c => c.vehicleType === smartVehicleType);
  const vehicleBasePrice = Number(activeVehicleConfig?.basePrice ?? FLETE_BASE_PRICE);
  const vehicleKmPrice = tierPricePerKm(activeVehicleConfig?.kmTiers || [], distanceKm || 0);
  const distanceCost = distanceKm ? roundToThousand(distanceKm * vehicleKmPrice) : 0;
  const cfgExtras = activeVehicleConfig?.extras || {};
  const driverHelpPrice = Number(cfgExtras.driver_help ?? FLETE_DRIVER_HELP);
  const helperUnitPrice = Number(cfgExtras.helper ?? FLETE_HELPER_COST);
  const floorUnitPrice = Number(cfgExtras.floor ?? FLETE_FLOOR_COST);
  const packingPrice = Number(cfgExtras.packing ?? FLETE_PACKING_COST);
  const extraM3Price = Number(cfgExtras.extra_m3 ?? FLETE_EXTRA_M3);
  // Ayudante sugerido: vol>6 o ítems pesados → chofer+ayudante, vol>2 → solo chofer
  const suggestHelperMode = invVol > 6 || hasTallItems ? 'helpers' : invVol > 2 ? 'driver' : 'none';
  // Costos extras
  const floorCost    = numFloors * floorUnitPrice;
  const helpCost     = helpMode === 'driver'  ? driverHelpPrice
                     : helpMode === 'helpers' ? driverHelpPrice + numHelpers * helperUnitPrice
                     : 0;
  const packCost     = needsPacking ? packingPrice : 0;
  const extraVolCost = serviceType === 'mudanza' ? 0 : roundToThousand(extraVol * extraM3Price);
  const fleteExact   = roundToThousand(vehicleBasePrice + distanceCost + extraVolCost + floorCost + helpCost + packCost);

  const status = useMemo(() => {
    if (!serviceType)    return ['¿Listo para mover?', 'Elige el tipo de servicio que necesitas para comenzar tu cotización.'];
    if (serviceType === 'paqueteria') {
      if (sceneCount < 3) return ['Datos de tu empresa', 'Ingresa el nombre de tu empresa y la persona de contacto.'];
      if (sceneCount < 6) return ['Casi listo', 'Agrega tu teléfono para que podamos contactarte.'];
      return ['¡Listo!', 'Revisa los datos y envía tu cotización.'];
    }
    if (step === 2) return ['¿De dónde a dónde?', 'Ingresa la dirección de retiro y la dirección de entrega. Usamos GPS para calcular la distancia exacta.'];
    if (step === 3) return ['¿Qué llevas?', 'Selecciona artículos, servicio de carga y adicionales. Abajo verás el precio calculado.'];
    if (step === 4) return ['Tus datos', 'Ingresa tu nombre y teléfono para enviar esta cotización al administrador.'];
    return ['Camión cargado y listo', '¡Perfecto! Revisa el resumen y envía tu cotización. Te contactaremos a la brevedad.'];
  }, [sceneCount, serviceType, step]);

  // ── Distance (auto-triggers when both addresses geocoded) ───────────────────

  const calculateDistance = async () => {
    if (!origin.lat || !dest.lat) return;
    setLoadingDist(true);
    setError('');
    try {
      const { distanceKm: km, durationMin: min } = await api.calculateDistance({
        originLat: origin.lat, originLng: origin.lng,
        destLat: dest.lat,     destLng: dest.lng,
      });
      setDistanceKm(km);
      setDurationMin(min);
      if (km) {
        const { vehicles: vs } = await api.getQuoteEstimate({ serviceType, distanceKm: km, numHelpers: 0, numFloors: 0, needsPacking: false });
        setVehicles(vs || []);
        if (vs?.length) {
          setSelectedVehicle(vs[0]);
        }
      }
    } catch {
      setError('No se pudo calcular la distancia. Puedes continuar sin ella.');
    } finally {
      setLoadingDist(false);
    }
  };

  // Auto-trigger distance when both addresses geocoded
  useEffect(() => {
    if (origin.lat && dest.lat && !distanceKm && !loadingDist) {
      calculateDistance();
    }
  }, [origin.lat, dest.lat]);

  // Detect large/heavy items that require help
  const hasLargeItems = useMemo(() => {
    return inventory.some(item => LARGE_ITEM_IDS.has(item.id) && item.qty > 0);
  }, [inventory]);

  useEffect(() => {
    if (helpModeManual) return;
    setHelpMode(invVol > 0 ? suggestHelperMode : 'none');
    if (suggestHelperMode === 'helpers') setNumHelpers(n => Math.max(1, n));
  }, [invVol, suggestHelperMode, helpModeManual]);

  // Auto-recommend vehicle from inventory (no price shown yet)
  useEffect(() => {
    if (!vehicles.length) return;
    const vol = totalVol(inventory);
    if (vol === 0) return;
    const recType = recommendVehicleType(vol, inventory);
    const rec = vehicles.find(v => v.vehicleType === recType) || vehicles[0];
    if (rec) { setSelectedVehicle(rec); }
  }, [inventory, vehicles]);

  // Sync truck boxes with form progress during normal filling
  useEffect(() => {
    if (!formGone) setAnimatedLoad(loadedTruck);
  }, [loadedTruck]);

  // When form submitted: load boxes into truck one by one with 300ms stagger
  useEffect(() => {
    if (!formGone) return;
    setAnimatedLoad([]); // clear truck first so boxes "fly in"
    const timers = TRUCK_LOAD_ORDER.map((boxIdx, order) =>
      setTimeout(() => setAnimatedLoad(prev => [...prev, boxIdx]),
                 950 + order * 300) // 950ms = fly duration, 300ms stagger
    );
    return () => timers.forEach(clearTimeout);
  }, [formGone]);

  // Reveal blur + form only after truck finishes arriving (1.7s matches muveTruckIn duration)
  useEffect(() => {
    const t = window.setTimeout(() => setBlurReady(true), 1700);
    return () => clearTimeout(t);
  }, []);


  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!serviceType)                                           return setError('Selecciona el tipo de servicio.');
    if (!contactPerson.trim() || !contactPhone.trim())         return setError('Nombre y teléfono son obligatorios.');
    if (serviceType === 'paqueteria' && !clientCompany.trim()) return setError('Ingresa el nombre de tu empresa.');
    if (isFlete && (!origin.address || !dest.address))         return setError('Ingresa las direcciones de origen y destino.');

    setSubmitting(true);
    try {
      const finalFletePrice = Math.max(fleteExact, vehicleBasePrice);
      const quote = await api.createPublicQuote({
        serviceType, clientCompany,
        originAddress: origin.address,      originCoords: origin.lat ? { lat: origin.lat, lng: origin.lng } : null,
        destinationAddress: dest.address,   destinationCoords: dest.lat ? { lat: dest.lat, lng: dest.lng } : null,
        distanceKm: distanceKm || null,
        vehicleType: isFlete ? smartVehicleType : (selectedVehicle?.vehicleType || ''),
        driverHelps: helpMode !== 'none',
        numHelpers: helpMode === 'helpers' ? numHelpers : 0,
        numFloors, needsPacking, isConserjeria,
        itemsDescription: serializeInventory(inventory, inventoryExtras),
        priceMin: isFlete ? (addressesVerified ? finalFletePrice : null) : (priceRange?.lo || null),
        priceMax: isFlete ? (addressesVerified ? finalFletePrice : null) : (priceRange?.hi || null),
        contactPerson, contactPhone, contactEmail, deliveryDate, deliveryTime,
        clientNotes: isUrgent ? `🚨 URGENTE - SERVICIO INMEDIATO 🚨\n${clientNotes}`.trim() : clientNotes,
        urgent: isUrgent,
      });
      setFormGone(true);                                        // form desaparece + cajitas vuelan
      window.setTimeout(() => setDeparted(true), 4200);        // camión sale cuando ya cargó todo
      window.setTimeout(() => setSuccess(quote), 6200);        // mensaje tras camión en marcha
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <main className="muve-landing">

      {/* ── ANIMATION PANEL ──────────────────────────────────────────────── */}
      <section className={`scene-panel${blurReady && !formGone ? ' settled' : ''}`} aria-label="Animación de carga MUVE">
        <div className="skyline">
          {/* Far-background buildings */}
          <div className="building bld-far bld-f1"/><div className="building bld-far bld-f2"/><div className="building bld-far bld-f3"/>
          {/* Main skyline */}
          <div className="building bld-1"/><div className="building bld-2"/><div className="building bld-3"/>
          <div className="building bld-4"/><div className="building bld-5"/>
          <div className="building bld-6"/><div className="building bld-7"/>
          {/* Trees */}
          <div className="tree t1"/><div className="tree t2"/><div className="tree t3"/><div className="tree t4"/>
          {/* Street lamps */}
          <div className="lamp-post lp1"/><div className="lamp-post lp2"/><div className="lamp-post lp3"/>
        </div>
        <div className="road-surface"/>
        <div className="curb-strip"/>
        <div className="garden-strip"/>
        {/* Traffic cones — safety zone around the loading area */}
        <div className="tcone tc1"/><div className="tcone tc2"/><div className="tcone tc3"/>
        <div className="tcone tc4"/><div className="tcone tc5"/><div className="tcone tc6"/>
        <div className={`truck-stage ${departed ? 'depart' : ''}`}>
          <svg className="truck" viewBox="0 0 900 420" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="430" cy="379" rx="365" ry="18" fill="#94A3B8" opacity="0.24"/>
            <rect x="62" y="88" width="510" height="240" rx="18" fill="#FFFFFF" stroke="#D7E2F0" strokeWidth="4"/>
            <rect x="62" y="88" width="510" height="24" rx="18" fill="url(#muveGrad)"/>
            <rect x="88" y="124" width="222" height="180" rx="14" fill="#F8FBFF" stroke="#E2E8F0" strokeWidth="3"/>
            <rect x="325" y="124" width="222" height="180" rx="14" fill="#F8FBFF" stroke="#E2E8F0" strokeWidth="3"/>
            <line x1="318" y1="124" x2="318" y2="304" stroke="#CBD5E1" strokeWidth="3"/>
            <circle cx="300" cy="216" r="5" fill="#CBD5E1"/><circle cx="342" cy="216" r="5" fill="#CBD5E1"/>
            <text x="318" y="226" textAnchor="middle" fontFamily="Montserrat,sans-serif" fontWeight="900" fontSize="46" fill="#0052FF" opacity=".1">MUVE</text>
            <path d="M572 157 L720 157 C740 157 754 168 762 185 L803 265 L803 328 L572 328 Z" fill="#0F172A"/>
            <path d="M603 177 L707 177 C720 177 729 185 734 197 L753 240 L603 240 Z" fill="#DFF7FF" stroke="#A7DDF0" strokeWidth="3"/>
            <line x1="712" y1="241" x2="712" y2="327" stroke="#26364D" strokeWidth="3"/>
            <rect x="730" y="271" width="28" height="9" rx="4" fill="#334155"/>
            <rect x="784" y="282" width="22" height="25" rx="7" fill="#00DAFF"/>
            <rect x="800" y="315" width="35" height="18" rx="7" fill="#1E293B"/>
            <rect x="554" y="295" width="30" height="33" rx="8" fill="#334155"/>
            <circle cx="166" cy="330" r="42" fill="#1E293B"/><circle cx="166" cy="330" r="19" fill="#64748B"/><circle cx="166" cy="330" r="7" fill="#CBD5E1"/>
            <circle cx="420" cy="330" r="42" fill="#1E293B"/><circle cx="420" cy="330" r="19" fill="#64748B"/><circle cx="420" cy="330" r="7" fill="#CBD5E1"/>
            <circle cx="715" cy="330" r="42" fill="#1E293B"/><circle cx="715" cy="330" r="19" fill="#64748B"/><circle cx="715" cy="330" r="7" fill="#CBD5E1"/>
            <path d="M124 292 A42 42 0 0 1 208 292" stroke="#E2E8F0" strokeWidth="4"/>
            <path d="M378 292 A42 42 0 0 1 462 292" stroke="#E2E8F0" strokeWidth="4"/>
            <path d="M673 292 A42 42 0 0 1 757 292" stroke="#1E293B" strokeWidth="4"/>
            <defs>
              <linearGradient id="muveGrad" x1="62" y1="88" x2="572" y2="112" gradientUnits="userSpaceOnUse">
                <stop stopColor="#0052FF"/><stop offset="1" stopColor="#00DAFF"/>
              </linearGradient>
            </defs>
          </svg>
          <div className="cab-logo">MUVE</div>
          {/* Exhaust smoke from rear when departing */}
          <div className={`exhaust-wrap ${departed ? 'active' : ''}`}>
            <div className="smoke-puff"/><div className="smoke-puff"/><div className="smoke-puff"/><div className="smoke-puff"/>
          </div>
          <div className="cargo-space">
            {BOXES.map((_, i) => (
              <div key={i} className={`box truck-box ${animatedLoad.includes(i) ? 'show' : ''}`}><span>MUVE</span></div>
            ))}
          </div>
        </div>

        {/* Blur que cubre la escena mientras el formulario está activo */}
        <div className={`scene-blur${blurReady ? ' active' : ''}${formGone ? ' reveal' : ''}`}/>

        <div className={`success ${success ? 'show' : ''}`}>
          <div className="success-box">
            <div className="check">✓</div>
            <h2>¡Cotización enviada!</h2>
            <p>
              {success?.serviceType === 'paqueteria'
                ? 'Recibimos tu solicitud. Te contactaremos a la brevedad.'
                : 'Nos pondremos en contacto contigo a la brevedad para confirmar todos los detalles.'}
            </p>
          </div>
        </div>
      </section>

      {/* ── FLOATING FORM OVERLAY ────────────────────────────────────────── */}
      <div className={`quote-overlay${blurReady ? ' ready' : ''}${formGone ? ' departed' : ''}${step === 3 && isFlete ? ' step-inventory' : ''}`}>

        {/* ── App thought bubble — floats above the white panel ─────────── */}
        {/*
          <div className="app-bubble-wrap" key={success ? '__success__' : status[1]}>
            <div className="app-bubble">
              {success ? '🎉 ¡Listo! Te contactaremos a la brevedad.' : status[1]}
            </div>
            <div className="thought-tail"><span/><span/></div>
          </div>
        */}

        <section className="quote-panel">

        {/* Gradient top bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg,#0052FF,#00DAFF)', zIndex: 2 }} />

        {/* ── Fixed header ──────────────────────────────────────────────── */}
        <div className="q-header">
          <div className="brand-lockup" style={{ marginBottom: 8 }}>
            <img src="/logo.png" alt="MUVE" style={{ width: 46, height: 46, borderRadius: 11, objectFit: 'contain', background: 'linear-gradient(135deg,#0052FF,#00DAFF)', padding: 5, boxShadow: '0 8px 20px #0052ff33', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="brand-name">MUVE</div>
              <div className="brand-caption">Fácil, rápido y online</div>
            </div>
            {step > 1 && !success && (
              <button type="button" className="quote-home-btn" onClick={resetQuoteFlow}>
                Inicio
              </button>
            )}
          </div>

          {/* Always rendered — keeps header height stable across all steps */}
          <div style={{ height: 6, background: '#EEF2FF', borderRadius: 99, overflow: 'hidden', visibility: (step > 1 && serviceType) ? 'visible' : 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 99,
              width: success ? '100%' : `${Math.round(((step - 1) / Math.max(maxSteps - 1, 1)) * 100)}%`,
              background: success ? 'linear-gradient(90deg,#22c55e,#16a34a)' : 'linear-gradient(90deg,#0052FF,#00DAFF)',
              transition: 'width .35s cubic-bezier(.4,0,.2,1)',
            }}/>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, minHeight: 18, visibility: (step > 1 && serviceType) ? 'visible' : 'hidden' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: success ? '#15803d' : 'var(--accent)' }}>
              {success ? '✅ Enviado' : stepTitle}
            </span>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>
              {success ? '' : `Paso ${step}/${maxSteps}`}
            </span>
          </div>

          {/* Volume bar — static in header, only visible in step 3 with items */}
          {(() => {
            const vol = totalVol(inventory);
            if (step !== 3 || !isFlete) return null;
            const volPct = Math.min((vol / 18) * 100, 100);
            const recType = vol > 0 ? recommendVehicleType(vol, inventory) : 'furgon';
            const rec = VEHICLE_THRESHOLDS.find(t => t.vehicleType === recType) || VEHICLE_THRESHOLDS[0];
            return (
              <div style={{ marginTop: 10, background: '#f4f7ff', border: '1px solid #0052FF20', borderRadius: 10, padding: '8px 12px', visibility: vol > 0 ? 'visible' : 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 15 }}>{rec.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)' }}>Camión sugerido: {rec.name}</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>{vol.toFixed(1)} m³</span>
                </div>
                <div style={{ background: '#dbeafe', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${volPct}%`, height: '100%', borderRadius: 4, transition: 'width .3s ease',
                    background: vol > 18 ? '#cc2244' : vol > 7 ? '#f59e0b' : '#0052FF' }} />
                </div>
              </div>
            );
          })()}
        </div>

        {/* ── Scrollable step body ───────────────────────────────────────── */}
        <div className="q-body quote-form">
          {blurReady && !success && (
            <div className="form-guide-message" key={status[1]}>
              <span className="form-guide-dot" />
              <span>
                <strong>{status[0]}</strong>
                {status[1]}
              </span>
            </div>
          )}

          {/* ── STEP 1: Choose service ──────────────────────────────────── */}
          {step === 1 && (
            <div>
              <h1 style={{ marginBottom: 8 }}>Cotiza tu traslado</h1>
              <p className="lead">Fletes, mudanzas y paquetería — cotiza online en minutos.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 6 }}>
                {SERVICES.map(({ v, icon, label, sub, grad }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => selectServiceType(v)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 16,
                      padding: '16px 18px', borderRadius: 16,
                      border: '1.5px solid #E2E8F0', background: '#fff',
                      cursor: 'pointer', textAlign: 'left',
                      boxShadow: '0 2px 12px #0000000a',
                      transition: 'border-color .18s, box-shadow .18s, transform .12s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = grad[0];
                      e.currentTarget.style.boxShadow = `0 6px 24px ${grad[0]}18`;
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = '#E2E8F0';
                      e.currentTarget.style.boxShadow = '0 2px 12px #0000000a';
                      e.currentTarget.style.transform = 'none';
                    }}
                  >
                    <div style={{
                      width: 50, height: 50, borderRadius: 14, flexShrink: 0,
                      background: `linear-gradient(135deg, ${grad[0]}, ${grad[1]})`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: `0 8px 20px ${grad[0]}30`,
                    }}>
                      {icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: '#0F172A', marginBottom: 3 }}>{label}</div>
                      <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.45 }}>{sub}</div>
                    </div>
                    <IconChevron />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 2 – Flete: Addresses + auto distance ──────────────── */}
          {step === 2 && isFlete && (
            <div className="address-step">
              <div className="address-grid">
              <label>
                Dirección de retiro *
                <span className={`inline-field-note${origin.address && !origin.lat ? ' show' : ''}`}>Selecciona una sugerencia</span>
                <AddressAutocomplete
                  value={origin.address}
                  onChange={v => { setOrigin({ address: v, lat: null, lng: null }); setDistanceKm(null); setVehicles([]); setError(''); }}
                  onSelect={({ address, lat, lng }) => setOrigin({ address, lat, lng })}
                  placeholder="Av. Vitacura 2939, Las Condes…"
                  dropdownFixed
                />
                <span className={`field-status${origin.lat ? '' : ' is-hidden'}`} style={{ color: 'var(--accent)' }}>✓ Ubicado en el mapa</span>
              </label>

              <label>
                Dirección de entrega *
                <span className={`inline-field-note${dest.address && !dest.lat ? ' show' : ''}`}>Selecciona una sugerencia</span>
                <AddressAutocomplete
                  value={dest.address}
                  onChange={v => { setDest({ address: v, lat: null, lng: null }); setDistanceKm(null); setVehicles([]); setError(''); }}
                  onSelect={({ address, lat, lng }) => setDest({ address, lat, lng })}
                  placeholder="Calle Ahumada 100, Santiago…"
                  dropdownFixed
                />
                <span className={`field-status${dest.lat ? '' : ' is-hidden'}`} style={{ color: 'var(--accent)' }}>✓ Ubicado en el mapa</span>
              </label>
              </div>

              <p className={`form-guidance-slot${(!origin.lat && origin.address) || (!dest.lat && dest.address && origin.lat) ? '' : ' is-hidden'}`}>
                {!origin.lat && origin.address
                  ? 'Selecciona una sugerencia de la lista para ubicar el origen'
                  : 'Selecciona una sugerencia para ubicar el destino'}
              </p>

              {/* Distance result (auto-calculated, no price) */}
              {loadingDist && (
                <div style={{ textAlign: 'center', padding: '12px', color: 'var(--muted)', fontSize: 13, background: '#f8fbff', borderRadius: 12, border: '1px solid var(--border)' }}>
                  ⏳ Calculando distancia…
                </div>
              )}
              {distanceKm && !loadingDist && (
                <div style={{ background: '#f4f7ff', border: '1px solid #0052FF20', borderRadius: 14, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>
                    Distancia calculada
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 24, fontWeight: 900, color: 'var(--accent)' }}>{distanceKm} km</span>
                    {durationMin && <span style={{ fontSize: 13, color: '#64748b' }}>· ~{durationMin} min en camión</span>}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                    El precio depende de lo que llevas — lo verás al final
                  </div>
                </div>
              )}

              {/* Error de cálculo — aparece junto a las direcciones */}
              {error && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#fff7f7', border: '1.5px solid #fca5a5', borderRadius: 12, padding: '10px 14px' }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
                  <span style={{ fontSize: 13, color: '#991b1b', fontWeight: 500, lineHeight: 1.4 }}>{error}</span>
                </div>
              )}

              {/* Date + time preferred */}
              <div style={{ background: isUrgent ? '#fff7ed' : '#f8fbff', border: `1.5px solid ${isUrgent ? '#f97316' : '#E2E8F0'}`, borderRadius: 14, padding: '14px 16px', transition: 'all .2s' }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: '#64748b', textTransform: 'uppercase', marginBottom: 10 }}>
                  ¿Cuándo lo necesitas?
                </div>

                {/* Inmediato button — solo para fletes */}
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    setIsUrgent(u => !u);
                    if (!isUrgent) {
                      setDeliveryDate(now.toISOString().split('T')[0]);
                      setDeliveryTime(now.toTimeString().slice(0, 5));
                    }
                  }}
                  style={{
                    width: '100%', padding: '10px 14px', marginBottom: 12, borderRadius: 10,
                    border: `2px solid ${isUrgent ? '#f97316' : '#E2E8F0'}`,
                    background: isUrgent ? '#f97316' : '#fff',
                    color: isUrgent ? '#fff' : '#64748b',
                    fontSize: 13, fontWeight: 800, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'all .2s',
                  }}
                >
                  <span style={{ fontSize: 16 }}>🚨</span>
                  {isUrgent ? '¡Servicio inmediato seleccionado!' : '¡Lo necesito ahora! — Inmediato'}
                </button>

                {!isUrgent && (
                  <div className="form-grid" style={{ gap: 10 }}>
                    <label style={{ margin: 0 }}>
                      Fecha preferida
                      <input type="date" value={deliveryDate}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={e => setDeliveryDate(e.target.value)} />
                    </label>
                    <label style={{ margin: 0 }}>
                      Hora preferida
                      <input type="time" value={deliveryTime} onChange={e => setDeliveryTime(e.target.value)} />
                    </label>
                  </div>
                )}

                {isUrgent && (
                  <div style={{ fontSize: 12, color: '#ea580c', fontWeight: 600, textAlign: 'center', lineHeight: 1.5 }}>
                    Notificaremos al equipo de inmediato.<br/>
                    <span style={{ fontWeight: 400, color: '#9a3412' }}>Te contactaremos en minutos.</span>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ── STEP 2 – Paquetería ─────────────────────────────────────── */}
          {step === 2 && serviceType === 'paqueteria' && (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label>
                Empresa o negocio *
                <input value={clientCompany} onChange={e => { setClientCompany(e.target.value); setError(''); }} placeholder="Importadora ABC Ltda" />
              </label>
              <div className="form-grid">
                <label>
                  Tu nombre *
                  <input value={contactPerson} onChange={e => { setContactPerson(e.target.value); setError(''); }} placeholder="Nombre y apellido" />
                </label>
                <label>
                  Teléfono *
                  <input type="tel" value={contactPhone} onChange={e => { setContactPhone(e.target.value); setError(''); }} placeholder="+56 9 xxxx xxxx" />
                </label>
              </div>
              <label>
                Notas adicionales
                <textarea value={clientNotes} onChange={e => setClientNotes(e.target.value)} placeholder="Cantidad de envíos, tipo de productos, destinos…" rows={3} />
              </label>
              <div className={`form-error form-error-slot${error ? ' show' : ''}`}>{error || 'Sin errores'}</div>
              <button className="submit-quote" type="submit" disabled={submitting || departed}>
                {submitting ? 'Enviando…' : 'Enviar cotización'}
              </button>
            </form>
          )}

          {/* ── STEP 3 – Inventory + extras ─────────────────────────────── */}
          {step === 3 && isFlete && (
            <div className="s3-wrap">

              {/* ── Left column: what you're moving ─── */}
              <div className="s3-col">

              {/* 1. Large item recommendation banner */}
              {false && hasLargeItems && helpMode === 'none' && (
                <div style={{ background: '#fffbe6', border: '1.5px solid #f59e0b', borderRadius: 12, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 20 }}>💡</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#92400e', marginBottom: 3 }}>Artículos pesados detectados</div>
                    <div style={{ fontSize: 12, color: '#78350f', lineHeight: 1.5 }}>
                      Tienes muebles grandes (nevera, camas, sofás…). Recomendamos al menos <strong>ayuda del chofer + 1 ayudante</strong> para bajar o subir escaleras con seguridad.
                    </div>
                    <button
                      type="button"
                      onClick={() => { setHelpMode('helpers'); setNumHelpers(1); }}
                      style={{ marginTop: 8, padding: '5px 12px', borderRadius: 8, border: 'none', background: '#f59e0b', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Aplicar recomendación
                    </button>
                  </div>
                </div>
              )}

              {/* 2. Vehicle suggestion */}
              {false && vehicleLabel && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#f4f7ff', border: '1px solid #0052FF20', borderRadius: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px' }}>Vehículo sugerido</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent)', marginTop: 2 }}>
                      {vehicleLabel.icon} {vehicleLabel.name}
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: '#94a3b8', textAlign: 'right' }}>Se ajusta según<br/>lo que indiques</div>
                </div>
              )}

              {/* 3. Inventory picker */}
              <div style={{ background: '#f8fbff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 16, boxSizing: 'border-box' }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: '#64748b', textTransform: 'uppercase', marginBottom: 12 }}>
                  ¿Qué vas a transportar?
                </div>
                <InventoryPicker inventory={inventory} onChange={setInventory} extras={inventoryExtras} onExtrasChange={setInventoryExtras} />
              </div>

              </div>

              {/* ── Right column: service options + price ─── */}
              <div className="s3-col">

              {/* 4. Auto-suggestion tip */}
              {false && suggestHelperMode !== 'none' && helpMode === 'none' && invVol > 0 && (
                <div style={{ background: '#fffbe6', border: '1px solid #f59e0b40', borderRadius: 10, padding: '9px 12px', fontSize: 11, color: '#92400e' }}>
                  💡 Con {invVol.toFixed(1)} m³{hasTallItems ? ' y artículos pesados' : ''} te recomendamos{' '}
                  <strong>{suggestHelperMode === 'helpers' ? 'chofer + ayudante' : 'ayuda del chofer'}</strong> para una carga segura.
                </div>
              )}

              {/* 5. Help mode selector */}
              <div style={{ background: '#f8fbff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: '#64748b', textTransform: 'uppercase', marginBottom: 12 }}>
                  Servicio de carga
                </div>
                {[
                  { v: 'none',    title: 'Solo traslado',          desc: 'El chofer solo conduce. Carga y descarga por tu cuenta.' },
                  { v: 'driver',  title: '+ Ayuda del chofer',     desc: `El chofer ayuda a cargar y descargar. +$${fmt(driverHelpPrice)}` },
                  { v: 'helpers', title: '+ Chofer y ayudantes',   desc: `Chofer ayuda + ayudantes adicionales. +$${fmt(driverHelpPrice)} + $${fmt(helperUnitPrice)} c/u` },
                ].map(opt => {
                  const isRecommended = invVol > 0 && suggestHelperMode !== 'none' && opt.v === suggestHelperMode;
                  const isActive = helpMode === opt.v;
                  const recommendedActive = isActive && isRecommended && !helpModeManual;
                  return (
                  <button key={opt.v} type="button" onClick={() => { setHelpModeManual(true); setHelpMode(opt.v); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                      padding: '10px 12px', marginBottom: 8, borderRadius: 10,
                      border: `1.5px solid ${recommendedActive || (isRecommended && !isActive) ? '#f59e0b' : isActive ? 'var(--accent)' : '#E2E8F0'}`,
                      background: recommendedActive ? '#fff7ed' : isActive ? '#EEF4FF' : '#fff',
                      cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
                    }}
                  >
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                      border: `2px solid ${recommendedActive ? '#f59e0b' : isActive ? 'var(--accent)' : '#CBD5E1'}`,
                      background: recommendedActive ? '#f59e0b' : isActive ? 'var(--accent)' : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isActive && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: recommendedActive ? '#b45309' : isActive ? 'var(--accent)' : '#0f172a' }}>
                        {isRecommended && <span style={{ color: '#f59e0b', marginRight: 5 }}>★</span>}{opt.title}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{isRecommended ? `${opt.desc} · Recomendado para lo que llevas` : opt.desc}</div>
                    </div>
                  </button>
                );})}
                {helpMode === 'helpers' && (
                  <div style={{ marginTop: 4, padding: '10px 12px', background: '#EEF4FF', borderRadius: 10, border: '1px solid #0052FF20' }}>
                    <ExtraRow
                      label="Número de ayudantes"
                      sub="Además del chofer"
                      value={numHelpers}
                      onDec={() => setNumHelpers(n => Math.max(1, n - 1))}
                      onInc={() => setNumHelpers(n => n + 1)}
                      onSet={v => setNumHelpers(Math.max(1, Number(v) || 1))}
                    />
                  </div>
                )}
              </div>

              {/* 6. Other extras */}
              <div style={{ background: '#f8fbff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: '#64748b', textTransform: 'uppercase', marginBottom: 12 }}>
                  Otros adicionales
                </div>
                <ExtraRow label="Pisos sin ascensor" sub="Subir o bajar escaleras"
                  value={numFloors} onDec={() => setNumFloors(n => Math.max(0, n - 1))} onInc={() => setNumFloors(n => n + 1)} onSet={v => setNumFloors(Math.max(0, Number(v) || 0))} />
                <CheckRow label="Embalaje profesional" sub="Empacamos todo antes de cargar" checked={needsPacking} onChange={setNeedsPacking} />
                <CheckRow label="Coordinar conserjería" sub="Trámite y aviso en edificio" checked={isConserjeria} onChange={setIsConserjeria} />
              </div>

              {/* 7. Price calculator — at the bottom, no sticky */}
              <div style={{
                background: 'linear-gradient(135deg,#f4f7ff,#e8f0ff)',
                border: '2px solid #0052FF20', borderRadius: 14, padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.5, color: '#64748b', textTransform: 'uppercase', marginBottom: 2 }}>
                      Precio calculado
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--accent)', letterSpacing: '-.5px', lineHeight: 1 }}>
                      ${fmt(Math.max(fleteExact, vehicleBasePrice))}
                    </div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>El precio final se confirma al contactarte</div>
                  </div>
                  {vehicleLabel && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 24 }}>{vehicleLabel.icon}</div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#475569' }}>{vehicleLabel.name}</div>
                      <div style={{ fontSize: 9, color: '#94a3b8' }}>{vehicleLabel.desc}</div>
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: invVol > 0 ? 10 : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700 }}>{invVol.toFixed(1)} m³</span>
                    <span>{invVol === 0 ? 'Agrega artículos para calcular' : `${vehicleLabel?.name || 'Vehículo'} recomendado por volumen`}</span>
                  </div>
                  <div style={{ height: 8, background: '#E2E8F0', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 99,
                      width: `${Math.min(invVol / 18 * 100, 100)}%`,
                      background: invVol > 14 ? '#ef4444' : invVol > 7 ? '#f59e0b' : 'var(--accent)',
                      transition: 'width .5s cubic-bezier(.2,.8,.25,1), background .3s',
                    }} />
                  </div>
                </div>

                {invVol > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, borderTop: '1px solid #0052FF15', paddingTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569' }}>
                      <span>Precio base {vehicleLabel?.name || ''}</span>
                      <span style={{ fontWeight: 700 }}>${fmt(vehicleBasePrice)}</span>
                    </div>
                    {serviceType !== 'mudanza' && extraVol > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569' }}>
                        <span>{extraVol.toFixed(2)} m³ adicionales × ${fmt(extraM3Price)}</span>
                        <span style={{ fontWeight: 700, color: '#f59e0b' }}>+${fmt(extraVolCost)}</span>
                      </div>
                    )}
                    {distanceKm > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569' }}>
                        <span>{distanceKm} km × ${fmt(vehicleKmPrice)}/km</span>
                        <span style={{ fontWeight: 700, color: '#f59e0b' }}>+${fmt(distanceCost)}</span>
                      </div>
                    )}
                    {numFloors > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569' }}>
                        <span>{numFloors} piso{numFloors > 1 ? 's' : ''} sin ascensor</span>
                        <span style={{ fontWeight: 700, color: '#f59e0b' }}>+${fmt(floorCost)}</span>
                      </div>
                    )}
                    {helpMode === 'driver' && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569' }}>
                        <span>Ayuda del chofer</span>
                        <span style={{ fontWeight: 700, color: '#f59e0b' }}>+${fmt(driverHelpPrice)}</span>
                      </div>
                    )}
                    {helpMode === 'helpers' && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569' }}>
                          <span>Ayuda del chofer</span>
                          <span style={{ fontWeight: 700, color: '#f59e0b' }}>+${fmt(driverHelpPrice)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569' }}>
                          <span>{numHelpers} ayudante{numHelpers > 1 ? 's' : ''} × ${fmt(helperUnitPrice)}</span>
                          <span style={{ fontWeight: 700, color: '#f59e0b' }}>+${fmt(numHelpers * helperUnitPrice)}</span>
                        </div>
                      </>
                    )}
                    {needsPacking && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569' }}>
                        <span>Embalaje profesional</span>
                        <span style={{ fontWeight: 700, color: '#f59e0b' }}>+${fmt(packingPrice)}</span>
                      </div>
                    )}
                    {helpMode === 'none' && numFloors === 0 && !needsPacking && extraVolCost === 0 && (
                      <div style={{ fontSize: 10, color: '#22c55e', fontWeight: 700, textAlign: 'center', marginTop: 2 }}>
                        ✓ Sin costos adicionales — dejar en recepción no tiene cargo extra
                      </div>
                    )}
                  </div>
                )}
              </div>

              </div>
            </div>
          )}

          {/* ── STEP 4 – Contact form → after submit: summary ────────────── */}
          {step === 4 && isFlete && (
            success ? (
              /* ── POST-SUBMIT: price + summary, no form fields ─────────── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* Price range card */}
                {priceRange && (
                  <div style={{
                    background: 'linear-gradient(135deg,#f4f7ff,#e8f0ff)',
                    border: '2px solid #0052FF20', borderRadius: 16, padding: '18px 16px',
                    textAlign: 'center', boxShadow: '0 4px 24px #0052FF0a',
                  }}>
                    <div style={{ fontSize: 10, color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                      Precio calculado para tu {serviceType}
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--accent)', letterSpacing: '-.5px', lineHeight: 1 }}>
                      {addressesVerified ? `$${fmt(priceRange.exact || priceRange.lo)}` : 'Sujeto a evaluación'}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 8, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px 10px' }}>
                      {vehicleLabel && <span>{vehicleLabel.icon} {vehicleLabel.name}</span>}
                      {distanceKm && <span>· {distanceKm} km</span>}
                      {helpMode === 'driver' && <span>· Ayuda del chofer</span>}
                      {helpMode === 'helpers' && <span>· Chofer + {numHelpers} ayudante{numHelpers !== 1 ? 's' : ''}</span>}
                      {numFloors > 0 && <span>· {numFloors} piso{numFloors > 1 ? 's' : ''}</span>}
                      {needsPacking && <span>· Embalaje incluido</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
                      {addressesVerified ? 'Este valor llega directo al administrador para confirmar o ajustar detalles.' : 'Falta seleccionar origen o destino desde las sugerencias del mapa.'}
                    </div>
                  </div>
                )}

                {/* Selection summary */}
                <div style={{ background: '#f8fbff', border: '1px solid #E2E8F0', borderRadius: 14, padding: '14px 16px' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 10 }}>
                    Lo que solicitaste
                  </div>
                  {origin.address && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, marginBottom: 2 }}>📍 ORIGEN</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{origin.address}</div>
                    </div>
                  )}
                  {dest.address && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, marginBottom: 2 }}>🏁 DESTINO</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{dest.address}</div>
                    </div>
                  )}
                  {(() => {
                    const chips = [
                      vehicleLabel && vehicleLabel.name,
                      distanceKm && `${distanceKm} km`,
                      helpMode === 'driver' && 'Ayuda del chofer',
                      helpMode === 'helpers' && `+${numHelpers} ayudante${numHelpers !== 1 ? 's' : ''}`,
                      numFloors > 0 && `${numFloors} piso${numFloors > 1 ? 's' : ''}`,
                      needsPacking && 'Embalaje',
                      isConserjeria && 'Conserjería',
                      deliveryDate && `📅 ${deliveryDate}${deliveryTime ? ' · ' + deliveryTime : ''}`,
                    ].filter(Boolean);
                    return chips.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {chips.map(c => (
                          <span key={c} style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: '#EEF4FF', color: 'var(--accent)', border: '1px solid #0052FF20' }}>
                            {c}
                          </span>
                        ))}
                      </div>
                    );
                  })()}
                  {inventory.filter(i => i.qty > 0).length > 0 && (
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 10, lineHeight: 1.6 }}>
                      {inventory.filter(i => i.qty > 0).map(i => `${i.qty}× ${i.name}`).join(' · ')}
                      {inventoryExtras && ` · ${inventoryExtras}`}
                    </div>
                  )}
                </div>

                {/* Confirmation message */}
                <div style={{ background: '#f0fdf4', border: '1.5px solid #22c55e30', borderRadius: 14, padding: '16px 18px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>✅</div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: '#15803d', marginBottom: 6 }}>
                    ¡Tu cotización fue enviada!
                  </div>
                  <div style={{ fontSize: 13, color: '#166534', lineHeight: 1.65 }}>
                    Nos comunicaremos contigo a la brevedad para confirmar los detalles y el precio exacto de tu {serviceType}.
                  </div>
                </div>
              </div>
            ) : (
              /* ── FORM — compact, no scroll ─────────────────────────── */
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* Price range — compact */}
                {priceRange && (
                  <div style={{
                    background: 'linear-gradient(135deg,#f4f7ff,#e8f0ff)',
                    border: '2px solid #0052FF20', borderRadius: 14, padding: '14px 16px',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 10, color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                      Precio calculado para tu {serviceType}
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--accent)', letterSpacing: '-.5px', lineHeight: 1.1 }}>
                      {addressesVerified ? `$${fmt(priceRange.exact || priceRange.lo)}` : 'Sujeto a evaluación'}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 6, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '3px 8px' }}>
                      {vehicleLabel && <span>{vehicleLabel.icon} {vehicleLabel.name}</span>}
                      {distanceKm && <span>· {distanceKm} km</span>}
                      {helpMode === 'driver' && <span>· Ayuda del chofer</span>}
                      {helpMode === 'helpers' && <span>· +{numHelpers} ayudante{numHelpers !== 1 ? 's' : ''}</span>}
                      {numFloors > 0 && <span>· {numFloors} piso{numFloors > 1 ? 's' : ''}</span>}
                    </div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
                      {addressesVerified ? 'Lo revisaremos contigo antes de coordinar.' : 'Selecciona direcciones sugeridas para cerrar el cálculo automático.'}
                    </div>
                  </div>
                )}

                {/* Contact — name + phone in grid, email below */}
                <div style={{ background: '#f8fbff', border: '1px solid #E2E8F0', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: '#64748b', textTransform: 'uppercase' }}>Tus datos</div>
                  <div className="form-grid" style={{ gap: 10 }}>
                    <label style={{ margin: 0 }}>
                      Tu nombre *
                      <input value={contactPerson} onChange={e => { setContactPerson(e.target.value); setError(''); }} placeholder="Nombre y apellido" />
                    </label>
                    <label style={{ margin: 0 }}>
                      Teléfono *
                      <input type="tel" value={contactPhone} onChange={e => { setContactPhone(e.target.value); setError(''); }} placeholder="+56 9 xxxx xxxx" />
                    </label>
                  </div>
                  <label style={{ margin: 0 }}>
                    Correo electrónico <span style={{ fontWeight: 400, color: '#94a3b8' }}>(opcional)</span>
                    <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="correo@ejemplo.com" />
                  </label>
                </div>

                <div className={`form-error form-error-slot${error ? ' show' : ''}`}>{error || 'Sin errores'}</div>
                <button className="submit-quote" type="submit" disabled={submitting || departed}>
                  {submitting ? 'Enviando cotización…' : 'Enviar cotización →'}
                </button>
              </form>
            )
          )}

        </div>

        {/* ── Navigation footer ─────────────────────────────────────────── */}
        {success ? (
          <div className="q-foot">
            <button
              type="button"
              onClick={resetQuoteFlow}
              style={{ flex: 1, padding: '13px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#0052FF,#0077FF)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 20px #0052FF28' }}
            >
              Nueva cotización
            </button>
          </div>
        ) : step > 1 && (
          <div className="q-foot">
            <button
              type="button"
              onClick={resetQuoteFlow}
              style={{ padding: '12px 14px', borderRadius: 12, border: '1.5px solid #dbe3ef', background: '#f8fbff', color: '#475569', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
            >
              Inicio
            </button>
            <button
              type="button"
              onClick={goBack}
              style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid var(--border)', background: '#fff', color: 'var(--muted)', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'border-color .15s' }}
            >
              ← Atrás
            </button>
            {!isLastStep && (
              <button
                type="button"
                onClick={goNext}
                disabled={!canGoNext()}
                style={{
                  flex: 2, padding: '12px', borderRadius: 12, border: 'none',
                  background: canGoNext() ? 'linear-gradient(135deg,#0052FF,#0077FF)' : '#E2E8F0',
                  color: canGoNext() ? '#fff' : '#94a3b8',
                  fontSize: 13, fontWeight: 800, cursor: canGoNext() ? 'pointer' : 'not-allowed',
                  boxShadow: canGoNext() ? '0 8px 20px #0052FF28' : 'none',
                  transition: 'all .18s',
                }}
              >
                Siguiente →
              </button>
            )}
          </div>
        )}
      </section>
      </div>{/* end .quote-overlay */}

    </main>
  );
}

// ── Extra row (stepper) ────────────────────────────────────────────────────────

function ExtraRow({ label, sub, value, onDec, onInc, onSet }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button type="button" onClick={onDec} disabled={value === 0}
          style={{ width: 32, height: 32, borderRadius: '50%', border: '1.5px solid #dbe3ef', background: '#fff', fontSize: 18, fontWeight: 700, cursor: value === 0 ? 'not-allowed' : 'pointer', color: value === 0 ? '#cbd5e1' : '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .12s' }}>
          −
        </button>
        <input
          type="number"
          min="0"
          value={value}
          onChange={e => onSet?.(e.target.value)}
          style={{
            width: 42, height: 32, minHeight: 32, padding: 0, border: '1px solid transparent',
            background: 'transparent', textAlign: 'center', fontSize: 16, fontWeight: 900,
            color: '#0f172a', MozAppearance: 'textfield'
          }}
        />
        <button type="button" onClick={onInc}
          style={{ width: 32, height: 32, borderRadius: '50%', border: '1.5px solid #dbe3ef', background: '#fff', fontSize: 18, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .12s' }}>
          ＋
        </button>
      </div>
    </div>
  );
}

function CheckRow({ label, sub, checked, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', marginBottom: 10, padding: '8px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
      <div style={{
        width: 24, height: 24, borderRadius: 7,
        border: `2px solid ${checked ? 'var(--accent)' : '#cbd5e1'}`,
        background: checked ? 'var(--accent)' : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, transition: 'all .15s',
        boxShadow: checked ? '0 4px 10px #0052FF28' : 'none',
      }}>
        {checked && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: checked ? 'var(--accent)' : '#0f172a', transition: 'color .15s' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{sub}</div>}
      </div>
    </button>
  );
}
