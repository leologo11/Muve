import React from 'react';
import ReactDOM from 'react-dom/client';
import DriverApp from './DriverApp.jsx';
import './index.css';

// Marks this as the mobile/Capacitor build so index.css can disable
// scrollbar-gutter reservation (a desktop-scrollbar affordance that just
// wastes a strip of viewport on a mobile WebView with overlay scrollbars).
document.documentElement.classList.add('driver-app');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <DriverApp />
  </React.StrictMode>
);
