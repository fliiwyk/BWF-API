// Cache memoire simple avec TTL + anti-stampede (une seule requete BWF a la fois par cle).

const store = new Map(); // key -> { value, expires }
const inflight = new Map(); // key -> Promise

/**
 * Renvoie la valeur en cache si fraiche, sinon appelle producer() et met en cache.
 * @param {string} key
 * @param {number} ttlMs duree de validite
 * @param {() => Promise<any>} producer
 */
export async function cached(key, ttlMs, producer) {
  const hit = store.get(key);
  const now = Date.now();
  if (hit && hit.expires > now) {
    return { value: hit.value, fromCache: true, ageMs: now - (hit.expires - ttlMs) };
  }
  // Anti-stampede : si une requete est deja en cours pour cette cle, on l'attend.
  if (inflight.has(key)) {
    const value = await inflight.get(key);
    return { value, fromCache: false, ageMs: 0 };
  }
  const p = (async () => {
    try {
      const value = await producer();
      store.set(key, { value, expires: Date.now() + ttlMs });
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  const value = await p;
  return { value, fromCache: false, ageMs: 0 };
}

export function invalidate(key) {
  store.delete(key);
}
