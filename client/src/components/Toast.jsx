import React, { useState, useCallback, useRef } from 'react';

let _show = null;

export function toast(msg, duration = 2600) {
  _show?.(msg, duration);
}

function classify(msg) {
  if (!msg) return 'success';
  const s = String(msg);
  if (s.startsWith('❌') || s.startsWith('⛔') || s.toLowerCase().includes('error')) return 'error';
  if (s.startsWith('⚠')  || s.startsWith('⚡')) return 'warn';
  if (s.startsWith('📋') || s.startsWith('ℹ') || s.startsWith('🔗')) return 'info';
  return 'success';
}

const TYPE_STYLE = {
  success: { bg: 'var(--accent)',  shadow: '#00885530' },
  error:   { bg: 'var(--danger)', shadow: '#cc224430' },
  warn:    { bg: 'var(--warn)',    shadow: '#d4650a30' },
  info:    { bg: 'var(--info)',    shadow: '#0077aa30' },
};

export default function Toast() {
  const [msg, setMsg]         = useState('');
  const [visible, setVisible] = useState(false);
  const [type, setType]       = useState('success');
  const timerRef              = useRef(null);

  _show = useCallback((m, d) => {
    setMsg(m);
    setType(classify(m));
    setVisible(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), d);
  }, []);

  const style = TYPE_STYLE[type] || TYPE_STYLE.success;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: 'fixed',
        bottom: 'calc(28px + env(safe-area-inset-bottom))',
        left: '50%',
        transform: `translateX(-50%) translateY(${visible ? 0 : '80px'}) scale(${visible ? 1 : .9})`,
        background: style.bg,
        color: '#fff',
        padding: '11px 22px',
        borderRadius: 'var(--r-full)',
        fontSize: 13,
        fontWeight: 700,
        zIndex: 9999,
        transition: `transform .3s var(--ease-spring), opacity .25s var(--ease)`,
        opacity: visible ? 1 : 0,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        boxShadow: `0 4px 20px ${style.shadow}, 0 1px 4px #00000020`,
        maxWidth: 'calc(100vw - 40px)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        letterSpacing: '.1px'
      }}
    >
      {msg}
    </div>
  );
}
