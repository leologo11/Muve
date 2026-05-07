import React, { useState, useRef, useCallback, useEffect } from 'react';

const KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || '';

// ── Google Places API (New) ───────────────────────────────────────────────────
async function googleSearch(q) {
  const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY },
    body: JSON.stringify({ input: q, languageCode: 'es', includedRegionCodes: ['cl'] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Google ${res.status}`);
  return (data.suggestions || []).map(s => {
    const p = s.placePrediction || {};
    return {
      main:      p.structuredFormat?.mainText?.text      || p.text?.text || '',
      secondary: p.structuredFormat?.secondaryText?.text || '',
      placeId:   p.placeId,
      source:    'google',
    };
  });
}

async function googleDetails(placeId) {
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}?fields=formattedAddress,location,addressComponents&languageCode=es`,
    { headers: { 'X-Goog-Api-Key': KEY } }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Google ${res.status}`);
  const comps   = data.addressComponents || [];
  const commune =
    comps.find(c => c.types?.includes('sublocality_level_1'))?.longText ||
    comps.find(c => c.types?.includes('locality'))?.longText || '';
  return {
    address: data.formattedAddress || '',
    commune,
    lat: data.location?.latitude  ?? null,
    lng: data.location?.longitude ?? null,
  };
}

// ── Nominatim (OpenStreetMap) — fallback gratuito ─────────────────────────────
async function nominatimSearch(q) {
  const params = new URLSearchParams({
    q: q + ', Chile', countrycodes: 'cl', format: 'json',
    addressdetails: '1', limit: '7', 'accept-language': 'es',
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'User-Agent': 'MUVE/1.0' },
  });
  if (!res.ok) throw new Error(`OSM ${res.status}`);
  const list = await res.json();
  return list.map(r => {
    const a      = r.address || {};
    const road   = [a.road, a.house_number].filter(Boolean).join(' ');
    const main   = road || a.pedestrian || r.display_name.split(',')[0];
    const commune = a.suburb || a.city_district || a.town || a.municipality || a.county || '';
    const city    = a.city || a.state_district || '';
    return {
      main,
      secondary: [commune, city, 'Chile'].filter(Boolean).join(', '),
      commune,
      lat:       parseFloat(r.lat),
      lng:       parseFloat(r.lon),
      address:   [road, commune, city, 'Chile'].filter(Boolean).join(', '),
      source:    'osm',
    };
  });
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const INP = {
  width: '100%', background: 'var(--card2)', border: '1px solid var(--border)',
  borderRadius: 10, color: 'var(--text)', fontSize: 14,
  padding: '10px 36px 10px 12px', outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color .15s',
};

export default function AddressAutocomplete({
  value, onChange, onSelect,
  placeholder = 'Buscar dirección…',
  style = {},
  dropdownFixed: _,
}) {
  const [query, setQuery]             = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen]               = useState(false);
  const [loading, setLoading]         = useState(false);
  const [provider, setProvider]       = useState('');  // 'google' | 'osm'
  const [dropPos, setDropPos]         = useState(null);

  const containerRef = useRef();
  const inputRef     = useRef();
  const debounceRef  = useRef();
  const mountedRef   = useRef(true);

  // ── fix React StrictMode: resetear mountedRef en cada mount ─────────────────
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => { setQuery(value || ''); }, [value]);

  const calcDropPos = () => {
    if (!inputRef.current) return;
    const r = inputRef.current.getBoundingClientRect();
    setDropPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, width: r.width });
  };

  // ── Buscar: Google primero, Nominatim de fallback ────────────────────────────
  const search = useCallback((q) => {
    clearTimeout(debounceRef.current);
    if (!q || q.trim().length < 3) { setSuggestions([]); setOpen(false); return; }

    debounceRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;
      setLoading(true);
      let results = [];
      let src = '';

      try {
        if (KEY) {
          results = await googleSearch(q.trim());
          src = 'google';
        }
      } catch (e) {
        console.warn('[Google Places]', e.message, '→ usando OSM');
      }

      if (!results.length) {
        try {
          results = await nominatimSearch(q.trim());
          src = 'osm';
        } catch (e) {
          console.warn('[Nominatim]', e.message);
        }
      }

      if (!mountedRef.current) return;
      setLoading(false);
      setProvider(src);
      if (results.length) {
        calcDropPos();
        setSuggestions(results);
        setOpen(true);
      } else {
        setSuggestions([]); setOpen(false);
      }
    }, 350);
  }, []);

  const handleChange = (val) => { setQuery(val); onChange?.(val); search(val); };
  const handleClear  = ()    => { setQuery(''); onChange?.(''); setSuggestions([]); setOpen(false); };

  // ── Seleccionar sugerencia ───────────────────────────────────────────────────
  const handleSelect = async (sugg) => {
    setQuery(sugg.main);
    setSuggestions([]);
    setOpen(false);
    onChange?.(sugg.main);

    if (sugg.source === 'google' && sugg.placeId) {
      try {
        const detail = await googleDetails(sugg.placeId);
        setQuery(detail.address);
        onChange?.(detail.address);
        onSelect?.(detail);
      } catch (e) {
        console.warn('[Google details]', e.message);
        onSelect?.({ address: sugg.main, commune: '', lat: null, lng: null });
      }
    } else {
      // OSM ya tiene todo
      const addr = sugg.address || sugg.main;
      setQuery(addr);
      onChange?.(addr);
      onSelect?.({ address: addr, commune: sugg.commune || '', lat: sugg.lat, lng: sugg.lng });
    }
  };

  useEffect(() => {
    const h = e => { if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative', ...style }}>
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          value={query}
          onChange={e => handleChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          style={{ ...INP, borderColor: open ? 'var(--accent)' : 'var(--border)' }}
          onFocus={() => { if (suggestions.length) { calcDropPos(); setOpen(true); } }}
        />
        <span
          onClick={query ? handleClear : undefined}
          style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: 'var(--muted)', cursor: query ? 'pointer' : 'default', userSelect: 'none' }}
        >
          {loading ? '⏳' : query ? '×' : '🔍'}
        </span>
      </div>

      {open && suggestions.length > 0 && dropPos && (
        <div style={{
          position: 'fixed', zIndex: 9999,
          top: dropPos.top, left: dropPos.left, width: dropPos.width,
          background: '#fff', border: '1px solid var(--border)',
          borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.16)', overflow: 'hidden',
        }}>
          {suggestions.map((s, idx) => (
            <div
              key={s.placeId || idx}
              onMouseDown={() => handleSelect(s)}
              style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: idx < suggestions.length - 1 ? '1px solid var(--border)' : 'none' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f4f7ff'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>📍 {s.main}</div>
              {s.secondary && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{s.secondary}</div>}
            </div>
          ))}
          <div style={{ padding: '4px 10px 5px', textAlign: 'right', background: '#fafafa', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: 9, color: 'var(--muted)' }}>
              {provider === 'google' ? '🗺 Google Maps' : '© OpenStreetMap'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
