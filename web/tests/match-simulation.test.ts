import test from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { Simulation, SIZE } from "../src/game/physics";
import { v, norm, lerp } from "../src/game/math";
function play(
  returns: boolean,
  tilt = 0.18,
  speed = 1.59,
  trigger = 0.72,
  aim = 0,
) {
  const s = new Simulation();
  let serveAge = 0,
    returnAge = 0,
    tossAge = 0,
    previousPhase = "",
    swingY = 1.02,
    swingX = 0;
  const points: any[] = [];
  let total = 0;
  for (let frame = 0; frame < 24000 && s.rules.phase !== "fin"; frame++) {
    const r = s.rules,
      p = s.paddles[0],
      dt = SIZE.step;
    if (r.phase !== previousPhase) {
      if (r.phase === "saque") {
        serveAge = 0;
      }
      previousPhase = r.phase;
    }
    if (r.phase === "preparacion" && r.server === 0) {
      tossAge += dt;
      s.pose(0, v(0, 1.08, 1.26), norm(v(0, 0.22, -1)), dt);
      if (tossAge > 0.35) {
        s.toss(0);
        tossAge = 0;
      }
    } else if (r.phase === "saque" && r.server === 0) {
      serveAge += dt;
      const stroke = Math.max(0, serveAge - 0.12);
      s.pose(
        0,
        v(0, s.p.y, 1.26 - Math.min(stroke, 0.22) * 1.59),
        norm(v(0, -0.55, -1)),
        dt,
      );
    } else if (
      returns &&
      r.phase === "juego" &&
      r.last === 1 &&
      r.bounces === 1 &&
      r.serveStage === 0
    ) {
      if (s.p.z > trigger && returnAge === 0) {
        const t = (1.24 - s.p.z) / (s.velocity.z + speed);
        returnAge = dt;
        swingY = s.p.y + s.velocity.y * t - 4.905 * t * t;
        swingX = s.p.x + s.velocity.x * t;
      }
      if (returnAge > 0) {
        returnAge += dt;
        s.pose(
          0,
          v(swingX, swingY, 1.24 - Math.min(returnAge, 0.3) * speed),
          norm(v(aim, tilt, -1)),
          dt,
        );
      } else
        s.pose(
          0,
          lerp(p.p, v(s.p.x, s.p.y, 1.24), 0.24),
          norm(v(aim, tilt, -1)),
          dt,
        );
    } else {
      returnAge = 0;
      s.pose(
        0,
        lerp(p.p, v(returns ? 0 : 0.65, 1.05, 1.24), 0.2),
        norm(v(0, 0.22, -1)),
        dt,
      );
    }
    s.step();
    if (r.score[0] + r.score[1] !== total) {
      total = r.score[0] + r.score[1];
      points.push({
        time: s.time,
        score: [...r.score],
        reason: r.reason,
        hits: r.hits,
      });
    }
  }
  return { rules: s.rules, time: s.time, points };
}
test("partidos completos con entradas cinemáticas: CPU gana y CPU pierde; revancha", () => {
  const win = play(true, 0.05, 1.6, 0.72, 0),
    loss = play(false);
  writeFileSync(
    "../evidencias/partidos-simulacion.json",
    JSON.stringify(
      {
        method:
          "Simulación determinista 120 Hz; palas cinemáticas de prueba, sin asignar puntos ni trayectorias de bola",
        win,
        loss,
      },
      null,
      2,
    ),
  );
  assert.equal(win.rules.phase, "fin");
  assert.equal(loss.rules.phase, "fin");
  assert.equal(win.rules.winner, 0);
  assert.equal(loss.rules.winner, 1);
  win.rules.reset();
  assert.deepEqual(win.rules.score, [0, 0]);
  assert.equal(win.rules.phase, "preparacion");
});
