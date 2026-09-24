/**
 * The browser's current position, as { lat, lng }. Rejects with a readable
 * message if the device can't give one or the user denies permission — the
 * field flow forces location, so a rejection blocks check-in / check-out.
 */
export function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Location is not available on this device'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? 'Location permission is off — turn it on to check in'
              : 'Could not read your location. Try again where the signal is better.',
          ),
        ),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    )
  })
}
