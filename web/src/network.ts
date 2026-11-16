import {
  SendQueue,
  RoomEvents,
  OwnershipModel,
  type Context,
} from "@needle-tools/engine";
import { Club, type ClubState, type Mode } from "./game/club";
import { type Simulation } from "./game/physics";
export class ClubConnection {
  club?: ClubState;
  side: 0 | 1 = 0;
  online = false;
  code = "";
  seq = 0;
  lastState = -1;
  lastPose = [-1, -1];
  lastReceived = 0;
  managed = false;
  coordinator?: Club;
  initiallyAlone = false;
  hostLocks: OwnershipModel[] = [];
  persistedRevision = -1;
  onClub = () => {};
  onState = (_s: ReturnType<Simulation["snapshot"]>) => {};
  onPose = (_p: any) => {};
  onAction = (_a: any) => {};
  onContact = (_a: any) => {};
  onPvP = () => {};
  onError = (_why: string) => {};
  constructor(public ctx: Context) {
    const c = ctx.connection;
    c.beginListen("club", (s: ClubState) => this.receiveClub(s));
    const applyState = (d: any) => {
      if (
        !this.club ||
        d.session !== this.club.session ||
        d.sender !== this.club.host ||
        d.seq <= this.lastState
      )
        return;
      this.lastState = d.seq;
      this.lastReceived = performance.now();
      this.onState(d.state);
    };
    c.beginListen("estado", applyState);
    c.beginListen("ingreso", applyState);
    c.beginListen("pose", (d: any) => {
      if (this.valid(d)) this.onPose(d);
    });
    c.beginListen("contacto", (d: any) => {
      if (this.valid(d)) this.onContact(d);
    });
    c.beginListen("accion", (d: any) => {
      if (this.valid(d)) this.onAction(d);
    });
    c.beginListen("iniciar-pvp", (d: any) => {
      if (!this.managed || d.session === this.club?.session) this.onPvP();
    });
    for (const key of ["rechazo", "cerrada"])
      c.beginListen(key, (d: any) => {
        if (d.target && d.target !== c.connectionId) return;
        this.online = false;
        this.onError(d.reason);
        if (this.managed) c.leaveRoom();
      });
    c.beginListen(RoomEvents.JoinedRoom, () => {
      this.initiallyAlone = c.usersInRoom().length === 1;
    });
    c.beginListen(RoomEvents.RoomStateSent, async () => {
      if (!this.managed) return;
      c.sendPing();
      // Needle puts the recipient first in its roster. Capture the membership count
      // from joined-room, before later join notifications modify that roster.
      // Only the server-confirmed first admission sees a one-member initial roster.
      if (this.initiallyAlone) {
        this.hostLocks = ["rebote-club", "rebote-ingreso"].map(
          (id) => new OwnershipModel(c, id),
        );
        const granted = await Promise.all(
          this.hostLocks.map((lock) => lock.requestOwnership()),
        );
        if (!granted.every(Boolean)) {
          this.onError("No se pudo reservar el anfitrión. Crea otra sala.");
          return;
        }
        this.coordinator = new Club(c.connectionId!, crypto.randomUUID());
        for (const id of c.usersInRoom().filter((id) => id !== c.connectionId))
          this.admitManaged(id);
        this.publishClub();
      }
    });
    c.beginListen(RoomEvents.UserJoinedRoom, (d) => {
      if (this.managed && this.coordinator) {
        this.admitManaged(d.userId);
        this.publishClub();
      }
    });
    c.beginListen(RoomEvents.UserLeftRoom, (d) => {
      if (!this.managed || !this.club) return;
      if (d.userId === this.club.host) {
        this.online = false;
        this.onError("El anfitrión salió. Crea una sala nueva.");
        c.leaveRoom();
        this.club = undefined;
      } else if (this.coordinator) {
        const departed = this.coordinator.leave(d.userId);
        if (departed === "guest") {
          this.publishClub();
          this.onAction({ action: "pausa", side: 0 });
        }
      }
    });
    c.beginListen("modo", (d: any) => {
      if (this.managed && this.coordinator && this.valid(d))
        this.managedMode(d.sender, d.mode);
    });
    c.beginListen("listo", (d: any) => {
      if (this.managed && this.coordinator && this.valid(d))
        this.managedReady(d.sender);
    });
  }
  receiveClub(s: ClubState) {
    const c = this.ctx.connection;
    if (this.managed && !c.usersInRoom().includes(s.host)) return;
    if (!s.seats.includes(c.connectionId!)) return;
    if (s.closed) {
      this.online = false;
      this.onError("El anfitrión salió. Crea tu propia sala.");
      return;
    }
    const changed = this.club?.session !== s.session;
    this.club = s;
    this.side = s.host === c.connectionId ? 0 : 1;
    this.online = true;
    if (changed) {
      this.seq = 0;
      this.lastState = -1;
      this.lastPose = [-1, -1];
    }
    this.onClub();
  }
  valid(d: any) {
    return (
      !this.managed ||
      !!(
        this.club &&
        d.session === this.club.session &&
        this.club.seats[d.side] === d.sender &&
        this.ctx.connection.usersInRoom().includes(d.sender)
      )
    );
  }
  admitManaged(id: string) {
    const why = this.coordinator?.admit(id);
    if (why)
      this.ctx.connection.send(
        "rechazo",
        { reason: why, target: id },
        SendQueue.Immediate,
      );
  }
  publishClub() {
    if (!this.coordinator) return;
    const s = this.coordinator.state;
    this.receiveClub({ ...s, seats: [...s.seats], ready: [...s.ready] });
    this.ctx.connection.send(
      "club",
      { ...s, guid: "rebote-club", deleteOnDisconnect: true },
      SendQueue.Immediate,
    );
  }
  managedMode(id: string, mode: Mode) {
    if (!this.coordinator?.choose(id, mode)) return;
    if (mode === "cpu" && this.coordinator.state.seats[1]) {
      const guest = this.coordinator.state.seats[1]!;
      this.ctx.connection.send(
        "rechazo",
        { reason: "El anfitrión conserva CPU. Crea tu sala.", target: guest },
        SendQueue.Immediate,
      );
      this.coordinator.leave(guest);
      this.coordinator.choose(id, "cpu");
    }
    this.publishClub();
  }
  managedReady(id: string) {
    if (!this.coordinator) return;
    const start = this.coordinator.ready(id);
    this.publishClub();
    if (start) {
      this.ctx.connection.send(
        "iniciar-pvp",
        { session: this.coordinator.state.session },
        SendQueue.Immediate,
      );
      this.onPvP();
    }
  }
  get host() {
    return !this.online || this.side === 0;
  }
  async join(code?: string) {
    this.code = (code || crypto.randomUUID().slice(0, 6))
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, "")
      .slice(0, 24);
    if (this.code.length < 4) {
      this.onError("Escribe un código de al menos 4 caracteres.");
      return;
    }
    const url = new URL(location.href);
    url.searchParams.set("room", this.code);
    history.replaceState(null, "", url);
    const configured =
      new URL(location.href).searchParams.get("transport") === "needle"
        ? "needle"
        : import.meta.env.VITE_NETWORK_URL;
    this.managed =
      configured === "needle" ||
      (!configured && !["localhost", "127.0.0.1"].includes(location.hostname));
    this.coordinator = undefined;
    this.club = undefined;
    this.online = false;
    const endpoint = this.managed
      ? undefined
      : configured ||
        `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/socket`;
    const connected = await Promise.race([
      this.ctx.connection.connect(endpoint),
      new Promise<boolean>((r) => setTimeout(() => r(false), 8000)),
    ]);
    if (!connected) {
      this.onError("Sin conexión de salas. Puedes jugar contra CPU local.");
      return;
    }
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        off();
        if (!this.online)
          this.onError("La sala no respondió. Prueba CPU local.");
        resolve();
      }, 8000);
      const off = this.ctx.connection.beginListen("club", () => {
        if (!this.online) return;
        clearTimeout(timeout);
        off();
        resolve();
      });
      this.ctx.connection.joinRoom(this.code);
      if (this.managed) {
        const done = this.ctx.connection.beginListen(
          RoomEvents.RoomStateSent,
          () => {
            done();
            if (this.online) {
              clearTimeout(timeout);
              off();
              resolve();
            }
          },
        );
      }
    });
  }
  send(key: string, payload: object) {
    if (!this.online || !this.club) return;
    this.ctx.connection.send(
      key,
      {
        ...payload,
        session: this.club.session,
        seq: ++this.seq,
        ...(this.managed
          ? { sender: this.ctx.connection.connectionId, side: this.side }
          : {}),
        ...(this.managed && key === "ingreso"
          ? { guid: "rebote-ingreso", deleteOnDisconnect: true }
          : {}),
      },
      SendQueue.Immediate,
    );
  }
  mode(mode: Mode) {
    if (this.managed && this.coordinator)
      this.managedMode(this.ctx.connection.connectionId!, mode);
    else this.send("modo", { mode });
  }
  ready() {
    if (this.managed && this.coordinator)
      this.managedReady(this.ctx.connection.connectionId!);
    else this.send("listo", {});
  }
  action(action: string) {
    this.send("accion", { action });
  }
  snapshot(sim: Simulation) {
    if (this.managed && this.persistedRevision !== sim.rules.revision) {
      this.send("ingreso", { state: sim.snapshot() });
      this.persistedRevision = sim.rules.revision;
    }
    this.send("estado", { state: sim.snapshot() });
  }
  pose(p: object, n: object, time: number, active: boolean) {
    this.send("pose", { p, n, time, active });
  }
  leave() {
    this.ctx.connection.leaveRoom();
    this.online = false;
    this.club = undefined;
  }
}
