const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID;

let initialized = false;

export function initMetaPixel() {
  if (!PIXEL_ID || initialized || typeof window === 'undefined') return;

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
  initMetaPixel();
  if (window.fbq) window.fbq('track', 'PageView');
}

export function trackMetaEvent(name, params = {}) {
  initMetaPixel();
  if (window.fbq) window.fbq('track', name, params);
}
