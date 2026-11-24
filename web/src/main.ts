import {
  onStart,
  onUpdate,
  NeedleXRSession,
  addComponent,
  WebXR,
  type Context,
} from "@needle-tools/engine";
import * as T from "three";
import { Simulation, SIZE, sweepPaddle } from "./game/physics";
import { v, norm, lerp, clamp, sub, mul, cross, type V } from "./game/math";
import { type Side } from "./game/rules";
import { buildWorld, updateText, palette } from "./world";
import { ClubConnection } from "./network";
import { predictBall } from "./game/prediction";
import {
  applyVisual,
  defaults,
  loadSettings,
  readForm,
  saveSettings,
  writeForm,
  type Settings,
} from "./settings";
import "./styles/style.css";
class Game {
  sim = new Simulation();
  world = buildWorld();
  net: ClubConnection;
  held = false;
  hand: "left" | "right" = "right";
  seated = false;
  settings: Settings = loadSettings();
  offset = 0;
  arPlaced = true;
  pointer = { x: 0, y: 0 };
  swing = 0;
  swingStrength = 1;
  tilt = 0.05;
  swingStart = v();
  swingNormal = v(0, 0, -1);
  lastTime = performance.now();
  accumulator = 0;
  poseClock = 0;
  sendClock = 0;
  lastRevision = -1;
  lastScoreText = "";
  lastEvent = 0;
  /** Micro interacción de golpe: anillos, rebote de la pala y peloteo. */
  hitFx: { mesh: T.Mesh; t: number }[] = [];
  ringGeo?: T.RingGeometry;
  padPop = [0, 0];
  padBase: T.Vector3[] = [];
  ballPop = 0;
  rally = 0;
  rallyTimer = 0;
  /** Último estado mostrado del aviso de fin de partido. */
  resultShown = false;
  pointTimer = 0;
  netFlash?: T.Mesh;
  /** Red dinámica que se abomba al chocar (la red horneada está fusionada con las líneas). */
  netWeb?: T.LineSegments;
  netBase?: Float32Array;
  netHit?: { t: number; x: number; y: number; sign: number };
  sparks: { mesh: T.Mesh; v: T.Vector3; t: number }[] = [];
  xrWas = false;
  wasTrigger = false;
  wasSqueeze = false;
  lastXRGood = 0;
  audio?: AudioContext;
  visualBall = new T.Vector3();
  temp = new T.Vector3();
  q = new T.Quaternion();
  metric: number[] = [];
  samples: { time: number; ms: number }[] = [];
  record = false;
  lastFrame = 0;
  remotePrevious?: V;
  remoteTime = -1;
  history: ReturnType<Simulation["snapshot"]>[] = [];
  predictedGuest?: V;
  pingClock = 0;
  baked?: T.Object3D;
  bakedEnvironment?: T.Object3D;
  constructor(public ctx: Context) {
    ctx.scene.add(this.world.root);
    this.net = new ClubConnection(ctx);
    this.baked = ctx.scene.getObjectByName("CanteraUnity");
    this.bakedEnvironment = this.baked?.getObjectByName("Cantera_Entorno");
    if (this.baked) {
      // UnityGLTF reflects X; the authoring importer reflects Z. Restore the shared axes.
      this.baked.rotation.y += Math.PI;
      this.world.root.add(this.baked);
      this.world.environment.visible = false;
      this.world.architecture.visible = false;
      this.world.dispenser.visible = false;
    }
    const authoringOnly = ctx.scene.getObjectByName("Equipo_visualizacion");
    if (authoringOnly) authoringOnly.visible = false;
    const camera = ctx.mainCamera as T.PerspectiveCamera;
    camera.fov = 60;
    camera.near = 0.025;
    camera.far = 60;
    camera.updateProjectionMatrix();
    this.net.onClub = () => {
      this.place("play");
      this.sim.cpu = this.net.club?.mode !== "pvp";
      this.refresh();
    };
    this.net.onState = (s) => {
      const local = this.sim.paddles[this.side];
      this.sim.apply(s);
      this.sim.paddles[this.side] = local;
      this.refresh();
    };
    this.net.onPose = (d) => this.remotePose(d);
    this.net.onContact = (d) => this.remoteContact(d);
    this.net.onAction = (d) => {
      if (this.net.host) this.authorizedAction(d.action, d.side);
    };
    this.net.onPvP = () => {
      if (this.net.host) {
        this.sim.rules.reset();
        this.sim.cpu = false;
        this.sim.active = false;
      }
      this.held = false;
      this.refresh();
    };
    this.net.onError = (why) => {
      this.pause(why);
      this.message(why + " · CPU local disponible.");
      this.refresh();
    };
    this.hand = this.settings.hand;
    this.seated = this.settings.seated;
    this.sim.cpuLevel = this.settings.cpuLevel;
    applyVisual(this.settings);
    this.bind();
    this.place("entry");
    addComponent(ctx.scene, WebXR, {
      createARButton: false,
      createVRButton: false,
      createQRCode: false,
      createSendToQuestButton: false,
      autoPlace: false,
      useDefaultControls: false,
      arScale: 1,
      defaultAvatar: false,
    });
    this.detectXR();
    this.refresh();
    const room = new URL(location.href).searchParams.get("room");
    if (room) this.net.join(room);
  }
  get side(): Side {
    return this.net.side;
  }
  get sign() {
    return this.side === 0 ? 1 : -1;
  }
  message(text: string) {
    document.querySelector("#message")!.textContent = text;
  }
  onHit(side: Side) {
    this.rally++;
    if (!this.settings.motion) {
      this.ringGeo ??= new T.RingGeometry(0.03, 0.046, 48);
      const ring = new T.Mesh(
        this.ringGeo,
        new T.MeshBasicMaterial({
          color: side === 0 ? palette.amber : palette.coral,
          transparent: true,
          opacity: 0.9,
          side: T.DoubleSide,
          depthWrite: false,
        }),
      );
      ring.position.copy(this.visualBall);
      ring.quaternion.copy(this.world.paddles[side].quaternion);
      this.world.root.add(ring);
      this.hitFx.push({ mesh: ring, t: 0 });
      this.padPop[side] = 1;
      this.ballPop = 1;
    }
    if (this.rally >= 3) {
      const el = document.querySelector<HTMLElement>("#rally")!;
      el.textContent = `Peloteo ×${this.rally}`;
      el.classList.remove("is-on");
      void el.offsetWidth; // reinicia la animación
      el.classList.add("is-on");
      clearTimeout(this.rallyTimer);
      this.rallyTimer = window.setTimeout(
        () => el.classList.remove("is-on"),
        1100,
      );
    }
  }
  /** Explica cada punto desde el punto de vista de quien juega. */
  pointToast(winner: Side) {
    const r = this.sim.rules;
    if (r.phase === "fin") return; // el aviso de fin de partido ya lo cuenta
    const won = winner === this.side,
      rival = this.sim.cpu ? "el autómata" : "tu rival";
    const why: Record<string, [string, string]> = {
      "Tocó la red y no pasó": [
        "Su bola tocó la red y no pasó.",
        "Tu bola tocó la red y no pasó.",
      ],
      "Tocó la red y salió": [
        "Su bola tocó la red y salió.",
        "Tu bola tocó la red y salió.",
      ],
      "Botó en su propio lado": [
        "Su golpe botó en su propio lado.",
        "Tu golpe botó en tu lado de la mesa, no pasó la red.",
      ],
      Volea: [
        "Golpeó antes de que la bola botara.",
        "Golpeaste antes de que la bola botara.",
      ],
      "Segundo bote": [
        "La bola botó dos veces en su lado.",
        "La bola botó dos veces en tu lado.",
      ],
      "Doble golpe": ["Tocó la bola dos veces.", "Tocaste la bola dos veces."],
      Fuera: ["La bola salió de la mesa.", "La bola salió de la mesa."],
    };
    const text = why[r.reason]?.[won ? 0 : 1] ?? r.reason;
    const box = document.querySelector<HTMLElement>("#point-toast")!;
    box.classList.toggle("is-win", won);
    box.classList.toggle("is-loss", !won);
    document.querySelector("#point-title")!.textContent = won
      ? "Punto para ti"
      : `Punto para ${rival}`;
    document.querySelector("#point-why")!.textContent = text;
    document.querySelector("#rally")!.classList.remove("is-on");
    box.classList.remove("is-on");
    void box.offsetWidth;
    box.classList.add("is-on");
    clearTimeout(this.pointTimer);
    this.pointTimer = window.setTimeout(
      () => box.classList.remove("is-on"),
      2200,
    );
  }
  /** Construye una red de hilos subdivididos encima de la red real. */
  buildNetWeb() {
    const pts: number[] = [],
      half = 0.7625,
      y0 = 0.762,
      y1 = 0.905,
      seg = 12;
    for (let i = 0; i <= 40; i++) {
      const x = -half + (i * (2 * half)) / 40;
      for (let k = 0; k < seg; k++)
        pts.push(
          x,
          y0 + ((y1 - y0) * k) / seg,
          0,
          x,
          y0 + ((y1 - y0) * (k + 1)) / seg,
          0,
        );
    }
    for (let j = 0; j <= 5; j++) {
      const y = y0 + ((y1 - y0) * j) / 5;
      for (let k = 0; k < 80; k++)
        pts.push(
          -half + (2 * half * k) / 80,
          y,
          0,
          -half + (2 * half * (k + 1)) / 80,
          y,
          0,
        );
    }
    const g = new T.BufferGeometry();
    this.netBase = new Float32Array(pts);
    g.setAttribute("position", new T.BufferAttribute(new Float32Array(pts), 3));
    this.netWeb = new T.LineSegments(
      g,
      new T.LineBasicMaterial({
        color: palette.ivory,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    this.netWeb.visible = false;
    this.world.root.add(this.netWeb);
  }
  /** La bola choca con la red: se ilumina, se abomba y suelta chispas. */
  onNet() {
    const ball = this.visualBall.clone();
    if (!this.settings.motion) {
      // Empuja la red hacia el lado al que iba la bola.
      this.netHit = {
        t: 0,
        x: ball.x,
        y: Math.min(0.89, Math.max(0.78, ball.y)),
        sign: ball.z >= 0 ? -1 : 1,
      };
      if (!this.netWeb) this.buildNetWeb();
      this.ringGeo ??= new T.RingGeometry(0.03, 0.046, 48);
      const ring = new T.Mesh(
        this.ringGeo,
        new T.MeshBasicMaterial({
          color: palette.coral,
          transparent: true,
          opacity: 0.95,
          side: T.DoubleSide,
          depthWrite: false,
        }),
      );
      ring.position.set(ball.x, ball.y, 0);
      this.world.root.add(ring);
      this.hitFx.push({ mesh: ring, t: 0 });
      const sparkGeo = new T.PlaneGeometry(0.018, 0.018);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2,
          m = new T.Mesh(
            sparkGeo,
            new T.MeshBasicMaterial({
              color: i % 2 ? palette.coral : palette.ivory,
              transparent: true,
              side: T.DoubleSide,
              depthWrite: false,
            }),
          );
        m.position.set(ball.x, ball.y, 0);
        m.rotation.z = a;
        this.world.root.add(m);
        this.sparks.push({
          mesh: m,
          v: new T.Vector3(
            Math.cos(a) * 0.9,
            Math.sin(a) * 0.9 + 0.6,
            (ball.z >= 0 ? 1 : -1) * 0.35,
          ),
          t: 0,
        });
      }
    }
    if (!this.netFlash) {
      this.netFlash = new T.Mesh(
        new T.PlaneGeometry(1.56, 0.15),
        new T.MeshBasicMaterial({
          color: palette.coral,
          transparent: true,
          opacity: 0,
          side: T.DoubleSide,
          depthWrite: false,
        }),
      );
      this.netFlash.position.set(0, 0.83, 0);
      this.world.root.add(this.netFlash);
    }
    (this.netFlash.material as T.MeshBasicMaterial).opacity = 0.45;
  }
  updateHitFx(dt: number) {
    if (this.netHit) {
      const h = this.netHit;
      h.t += dt;
      const done = h.t > 1.1,
        // Se estira hacia donde iba la bola y vuelve con un rebote amortiguado.
        wave = done
          ? 0
          : 0.12 * Math.exp(-3.6 * h.t) * Math.abs(Math.cos(8 * h.t));
      if (this.netWeb && this.netBase) {
        const pos = this.netWeb.geometry.getAttribute(
            "position",
          ) as T.BufferAttribute,
          arr = pos.array as Float32Array,
          base = this.netBase;
        for (let i = 0; i < arr.length; i += 3) {
          const x = base[i],
            y = base[i + 1],
            dx = x - h.x,
            dy = y - h.y,
            r = Math.hypot(dx * 0.55, dy),
            // Bolsa alrededor del impacto: los hilos se abren y la red cede.
            pocket = Math.exp(-(r * r) / (2 * 0.1 * 0.1)),
            edge = Math.max(0, Math.sin((Math.PI * (y - 0.762)) / 0.143)),
            push = wave * pocket * edge,
            k = r > 1e-4 ? push / r : 0;
          arr[i] = x + dx * 0.55 * k;
          arr[i + 1] = Math.min(
            0.905,
            Math.max(0.762, y + dy * k - push * 0.35),
          );
          arr[i + 2] = h.sign * push * 1.4;
        }
        pos.needsUpdate = true;
        const m = this.netWeb.material as T.LineBasicMaterial;
        m.opacity = done ? 0 : Math.min(1, 25 * h.t) * Math.exp(-1.6 * h.t);
        m.color.set(palette.ivory);
        this.netWeb.visible = !done;
      }
      if (done) this.netHit = undefined;
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.t += dt;
      s.v.y -= 3.5 * dt;
      s.mesh.position.addScaledVector(s.v, dt);
      s.mesh.rotation.z += dt * 8;
      (s.mesh.material as T.MeshBasicMaterial).opacity = Math.max(
        0,
        1 - s.t / 0.55,
      );
      if (s.t >= 0.55) {
        this.world.root.remove(s.mesh);
        (s.mesh.material as T.Material).dispose();
        this.sparks.splice(i, 1);
      }
    }
    if (this.netFlash) {
      const m = this.netFlash.material as T.MeshBasicMaterial;
      m.opacity = Math.max(0, m.opacity - dt * 1.1);
      this.netFlash.visible = m.opacity > 0.01;
    }
    for (let i = this.hitFx.length - 1; i >= 0; i--) {
      const f = this.hitFx[i];
      f.t += dt / 0.28;
      const k = Math.min(1, f.t),
        ease = 1 - (1 - k) * (1 - k);
      f.mesh.scale.setScalar(1 + ease * 3.2);
      (f.mesh.material as T.MeshBasicMaterial).opacity = 0.9 * (1 - k);
      if (k >= 1) {
        this.world.root.remove(f.mesh);
        (f.mesh.material as T.Material).dispose();
        this.hitFx.splice(i, 1);
      }
    }
    if (!this.padBase.length)
      this.padBase = this.world.paddles.map((p) => p.scale.clone());
    if (this.ballPop > 0) {
      this.ballPop = Math.max(0, this.ballPop - dt / 0.14);
      this.world.ball.scale.setScalar(1 + 0.6 * this.ballPop);
    }
    for (const s of [0, 1] as const) {
      if (this.padPop[s] <= 0) continue;
      this.padPop[s] = Math.max(0, this.padPop[s] - dt / 0.16);
      const bump = 1 + 0.12 * Math.sin(this.padPop[s] * Math.PI);
      this.world.paddles[s].scale.copy(this.padBase[s]).multiplyScalar(bump);
    }
  }
  /** Mantiene Opciones al día cuando mano o postura cambian por tecla o botón. */
  syncToggles() {
    this.settings = {
      ...this.settings,
      hand: this.hand,
      seated: this.seated,
    };
    saveSettings(this.settings);
    const form = document.querySelector<HTMLFormElement>("#settings-form");
    if (form) writeForm(form, this.settings);
  }
  bindSettings() {
    const dialog = document.querySelector<HTMLDialogElement>("#settings")!;
    const form = document.querySelector<HTMLFormElement>("#settings-form")!;
    writeForm(form, this.settings);
    document
      .querySelectorAll<HTMLElement>("[data-open=settings]")
      .forEach((b) => {
        b.onclick = () => {
          if (
            this.sim.rules.phase === "juego" ||
            this.sim.rules.phase === "saque"
          )
            this.action("pause");
          writeForm(form, this.settings);
          dialog.showModal();
        };
      });
    document.querySelector<HTMLElement>("#settings-close")!.onclick = () =>
      dialog.close();
    document.querySelector<HTMLElement>("#settings-reset")!.onclick = () => {
      const d = defaults();
      this.applyChoices({ ...d, hand: this.hand, seated: this.seated });
      if (d.hand !== this.hand) this.action("hand");
      if (d.seated !== this.seated) this.action("seated");
      this.syncToggles();
      this.message("Opciones restablecidas.");
    };
    form.addEventListener("input", () => {
      const next = readForm(form, this.settings);
      if (next.hand !== this.hand) this.action("hand");
      if (next.seated !== this.seated) this.action("seated");
      this.applyChoices({ ...next, hand: this.hand, seated: this.seated });
      writeForm(form, this.settings);
    });
  }
  applyChoices(next: Settings) {
    this.settings = next;
    this.sim.cpuLevel = next.cpuLevel;
    applyVisual(next);
    saveSettings(next);
  }
  bind() {
    document
      .querySelectorAll<HTMLButtonElement>("[data-action]")
      .forEach((b) => (b.onclick = () => this.action(b.dataset.action!)));
    this.bindSettings();
    document.querySelector<HTMLElement>("#result-close")!.onclick = () =>
      this.hideResult();
    document
      .querySelector<HTMLElement>("#result")!
      .addEventListener("keydown", (e) => {
        if (e.key === "Escape") this.hideResult();
      });
    document
      .querySelector("needle-engine")
      ?.setAttribute(
        "aria-label",
        "Cancha de tenis de mesa en 3D. Los controles y el marcador están en el panel de la página.",
      );
    document.querySelector<HTMLFormElement>("#join")!.onsubmit = (e) => {
      e.preventDefault();
      this.net.join(
        (document.querySelector("#code") as HTMLInputElement).value,
      );
    };
    window.addEventListener("pointermove", (e) => {
      this.pointer.x = (e.clientX / innerWidth - 0.5) * 2;
      this.pointer.y = (e.clientY / innerHeight - 0.5) * 2;
    });
    this.ctx.renderer.domElement.addEventListener("wheel", (e) => {
      this.tilt = clamp(this.tilt + Math.sign(e.deltaY) * 0.06, -0.25, 0.65);
      this.message(
        "Ángulo de pala: " +
          Math.round((Math.atan(this.tilt) * 180) / Math.PI) +
          "° · Shift + golpe: más fuerte.",
      );
    });
    this.ctx.renderer.domElement.addEventListener("pointerdown", (e) => {
      this.unlockAudio();
      this.raycaster.setFromCamera(
        new T.Vector2(
          (e.clientX / innerWidth) * 2 - 1,
          (-e.clientY / innerHeight) * 2 + 1,
        ),
        this.ctx.mainCamera,
      );
      const hit = this.raycaster.intersectObjects(
        this.world.actions.map((a) => a.mesh),
      )[0];
      if (hit) {
        this.action(
          this.world.actions.find((a) => a.mesh === hit.object)!.action,
        );
        return;
      }
      if (!this.held) this.action("grab");
      else this.startSwing(e.shiftKey);
    });
    window.addEventListener("keydown", (e) => {
      const target = e.target as HTMLElement;
      // Campos de texto: nunca interceptar.
      if (
        target.closest?.("input, textarea, select, [contenteditable], dialog")
      )
        return;
      // Combinaciones del navegador o del sistema (Ctrl+R, Cmd+1, Alt+...).
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Botones, resúmenes y enlaces enfocados conservan Enter, Espacio y
      // flechas nativos: no se dispara además un golpe, un saque ni un ajuste.
      const onControl = !!target.closest?.("button, summary, a[href]");
      if (onControl && [" ", "Enter", "ArrowUp", "ArrowDown"].includes(e.key))
        return;
      // WCAG 2.1.4: los atajos de una sola tecla se pueden desactivar.
      // Escape sigue activo porque no es una tecla de carácter.
      if (!this.settings.shortcuts && e.key !== "Escape") return;
      const map: Record<string, string> = {
        g: "grab",
        " ": "serve",
        p: "pause",
        r: "rematch",
        c: "center",
        h: "hand",
        v: "vr",
        m: "ar",
        "1": "entry",
        "2": "bench",
        "3": "play",
        Escape: "pause",
      };
      if (e.key === " " || e.key === "ArrowUp" || e.key === "ArrowDown")
        e.preventDefault();
      if (map[e.key]) this.action(map[e.key]);
      if (e.key === "Enter") this.startSwing(e.shiftKey);
      if (e.key === "ArrowUp") {
        this.offset = clamp(this.offset - 0.05, -0.3, 0.45);
        this.action("center");
      }
      if (e.key === "ArrowDown") {
        this.offset = clamp(this.offset + 0.05, -0.3, 0.45);
        this.action("center");
      }
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.sim.rules.phase === "juego")
        this.action("pause");
    });
  }
  raycaster = new T.Raycaster();
  unlockAudio() {
    if (!this.audio) this.audio = new AudioContext();
    this.audio.resume();
  }
  sound(kind: string) {
    if (this.ctx.xr?.running && (kind === "pala" || kind === "agarre")) {
      const actuator = this.ctx.xr.controllers.find((c) => c.side === this.hand)
        ?.gamepad?.hapticActuators?.[0];
      if (actuator)
        void actuator.pulse(kind === "pala" ? 0.35 : 0.15, 35).catch(() => {});
    }
    if (!this.audio || !this.settings.sound || this.settings.volume <= 0)
      return;
    if (kind === "victoria" || kind === "derrota") {
      const notes =
        kind === "victoria" ? [523, 659, 784, 1047] : [440, 370, 311];
      const a = this.audio,
        vol = 0.06 * (this.settings.volume / 70);
      notes.forEach((f, i) => {
        const t = a.currentTime + i * 0.12,
          o = a.createOscillator(),
          g = a.createGain();
        o.type = kind === "victoria" ? "triangle" : "sine";
        o.frequency.setValueAtTime(f, t);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        o.connect(g);
        g.connect(a.destination);
        o.start(t);
        o.stop(t + 0.24);
      });
      return;
    }
    const a = this.audio,
      t = a.currentTime,
      o = a.createOscillator(),
      g = a.createGain();
    o.frequency.setValueAtTime(
      (
        {
          // El golpe sube de tono mientras dura el peloteo.
          pala: 620 + Math.min(this.rally, 10) * 28,
          mesa: 260,
          red: 110,
          punto: 880,
          agarre: 430,
        } as Record<string, number>
      )[kind] || 440,
      t,
    );
    o.type = kind === "red" ? "triangle" : "sine";
    g.gain.setValueAtTime(0.06 * (this.settings.volume / 70), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g);
    g.connect(a.destination);
    o.start(t);
    o.stop(t + 0.13);
  }
  async detectXR() {
    for (const [mode, id] of [
      ["immersive-vr", "#vr"],
      ["immersive-ar", "#ar"],
    ] as const) {
      let available = false;
      try {
        available = (await navigator.xr?.isSessionSupported(mode)) || false;
      } catch {}
      const b = document.querySelector<HTMLButtonElement>(id)!;
      b.disabled = !available;
      b.textContent = available
        ? id === "#vr"
          ? "Entrar en RV"
          : "Entrar en RM"
        : id === "#vr"
          ? "RV no disponible"
          : "RM no disponible";
    }
  }
  async enterXR(mode: XRSessionMode) {
    try {
      this.unlockAudio();
      const s = await NeedleXRSession.start(
        mode,
        { optionalFeatures: ["local-floor", "hand-tracking", "hit-test"] },
        this.ctx,
      );
      if (!s) {
        this.message("Modo inmersivo no disponible. Continúa en escritorio.");
        return;
      }
      this.arPlaced = mode !== "immersive-ar";
      this.place("play");
      this.message(
        mode === "immersive-ar"
          ? "Coloca, gira y confirma la mesa desde el panel espacial."
          : "Gatillo: panel / saque. Agarre: tomar pala.",
      );
    } catch (e) {
      this.message(
        (e as Error).name === "NotAllowedError"
          ? "Permiso XR rechazado. Puedes reintentar."
          : "Sesión XR interrumpida o no disponible.",
      );
    }
  }
  action(action: string) {
    if (action === "grab" || action === "serve") this.unlockAudio();
    if (action === "vr") {
      this.enterXR("immersive-vr");
      return;
    }
    if (action === "ar") {
      this.enterXR("immersive-ar");
      return;
    }
    if (action === "exit") {
      this.action("pause");
      NeedleXRSession.stop();
      return;
    }
    if (action === "grab") {
      this.held = !this.held;
      this.sound("agarre");
      if (this.held) {
        if (!this.ctx.xr?.running) this.place("play");
        this.message(
          "Pala lista · Espacio prepara la bola · clic o Enter golpea",
        );
      } else this.message("Pala en el soporte. G o Tomar para recuperarla.");
      this.refresh();
      return;
    }
    if (action === "serve") {
      if (!this.held) {
        this.message("Primero toma la pala (G o agarre).");
        return;
      }
      if (this.net.online && this.net.club?.mode !== "pvp" && this.side === 1) {
        this.message("Tu plaza está reservada. Ambos deben pulsar Listo PvP.");
        return;
      }
      if (this.sim.rules.server !== this.side) {
        this.message(
          "Saque del lado " + (this.sim.rules.server === 0 ? "A" : "B"),
        );
        return;
      }
      if (this.net.host) this.authorizedAction("saque", this.side);
      else this.net.action("saque");
      return;
    }
    if (action === "pause" || action === "rematch") {
      const a =
        action === "rematch"
          ? "revancha"
          : this.sim.rules.phase === "pausa"
            ? "continuar"
            : "pausa";
      if (this.net.host) this.authorizedAction(a, this.side);
      else this.net.action(a);
      return;
    }
    if (action === "cpu" || action === "now" || action === "wait") {
      if (this.net.online && this.side !== 0) {
        this.message("El anfitrión elige el modo. Confirma Listo PvP.");
        return;
      }
      const mode =
        action === "cpu" ? "cpu" : action === "wait" ? "esperar" : "auto";
      if (!this.net.online) this.net.join().then(() => this.net.mode(mode));
      else this.net.mode(mode);
      this.sim.cpu = action !== "wait";
      this.sim.rules.reset();
      this.sim.active = false;
      this.place("play");
      if (action === "wait") this.pause("Esperando rival");
      return;
    }
    if (action === "local") {
      this.net.leave();
      this.net.side = 0;
      this.sim.cpu = true;
      this.sim.rules.reset();
      this.sim.active = false;
      this.place("play");
      this.refresh();
      return;
    }
    if (action === "ready") {
      if (this.sim.rules.phase === "juego") {
        this.message("Termina el punto antes de pasar a PvP.");
        return;
      }
      this.net.ready();
      return;
    }
    if (action === "copy") {
      navigator.clipboard
        ?.writeText(location.href)
        .then(() => this.message("Invitación copiada."))
        .catch(() => this.message(location.href));
      return;
    }
    if (action === "hand") {
      this.pause("Mano cambiada. Continúa para sacar.");
      this.hand = this.hand === "right" ? "left" : "right";
      this.message(
        "Mano " +
          (this.hand === "right" ? "derecha" : "izquierda") +
          " seleccionada. Recupera la pala.",
      );
      this.held = false;
      this.syncToggles();
      return;
    }
    if (action === "seated") {
      this.pause("Postura cambiada. Continúa para sacar.");
      this.seated = !this.seated;
      this.syncToggles();
      this.place("play");
      this.message(
        this.seated
          ? "Puesto sentado: alcance acercado. Ajusta con flechas."
          : "Puesto de pie.",
      );
      return;
    }
    if (["entry", "bench", "play", "center"].includes(action)) {
      if (this.sim.rules.phase === "juego" || this.sim.rules.phase === "saque")
        this.action("pause");
      this.place(action === "center" ? "play" : action);
      return;
    }
    if (action === "place") {
      if (this.ctx.xr?.mode !== "immersive-ar") {
        this.message("Disponible dentro de una sesión RM.");
        return;
      }
      this.pause("Colocando mesa. Confirma para jugar.");
      this.arPlaced = false;
      const ctrl = this.ctx.xr.controllers.find((c) => c.isTracking),
        hit = ctrl?.getHitTest();
      if (hit) this.world.root.position.copy(hit.position);
      else {
        this.ctx.mainCamera.getWorldPosition(this.temp);
        this.world.root.position.set(this.temp.x, 0, this.temp.z - 1.9);
      }
      return;
    }
    if (action === "rotate") {
      this.pause("Girando mesa. Confirma colocación.");
      this.world.root.rotation.y += Math.PI / 12;
      return;
    }
    if (action === "confirm") {
      this.arPlaced = true;
      this.sim.recover("Mesa confirmada a escala 1:1. Toma la pala.");
      return;
    }
    if (action === "measure") {
      if (this.record) {
        this.record = false;
        this.downloadMetrics();
        this.message("Registro descargado.");
      } else {
        this.record = true;
        this.samples = [];
        this.message(
          "Registro de cuadros activo; pulsa otra vez para descargar.",
        );
      }
    }
  }
  authorizedAction(action: string, side: Side) {
    if (action === "saque" && this.sim.rules.server === side)
      this.sim.toss(side);
    if (action === "pausa")
      this.pause("Pausa solicitada. Continuar repite el saque.");
    if (action === "continuar") {
      this.sim.active = false;
      this.sim.recover("Pausa terminada. Repite el saque.");
    }
    if (action === "revancha") {
      this.sim.rules.reset();
      this.sim.active = false;
    }
    this.refresh();
  }
  pause(why: string) {
    if (this.net.online && !this.net.host) this.net.action("pausa");
    this.sim.rules.pause(why);
    this.sim.active = false;
    this.swing = 0;
  }
  place(destination: string) {
    const s = this.sign;
    const p =
      destination === "entry"
        ? new T.Vector3(0, 0, 3.15 * s)
        : destination === "bench"
          ? new T.Vector3(-1.25, 0, 2.05 * s)
          : new T.Vector3(
              0,
              0,
              (1.98 + this.offset - (this.seated ? 0.18 : 0)) * s,
            );
    const xr = this.ctx.xr;
    if (xr?.running && xr.rig) {
      const rig = xr.rig.gameObject;
      const head = xr.getUserOffsetInRig();
      rig.position.set(p.x - head.x, 0, p.z - head.z);
      rig.rotation.y = this.side === 1 ? Math.PI : 0;
    } else {
      // En escritorio el puesto queda 30 cm más atrás para ver y alcanzar bolas altas.
      const back = destination === "entry" || destination === "bench" ? 0 : 0.3;
      this.ctx.mainCamera.position.set(
        p.x,
        this.seated ? 1.28 : 1.62,
        p.z + back * s,
      );
      this.ctx.mainCamera.lookAt(
        0,
        0.91,
        destination === "entry" ? -1.0 * s : -0.15 * s,
      );
    }
    this.world.panel.position.set(-1.2, 1.26, 1.55 * s);
    this.world.panel.rotation.y = this.side === 0 ? 0.12 : Math.PI - 0.12;
  }
  startSwing(strong = false) {
    if (!this.held || this.ctx.xr?.running || this.swing > 0) return;
    this.swingStrength = strong ? 1.5 : 1;
    this.swing = 0.001;
    this.swingStart = { ...this.sim.paddles[this.side].p };
    this.swingNormal =
      this.sim.rules.phase === "saque"
        ? norm(v(this.pointer.x * 0.25, -0.55, -this.sign))
        : norm(v(this.pointer.x * 0.4, this.tilt, -this.sign));
  }
  desktop(dt: number) {
    const s = this.side,
      p = this.sim.paddles[s];
    let pos: V;
    if (!this.held) {
      pos = v(-1.58, 0.73, 1.2 * this.sign);
      p.p = { ...pos };
      p.previous = { ...pos };
      p.active = false;
      return;
    }
    if (this.swing > 0) {
      this.swing += dt;
      pos = {
        ...this.swingStart,
        z:
          this.swingStart.z -
          this.sign *
            0.35 *
            this.swingStrength *
            Math.min(1, this.swing / 0.22),
      };
      if (this.sim.rules.phase === "saque")
        pos.y =
          !this.net.host && this.predictedGuest
            ? this.predictedGuest.y
            : this.sim.p.y;
      if (this.swing > 0.29) this.swing = 0;
    } else {
      const serving = this.sim.rules.phase === "saque";
      const base = serving
        ? v(
            clamp(this.pointer.x * 0.8, -0.6, 0.6),
            !this.net.host && this.predictedGuest
              ? this.predictedGuest.y
              : this.sim.p.y,
            1.26 * this.sign,
          )
        : v(
            clamp(this.pointer.x * 1.0, -0.8, 0.8),
            clamp(1.06 - this.pointer.y * 0.62, 0.82, 1.7),
            // Más atrás que el borde de la mesa: la bola ya bajó cuando llega.
            1.5 * this.sign,
          );
      pos = lerp(p.p, base, Math.min(1, dt * 20));
    }
    this.sim.pose(
      s,
      pos,
      this.swing > 0 ? this.swingNormal : norm(v(0, 0.22, -this.sign)),
      dt,
    );
  }
  xrInput(dt: number) {
    const xr = this.ctx.xr!;
    const c = xr.controllers.find((c) => c.side === this.hand && c.isTracking);
    if (!c) {
      if (this.held && performance.now() - this.lastXRGood > 300) {
        this.held = false;
        this.net.action("pausa");
        this.pause("Tracking perdido. Recupera la pala y continúa.");
      }
      return;
    }
    this.lastXRGood = performance.now();
    const trigger = c.getButton("xr-standard-trigger")?.pressed || false,
      squeeze = c.getButton("xr-standard-squeeze")?.pressed || false;
    let pinched = false;
    if (c.isHand) {
      const a = c.hand?.get("thumb-tip"),
        b = c.hand?.get("index-finger-tip");
      const pa = a ? c.getHandJointPose(a) : null,
        pb = b ? c.getHandJointPose(b) : null;
      if (pa && pb)
        pinched =
          Math.hypot(
            pa.transform.position.x - pb.transform.position.x,
            pa.transform.position.y - pb.transform.position.y,
            pa.transform.position.z - pb.transform.position.z,
          ) < 0.025;
    }
    if ((squeeze || pinched) && !this.wasSqueeze) {
      const paddle = this.world.paddles[this.side];
      const handle = paddle.localToWorld(new T.Vector3(0, -0.12, 0));
      if (this.held || handle.distanceTo(c.gripWorldPosition) < 0.24)
        this.action("grab");
      else
        this.message(
          "Acerca la mano al mango o usa Tomar / recuperar en el panel.",
        );
    }
    this.wasSqueeze = squeeze || pinched;
    if (trigger && !this.wasTrigger) {
      this.raycaster.ray.copy(c.ray);
      const hits = this.raycaster.intersectObjects(
        this.world.actions.map((a) => a.mesh),
      );
      if (hits[0])
        this.action(
          this.world.actions.find((a) => a.mesh === hits[0].object)!.action,
        );
      else this.action("serve");
    }
    this.wasTrigger = trigger;
    if (!this.held) return;
    this.temp.copy(c.gripWorldPosition);
    this.q.copy(c.gripWorldQuaternion);
    this.temp.add(new T.Vector3(0, 0.125, 0).applyQuaternion(this.q));
    this.world.root.updateMatrixWorld();
    this.world.root.worldToLocal(this.temp);
    const normal = new T.Vector3(0, 0, 1)
      .applyQuaternion(this.q)
      .transformDirection(this.world.root.matrixWorld.clone().invert());
    this.sim.pose(this.side, this.temp, normal, dt);
  }
  remotePose(d: any) {
    if (
      d.side === this.side ||
      !this.net.club ||
      d.session !== this.net.club.session ||
      d.seq <= this.net.lastPose[d.side]
    )
      return;
    this.net.lastPose[d.side] = d.seq;
    const age = this.sim.time - d.time;
    if (!Number.isFinite(age) || age < -0.12 || age > 0.3) return;
    this.sim.pose(d.side, d.p, d.n, 1 / 30, d.active);
    this.remotePrevious = d.p;
    this.remoteTime = d.time;
  }
  guestBall?: V;
  guestContact = -1;
  lateContacts = 0;
  remoteContact(d: any) {
    if (
      !this.net.host ||
      this.net.club?.mode !== "pvp" ||
      d.sender !== this.net.club.seats[1] ||
      d.session !== this.net.club.session ||
      d.rally !== this.sim.rules.rally ||
      d.dt < 0.004 ||
      d.dt > 0.08
    )
      return;
    const age = this.sim.time - d.time;
    if (age < -0.05 || age > 0.3) return;
    for (let i = 0; i < this.history.length - 1; i++) {
      const a = this.history[i],
        b = this.history[i + 1];
      const serving = a.rules.phase === "saque" && a.rules.server === 1;
      const returning =
        a.rules.phase === "juego" &&
        a.rules.last === 0 &&
        a.rules.bounces === 1 &&
        a.rules.serveStage === 0;
      if (Math.abs(a.time - d.time) > 0.045 || (!serving && !returning))
        continue;
      const p = {
        ...this.sim.paddles[1],
        previous: d.previous,
        p: d.p,
        n: d.n,
        velocity: mul(sub(d.p, d.previous), 1 / d.dt),
        angular: v(),
        active: true,
      };
      const hit = sweepPaddle(a.p, b.p, p, 0.027);
      if (!hit) continue;
      const now = this.sim.time,
        currentA = this.sim.paddles[0];
      this.sim.apply(a);
      this.sim.cpu = false;
      this.sim.p = { ...hit.point };
      this.sim.paddles[1] = p;
      if (!this.sim.rules.hit(1)) return;
      this.sim.reflect(1, hit.normal, p, serving);
      this.sim.cooldown[1] = 0.1;
      this.sim.sound("pala", 1);
      for (let t = a.time; t < now; t += SIZE.step) this.sim.step();
      this.sim.paddles[0] = currentA;
      this.history = [];
      this.lateContacts++;
      return;
    }
  }
  update() {
    const now = performance.now(),
      raw = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(raw, 0.05);
    if (raw > 1 && this.ctx.xr?.running && this.sim.rules.phase === "juego")
      this.action("pause");
    if (this.record) this.samples.push({ time: now, ms: raw * 1000 });
    this.metric.push(raw * 1000);
    if (this.metric.length > 120) this.metric.shift();
    const inXR = !!this.ctx.xr?.running;
    if (this.xrWas && !inXR) {
      this.action("pause");
      this.place("play");
      this.message("Saliste de XR. Continúa para repetir el saque.");
    }
    this.xrWas = inXR;
    if (inXR) this.xrInput(dt);
    else this.desktop(dt);
    const localP = this.sim.paddles[this.side];
    if (this.net.host && this.arPlaced) {
      this.accumulator = Math.min(this.accumulator + dt, 0.067);
      while (this.accumulator >= SIZE.step) {
        this.sim.step();
        this.accumulator -= SIZE.step;
        if (this.net.club?.mode === "pvp") {
          this.history.push(this.sim.snapshot());
          if (this.history.length > 44) this.history.shift();
        }
      }
    }
    if (!this.net.host && this.net.club?.mode === "pvp") {
      const networkDelay = clamp(this.ctx.connection.currentLatency, 0, 0.22);
      const elapsed = Math.min(
          0.25,
          (now - this.net.lastReceived) / 1000 + networkDelay,
        ),
        p = this.sim.p,
        vel = this.sim.velocity;
      const predicted = predictBall(p, vel, elapsed);
      const r = this.sim.rules;
      const canContact =
        (r.phase === "saque" && r.server === this.side) ||
        (r.phase === "juego" &&
          r.last === 0 &&
          r.bounces === 1 &&
          r.serveStage === 0);
      if (
        this.held &&
        canContact &&
        this.guestBall &&
        this.guestContact !== r.revision
      ) {
        const hit = sweepPaddle(this.guestBall, predicted, localP);
        if (hit) {
          this.net.send("contacto", {
            p: localP.p,
            previous: localP.previous,
            n: localP.n,
            dt,
            time: this.sim.time + elapsed,
            rally: r.rally,
          });
          this.guestContact = r.revision;
        }
      }
      this.guestBall = predicted;
      this.predictedGuest = predicted;
    }
    this.poseClock += dt;
    this.sendClock += dt;
    this.pingClock += dt;
    if (this.net.online && this.pingClock > 2) {
      this.ctx.connection.sendPing();
      this.pingClock = 0;
    }
    if (this.net.online && this.poseClock > 1 / 30) {
      const time = this.net.host
        ? this.sim.time
        : this.sim.time +
          Math.min(
            0.25,
            (now - this.net.lastReceived) / 1000 +
              clamp(this.ctx.connection.currentLatency, 0, 0.22),
          );
      this.net.pose(localP.p, localP.n, time, localP.active);
      this.poseClock = 0;
    }
    if (this.net.host && this.net.online && this.sendClock > 1 / 25) {
      this.net.snapshot(this.sim);
      this.sendClock = 0;
    }
    if (
      this.net.online &&
      this.net.club?.mode === "pvp" &&
      !this.ctx.connection.isConnected
    ) {
      this.pause("Conexión perdida. Reconecta o juega CPU local.");
      this.net.online = false;
    }
    const w = this.world;
    w.panel.visible = inXR;
    for (const s of [0, 1] as Side[]) {
      const p = this.sim.paddles[s];
      w.paddles[s].position.set(p.p.x, p.p.y, p.p.z);
      w.paddles[s].quaternion.setFromUnitVectors(
        new T.Vector3(0, 0, 1),
        new T.Vector3(p.n.x, p.n.y, p.n.z).normalize(),
      );
    }
    const target = this.sim.active
      ? !this.net.host && this.predictedGuest
        ? this.predictedGuest
        : this.sim.p
      : v(-1.08, 1.08, 1.3);
    if (this.net.host) this.visualBall.set(target.x, target.y, target.z);
    else
      this.visualBall.lerp(
        new T.Vector3(target.x, target.y, target.z),
        Math.min(1, dt * 40),
      );
    w.ball.position.copy(this.visualBall);
    w.shadow.position.set(this.visualBall.x, 0.763, this.visualBall.z);
    w.shadow.visible =
      Math.abs(this.visualBall.x) < 0.76 && Math.abs(this.visualBall.z) < 1.37;
    w.bot.visible = this.sim.cpu;
    w.bellows.scale.y = 1 + Math.sin(this.sim.time * 4) * 0.04;
    w.core.rotation.y = this.sim.time * 0.3;
    w.branding.visible = this.ctx.xr?.mode !== "immersive-ar";
    w.environment.visible = !this.baked && this.ctx.xr?.mode !== "immersive-ar";
    if (this.bakedEnvironment)
      this.bakedEnvironment.visible = this.ctx.xr?.mode !== "immersive-ar";
    if (this.ctx.xr?.mode === "immersive-ar") {
      this.ctx.scene.background = null;
      this.ctx.scene.fog = null;
    } else if (!this.ctx.scene.background)
      this.ctx.scene.background = new T.Color(palette.ink);
    for (const e of this.sim.events)
      if (e.id > this.lastEvent) {
        this.sound(e.kind);
        if (e.kind === "pala") this.onHit(e.side ?? 0);
        if (e.kind === "punto") {
          this.rally = 0;
          this.pointToast(e.side ?? 0);
        }
        if (e.kind === "red") this.onNet();
        this.lastEvent = e.id;
      }
    this.updateHitFx(dt);
    if (this.sim.rules.revision !== this.lastRevision) {
      this.refresh();
      this.lastRevision = this.sim.rules.revision;
    }
    if (this.lastFrame++ % 30 === 0)
      document.querySelector("#performance")!.textContent =
        `${Math.round(1000 / (this.metric.reduce((a, b) => a + b, 0) / (this.metric.length || 1)))} FPS · sesión actual`;
  }
  showResult() {
    const r = this.sim.rules,
      won = r.winner === this.side,
      mine = r.score[this.side],
      theirs = r.score[this.side === 0 ? 1 : 0],
      cpu = this.sim.cpu;
    const box = document.querySelector<HTMLElement>("#result")!;
    box.classList.toggle("is-win", won);
    box.classList.toggle("is-loss", !won);
    document.querySelector("#result-title")!.textContent = won
      ? "¡Ganaste!"
      : "Perdiste";
    document.querySelector("#result-score")!.textContent =
      `${mine} : ${theirs}`;
    document.querySelector("#result-detail")!.textContent = won
      ? `Le ganaste ${cpu ? "al autómata" : "a tu rival"}. ¿Otra para confirmarlo?`
      : `Esta vez ganó ${cpu ? "el autómata" : "tu rival"}. La revancha está a un clic.`;
    box.hidden = false;
    this.sound(won ? "victoria" : "derrota");
    box.querySelector<HTMLElement>("[data-action=rematch]")?.focus();
  }
  hideResult() {
    const box = document.querySelector<HTMLElement>("#result")!;
    if (box.hidden) return;
    box.hidden = true;
    document.querySelector<HTMLElement>("#controls")?.focus();
  }
  refresh() {
    const r = this.sim.rules,
      server = r.server === 0 ? "A" : "B",
      score = `${r.score[0]} : ${r.score[1]}`;
    document.querySelector("#score")!.textContent = score;
    if (r.phase === "fin" && !this.resultShown) {
      this.resultShown = true;
      this.showResult();
    } else if (r.phase !== "fin" && this.resultShown) {
      this.resultShown = false;
      document.querySelector<HTMLElement>("#result")!.hidden = true;
    }
    if (score !== this.lastScoreText) {
      this.lastScoreText = score;
      document.querySelector("#sr-score")!.textContent =
        `Marcador: A ${r.score[0]}, B ${r.score[1]}.`;
    }
    document.querySelector("#turn")!.textContent =
      `Saque ${server} · ${this.sim.cpu ? "CPU" : "PvP"}`;
    document.querySelector("#phase")!.textContent =
      r.phase === "fin"
        ? `Ganador: ${r.winner === 0 ? "A" : "B"} · ${r.reason} · Pulsa Revancha.`
        : r.reason;
    document.querySelector("#room")!.textContent = this.net.online
      ? `${this.net.code} · ${this.net.club?.seats[1] ? "2/2" : "1/2"} · lado ${this.side === 0 ? "A" : "B"}`
      : "CPU local · sin sala";
    updateText(this.world.scoreFront, `A  ${score}  B\nSAQUE ${server}`);
    updateText(
      this.world.scoreBack,
      `B  ${r.score[1]} : ${r.score[0]}  A\nSAQUE ${server}`,
    );
    updateText(
      this.world.status,
      `${this.net.online ? this.net.code + " · " + (this.net.club?.seats[1] ? "2/2" : "1/2") : "CLUB DE CANTERA"} · ${score}\n${r.phase === "fin" ? "FIN · REVANCHA" : r.phase === "pausa" ? "PAUSA · CONTINUAR" : this.held ? "SAQUE " + server : "TOMA LA PALA"}`,
    );
  }
  downloadMetrics() {
    const rows = [
      "time,ms",
      ...this.samples.map((s) => `${s.time},${s.ms}`),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([rows], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "cuadros-rebote.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
}
declare global {
  interface Window {
    clubGame: Game;
  }
}
onStart((ctx) => {
  if (!window.clubGame) window.clubGame = new Game(ctx);
});
onUpdate(() => window.clubGame?.update());
