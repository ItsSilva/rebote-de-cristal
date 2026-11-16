import { type Side } from "./rules";
export type Mode = "auto" | "cpu" | "esperar" | "pvp";
export type ClubState = {
  session: string;
  host: string;
  seats: [string, string | null];
  mode: Mode;
  ready: [boolean, boolean];
  revision: number;
  closed: boolean;
};
// Server-owned serialized admission: first arrival is the host. All mutations are synchronous.
export class Club {
  state: ClubState;
  constructor(host: string, session: string) {
    this.state = {
      session,
      host,
      seats: [host, null],
      mode: "auto",
      ready: [false, false],
      revision: 0,
      closed: false,
    };
  }
  admit(id: string) {
    const s = this.state;
    if (s.closed) return "Sala cerrada";
    if (s.seats.includes(id)) return null;
    if (s.mode === "cpu") return "Partida individual";
    if (s.seats[1]) return "Sala llena";
    s.seats[1] = id;
    s.ready = [false, false];
    s.revision++;
    return null;
  }
  side(id: string): Side | null {
    const i = this.state.seats.indexOf(id);
    return i < 0 ? null : (i as Side);
  }
  choose(id: string, mode: Mode) {
    const s = this.state;
    if (id !== s.host || !["auto", "cpu", "esperar"].includes(mode))
      return false;
    s.mode = mode;
    s.ready = [false, false];
    s.revision++;
    return true;
  }
  ready(id: string) {
    const s = this.state,
      i = this.side(id);
    if (i === null || !s.seats[1] || s.closed || s.ready[i] || s.mode === "pvp")
      return false;
    s.ready[i] = true;
    s.revision++;
    if (s.ready.every(Boolean)) {
      s.mode = "pvp";
      return true;
    }
    return false;
  }
  leave(id: string) {
    const s = this.state;
    if (id === s.host) {
      s.closed = true;
      s.revision++;
      return "host";
    }
    if (id === s.seats[1]) {
      s.seats[1] = null;
      s.ready = [false, false];
      s.mode = "esperar";
      s.revision++;
      return "guest";
    }
    return null;
  }
}
