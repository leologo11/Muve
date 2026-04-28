import React, { useState, useCallback, useRef } from 'react';

let _show = null;

export function toast(msg, duration = 2400) {
  _show?.(msg, duration);
}

export default function Toast() {
  const [msg, setMsg] = useState('');
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);

  _show = useCallback((m, d) => {
    setMsg(m);
    setVisible(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), d);
  }, []);

  return (
    <div style={{
      position: 'fixed',
      bottom: 'calc(28px + env(safe-area-inset-bottom))',
      left: '50%',
      transform: `translateX(-50%) translateY(${visible ? 0 : '90px'})`,
      background: 'var(--accent)',
      color: '#fff',
      padding: '10px 22px',
      borderRadius: 30,
      fontSize: 13,
      fontWeight: 700,
      zIndex: 999,
      transition: 'transform .3s cubic-bezier(.34,1.56,.64,1)',
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
      boxShadow: '0 4px 16px #00885530'
    }}>
      {msg}
    </div>
  );
}
