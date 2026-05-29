// Native GPS wrapper — uses @capacitor/geolocation on Android/iOS,
// falls back to browser navigator.geolocation on web.

function isNativePlatform() {
  try { return !!(window.Capacitor?.isNativePlatform?.()); } catch (_) { return false; }
}

export const isNative = isNativePlatform();

export async function requestGeoPermissions() {
  if (!isNative) return true;
  try {
    const { Geolocation } = await import('@capacitor/geolocation');
    const res = await Geolocation.requestPermissions();
    return res.location === 'granted' || res.coarseLocation === 'granted';
  } catch (_) { return true; }
}

// Returns a watch handle { type, id } for clearGeoWatch()
export async function watchGeoPosition(onSuccess, onError, opts = {}) {
  const options = { enableHighAccuracy: true, timeout: 10000, maximumAge: 2000, ...opts };

  if (isNative) {
    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      await requestGeoPermissions();
      const id = await Geolocation.watchPosition(options, (pos, err) => {
        if (err) { onError?.({ code: 2, message: err.message }); return; }
        if (pos?.coords) onSuccess(pos);
      });
      return { type: 'native', id };
    } catch (e) {
      console.warn('[geo] native watchPosition failed, falling back to browser', e);
    }
  }

  if (!navigator.geolocation) {
    onError?.({ code: 2, message: 'Geolocation not supported' });
    return { type: 'none', id: null };
  }

  const id = navigator.geolocation.watchPosition(onSuccess, onError, options);
  return { type: 'browser', id };
}

export async function clearGeoWatch(handle) {
  if (!handle || handle.type === 'none') return;
  try {
    if (handle.type === 'native') {
      const { Geolocation } = await import('@capacitor/geolocation');
      await Geolocation.clearWatch({ id: handle.id });
    } else {
      navigator.geolocation.clearWatch(handle.id);
    }
  } catch (_) {}
}
