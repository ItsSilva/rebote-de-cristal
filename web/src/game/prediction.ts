import { type V, v } from "./math";
// Short visual extrapolation with table bounces. Never writes authoritative state.
export function predictBall(position: V, velocity: V, seconds: number) {
  const p = { ...position },
    speed = { ...velocity };
  let rest = Math.min(0.25, Math.max(0, seconds));
  for (let i = 0; i < 3 && rest > 0; i++) {
    const discriminant = speed.y * speed.y + 19.62 * (p.y - 0.78);
    const impact =
      discriminant >= 0 ? (speed.y + Math.sqrt(discriminant)) / 9.81 : Infinity;
    const x = p.x + speed.x * impact,
      z = p.z + speed.z * impact;
    if (
      impact > 1e-5 &&
      impact < rest &&
      Math.abs(x) < 0.7825 &&
      Math.abs(z) < 1.39
    ) {
      p.x = x;
      p.z = z;
      p.y = 0.7801;
      speed.y = -(speed.y - 9.81 * impact) * 0.89;
      speed.x *= 0.98;
      speed.z *= 0.98;
      rest -= impact;
    } else {
      p.x += speed.x * rest;
      p.z += speed.z * rest;
      p.y += speed.y * rest - 4.905 * rest * rest;
      rest = 0;
    }
  }
  return v(p.x, p.y, p.z);
}
