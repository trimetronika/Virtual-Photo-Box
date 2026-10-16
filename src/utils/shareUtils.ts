/**
 * Generates the correct public, shareable URL for a room.
 * In AI Studio, the dev preview uses `ais-dev-...` which is private to the developer.
 * The public shared preview URL uses `ais-pre-...` which anyone can access without 404 / login error.
 */
export function getShareableRoomUrl(roomCode: string): string {
  if (typeof window === 'undefined') return '';

  const code = (roomCode || '').toUpperCase().trim();
  let origin = window.location.origin;

  // In Google AI Studio, ais-dev- is private to the developer session.
  // Converting ais-dev- to ais-pre- points to the public shared app URL.
  if (origin.includes('ais-dev-')) {
    origin = origin.replace('ais-dev-', 'ais-pre-');
  }

  try {
    const url = new URL(origin);
    url.pathname = '/';
    url.search = '';
    url.searchParams.set('room', code);
    return url.toString();
  } catch {
    return `${origin}/?room=${code}`;
  }
}

export function getShareMessage(roomCode: string): string {
  const code = (roomCode || '').toUpperCase().trim();
  const url = getShareableRoomUrl(code);
  return `Ayo foto bareng di K-Photobox! 📸✨\n\nKlik link ini untuk langsung bergabung:\n${url}\n\nAtau buka web dan masukkan Kode Room:\n${code}`;
}
