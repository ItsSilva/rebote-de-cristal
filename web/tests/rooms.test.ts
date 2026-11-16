import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { createClubServer } from "../server/server.ts";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
test("coordinador real: admisión, identidad, duplicados, dos salas, abandono", async () => {
  const app = createClubServer(0);
  await new Promise<void>((r) => app.server.on("listening", r));
  const port = (app.server.address() as { port: number }).port;
  const clients: WebSocket[] = [];
  async function client() {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/socket`);
    clients.push(ws);
    const messages: any[] = [];
    ws.on("message", (raw) => messages.push(JSON.parse(raw.toString())));
    await new Promise<void>((r) => ws.on("open", r));
    await wait(15);
    return {
      ws,
      messages,
      send: (key: string, data: object) =>
        ws.send(JSON.stringify({ key, data })),
      last: (key: string) => messages.filter((m) => m.key === key).at(-1)?.data,
    };
  }
  try {
    const a = await client();
    a.send("join-room", { room: "TEST-ONE" });
    await wait(20);
    const b = await client(),
      c = await client();
    b.send("join-room", { room: "TEST-ONE" });
    c.send("join-room", { room: "TEST-ONE" });
    await wait(35);
    assert.equal(b.last("club").seats[1], b.last("connection-start-info").id);
    assert.equal(c.last("rechazo").reason, "Sala llena");
    const s = a.last("club").session;
    b.send("estado", { session: s, seq: 1, state: { score: "forged" } });
    await wait(10);
    assert.equal(a.last("estado"), undefined);
    a.send("estado", {
      session: s,
      seq: 1,
      state: { rules: { score: [1, 0] } },
    });
    a.send("estado", {
      session: s,
      seq: 1,
      state: { rules: { score: [9, 9] } },
    });
    await wait(20);
    assert.deepEqual(b.last("estado").state.rules.score, [1, 0]);
    a.send("listo", { session: s });
    b.send("listo", { session: s });
    await wait(15);
    assert.equal(a.last("club").mode, "pvp");
    c.send("join-room", { room: "TEST-TWO" });
    await wait(15);
    assert.notEqual(c.last("club").session, s);
    assert.equal(c.last("estado"), undefined);
    b.ws.close();
    await wait(30);
    assert.equal(a.last("club").mode, "esperar");
    a.send("modo", { session: s, mode: "cpu" });
    await wait(15);
    const d = await client();
    d.send("join-room", { room: "TEST-ONE" });
    await wait(20);
    assert.equal(d.last("rechazo").reason, "Partida individual");
    a.send("modo", { session: s, mode: "auto" });
    await wait(10);
    d.send("join-room", { room: "TEST-ONE" });
    await wait(20);
    assert.deepEqual(d.last("estado").state.rules.score, [1, 0]);
    a.ws.close();
    await wait(30);
    assert.match(d.last("cerrada").reason, /anfitrión/);
  } finally {
    clients.forEach((c) => c.terminate());
    await app.close();
  }
});
