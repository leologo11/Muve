import React, { useState, useRef, useCallback, useEffect } from 'react';

function streetNumberFrom(text) {
  return String(text || '').match(/\b\d+[A-Za-z]?\b/)?.[0] || '';
}

function hasStreetNumber(text) {
  return /\b\d+[A-Za-z]?\b/.test(String(text || ''));
}

function mergeTypedStreetNumber(address, typed) {
  const number = streetNumberFrom(typed);
  if (!number || hasStreetNumber(address)) return address;
  const parts = String(address || '').split(',').map(p => p.trim()).filter(Boolean);
  if (!parts.length) return address;
  parts[0] = `${parts[0]} ${number}`;
  return parts.join(', ');
}

const KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || '';

// ── Google Places API (New) ───────────────────────────────────────────────────
async function googleSearch(q) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 1800);
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY },
      body: JSON.stringify({ input: q, languageCode: 'es', includedRegionCodes: ['cl'] }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `Google ${res.status}`);
    return (data.suggestions || []).map(s => {
      const p = s.placePrediction || {};
      const fullText = p.text?.text || '';
      return {
        main:      mergeTypedStreetNumber(p.structuredFormat?.mainText?.text || fullText || '', q),
        secondary: p.structuredFormat?.secondaryText?.text || '',
        placeId:   p.placeId,
        source:    'google',
        typed:     q,
        fullText,
      };
    });
  } catch (e) {
    clearTimeout(t);
    throw e;
  }
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

// ── Estilos ───────────────────────────────────────────────────────────────────
const INP = {
  width: '100%', background: 'var(--card2)', border: '1px solid var(--border)',
  borderRadius: 10, color: 'var(--text)', fontSize: 14,
  height: 44, minHeight: 44,
  padding: '10px 36px 10px 12px', outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color .15s',
};

export default function AddressAutocomplete({
  value, onChange, onSelect,
  placeholder = 'Buscar dirección…',
  style = {},
  compact = false,
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

  const search = useCallback((q) => {
    clearTimeout(debounceRef.current);
    if (!q || q.trim().length < 3) { setSuggestions([]); setOpen(false); return; }

    debounceRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;
      setLoading(true);
      let results = [];

      try {
        if (KEY) results = await googleSearch(q.trim());
      } catch (e) {
        console.warn('[Google Places]', e.message);
      }

      if (!mountedRef.current) return;
      setLoading(false);
      setProvider(results.length ? 'google' : '');
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
        const address = mergeTypedStreetNumber(detail.address, sugg.typed || query);
        setQuery(address);
        onChange?.(address);
        onSelect?.({ ...detail, address });
      } catch (e) {
        console.warn('[Google details]', e.message);
        const address = mergeTypedStreetNumber(sugg.fullText || sugg.main, sugg.typed || query);
        setQuery(address);
        onChange?.(address);
        onSelect?.({ address, commune: '', lat: null, lng: null });
      }
    } else {
      const addr = mergeTypedStreetNumber(sugg.fullText || sugg.main, sugg.typed || query);
      setQuery(addr);
      onChange?.(addr);
      onSelect?.({ address: addr, commune: '', lat: null, lng: null });
    }
  };

  useEffect(() => {
    const h = e => { if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative', zIndex: open ? 40 : 'auto', ...style }}>
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          value={query}
          onChange={e => handleChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          style={compact
            ? { ...INP, height: 30, minHeight: 30, fontSize: 11, padding: '4px 26px 4px 7px', borderRadius: 5, borderColor: open ? 'var(--accent)' : 'var(--border)' }
            : { ...INP, borderColor: open ? 'var(--accent)' : 'var(--border)' }
          }
          onFocus={() => { if (suggestions.length) { calcDropPos(); setOpen(true); } }}
        />
        <span
          onClick={query ? handleClear : undefined}
          style={{ position: 'absolute', right: compact ? 6 : 10, top: '50%', transform: 'translateY(-50%)', fontSize: compact ? 12 : 15, color: 'var(--muted)', cursor: query ? 'pointer' : 'default', userSelect: 'none' }}
        >
          {loading ? '⏳' : query ? '×' : '🔍'}
        </span>
      </div>

      {open && suggestions.length > 0 && dropPos && (
        <div style={{
          position: 'absolute', zIndex: 9999,
          top: 'calc(100% + 4px)', left: 0, width: '100%',
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
            <span style={{ fontSize: 9, color: 'var(--muted)' }}>🗺 Google Maps</span>
          </div>
        </div>
      )}
    </div>
  );
}
