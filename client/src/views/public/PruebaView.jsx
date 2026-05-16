import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../api/index.js';
import AddressAutocomplete from '../../components/AddressAutocomplete.jsx';
import { CATALOG } from '../../components/InventoryPicker.jsx';

const fmt = n => Number(n || 0).toLocaleString('es-CL');

const CATS = [...new Set(CATALOG.map(c => c.cat))];

const CONFIDENCE_COLOR = { low: '#f59e0b', medium: '#0052FF', high: '#16a34a' };
const CONFIDENCE_LABEL = { low: 'Estimación aproximada', medium: 'Precio calculado', high: 'Precio preciso' };

function Counter({ value, onDec, onInc, min = 0 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      <button type="button" onClick={onDec} disabled={value <= min}
        style={{ width: 28, height: 28, border: '1px solid #CBD5E1', borderRadius: '6px 0 0 6px', background: value <= min ? '#f8fafc' : '#fff', color: value <= min ? '#CBD5E1' : '#475569', fontSize: 16, cursor: value <= min ? 'default' : 'pointer', fontWeight: 700 }}>
        −
      </button>
      <div style={{ width: 32, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #CBD5E1', borderLeft: 0, borderRight: 0, fontSize: 13, fontWeight: 700, color: value > 0 ? '#0f172a' : '#CBD5E1' }}>
        {value}
      </div>
      <button type="button" onClick={onInc}
        style={{ width: 28, height: 28, border: '1px solid #CBD5E1', borderRadius: '0 6px 6px 0', background: '#fff', color: '#0052FF', fontSize: 16, cursor: 'pointer', fontWeight: 700 }}>
        +
      </button>
    </div>
  );
}

export default function PruebaView() {
  const [origin, setOrigin] = useState({ address: '', lat: null, lng: null });
  const [dest, setDest] = useState({ address: '', lat: null, lng: null });
  const [distanceKm, setDistanceKm] = useState(null);
  const [durationMin, setDurationMin] = useState(null);
  const [loadingDist, setLoadingDist] = useState(false);

  const [inventory, setInventory] = useState(CATALOG.map(c => ({ id: c.id, qty: 0 })));
  const [freeText, setFreeText] = useState('');
  const [numFloors, setNumFloors] = useState(0);
  const [numHelpers, setNumHelpers] = useState(0);
  const [needsPacking, setNeedsPacking] = useState(false);

  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState(null);
  const [quotedItems, setQuotedItems] = useState([]);
  const [quotedFreeText, setQuotedFreeText] = useState('');
  const [quotedDistKm, setQuotedDistKm] = useState(null);
  const [isRandomQuote, setIsRandomQuote] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [correctPrice, setCorrectPrice] = useState('');
  const [correctVehicle, setCorrectVehicle] = useState('');
  const [correctHelpers, setCorrectHelpers] = useState(0);
  const [feedbackNote, setFeedbackNote] = useState('');
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [lastProfile, setLastProfile] = useState(null);

  const resultRef = useRef(null);

  const setQty = (id, qty) => setInventory(inv => inv.map(i => i.id === id ? { ...i, qty: Math.max(0, qty) } : i));
  const getQty = id => inventory.find(i => i.id === id)?.qty || 0;
  const hasItems = inventory.some(i => i.qty > 0) || freeText.trim();
  const selectedItems = inventory.filter(i => i.qty > 0).map(i => {
    const cat = CATALOG.find(c => c.id === i.id);
    return { name: cat?.name || i.id, qty: i.qty, icon: cat?.icon || '📦', vol: cat?.vol || 0 };
  });

  useEffect(() => {
    if (!origin.lat || !dest.lat || distanceKm || loadingDist) return;
    const calc = async () => {
      setLoadingDist(true);
      try {
        const { distanceKm: km, durationMin: min } = await api.calculateDistance({
          originLat: origin.lat, originLng: origin.lng,
          destLat: dest.lat, destLng: dest.lng,
        });
        setDistanceKm(km);
        setDurationMin(min);
      } catch {}
      finally { setLoadingDist(false); }
    };
    calc();
  }, [origin.lat, dest.lat]);

  const resetFeedback = () => {
    setFeedback(null); setCorrectPrice(''); setCorrectVehicle('');
    setCorrectHelpers(0); setFeedbackNote('');
  };

  const calculate = async () => {
    if (!hasItems) return setError('Agrega al menos un artículo o describe lo que necesitas mover.');
    setCalculating(true);
    setError('');
    setResult(null);
    const dist = distanceKm || 0;
    try {
      const res = await api.aiQuote({
        originAddress: origin.address,
        destinationAddress: dest.address,
        distanceKm: dist,
        items: selectedItems,
        freeText: freeText.trim(),
        numFloors,
        numHelpers,
        needsPacking,
      });
      setResult(res);
      setQuotedItems([...selectedItems]);
      setQuotedFreeText(freeText.trim());
      setQuotedDistKm(dist);
      setIsRandomQuote(false);
      resetFeedback();
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (err) {
      setError('No se pudo conectar al servidor. Verifica tu conexión e intenta de nuevo.');
    } finally {
      setCalculating(false);
    }
  };

  const sendFeedback = async (status) => {
    if (!result) return;
    setSavingFeedback(true);
    try {
      const itemsText = quotedItems.map(i => `${i.qty}x ${i.name}`).join(', ');
      const helperNote = correctHelpers > 0 ? `${correctHelpers} ayudante(s)` : 'sin ayudantes';
      await api.aiQuoteFeedback({
        itemsText,
        itemsJson: quotedItems,
        freeText: quotedFreeText,
        distanceKm: quotedDistKm,
        origin: origin.address,
        destination: dest.address,
        numHelpers: correctHelpers,
        numFloors,
        aiVehicle: result.vehicle,
        aiVehicleName: result.vehicleName,
        aiDetectedType: result.detectedType,
        aiPrice: result.price,
        aiTwoTrips: result.twoTrips,
        status,
        correctPrice: status === 'corrected' ? Number(String(correctPrice).replace(/\D/g, '')) : null,
        correctVehicle: status === 'corrected' && correctVehicle ? correctVehicle : null,
        notes: [feedbackNote.trim(), helperNote].filter(Boolean).join(' — '),
      });
      setFeedback('done');
    } catch (err) {
      console.error('feedback error', err);
    } finally {
      setSavingFeedback(false);
    }
  };

  const RANDOM_EXTRAS_POOL = [
    '', '', '',
    '2 plantas grandes en macetero', '4 cajas de libros pesados', '1 bicicleta',
    '3 cajas medianas con ropa', '1 espejo grande de cuerpo completo', '2 cuadros grandes enmarcados',
    'herramientas de jardín y manguera', '5 cajas de cocina y vajilla', '1 caja con electrodomésticos pequeños',
    '1 silla de oficina ergonómica', '2 maceteros grandes', '1 bicicleta estática',
    '1 colchón de 1 plaza adicional', '3 bolsas grandes de ropa', '1 televisor 55 pulgadas en su caja',
    '1 impresora de oficina grande', '4 sillas plegables', '1 cuna de bebé desarmada',
    '2 cajas con libros y archivos', '1 aspiradora y accesorios', '6 cajas de ropa y sábanas',
    '1 barra de cortinas y accesorios', '1 estante de metal desmontado',
  ];

  // Profiles: helpers are NOT pre-assigned — operator decides when reviewing
  const PROFILES = [
    { label: 'Flete mini',      min: 1,  max: 2  },
    { label: 'Flete pequeño',   min: 2,  max: 4  },
    { label: 'Flete mediano',   min: 3,  max: 6  },
    { label: 'Mudanza chica',   min: 5,  max: 9  },
    { label: 'Mudanza mediana', min: 8,  max: 13 },
    { label: 'Mudanza grande',  min: 12, max: 18 },
    { label: 'Mudanza enorme',  min: 16, max: 22 },
  ];

  const TRAINING_KM = 4; // fixed distance for training consistency

  const randomizeAndCalculate = async () => {
    const profile = PROFILES[Math.floor(Math.random() * PROFILES.length)];
    const numItems = profile.min + Math.floor(Math.random() * (profile.max - profile.min + 1));

    const shuffled = [...CATALOG].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, Math.min(numItems, CATALOG.length));

    const newInventory = CATALOG.map(c => {
      const p = picked.find(x => x.id === c.id);
      if (!p) return { id: c.id, qty: 0 };
      const qty = Math.random() < 0.2 ? 2 : 1;
      return { id: c.id, qty };
    });

    // 45% chance of adding free-text extras
    const pool = RANDOM_EXTRAS_POOL.filter(Boolean);
    const newFreeText = Math.random() < 0.45
      ? pool[Math.floor(Math.random() * pool.length)]
      : '';

    setInventory(newInventory);
    setFreeText(newFreeText);
    setNumHelpers(0);   // operator decides helpers when reviewing
    setNumFloors(0);    // floors have fixed price — not part of AI training
    setNeedsPacking(false);
    setResult(null);
    resetFeedback();
    setLastProfile(profile.label);

    const newSelectedItems = newInventory.filter(i => i.qty > 0).map(i => {
      const cat = CATALOG.find(c => c.id === i.id);
      return { name: cat?.name || i.id, qty: i.qty, icon: cat?.icon || '📦' };
    });

    if (!newSelectedItems.length && !newFreeText.trim()) return;

    setCalculating(true);
    setError('');
    try {
      const res = await api.aiQuote({
        originAddress: 'Santiago Centro',
        destinationAddress: 'Santiago, 4km',
        distanceKm: TRAINING_KM,   // always 4km for training
        items: newSelectedItems,
        freeText: newFreeText.trim(),
        numFloors: 0,              // floors = fixed price, not AI training
        numHelpers: 0,             // no helpers in AI call — operator assigns
        needsPacking: false,
      });
      setResult(res);
      setQuotedItems([...newSelectedItems]);
      setQuotedFreeText(newFreeText.trim());
      setQuotedDistKm(TRAINING_KM);
      setIsRandomQuote(true);
      resetFeedback();
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (err) {
      setError('No se pudo conectar al servidor. Verifica tu conexión e intenta de nuevo.');
    } finally {
      setCalculating(false);
    }
  };

  const reset = () => {
    setInventory(CATALOG.map(c => ({ id: c.id, qty: 0 })));
    setFreeText('');
    setNumFloors(0);
    setNumHelpers(0);
    setNeedsPacking(false);
    setResult(null);
    setQuotedItems([]);
    setQuotedFreeText('');
    setIsRandomQuote(false);
    resetFeedback();
    setError('');
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#f1f5f9', fontFamily: "'Montserrat', system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#0052FF,#0030cc)', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 2px 12px #0052ff30' }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: '#ffffff22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🚚</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', letterSpacing: '-0.3px' }}>MUVE · Cotizador IA</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#ffffff88', textTransform: 'uppercase', letterSpacing: 1 }}>Vista de prueba · Beta</div>
        </div>
        <div style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 999, background: '#ffffff22', fontSize: 10, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: 1 }}>
          BETA
        </div>
      </div>

      <div style={{ maxWidth: 780, margin: '0 auto', padding: '20px 16px 60px' }}>

        {/* Addresses */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: '16px 18px', marginBottom: 14, boxShadow: '0 1px 6px #0000000a' }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: '#64748b', textTransform: 'uppercase', marginBottom: 14 }}>Ruta</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 700, color: '#475569' }}>
              Dirección de retiro
              <AddressAutocomplete
                value={origin.address}
                onChange={v => { setOrigin({ address: v, lat: null, lng: null }); setDistanceKm(null); }}
                onSelect={({ address, lat, lng }) => setOrigin({ address, lat, lng })}
                placeholder="Av. Vitacura 2939, Las Condes…"
              />
              {origin.lat && <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 700 }}>✓ Ubicado</span>}
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 700, color: '#475569' }}>
              Dirección de entrega
              <AddressAutocomplete
                value={dest.address}
                onChange={v => { setDest({ address: v, lat: null, lng: null }); setDistanceKm(null); }}
                onSelect={({ address, lat, lng }) => setDest({ address, lat, lng })}
                placeholder="Calle Ahumada 100, Santiago…"
              />
              {dest.lat && <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 700 }}>✓ Ubicado</span>}
            </label>
          </div>
          {loadingDist && (
            <div style={{ marginTop: 12, fontSize: 12, color: '#64748b', fontWeight: 600 }}>⏳ Calculando distancia…</div>
          )}
          {distanceKm && !loadingDist && (
            <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center', padding: '10px 14px', background: '#f4f7ff', borderRadius: 10, border: '1px solid #0052FF15' }}>
              <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--accent)' }}>{distanceKm} km</span>
              {durationMin && <span style={{ fontSize: 12, color: '#64748b' }}>· ~{durationMin} min</span>}
              <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>Distancia calculada</span>
            </div>
          )}
        </div>

        {/* Item picker */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: '16px 18px', marginBottom: 14, boxShadow: '0 1px 6px #0000000a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: '#64748b', textTransform: 'uppercase' }}>Artículos</div>
            {inventory.some(i => i.qty > 0) && (
              <button type="button" onClick={() => setInventory(CATALOG.map(c => ({ id: c.id, qty: 0 })))}
                style={{ fontSize: 11, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                Limpiar selección
              </button>
            )}
          </div>

          {CATS.map(cat => (
            <div key={cat} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8, borderBottom: '1px solid #f1f5f9', paddingBottom: 4 }}>
                {cat}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6 }}>
                {CATALOG.filter(c => c.cat === cat).map(item => {
                  const qty = getQty(item.id);
                  return (
                    <div key={item.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10,
                        border: `1.5px solid ${qty > 0 ? '#0052FF30' : '#E2E8F0'}`,
                        background: qty > 0 ? '#f4f7ff' : '#fafbfc',
                        transition: 'all .12s',
                      }}>
                      <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: qty > 0 ? 800 : 600, color: qty > 0 ? '#0f172a' : '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.name}
                        </div>
                      </div>
                      <Counter value={qty} min={0}
                        onDec={() => setQty(item.id, qty - 1)}
                        onInc={() => { setQty(item.id, qty + 1); setResult(null); }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Free text */}
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>
              Artículos especiales / notas adicionales
            </div>
            <textarea
              value={freeText}
              onChange={e => { setFreeText(e.target.value); setResult(null); }}
              placeholder="Ej: bicicleta, piano, moto, plantas grandes, 3 cajas de libros, herramientas…"
              rows={3}
              style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', borderRadius: 10, border: '1.5px solid #E2E8F0', padding: '10px 12px', fontSize: 13, color: '#0f172a', fontFamily: 'inherit', outline: 'none' }}
            />
          </div>
        </div>

        {/* Extras */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: '16px 18px', marginBottom: 20, boxShadow: '0 1px 6px #0000000a' }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: '#64748b', textTransform: 'uppercase', marginBottom: 14 }}>Adicionales</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Pisos sin ascensor</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>Suma pisos de retiro + entrega</div>
              </div>
              <Counter value={numFloors} onDec={() => { setNumFloors(n => Math.max(0, n - 1)); setResult(null); }} onInc={() => { setNumFloors(n => n + 1); setResult(null); }} />
            </div>

            <div style={{ height: 1, background: '#f1f5f9' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Ayudantes adicionales</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>Además del chofer</div>
              </div>
              <Counter value={numHelpers} onDec={() => { setNumHelpers(n => Math.max(0, n - 1)); setResult(null); }} onInc={() => { setNumHelpers(n => n + 1); setResult(null); }} />
            </div>

            <div style={{ height: 1, background: '#f1f5f9' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Embalaje profesional</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>Empacamos todo antes de cargar</div>
              </div>
              <button type="button" onClick={() => { setNeedsPacking(v => !v); setResult(null); }}
                style={{
                  width: 46, height: 26, borderRadius: 999, border: 'none', cursor: 'pointer',
                  background: needsPacking ? '#0052FF' : '#CBD5E1', transition: 'background .2s', position: 'relative',
                }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', background: '#fff',
                  position: 'absolute', top: 3, transition: 'left .2s',
                  left: needsPacking ? 23 : 3, boxShadow: '0 1px 4px #00000030',
                }} />
              </button>
            </div>
          </div>
        </div>

        {/* Calculate button */}
        <button type="button" onClick={randomizeAndCalculate} disabled={calculating}
          style={{
            width: '100%', padding: '13px', borderRadius: 14, border: '2px dashed #94a3b8', marginBottom: 10,
            background: calculating ? '#f8fafc' : '#fff', color: calculating ? '#94a3b8' : '#475569',
            fontSize: 14, fontWeight: 800, cursor: calculating ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}>
          <span style={{ fontSize: 18 }}>🎲</span>
          <span>{calculating ? 'Calculando…' : 'Caso aleatorio → cotizar y entrenar'}</span>
          {lastProfile && !calculating && (
            <span style={{ padding: '2px 7px', borderRadius: 999, background: '#f1f5f9', fontSize: 11, fontWeight: 700, color: '#64748b' }}>
              {lastProfile}
            </span>
          )}
        </button>
        <button type="button" onClick={calculate} disabled={calculating || !hasItems}
          style={{
            width: '100%', padding: '16px', borderRadius: 14, border: 'none',
            background: (calculating || !hasItems) ? '#CBD5E1' : 'linear-gradient(135deg,#0052FF,#0030cc)',
            color: '#fff', fontSize: 15, fontWeight: 900, cursor: (calculating || !hasItems) ? 'not-allowed' : 'pointer',
            boxShadow: (calculating || !hasItems) ? 'none' : '0 8px 24px #0052FF35',
            transition: 'all .2s', letterSpacing: '-0.2px',
          }}>
          {calculating ? '⏳ Calculando precio…' : '✨ Calcular precio →'}
        </button>

        {error && (
          <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 12, background: '#fff7f7', border: '1.5px solid #fca5a5', fontSize: 13, color: '#991b1b', fontWeight: 600 }}>
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div ref={resultRef} style={{ marginTop: 20 }}>
            <div style={{
              borderRadius: 20, overflow: 'hidden',
              boxShadow: '0 12px 40px #0052FF18',
              border: '2px solid #0052FF20',
            }}>
              {/* Result header */}
              <div style={{
                background: 'linear-gradient(135deg,#0052FF,#0030cc)',
                padding: '20px 22px',
                display: 'flex', alignItems: 'flex-start', gap: 16,
              }}>
                <div style={{ fontSize: 52, lineHeight: 1, flexShrink: 0 }}>{result.vehicleIcon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#ffffff80', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                    Vehículo recomendado
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 4 }}>{result.vehicleName}</div>
                  <div style={{ fontSize: 11, color: '#ffffff90', lineHeight: 1.5 }}>{result.clientExplanation}</div>
                </div>
              </div>

              {/* Price */}
              <div style={{ background: '#fff', padding: '20px 22px' }}>

                {/* Quoted items — always visible at top for quick reading */}
                <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 12, background: '#f8fafc', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                    Artículos cotizados · {quotedDistKm ? `${quotedDistKm} km${isRandomQuote ? ' (entrenamiento)' : ''}` : 'distancia no calculada'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {[...quotedItems].sort((a, b) => (b.vol || 0) - (a.vol || 0)).map(i => (
                      <div key={i.name} style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 15, flexShrink: 0 }}>{i.icon}</span>
                        <span>{i.qty > 1 ? <strong>{i.qty}×</strong> : null} {i.name}</span>
                      </div>
                    ))}
                    {quotedFreeText && (
                      <div style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic', marginTop: 4, paddingTop: 4, borderTop: '1px dashed #E2E8F0' }}>
                        + {quotedFreeText}
                      </div>
                    )}
                    {quotedItems.length === 0 && !quotedFreeText && (
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>Sin artículos del catálogo</div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                      {result.detectedType === 'mudanza' ? 'Precio mudanza' : 'Precio flete'}
                    </div>
                    <div style={{ fontSize: 38, fontWeight: 900, color: 'var(--accent)', letterSpacing: '-1px', lineHeight: 1 }}>
                      ${fmt(result.price)}
                    </div>
                    {result.priceMin !== result.priceMax && (
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 5, fontWeight: 600 }}>
                        Rango: ${fmt(result.priceMin)} – ${fmt(result.priceMax)}
                      </div>
                    )}
                    {result.tollEstimate > 0 && (
                      <div style={{ marginTop: 6, fontSize: 12, color: '#c2410c', fontWeight: 700 }}>
                        + peaje autopista estimado: ${fmt(result.tollEstimate)}
                      </div>
                    )}
                    {result.twoTrips && (
                      <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 10, background: '#fffbeb', border: '1.5px solid #fde68a', fontSize: 12, color: '#92400e', fontWeight: 600, maxWidth: 260 }}>
                        💡 Incluye 2 viajes — el 2do con 50% de descuento
                      </div>
                    )}
                  </div>
                  <div style={{
                    padding: '6px 12px', borderRadius: 999,
                    background: `${CONFIDENCE_COLOR[result.confidence]}18`,
                    border: `1.5px solid ${CONFIDENCE_COLOR[result.confidence]}50`,
                    flexShrink: 0,
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: CONFIDENCE_COLOR[result.confidence], textTransform: 'uppercase', letterSpacing: .8 }}>
                      {CONFIDENCE_LABEL[result.confidence]}
                    </div>
                  </div>
                </div>

                {/* AI helper recommendation */}
                <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: '#f4f7ff', border: '1px solid #0052FF20', fontSize: 13, color: '#1e40af', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>👤</span>
                  <span>
                    {result.recommendedHelpers === 0
                      ? 'Solo chofer — la IA estima que el chofer puede solo'
                      : `IA recomienda ${result.recommendedHelpers} ayudante${result.recommendedHelpers > 1 ? 's' : ''} adicional${result.recommendedHelpers > 1 ? 'es' : ''}`}
                  </span>
                </div>

                {result.needsManualReview && (
                  <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: '#fffbeb', border: '1.5px solid #f59e0b50', fontSize: 12, color: '#92400e', fontWeight: 600 }}>
                    ⚠️ Un asesor revisará los detalles y confirmará el precio final.
                  </div>
                )}

                {/* Feedback — training block */}
                <div style={{ marginTop: 4, paddingTop: 14, borderTop: '1.5px dashed #E2E8F0' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                    ¿El precio es correcto? · Entrenamiento IA
                  </div>

                  {feedback === 'done' ? (
                    <div style={{ padding: '10px 14px', borderRadius: 10, background: '#f0fdf4', border: '1.5px solid #86efac', fontSize: 13, color: '#15803d', fontWeight: 700 }}>
                      ✅ Guardado — el agente aprenderá de este caso
                    </div>
                  ) : feedback === 'correcting' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {/* Helpers selector */}
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6 }}>Ayudantes necesarios (tú decides)</div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {[0, 1, 2, 3].map(n => (
                            <button key={n} type="button" onClick={() => setCorrectHelpers(n)}
                              style={{
                                padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: 'pointer',
                                border: `2px solid ${correctHelpers === n ? '#0052FF' : '#E2E8F0'}`,
                                background: correctHelpers === n ? '#EEF4FF' : '#fff',
                                color: correctHelpers === n ? '#0052FF' : '#64748b',
                              }}>
                              {n === 0 ? 'Solo chofer' : `+${n}`}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Precio total correcto ($) <span style={{ color: '#94a3b8', fontWeight: 600 }}>todo incluido</span></div>
                          <input
                            type="number"
                            placeholder="Ej: 55000"
                            value={correctPrice}
                            onChange={e => setCorrectPrice(e.target.value)}
                            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #CBD5E1', fontSize: 13, fontFamily: 'inherit' }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Vehículo correcto</div>
                          <select
                            value={correctVehicle}
                            onChange={e => setCorrectVehicle(e.target.value)}
                            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #CBD5E1', fontSize: 13, fontFamily: 'inherit', background: '#fff' }}
                          >
                            <option value="">Sin cambio</option>
                            <option value="auto">Auto</option>
                            <option value="furgon">Furgón</option>
                            <option value="camion34">Camión 3/4</option>
                            <option value="camionLargo">Camión Largo</option>
                            <option value="camion34-2viajes">Camión 3/4 (2 viajes)</option>
                          </select>
                        </div>
                      </div>
                      <input
                        type="text"
                        placeholder="Nota opcional (ej: cabe en furgón, precio bajo por distancia corta…)"
                        value={feedbackNote}
                        onChange={e => setFeedbackNote(e.target.value)}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #CBD5E1', fontSize: 12, fontFamily: 'inherit' }}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" onClick={() => setFeedback(null)}
                          style={{ flex: 1, padding: '10px', borderRadius: 9, border: '1.5px solid #E2E8F0', background: '#fff', color: '#64748b', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                          Cancelar
                        </button>
                        <button type="button" onClick={() => sendFeedback('corrected')} disabled={!correctPrice || savingFeedback}
                          style={{ flex: 2, padding: '10px', borderRadius: 9, border: 'none', background: !correctPrice ? '#CBD5E1' : '#dc2626', color: '#fff', fontSize: 12, fontWeight: 800, cursor: !correctPrice ? 'not-allowed' : 'pointer' }}>
                          {savingFeedback ? 'Guardando…' : '💾 Guardar corrección'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" onClick={() => { setCorrectHelpers(result.recommendedHelpers ?? 0); setFeedback('approved'); sendFeedback('approved'); }} disabled={savingFeedback}
                        style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #86efac', background: '#f0fdf4', color: '#15803d', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                        ✅ Precio correcto
                      </button>
                      <button type="button" onClick={() => { setFeedback('correcting'); setCorrectHelpers(result.recommendedHelpers ?? 0); }}
                        style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #fca5a5', background: '#fff7f7', color: '#dc2626', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                        ✏️ Corregir precio
                      </button>
                    </div>
                  )}
                </div>

                {/* CTAs */}
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button type="button" onClick={reset}
                    style={{ flex: 1, padding: '12px', borderRadius: 11, border: '1.5px solid #E2E8F0', background: '#fff', color: '#475569', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    Nueva cotización
                  </button>
                  <button type="button" onClick={randomizeAndCalculate} disabled={calculating}
                    style={{
                      flex: 2, padding: '12px', borderRadius: 11, border: '2px dashed #94a3b8',
                      background: calculating ? '#f8fafc' : '#fff', color: calculating ? '#94a3b8' : '#475569',
                      fontSize: 13, fontWeight: 800, cursor: calculating ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}>
                    <span>🎲</span>
                    <span>{calculating ? 'Calculando…' : 'Caso aleatorio'}</span>
                    {lastProfile && !calculating && (
                      <span style={{ padding: '2px 7px', borderRadius: 999, background: '#f1f5f9', fontSize: 11, fontWeight: 700, color: '#64748b' }}>
                        {lastProfile}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
