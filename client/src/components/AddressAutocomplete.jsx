import React, { useState, useEffect, useRef, useCallback } from 'react';

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function extractCommune(addr) {
  return addr.city_district || addr.suburb || addr.town || addr.municipality || addr.city || '';
}

function extractStreet(addr) {
  const parts = [addr.road];
  if (addr.house_number) parts.push(addr.house_number);
  return parts.filter(Boolean).join(' ');
}

export default function AddressAutocomplete({ value, onChange, onSelect, placeholder = 'Buscar dirección…', style = {} }) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef();

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  const search = useCallback(
    debounce(async (q) => {
      if (!q || q.length < 4) { setSuggestions([]); return; }
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + ', Chile')}&format=json&limit=5&countrycodes=cl&addressdetails=1`,
          { headers: { 'Accept-Language': 'es', 'User-Agent': 'Routiflow/1.0' } }
        );
        const data = await res.json();
        setSuggestions(data);
        setOpen(data.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 650),
    []
  );

  const handleChange = (val) => {
    setQuery(val);
    onChange?.(val);
    search(val);
  };

  const handleSelect = (item) => {
    const street = extractStreet(item.address);
    const commune = extractCommune(item.address);
    const displayName = street || item.display_name.split(',')[0];
    setQuery(displayName);
    setSuggestions([]);
    setOpen(false);
    onSelect?.({ address: displayName, commune, lat: parseFloat(item.lat), lng: parseFloat(item.lon), raw: item });
  };

  // Close dropdown on outside click
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
          value={query}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          style={{
            width: '100%', background: 'var(--card2)', border: '1px solid var(--border)',
            borderRadius: 10, color: 'var(--text)', fontSize: 14, padding: '10px 36px 10px 12px', outline: 'none'
          }}
        />
        {loading && (
          <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--muted)' }}>⏳</span>
        )}
        {!loading && query && (
          <span
            onClick={() => { setQuery(''); onChange?.(''); setSuggestions([]); setOpen(false); }}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'var(--muted)', cursor: 'pointer' }}
          >×</span>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
          background: '#fff', border: '1px solid var(--border)', borderRadius: 10,
          boxShadow: '0 4px 20px #00000018', marginTop: 4, overflow: 'hidden'
        }}>
          {suggestions.map(item => {
            const street = extractStreet(item.address);
            const commune = extractCommune(item.address);
            return (
              <div
                key={item.place_id}
                onClick={() => handleSelect(item)}
                style={{
                  padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                  fontSize: 13, lineHeight: 1.4
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--card2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ fontWeight: 600 }}>{street || item.display_name.split(',')[0]}</div>
                {commune && <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>{commune}</div>}
              </div>
            );
          })}
          <div style={{ padding: '6px 12px', fontSize: 10, color: '#aaa', textAlign: 'right' }}>
            © OpenStreetMap
          </div>
        </div>
      )}
    </div>
  );
}
