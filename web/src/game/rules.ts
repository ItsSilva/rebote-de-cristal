export type Side = 0 | 1;
export type Phase =
  | "preparacion"
  | "saque"
  | "juego"
  | "punto"
  | "fin"
  | "pausa";
export const other = (s: Side): Side => (s === 0 ? 1 : 0);
export const service = (a: number, b: number): Side =>
  (a >= 6 && b >= 6 ? (a + b) % 2 : Math.floor((a + b) / 2) % 2) as Side;
export class Rules {
  score: [number, number] = [0, 0];
  phase: Phase = "preparacion";
  server: Side = 0;
  rally = 1;
  revision = 0;
  last: Side = 0;
  bounces = 0;
  serveStage = 0;
  net = false;
  /** La bola tocó la red en el golpe actual (no solo en el saque). */
  shotNet = false;
  reason = "Toma la pala. Activa el saque. Devuelve tras el primer bote.";
  winner: Side | null = null;
  hits = 0;
  prepare() {
    if (this.phase === "fin") return;
    this.rally++;
    this.phase = "preparacion";
    this.server = service(...this.score);
    this.last = this.server;
    this.bounces = 0;
    this.serveStage = 0;
    this.net = false;
    this.shotNet = false;
    this.revision++;
  }
  toss() {
    if (this.phase !== "preparacion") return false;
    this.phase = "saque";
    this.reason = "Golpea la bola: primero tu campo, después el contrario.";
    this.revision++;
    return true;
  }
  hit(s: Side) {
    if (this.phase === "saque") {
      if (s !== this.server) return false;
      this.phase = "juego";
      this.last = s;
      this.bounces = 0;
      this.serveStage = 1;
      this.shotNet = false;
      this.hits++;
      this.revision++;
      return true;
    }
    if (this.phase !== "juego") return false;
    if (s === this.last) {
      this.point(other(s), "Doble golpe");
      return false;
    }
    if (this.serveStage !== 0 || this.bounces !== 1) {
      this.point(other(s), "Volea");
      return false;
    }
    this.last = s;
    this.bounces = 0;
    this.shotNet = false;
    this.hits++;
    this.revision++;
    return true;
  }
  bounce(s: Side) {
    if (this.phase === "saque") {
      this.phase = "preparacion";
      this.reason = "Preparación sin golpe. Puedes repetir.";
      this.revision++;
      return;
    }
    if (this.phase !== "juego") return;
    if (this.serveStage === 1) {
      if (s !== this.server) {
        this.point(other(this.server), "Saque: falta primer bote propio");
        return;
      }
      this.serveStage = 2;
      this.revision++;
      return;
    }
    if (this.serveStage === 2) {
      if (s === this.server) {
        this.point(other(this.server), "Saque: segundo bote propio");
        return;
      }
      if (this.net) {
        this.prepare();
        this.reason = "Let: red y dos botes válidos. Repite el saque.";
        return;
      }
      this.serveStage = 0;
      this.bounces = 1;
      this.revision++;
      return;
    }
    if (s === this.last) {
      this.point(
        other(this.last),
        this.shotNet ? "Tocó la red y no pasó" : "Botó en su propio lado",
      );
      return;
    }
    if (++this.bounces >= 2) this.point(this.last, "Segundo bote");
    else {
      this.reason = "Devuelve después del bote";
      this.revision++;
    }
  }
  out() {
    if (this.phase === "saque") {
      this.phase = "preparacion";
      this.reason = "Preparación sin golpe. Repite el lanzamiento.";
      this.revision++;
    } else if (this.phase === "juego")
      this.point(
        this.bounces === 1 && this.serveStage === 0
          ? this.last
          : other(this.last),
        this.shotNet && this.bounces === 0 ? "Tocó la red y salió" : "Fuera",
      );
  }
  point(s: Side, why: string, rally = this.rally) {
    if (this.phase !== "juego" || rally !== this.rally) return false;
    this.score[s]++;
    this.reason = why;
    this.winner = s;
    this.revision++;
    this.phase =
      this.score[s] >= 7 && this.score[s] - this.score[other(s)] >= 2
        ? "fin"
        : "punto";
    this.server = service(...this.score);
    return true;
  }
  reset() {
    this.score = [0, 0];
    this.phase = "preparacion";
    this.winner = null;
    this.hits = 0;
    this.reason = "Revancha: 0–0. Toma la pala y prepara el saque.";
    this.prepare();
  }
  pause(why = "Pausa. Pulsa continuar para repetir el saque.") {
    if (this.phase === "fin") return;
    this.phase = "pausa";
    this.rally++;
    this.reason = why;
    this.revision++;
  }
}
