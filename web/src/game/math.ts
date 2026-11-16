export type V = { x: number; y: number; z: number };
export const v = (x = 0, y = 0, z = 0): V => ({ x, y, z });
export const add = (a: V, b: V): V => v(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a: V, b: V): V => v(a.x - b.x, a.y - b.y, a.z - b.z);
export const mul = (a: V, s: number): V => v(a.x * s, a.y * s, a.z * s);
export const dot = (a: V, b: V) => a.x * b.x + a.y * b.y + a.z * b.z;
export const len = (a: V) => Math.sqrt(dot(a, a));
export const norm = (a: V) => mul(a, 1 / (len(a) || 1));
export const cross = (a: V, b: V): V =>
  v(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const lerp = (a: V, b: V, t: number) => add(a, mul(sub(b, a), t));
export const clamp = (x: number, a: number, b: number) =>
  Math.min(b, Math.max(a, x));
export const finite = (a: V) => a && [a.x, a.y, a.z].every(Number.isFinite);
