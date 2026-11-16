import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath:
    "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe",
  headless: true,
});
const contexts = await Promise.all(
  Array.from({ length: 4 }, () => browser.newContext()),
);
const pages = await Promise.all(contexts.map((c) => c.newPage()));
const errors = [];
pages.forEach((p) => p.on("pageerror", (e) => errors.push(e.message)));
const url = new URL(
  process.env.GAME_URL || "http://localhost:4173/?transport=needle",
);
url.searchParams.set("room", "RACE-" + Date.now().toString(36));
await pages[0].goto(url.href);
await pages[0].waitForFunction(() => window.clubGame?.net.online);
const host = await pages[0].evaluate(() => window.clubGame.net.club.host);
await Promise.all(
  pages.slice(1, 3).map(async (p) => {
    await p.goto(url.href);
    await p.waitForFunction(
      () =>
        window.clubGame?.net.online ||
        document.querySelector("#message")?.textContent.includes("Sala llena"),
    );
  }),
);
const racing = await Promise.all(
  pages
    .slice(1, 3)
    .map((p) =>
      p.evaluate(() => ({
        online: window.clubGame.net.online,
        side: window.clubGame.side,
        message: document.querySelector("#message").textContent,
      })),
    ),
);
const club = await pages[0].evaluate(() => window.clubGame.net.club);
const admitted = racing.findIndex((r) => r.online);
if (admitted >= 0) {
  await contexts[admitted + 1].close();
  await pages[0].waitForFunction(
    () => window.clubGame.net.club.seats[1] === null,
  );
}
await pages[0].evaluate(() => window.clubGame.action("cpu"));
await pages[3].goto(url.href);
await pages[3].waitForFunction(() =>
  document
    .querySelector("#message")
    ?.textContent.includes("Partida individual"),
);
const solo = await pages[3].locator("#message").textContent();
const rejected = racing.findIndex((r) => !r.online);
const other = pages[rejected + 1];
const second = new URL(url);
second.searchParams.set("room", "OTRA-" + Date.now().toString(36));
await other.goto(second.href);
await other.waitForFunction(() => window.clubGame?.net.online);
const isolated = await other.evaluate(() => window.clubGame.net.club);
const final = await pages[0].evaluate(() => window.clubGame.net.club);
const passed =
  racing.filter((r) => r.online).length === 1 &&
  racing.filter((r) => r.message.includes("Sala llena")).length === 1 &&
  club.host === host &&
  final.mode === "cpu" &&
  !final.seats[1] &&
  isolated.session !== final.session &&
  isolated.host !== final.host &&
  !errors.length;
await writeFile(
  "../evidencias/admision-needle.json",
  JSON.stringify(
    {
      date: new Date().toISOString(),
      url: url.href,
      method:
        "Anfitrión establecido; dos solicitudes concurrentes; CPU cerrada y segunda sala independiente",
      host,
      racing,
      club,
      solo,
      isolated,
      final,
      passed,
      errors,
    },
    null,
    2,
  ),
);
console.log({ passed, racing, solo, errors });
await browser.close();
if (!passed) process.exitCode = 1;
