import {
  v,
  add,
  sub,
  mul,
  dot,
  len,
  norm,
  lerp,
  cross,
  clamp,
  finite,
  type V,
} from "./math";
import { Rules, type Side } from "./rules";
export const SIZE = {
  length: 2.74,
  width: 1.525,
  top: 0.76,
  net: 0.1525,
  radius: 0.02,
  paddleRadius: 0.09,
  step: 1 / 120,
};
export type Paddle = {
  p: V;
  previous: V;
  n: V;
  oldNormal: V;
  velocity: V;
  angular: V;
  active: boolean;
  sample: number;
};
export const paddle = (s: Side): Paddle => ({
  p: v(0, 0.98, s === 0 ? 1.5 : -1.5),
  previous: v(0, 0.98, s === 0 ? 1.5 : -1.5),
  n: v(0, 0.24, s === 0 ? -1 : 1),
  oldNormal: v(0, 0.24, s === 0 ? -1 : 1),
  velocity: v(),
  angular: v(),
  active: false,
  sample: 0,
});
export type Contact = {
  t: number;
  kind: "mesa" | "red" | "pala";
  side?: Side;
  normal: V;
  point: V;
};
// Sphere vs finite moving disk. Relative movement includes the paddle's frame sweep.
export function sweepPaddle(a: V, b: V, p: Paddle, r = 0.02): Contact | null {
  const n = norm(p.n),
    da = dot(sub(a, p.previous), n),
    db = dot(sub(b, p.p), n);
  const sign = da >= 0 ? 1 : -1,
    d0 = da * sign - r - 0.009,
    d1 = db * sign - r - 0.009;
  if (d0 < -0.035 || d1 > 0 || d0 <= d1) return null;
  const t = clamp(d0 / (d0 - d1), 0, 1),
    c = lerp(p.previous, p.p, t),
    q = lerp(a, b, t),
    off = sub(q, c);
  const planar = sub(off, mul(n, dot(off, n)));
  if (len(planar) > 0.09 + r) return null;
  return { t, kind: "pala", normal: mul(n, sign), point: q };
}
export class Simulation {
  rules = new Rules();
  p = v(0, 1.1, 1.08);
  velocity = v();
  paddles = [paddle(0), paddle(1)];
  time = 0;
  active = false;
  cooldown = [0, 0];
  age = 0;
  pointAge = 0;
  cpu = true;
  /** Dificultad de la CPU: 0 fácil, 1 normal (la de la entrega), 2 difícil. */
  cpuLevel: 0 | 1 | 2 = 1;
  cpuClock = 0;
  events: { kind: string; id: number; side?: Side }[] = [];
  eventId = 0;
  lastPose = [0, 0];
  sound(kind: string, side?: Side) {
    this.events.push({ kind, id: ++this.eventId, side });
    if (this.events.length > 16) this.events.shift();
  }
  pose(s: Side, pos: V, normal: V, dt: number, active = true) {
    if (!finite(pos) || !finite(normal) || len(normal) < 0.5) return;
    const p = this.paddles[s],
      d = clamp(dt, 0.004, 0.1),
      delta = sub(pos, p.p);
    if (len(delta) > 0.55) {
      p.active = false;
      p.previous = { ...pos };
      p.p = { ...pos };
      p.velocity = v();
      p.angular = v();
      return;
    }
    p.previous = { ...p.p };
    p.oldNormal = { ...p.n };
    p.velocity = mul(delta, 1 / d);
    if (len(p.velocity) > 8) p.velocity = mul(norm(p.velocity), 8);
    p.angular = mul(cross(norm(p.n), norm(normal)), 1 / d);
    p.p = { ...pos };
    p.n = norm(normal);
    p.active = active;
    p.sample = this.time;
  }
  toss(s: Side) {
    if (s !== this.rules.server || !this.rules.toss()) return false;
    const sign = s === 0 ? 1 : -1;
    this.p = v(clamp(this.paddles[s].p.x, -0.5, 0.5), 1.08, sign * 1.1);
    this.velocity = v(0, 1.6, 0);
    this.active = true;
    this.age = 0;
    this.cooldown = [0, 0];
    return true;
  }
  recover(reason = "Bola recuperada. Repite el saque.") {
    this.active = false;
    this.velocity = v();
    this.rules.prepare();
    this.rules.reason = reason;
    this.age = 0;
  }
  step(dt = SIZE.step) {
    this.time += dt;
    this.cooldown[0] -= dt;
    this.cooldown[1] -= dt;
    if (this.rules.phase === "pausa" || this.rules.phase === "fin") return;
    if (this.rules.phase === "punto") {
      this.pointAge += dt;
      if (this.pointAge > 1.6) {
        this.rules.prepare();
        this.pointAge = 0;
        this.active = false;
      }
      return;
    }
    if (this.cpu) this.bot(dt);
    if (!this.active) return;
    this.age += dt;
    if (this.age > 12 || !finite(this.p) || !finite(this.velocity)) {
      this.recover("Bola inmóvil o perdida: repite el saque.");
      return;
    }
    this.velocity.y -= 9.81 * dt;
    this.velocity = mul(this.velocity, Math.exp(-0.1 * dt));
    let remaining = dt;
    for (
      let iteration = 0;
      iteration < 4 && remaining > 1e-5 && this.active;
      iteration++
    ) {
      const a = this.p,
        b = add(a, mul(this.velocity, remaining)),
        contacts: Contact[] = [];
      const tableY = SIZE.top + SIZE.radius;
      if (a.y >= tableY - 1e-5 && b.y < tableY) {
        const t = (a.y - tableY) / (a.y - b.y),
          point = lerp(a, b, t);
        if (
          Math.abs(point.x) <= SIZE.width / 2 + SIZE.radius &&
          Math.abs(point.z) <= SIZE.length / 2 + SIZE.radius
        )
          contacts.push({ t, kind: "mesa", normal: v(0, 1, 0), point });
      }
      // net is a two-sided thin slab, continuous collision at its leading face.
      const sign = a.z >= 0 ? 1 : -1,
        face = sign * (SIZE.radius + 0.006);
      if ((a.z - face) * sign >= 0 && (b.z - face) * sign < 0) {
        const t = (a.z - face) / (a.z - b.z),
          point = lerp(a, b, t);
        if (
          Math.abs(point.x) < SIZE.width / 2 + 0.035 &&
          point.y < SIZE.top + SIZE.net + SIZE.radius &&
          point.y > SIZE.top - 0.03
        )
          contacts.push({ t, kind: "red", normal: v(0, 0, sign), point });
      }
      for (const s of [0, 1] as Side[]) {
        const p = this.paddles[s];
        if (!p.active || this.cooldown[s] > 0 || this.time - p.sample > 0.3)
          continue;
        const hit = sweepPaddle(a, b, p);
        if (hit) contacts.push({ ...hit, side: s });
      }
      contacts.sort((x, y) => x.t - y.t);
      const hit = contacts[0];
      if (!hit) {
        this.p = b;
        break;
      }
      this.p = add(hit.point, mul(hit.normal, 0.001));
      remaining *= 1 - hit.t;
      if (hit.kind === "mesa") {
        this.velocity.y = Math.abs(this.velocity.y) * 0.89;
        this.velocity.x *= 0.98;
        this.velocity.z *= 0.98;
        this.rules.bounce(this.p.z >= 0 ? 0 : 1);
        this.sound("mesa");
      } else if (hit.kind === "red") {
        this.rules.net = true;
        this.velocity.z *= -0.22;
        this.velocity.x *= 0.7;
        this.velocity.y *= 0.7;
        this.sound("red");
      } else {
        const s = hit.side!,
          p = this.paddles[s],
          serving = this.rules.phase === "saque";
        if (this.rules.hit(s)) {
          this.reflect(s, hit.normal, p, serving);
          this.cooldown[s] = 0.1;
          this.age = 0;
          this.sound("pala", s);
        }
      }
      if (this.resolved()) {
        this.active = false;
        this.pointAge = 0;
        this.sound("punto", this.rules.winner!);
      }
      for (const p of this.paddles) p.previous = { ...p.p };
    }
    if (
      this.p.y < 0.04 ||
      Math.abs(this.p.z) > 3.2 ||
      Math.abs(this.p.x) > 2.6
    ) {
      this.rules.out();
      this.active = false;
      if (this.resolved()) this.sound("punto", this.rules.winner!);
    }
    if (!this.active && this.rules.phase === "saque")
      this.rules.phase = "preparacion";
  }
  resolved() {
    return this.rules.phase === "punto" || this.rules.phase === "fin";
  }
  bot(dt: number) {
    const p = this.paddles[1];
    p.active = true;
    p.sample = this.time;
    if (this.rules.phase === "preparacion" && this.rules.server === 1) {
      this.cpuClock += dt;
      if (this.cpuClock > 0.9) {
        p.p = v(0, 1.12, -1.2);
        p.previous = { ...p.p };
        p.n = norm(v(0, -0.46, 1));
        this.toss(1);
        this.cpuClock = 0;
      }
      return;
    }
    if (this.rules.phase === "saque" && this.rules.server === 1) {
      const target = v(this.p.x, this.p.y, -0.98);
      this.moveBot(target, norm(v(0, -0.55, 1)), dt, 1.7);
      return;
    }
    if (this.rules.phase !== "juego" || this.rules.last === 1) return;
    const time = (-1.12 - this.p.z) / (this.velocity.z || -1),
      t = clamp(time, 0, 0.65);
    // Reach and reaction are deliberately bounded. Error varies by rally; no teleport.
    this.cpuClock += dt;
    const level = this.cpuLevel,
      reaction = [0.26, 0.14, 0.09][level],
      botSpeed = [1.3, 1.8, 2.3][level],
      slip = [0.32, 0.18, 0.07][level],
      wobble = [0.05, 0.025, 0.012][level];
    if (this.cpuClock < reaction) return;
    const miss =
      this.rules.rally % 5 === 0
        ? slip
        : wobble * Math.sin(this.rules.rally * 2.1);
    let y = this.p.y + this.velocity.y * t - 4.905 * t * t;
    if (y < 0.8) y = 0.8 + (0.8 - y) * 0.75;
    const stroke =
      this.rules.serveStage === 0 &&
      this.rules.bounces === 1 &&
      this.p.z < -0.58;
    const target = v(
      clamp(this.p.x + this.velocity.x * t + miss, -0.66, 0.66),
      clamp(y, 0.85, 1.35),
      stroke ? -0.9 : -1.24,
    );
    this.moveBot(target, norm(v(0, 0.6, 1)), dt, botSpeed);
  }
  moveBot(target: V, n: V, dt: number, speed: number) {
    const p = this.paddles[1],
      d = sub(target, p.p);
    this.pose(1, add(p.p, mul(norm(d), Math.min(len(d), speed * dt))), n, dt);
  }
  reflect(s: Side, n: V, p: Paddle, serving = false) {
    const localVelocity = add(p.velocity, cross(p.angular, sub(this.p, p.p))),
      relative = sub(this.velocity, localVelocity);
    this.velocity = add(
      sub(relative, mul(n, 1.72 * dot(relative, n))),
      localVelocity,
    );
    if (len(this.velocity) > 8) this.velocity = mul(norm(this.velocity), 8);
    if (!serving && this.velocity.z * (s === 0 ? -1 : 1) > 0)
      this.velocity.z =
        (s === 0 ? -1 : 1) * clamp(Math.abs(this.velocity.z), 2.6, 5.5);
  }
  snapshot() {
    return {
      rules: { ...this.rules, score: [...this.rules.score] },
      p: { ...this.p },
      velocity: { ...this.velocity },
      active: this.active,
      time: this.time,
      paddles: this.paddles.map((p) => ({
        ...p,
        p: { ...p.p },
        previous: { ...p.previous },
        n: { ...p.n },
        oldNormal: { ...p.oldNormal },
        velocity: { ...p.velocity },
        angular: { ...p.angular },
      })),
      events: this.events.map((e) => ({ ...e })),
      eventId: this.eventId,
    };
  }
  apply(s: ReturnType<Simulation["snapshot"]>) {
    Object.assign(this.rules, s.rules);
    this.p = { ...s.p };
    this.velocity = { ...s.velocity };
    this.active = s.active;
    this.time = s.time;
    this.events = s.events.map((e) => ({ ...e }));
    this.eventId = s.eventId;
    this.paddles = s.paddles.map((p) => ({
      ...p,
      p: { ...p.p },
      previous: { ...p.previous },
      n: { ...p.n },
      oldNormal: { ...p.oldNormal },
      velocity: { ...p.velocity },
      angular: { ...p.angular },
    }));
  }
}
