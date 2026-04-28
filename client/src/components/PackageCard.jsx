import React from 'react';

const STATUS_COLOR = { pendiente: '#777788', entregado: '#008855', 'no-entregado': '#cc2244', eliminado: '#c04a1a' };
const STATUS_LABEL = { pendiente: '⏳ PENDIENTE', entregado: '✅ ENTREGADO', 'no-entregado': '❌ NO ENTREGADO', eliminado: '🗑️ ELIMINADO' };
const STATUS_CLASS = { pendiente: 'ep', entregado: 'ee', 'no-entregado': 'en', eliminado: 'eel' };

export default function PackageCard({ pkg, index, onEdit, onStatusChange, onDelete, onRestore, readOnly }) {
  const st = pkg.status;
  const color = STATUS_COLOR[st] || '#888';
  const isElim = st === 'eliminado';

  return (
    <div style={{
      margin: '0 10px 8px',
      borderRadius: 14,
      border: `1px solid ${isElim ? '#c04a1a22' : st === 'entregado' ? '#00885533' : st === 'no-entregado' ? '#cc224433' : 'var(--border)'}`,
      background: isElim ? '#fff' : st === 'entregado' ? '#edfff5' : st === 'no-entregado' ? '#fff0f3' : '#fff',
      opacity: isElim ? 0.5 : 1,
      overflow: 'hidden',
      boxShadow: '0 1px 4px #0000000a',
      animation: 'fadeIn .2s ease'
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', padding: '12px 10px 8px 0' }}>
        {/* Number + thumb */}
        <div style={{ width: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, paddingTop: 2, flexShrink: 0 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: color + '22', color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700
          }}>
            {st === 'entregado' ? '✓' : st === 'no-entregado' ? '✗' : st === 'eliminado' ? '✕' : index + 1}
          </div>
          {pkg.photoUrl && (
            <img
              src={pkg.photoUrl}
              alt=""
              style={{ width: 32, height: 32, borderRadius: 7, objectFit: 'cover', border: '1px solid var(--border)', cursor: 'pointer' }}
              onClick={() => window.open(pkg.photoUrl, '_blank')}
            />
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 15, fontWeight: 700, lineHeight: 1.15,
            textDecoration: isElim ? 'line-through' : 'none',
            opacity: isElim ? 0.45 : 1
          }}>
            {pkg.customerName} {pkg.customerLastName}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, lineHeight: 1.4 }}>
            {pkg.address}{pkg.commune ? `, ${pkg.commune}` : ''}
          </div>
          {pkg.aptFloor && (
            <div style={{ fontSize: 11, color: 'var(--warn)', marginTop: 1, fontWeight: 600 }}>{pkg.aptFloor}</div>
          )}
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginTop: 3 }}>
            ${(pkg.price || 0).toLocaleString('es-CL')}
          </div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 5,
            padding: '2px 9px', borderRadius: 20, fontSize: 9, fontWeight: 700, letterSpacing: .5,
            background: color + '12', color, border: `1px solid ${color}30`
          }}>
            {STATUS_LABEL[st] || st}
          </span>
          {pkg.failReason && (
            <div style={{ fontSize: 10, color: 'var(--danger)', marginTop: 2 }}>↳ {pkg.failReason}</div>
          )}
        </div>

        {/* Nav buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0, paddingLeft: 7 }}>
          {pkg.customerPhone && (
            <a href={`tel:${pkg.customerPhone}`} style={navBtn('#008855')}>📞 LLAMAR</a>
          )}
          <a
            href={`https://waze.com/ul?q=${encodeURIComponent(pkg.address + ', ' + (pkg.commune || '') + ', Chile')}&navigate=yes`}
            style={navBtn('#0077aa')}
          >🔵 WAZE</a>
          <a
            href={`https://maps.google.com/maps?daddr=${pkg.lat || 0},${pkg.lng || 0}&dir_action=navigate`}
            style={navBtn('#2a9940')}
          >📍 MAPS</a>
        </div>
      </div>

      {/* Action buttons */}
      {!readOnly && (
        <div style={{ display: 'flex', gap: 5, padding: '0 10px 10px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {isElim ? (
            <button onClick={() => onRestore?.(pkg)} style={actionBtn('#008855')}>↩ Restaurar</button>
          ) : (
            <>
              <button onClick={() => onStatusChange?.(pkg, 'entregado')} style={actionBtn('#008855', '#fff')}>✅ Entregado</button>
              <button onClick={() => onStatusChange?.(pkg, 'no-entregado')} style={actionBtn('#cc2244', '#fff')}>❌ No entregado</button>
              <button onClick={() => onEdit?.(pkg)} style={actionBtn('#d4650a')}>📷 Foto/Nota</button>
              {st !== 'pendiente' && (
                <button onClick={() => onStatusChange?.(pkg, 'pendiente')} style={actionBtn('#555')}>↩ Deshacer</button>
              )}
              <button onClick={() => onDelete?.(pkg)} style={actionBtn('#c04a1a')}>🗑️ Eliminar</button>
            </>
          )}
        </div>
      )}

      {pkg.note && (
        <div style={{
          margin: '0 10px 9px', padding: '6px 10px', borderRadius: 9,
          background: '#3b82f610', border: '1px solid #3b82f628',
          fontSize: 11, color: '#3366cc'
        }}>
          📝 {pkg.note}
        </div>
      )}
    </div>
  );
}

function navBtn(color) {
  return {
    padding: '5px 9px', borderRadius: 8, fontSize: 10, fontWeight: 700, border: 'none',
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, textDecoration: 'none',
    whiteSpace: 'nowrap', background: color + '12', color, border: `1px solid ${color}30`
  };
}

function actionBtn(color, textColor) {
  return {
    flexShrink: 0, padding: '7px 12px', borderRadius: 22, fontSize: 11, fontWeight: 700,
    border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
    background: textColor ? color : color + '15',
    color: textColor || color,
    border: textColor ? 'none' : `1px solid ${color}30`
  };
}
