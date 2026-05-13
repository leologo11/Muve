const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID || '1365904715457691';

let initialized = false;

function isAdminPath() {
  if (typeof window === 'undefined') return false;
  const p = window.location.pathname;
  return p.startsWith('/admin') || p.startsWith('/app');
}

export function initMetaPixel() {
  if (!PIXEL_ID || initialized || typeof window === 'undefined') return;
  if (isAdminPath()) return;

  /* eslint-disable */
  !(function(f,b,e,v,n,t,s){
    if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */

  window.fbq('init', PIXEL_ID);
  initialized = true;
}

export function trackPageView() {
  if (isAdminPath()) return;
  initMetaPixel();
  if (window.fbq) window.fbq('track', 'PageView');
}

export function trackMetaEvent(name, params = {}) {
  if (isAdminPath()) return;
  initMetaPixel();
  if (window.fbq) window.fbq('track', name, params);
}

// Funnel step tracking — maps step numbers to Pixel events
// serviceType: 'flete' | 'mudanza' | 'paqueteria'
// step: 1..4
export function trackFunnelStep(step, serviceType) {
  if (isAdminPath() || !serviceType) return;
  initMetaPixel();
  if (!window.fbq) return;

  if (step === 2) {
    // User selected a service and moved to step 2
    window.fbq('track', 'ViewContent', {
      content_name: `Cotizacion ${serviceType}`,
      content_category: serviceType,
    });
  } else if (step === 3 && serviceType !== 'paqueteria') {
    // Addresses confirmed, entering inventory/extras step
    window.fbq('track', 'AddToCart', {
      content_name: `Cotizacion ${serviceType} - Paso inventario`,
      content_category: serviceType,
    });
  } else if (step === 4) {
    // Entering contact details step — high intent
    window.fbq('track', 'InitiateCheckout', {
      content_name: `Cotizacion ${serviceType} - Datos de contacto`,
      content_category: serviceType,
    });
  }
}
