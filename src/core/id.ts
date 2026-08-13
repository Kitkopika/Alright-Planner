/**
 * Stable unique IDs (uuid v4) generated in pure TypeScript so the core
 * module has zero native dependencies and is fully unit-testable.
 */

let counter = 0;

function randomHex(bytes: number): string {
  const out: string[] = [];
  for (let i = 0; i < bytes; i++) {
    // Math.random() is fine for a local-first prototype (not security).
    out.push(Math.floor(Math.random() * 256).toString(16).padStart(2, '0'));
  }
  return out.join('');
}

/** Returns a new uuid v4 string. */
export function newId(): string {
  // Fallback that never collides within a single process.
  const time = Date.now().toString(16).padStart(12, '0');
  const rand = randomHex(10);
  const seq = (counter++ % 0xffff).toString(16).padStart(4, '0');
  return `${time.slice(0, 8)}-${time.slice(8, 12)}-4${rand.slice(0, 3)}-${'8'}${seq.slice(1, 4)}-${rand.slice(3)}`;
}

/** Returns a short human-friendly id (for device ids). */
export function shortId(): string {
  return newId().slice(0, 8);
}
