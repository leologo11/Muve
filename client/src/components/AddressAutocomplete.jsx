import React, { useState, useEffect, useRef, useCallback } from 'react';

let debounceTimer;

// Photon API (komoot) — faster than Nominatim, no rate limit issues, OSM data
async function searchPhoton(q) {
  // Bias results toward Santiago Chile with location + country filter
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=es&lat=-33.45&lon=-70.65`;
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error('Search failed');
  const data = await res.json();
  // Filter to Chile only
  return (data.features || []).filter(f =>
    f.properties?.country === 'Chile' || f.properties?.countrycode === 'CL'
  );
}

function formatSuggestion(f) {
  const p = f.properties;
  const parts = [];
  if (p.street && p.housenumber) parts.push(`${p.street} ${p.housenumber}`);
  else if (p.street) parts.push(p.street);
  else if (p.name && p.type !== 'city' && p.type !== 'district') parts.push(p.name);
  const address = parts[0] || '';
  const commune = p.city || p.district || p.locality || '';
  const [lng, lat] = f.geometry.coordinates;
  return { address, commune, lat, lng, label: address, sublabel: commune };
}

export default function AddressAutocomplete({ value, onChange, onSelect, placeholder = 'Buscar dirección…', style = {}, dropdownFixed = false }) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dropdownPos, setDropdownPos] = useState(null);
  const containerRef = useRef();
  const inputRef = useRef();
  const abortRef = useRef();

  useEffect(() => { setQuery(value || ''); }, [value]);

  const updateDropdownPos = () => {
    if (!dropdownFixed || !inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom + 5, left: rect.left, width: rect.width });
  };

  const search = useCallback((q) => {
    clearTimeout(debounceTimer);
    if (!q || q.length < 3) { setSuggestions([]); setOpen(false); return; }
    debounceTimer = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      setLoading(true);
      try {
        const results = await searchPhoton(q);
        const formatted = results.map(formatSuggestion).filter(r => r.address);
        setSuggestions(formatted);
        if (formatted.length > 0) { updateDropdownPos(); setOpen(true); }
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 320);
  }, []);

  const handleChange = (val) => {
    setQuery(val);
    onChange?.(val);
    search(val);
  };

  const handleSelect = (item) => {
    const displayAddr = item.address;
    setQuery(displayAddr);
    setSuggestions([]);
    setOpen(false);
    onSelect?.({ address: displayAddr, commune: item.commune, lat: item.lat, lng: item.lng });
  };

  const handleClear = () => {
    setQuery('');
    onChange?.('');
    setSuggestions([]);
    setOpen(false);
  };

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
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
          style={{
            width: '100%',
            background: 'var(--card2)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            color: 'var(--text)',
            fontSize: 14,
            padding: '10px 36px 10px 12px',
            outline: 'none',
            transition: 'border-color .15s'
          }}
          onFocus={e => { e.target.style.borderColor = 'var(--accent)'; if (suggestions.length > 0) { updateDropdownPos(); setOpen(true); } }}
          onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
        />
        <span style={{
          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          fontSize: 15, color: 'var(--muted)', cursor: query ? 'pointer' : 'default',
          userSelect: 'none'
        }} onClick={query ? handleClear : undefined}>
          {loading ? '⏳' : query ? '×' : '🔍'}
        </span>
      </div>

      {open && suggestions.length > 0 && (
        <div style={dropdownFixed && dropdownPos ? {
          position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 2000,
          background: '#fff', border: '1px solid var(--border)', borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)', overflow: 'hidden'
        } : {
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
          background: '#fff', border: '1px solid var(--border)', borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)', marginTop: 5, overflow: 'hidden'
        }}>
          {suggestions.map((item, idx) => (
            <div
              key={idx}
              onMouseDown={() => handleSelect(item)}
              style={{
                padding: '10px 14px',
                cursor: 'pointer',
                borderBottom: idx < suggestions.length - 1 ? '1px solid var(--border)' : 'none',
                transition: 'background .1s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--card2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                📍 {item.address}
              </div>
              {item.commune && (
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  {item.commune}
                </div>
              )}
            </div>
          ))}
          <div style={{ padding: '5px 14px 6px', fontSize: 10, color: '#bbb', textAlign: 'right' }}>
            © OpenStreetMap / Photon
          </div>
        </div>
      )}
    </div>
  );
}
