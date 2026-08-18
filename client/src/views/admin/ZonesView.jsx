import React from 'react';
import Header from '../../components/Header.jsx';
import Toast from '../../components/Toast.jsx';
import SectorMap from './SectorMap.jsx';

export default function ZonesView({ onBack }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header title="🗺 Zonas y precios" onBack={onBack} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SectorMap />
      </div>
      <Toast />
    </div>
  );
}
