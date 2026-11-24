import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath:
    "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(process.env.GAME_URL || "http://localhost:3000");
await page.waitForFunction(() => window.clubGame);
await page.mouse.move(720, 430);
await page.keyboard.press("g");
await page.waitForTimeout(400);
const log = [];
let last = 0,
  served = 0,
  returnActions = 0,
  humanReturned = false;
const end = Date.now() + 60000;
while (Date.now() < end) {
  const s = await page.evaluate(() => {
    const g = window.clubGame,
      s = g.sim,
      r = s.rules;
    return {
      phase: r.phase,
      server: r.server,
      last: r.last,
      bounces: r.bounces,
      stage: r.serveStage,
      p: s.p,
      velocity: s.velocity,
      paddle: s.paddles[0].p,
      score: r.score,
      hits: r.hits,
      reason: r.reason,
      swing: g.swing,
      time: s.time,
    };
  });
  if (s.hits !== last) {
    if (s.last === 0 && s.stage === 0 && s.phase === "juego")
      humanReturned = true;
    log.push(s);
    last = s.hits;
    console.log(JSON.stringify(s));
  }
  if (s.phase === "preparacion" && s.server === 0) {
    await page.mouse.move(720, 430);
    await page.waitForTimeout(120);
    await page.keyboard.press("Space");
    await page.waitForTimeout(120);
    await page.keyboard.press("Enter");
    served++;
  }
  if (s.phase === "juego" && s.last === 1 && s.bounces === 1 && s.stage === 0) {
    const t = Math.max(0, (1.5 - s.p.z) / (s.velocity.z + 1.59));
    const x = 720 + ((s.p.x + s.velocity.x * t) / 0.9) * 720,
      y = 450 - (s.p.y + s.velocity.y * t - 4.905 * t * t - 1.02) * 900;
    await page.mouse.move(
      Math.max(400, Math.min(1350, x)),
      Math.max(20, Math.min(890, y)),
    );
    if (s.p.z > 0.6 && s.p.z < 1.28 && !s.swing) {
      log.push({ returnInput: s });
      await page.keyboard.press("Enter");
      returnActions++;
    }
  }
  if (s.score[0] + s.score[1] >= 2 && humanReturned) {
    log.push(s);
    break;
  }
  await page.waitForTimeout(15);
}
const result = await page.evaluate(() => ({
  score: window.clubGame.sim.rules.score,
  hits: window.clubGame.sim.rules.hits,
  reason: window.clubGame.sim.rules.reason,
  phase: window.clubGame.sim.rules.phase,
}));
await page.screenshot({ path: "../evidencias/05-punto-y-devolucion.png" });
await writeFile(
  "../evidencias/partida-cpu.json",
  JSON.stringify(
    {
      method:
        "Teclado y ratón vía Playwright, sin modificar marcador ni trayectoria",
      url: process.env.GAME_URL,
      served,
      returnActions,
      humanReturned,
      result,
      log,
      errors,
    },
    null,
    2,
  ),
);
console.log({ result, served, returnActions, humanReturned, errors });
await browser.close();
if (errors.length || !humanReturned || !result.score.some((x) => x > 0))
  process.exitCode = 1;
