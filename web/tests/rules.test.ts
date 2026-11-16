import { test } from "node:test";
import assert from "node:assert/strict";
import { Rules, service } from "../src/game/rules";
import { Simulation, sweepPaddle, paddle } from "../src/game/physics";
import { Club } from "../src/game/club";
import { v, norm } from "../src/game/math";
function serve(r: Rules) {
  r.toss();
  assert.equal(r.hit(r.server), true);
  r.bounce(r.server);
  r.bounce(r.server === 0 ? 1 : 0);
}
test("6–6 → 7–6 → 8–6; servicio deuce y revancha", () => {
  const r = new Rules();
  r.score = [6, 6];
  r.server = service(6, 6);
  serve(r);
  r.point(0, "Prueba");
  assert.equal(r.phase, "punto");
  assert.equal(r.server, 1);
  r.prepare();
  serve(r);
  r.point(0, "Prueba");
  assert.equal(r.phase, "fin");
  assert.deepEqual(r.score, [8, 6]);
  r.reset();
  assert.deepEqual(r.score, [0, 0]);
  assert.equal(r.server, 0);
});
test("let por red y dos botes válidos; red sin cruce pierde", () => {
  const r = new Rules();
  r.toss();
  r.hit(0);
  r.net = true;
  r.bounce(0);
  r.bounce(1);
  assert.equal(r.phase, "preparacion");
  assert.match(r.reason, /Let/);
  assert.deepEqual(r.score, [0, 0]);
  r.toss();
  r.hit(0);
  r.net = true;
  r.bounce(0);
  r.bounce(0);
  assert.deepEqual(r.score, [0, 1]);
});
test("segundo bote, volea, fuera e id de punto repetido", () => {
  const r = new Rules();
  serve(r);
  r.bounce(1);
  assert.deepEqual(r.score, [1, 0]);
  assert.equal(r.point(0, "Duplicado"), false);
  r.prepare();
  serve(r);
  r.hit(1);
  r.hit(0);
  assert.equal(r.reason, "Volea");
  assert.deepEqual(r.score, [1, 1]);
  r.prepare();
  serve(r);
  r.hit(1);
  r.out();
  assert.deepEqual(r.score, [2, 1]);
});
test("saque alterna cada dos, preparación perdida no puntúa", () => {
  assert.deepEqual(
    Array.from({ length: 8 }, (_, i) => service(i, 0)),
    [0, 0, 1, 1, 0, 0, 1, 1],
  );
  const r = new Rules();
  r.toss();
  r.out();
  assert.equal(r.phase, "preparacion");
  assert.deepEqual(r.score, [0, 0]);
});
test("barrido rápido de esfera y pala móvil entre frames", () => {
  const p = paddle(0);
  p.p = v(0, 1, 0);
  p.previous = v(0, 1, 0.4);
  p.n = v(0, 0, -1);
  assert.ok(sweepPaddle(v(0, 1, -0.3), v(0, 1, 0.3), p));
  assert.equal(sweepPaddle(v(0.5, 1, -0.3), v(0.5, 1, 0.3), p), null);
});
test("mesa y red resuelven contacto continuo", () => {
  const s = new Simulation();
  s.cpu = false;
  s.active = true;
  s.rules.toss();
  s.rules.hit(0);
  s.p = v(0, 0.9, 0.4);
  s.velocity = v(0, -20, 0);
  s.step(0.02);
  assert.ok(s.velocity.y > 0);
  const n = new Simulation();
  n.cpu = false;
  n.active = true;
  n.rules.toss();
  n.rules.hit(0);
  n.p = v(0, 0.85, 0.1);
  n.velocity = v(0, 0, -20);
  n.step(0.02);
  assert.ok(n.velocity.z > 0);
  assert.equal(n.rules.net, true);
});
test("dos admisiones simultáneas solo dan una plaza; CPU cerrada y cambio bilateral", async () => {
  const c = new Club("A", "session");
  const answers = await Promise.all([
    Promise.resolve().then(() => c.admit("B")),
    Promise.resolve().then(() => c.admit("C")),
  ]);
  assert.deepEqual(answers, [null, "Sala llena"]);
  assert.equal(c.choose("B", "cpu"), false);
  assert.equal(c.ready("A"), false);
  assert.equal(c.ready("B"), true);
  assert.equal(c.state.mode, "pvp");
  assert.equal(c.leave("B"), "guest");
  assert.equal(c.state.mode, "esperar");
  c.choose("A", "cpu");
  assert.equal(c.admit("D"), "Partida individual");
  assert.equal(c.leave("A"), "host");
  assert.equal(c.admit("D"), "Sala cerrada");
});
