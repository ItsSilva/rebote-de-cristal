import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import { Club, type Mode } from "../src/game/club.ts";
import { finite, len, type V } from "../src/game/math.ts";
type Peer = {
  id: string;
  ws: WebSocket;
  room?: string;
  seq: number;
  alive: boolean;
  count: number;
};
type Room = { club: Club; peers: Peer[]; snapshot?: unknown; created: number };
export function createClubServer(port = 8787) {
  const rooms = new Map<string, Room>();
  const peers = new Set<Peer>();
  const root = resolve("dist");
  const server = createServer(async (req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, protocol: 1, rooms: rooms.size }));
      return;
    }
    try {
      const pathname = decodeURIComponent(
        new URL(req.url || "/", "http://localhost").pathname,
      );
      const path = resolve(
        root,
        "." + (pathname === "/" ? "/index.html" : pathname),
      );
      if (!path.startsWith(root + sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const data = await readFile(path);
      res.writeHead(200, {
        "Content-Type":
          (
            {
              html: "text/html; charset=utf-8",
              js: "text/javascript",
              css: "text/css",
              png: "image/png",
              glb: "model/gltf-binary",
              json: "application/json",
              woff2: "font/woff2",
            } as Record<string, string>
          )[extname(path).slice(1)] || "application/octet-stream",
        "Permissions-Policy": "xr-spatial-tracking=(self)",
        "Cache-Control": path.endsWith(".html")
          ? "no-cache"
          : "public, max-age=3600",
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("No encontrado");
    }
  });
  const wss = new WebSocketServer({
    server,
    path: "/socket",
    maxPayload: 48000,
  });
  const send = (p: Peer, key: string, data?: unknown, extra = {}) => {
    if (p.ws.readyState === WebSocket.OPEN)
      p.ws.send(JSON.stringify({ key, data, ...extra }));
  };
  const broadcast = (r: Room, key: string, data: unknown, except?: Peer) =>
    r.peers.filter((p) => p !== except).forEach((p) => send(p, key, data));
  const state = (r: Room) => broadcast(r, "club", r.club.state);
  function leave(p: Peer) {
    const r = rooms.get(p.room || "");
    if (!r) return;
    const kind = r.club.leave(p.id);
    r.peers = r.peers.filter((x) => x !== p);
    broadcast(r, "user-left-room", { userId: p.id });
    state(r);
    if (kind === "host") {
      broadcast(r, "cerrada", {
        reason: "El anfitrión salió. Crea una sala nueva.",
      });
      rooms.delete(p.room!);
      r.peers.forEach((x) => {
        x.room = undefined;
      });
    } else if (!r.peers.length) rooms.delete(p.room!);
    p.room = undefined;
    p.seq = -1;
  }
  wss.on("connection", (ws) => {
    const p: Peer = { id: randomUUID(), ws, seq: -1, alive: true, count: 0 };
    peers.add(p);
    send(p, "connection-start-info", { id: p.id });
    ws.on("pong", () => (p.alive = true));
    ws.on("message", (raw) => {
      try {
        if (++p.count > 240) return;
        const parsed = JSON.parse(raw.toString());
        const messages = Array.isArray(parsed) ? parsed : [parsed];
        for (const m of messages) {
          const d = m.data || {};
          if (m.key === "ping") {
            send(p, "pong", d);
            continue;
          }
          if (m.key === "join-room") {
            if (!/^[A-Z0-9-]{4,24}$/.test(d.room)) {
              send(p, "rechazo", { reason: "Código no válido" });
              continue;
            }
            if (p.room) leave(p);
            let r = rooms.get(d.room);
            if (!r) {
              r = {
                club: new Club(p.id, randomUUID()),
                peers: [],
                created: Date.now(),
              };
              rooms.set(d.room, r);
            }
            const error = r.club.admit(p.id);
            if (error) {
              send(p, "rechazo", { reason: error });
              continue;
            }
            broadcast(r, "user-joined-room", { userId: p.id });
            r.peers.push(p);
            p.room = d.room;
            p.seq = -1;
            send(p, "joined-room", undefined, {
              room: d.room,
              viewId: d.room,
              allowEditing: true,
              inRoom: r.peers.map((x) => x.id),
            });
            send(p, "club", r.club.state);
            if (r.snapshot) send(p, "estado", r.snapshot);
            send(p, "room-state-sent", {});
            state(r);
            continue;
          }
          if (m.key === "leave-room") {
            const name = p.room;
            leave(p);
            send(p, "left-room", undefined, { room: name });
            continue;
          }
          const r = rooms.get(p.room || "");
          if (!r || d.session !== r.club.state.session) continue;
          const side = r.club.side(p.id);
          if (side === null) continue;
          if (m.key === "modo") {
            if (r.club.choose(p.id, d.mode as Mode)) {
              state(r);
              if (d.mode === "cpu" && r.peers.length > 1) {
                const guest = r.peers.find((x) => x !== p)!;
                send(guest, "rechazo", {
                  reason: "El anfitrión conserva CPU. Crea tu propia sala.",
                });
                leave(guest);
                r.club.choose(p.id, "cpu");
                state(r);
              }
            }
            continue;
          }
          if (m.key === "listo") {
            if (r.club.ready(p.id))
              broadcast(r, "iniciar-pvp", { session: r.club.state.session });
            state(r);
            continue;
          }
          if (!Number.isSafeInteger(d.seq) || d.seq <= p.seq) continue;
          p.seq = d.seq;
          if (m.key === "estado" && side === 0) {
            r.snapshot = { ...d, sender: p.id };
            broadcast(r, "estado", r.snapshot, p);
          } else if (
            m.key === "pose" &&
            finite(d.p) &&
            finite(d.n) &&
            len(d.n) > 0.8 &&
            len(d.n) < 1.2 &&
            Math.abs(d.p.x) < 1.5 &&
            d.p.y >= 0 &&
            d.p.y < 2.8 &&
            Math.abs(d.p.z) < 2.6
          ) {
            broadcast(
              r,
              "pose",
              { ...d, side, sender: p.id, received: Date.now() },
              p,
            );
          } else if (
            m.key === "contacto" &&
            side === 1 &&
            finite(d.p) &&
            finite(d.previous) &&
            finite(d.n) &&
            Number.isFinite(d.time) &&
            Number.isFinite(d.dt)
          ) {
            broadcast(r, "contacto", { ...d, side, sender: p.id }, p);
          } else if (
            m.key === "accion" &&
            ["saque", "pausa", "continuar", "revancha"].includes(d.action)
          ) {
            broadcast(r, "accion", { ...d, side, sender: p.id }, p);
          }
        }
      } catch {
        /* Reject malformed frames without stopping other rooms. */
      }
    });
    ws.on("close", () => {
      leave(p);
      peers.delete(p);
    });
  });
  const timer = setInterval(() => {
    for (const p of peers) {
      p.count = 0;
      if (!p.alive) {
        p.ws.terminate();
        continue;
      }
      p.alive = false;
      p.ws.ping();
    }
  }, 3000);
  server.listen(port, "0.0.0.0");
  return {
    server,
    wss,
    rooms,
    close: async () => {
      clearInterval(timer);
      for (const p of peers) p.ws.terminate();
      await new Promise<void>((r) => wss.close(() => server.close(() => r())));
    },
  };
}
if (process.argv[1]?.replaceAll("\\", "/").endsWith("/server.ts")) {
  const app = createClubServer(Number(process.env.PORT) || 8787);
  console.log(
    "Coordinador Needle en http://localhost:" +
      ((app.server.address() as { port: number })?.port || 8787),
  );
}
