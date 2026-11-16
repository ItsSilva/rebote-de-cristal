import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath:
    "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe",
  headless: true,
});
const contexts = await Promise.all([
  browser.newContext({ viewport: { width: 1280, height: 800 } }),
  browser.newContext({ viewport: { width: 1280, height: 800 } }),
]);
const pages = await Promise.all(contexts.map((c) => c.newPage()));
const errors = [];
pages.forEach((p) => p.on("pageerror", (e) => errors.push(e.message)));
const url = new URL(
  process.env.GAME_URL || "http://localhost:4173/?transport=needle",
);
url.searchParams.set("room", "DIEZ-" + Date.now().toString(36).toUpperCase());
const read = (p) =>
  p.evaluate(() => {
    const g = window.clubGame,
      r = g.sim.rules;
    return {
      side: g.side,
      score: [...r.score],
      server: r.server,
      phase: r.phase,
      last: r.last,
      bounces: r.bounces,
      stage: r.serveStage,
      hits: r.hits,
      rally: r.rally,
      p: { x: g.visualBall.x, y: g.visualBall.y, z: g.visualBall.z },
      velocity: g.sim.velocity,
      swing: g.swing,
      latency: g.ctx.connection.currentLatency,
      lateContacts: g.lateContacts,
    };
  });
for (const p of pages) {
  await p.goto(url.href);
  await p.waitForFunction(() => window.clubGame?.net.online);
}
for (const p of pages) await p.evaluate(() => window.clubGame.action("ready"));
await pages[1].waitForFunction(() => window.clubGame.net.club.mode === "pvp");
for (const p of pages) {
  await p.keyboard.press("g");
  await p.mouse.move(640, 380);
}
let match = 1,
  total = 0,
  tossAt = 0;
const points = [],
  inputs = [];
const deadline = Date.now() + 100000;
while (Date.now() < deadline && points.length < 10) {
  const states = await Promise.all(pages.map(read)),
    a = states[0];
  const sum = a.score[0] + a.score[1];
  if (sum !== total) {
    await pages[1].waitForFunction(
      (score) =>
        JSON.stringify(window.clubGame.sim.rules.score) ===
        JSON.stringify(score),
      a.score,
      { timeout: 4000 },
    );
    const b = await read(pages[1]);
    points.push({
      match,
      a,
      b,
      agreed:
        JSON.stringify(a.score) === JSON.stringify(b.score) &&
        a.server === b.server,
    });
    total = sum;
    console.log(
      "Punto " +
        points.length +
        ": " +
        a.score.join("–") +
        " · coinciden=" +
        points.at(-1).agreed,
    );
  }
  if (points.length >= 10) break;
  if (a.phase === "fin") {
    await pages[0].keyboard.press("r");
    await pages[1].waitForFunction(() =>
      window.clubGame.sim.rules.score.every((x) => x === 0),
    );
    total = 0;
    match++;
    continue;
  }
  if (a.phase === "preparacion" && Date.now() - tossAt > 1200) {
    const server = a.server;
    await pages[server].mouse.move(640, 380);
    await pages[server].keyboard.press("Space");
    await pages[server].waitForFunction(
      () => window.clubGame.sim.rules.phase === "saque",
      { timeout: 4000 },
    );
    await pages[server].waitForTimeout(100);
    await pages[server].keyboard.press("Enter");
    inputs.push({ match, side: server, action: "saque" });
    tossAt = Date.now();
    continue;
  }
  for (let i = 0; i < 2; i++) {
    const s = states[i];
    if (
      s.phase !== "juego" ||
      s.last === s.side ||
      s.bounces !== 1 ||
      s.stage !== 0
    )
      continue;
    const t = Math.max(
      0,
      (1.24 - Math.abs(s.p.z)) / (Math.abs(s.velocity.z) + 1.59),
    );
    const x = 640 + ((s.p.x + s.velocity.x * t) / 0.9) * 640,
      y = 400 - (s.p.y + s.velocity.y * t - 4.905 * t * t - 1.02) * 800;
    await pages[i].mouse.move(
      Math.max(350, Math.min(1200, x)),
      Math.max(20, Math.min(790, y)),
    );
    if (Math.abs(s.p.z) > 0.6 && Math.abs(s.p.z) < 1.32 && !s.swing) {
      await pages[i].keyboard.press("Enter");
      inputs.push({ match, side: i, action: "devolución", hits: s.hits });
    }
  }
  await pages[0].waitForTimeout(20);
}
await contexts[0].close();
await pages[1].waitForFunction(() => !window.clubGame.net.online, {
  timeout: 10000,
});
const hostExit = await pages[1].locator("#message").textContent();
await writeFile(
  "../evidencias/pvp-diez-puntos.json",
  JSON.stringify(
    {
      date: new Date().toISOString(),
      url: url.href,
      method:
        "Dos contextos independientes; teclado y ratón, sin asignar pelota ni marcador. Hasta diez puntos en partidas a siete.",
      points,
      inputs,
      hostExit,
      errors,
    },
    null,
    2,
  ),
);
await browser.close();
if (points.length !== 10 || points.some((p) => !p.agreed) || errors.length)
  process.exitCode = 1;
