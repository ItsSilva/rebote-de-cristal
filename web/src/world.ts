import * as T from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
export const palette = {
  ink: "#172238",
  slate: "#42415F",
  stone: "#786A80",
  petrol: "#225B61",
  jade: "#68CDB5",
  coral: "#E68772",
  amber: "#F2B65E",
  ivory: "#FFF1CB",
};
export function textPlane(
  text: string,
  w: number,
  h: number,
  size = 56,
  color = palette.ivory,
  bg = palette.ink,
) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = Math.round((1024 * h) / w);
  const x = c.getContext("2d")!;
  x.fillStyle = bg;
  x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = color;
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.font = `600 ${size}px system-ui`;
  const lines = text.split("\n");
  lines.forEach((l, i) =>
    x.fillText(
      l,
      512,
      c.height / 2 + (i - (lines.length - 1) / 2) * size * 1.5,
      960,
    ),
  );
  const texture = new T.CanvasTexture(c);
  texture.colorSpace = T.SRGBColorSpace;
  const mesh = new T.Mesh(
    new T.PlaneGeometry(w, h),
    new T.MeshBasicMaterial({ map: texture, toneMapped: false }),
  );
  mesh.userData.canvas = c;
  return mesh;
}
export function updateText(mesh: T.Mesh, text: string) {
  const c = mesh.userData.canvas as HTMLCanvasElement,
    x = c.getContext("2d")!;
  x.fillStyle = palette.ink;
  x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = palette.ivory;
  x.textAlign = "center";
  x.textBaseline = "middle";
  const lines = text.split("\n");
  x.font = `600 ${lines.length > 2 ? 64 : 96}px system-ui`;
  lines.forEach((l, i) =>
    x.fillText(l, 512, c.height / 2 + (i - (lines.length - 1) / 2) * 90, 960),
  );
  (mesh.material as T.MeshBasicMaterial).map!.needsUpdate = true;
}
export function buildWorld() {
  const root = new T.Group();
  root.name = "Cancha — origen bajo el centro de mesa";
  const environment = new T.Group();
  environment.name = "Cantera_estatica";
  root.add(environment);
  const mats: Record<string, T.MeshStandardMaterial> = {};
  for (const [k, color] of Object.entries(palette))
    mats[k] = new T.MeshStandardMaterial({ color, roughness: 0.85 });
  const lamp = new T.MeshBasicMaterial({ color: palette.amber }),
    crystal = new T.MeshStandardMaterial({
      color: palette.jade,
      roughness: 0.35,
      metalness: 0.15,
      emissive: palette.jade,
      emissiveIntensity: 0.13,
    });
  const texture = new T.TextureLoader().load(
    new URL("./assets/fabric-normal.png", import.meta.url).href,
  );
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(2, 2);
  const ao = new T.TextureLoader().load(
    new URL("./assets/fabric-ao.png", import.meta.url).href,
  );
  const padded = mats.jade.clone();
  padded.roughness = 0.56;
  padded.normalMap = texture;
  padded.normalScale.set(0.18, 0.18);
  padded.aoMap = ao;
  const coral = padded.clone();
  coral.color.set(palette.coral);
  const box = (
    parent: T.Object3D,
    name: string,
    s: number[],
    p: number[],
    mat: T.Material,
    round = 0,
  ) => {
    const g = round
      ? new RoundedBoxGeometry(s[0], s[1], s[2], 2, round)
      : new T.BoxGeometry(s[0], s[1], s[2]);
    g.setAttribute("uv1", g.getAttribute("uv").clone());
    const m = new T.Mesh(g, mat);
    m.name = name;
    m.position.set(p[0], p[1], p[2]);
    parent.add(m);
    return m;
  };
  const floorTex = new T.TextureLoader().load(
    new URL("./assets/court-baked.png", import.meta.url).href,
  );
  floorTex.colorSpace = T.SRGBColorSpace;
  const floor = box(
    environment,
    "Terraza_bake",
    [5, 0.18, 7],
    [0, -0.09, 0],
    new T.MeshBasicMaterial({ map: floorTex }),
  );
  for (let s of [-1, 1]) {
    for (let i = 0; i < 3; i++)
      box(
        environment,
        "Estrato_de_cantera",
        [5.25 + i * 0.25, 0.2, 7.25 + i * 0.25],
        [0, -0.29 - i * 0.2, 0],
        i % 2 ? mats.stone : mats.slate,
      );
    for (let i = 0; i < 8; i++) {
      const g = new T.IcosahedronGeometry(0.55 + (i % 3) * 0.11, 0);
      const m = new T.Mesh(g, i % 3 ? mats.slate : mats.stone);
      m.name = "Roca_facetada";
      m.scale.set(1, 0.9 + (i % 3) * 0.65, 1.1);
      m.position.set(
        s * (2.35 + (i % 2) * 0.3),
        0.15 + (i % 3) * 0.18,
        -3.1 + i * 0.86,
      );
      m.rotation.set(i * 0.6, i * 1.45, 0);
      environment.add(m);
    }
    for (let i = 0; i < 3; i++)
      box(
        environment,
        "Escalón_fondo",
        [4.5 - i * 0.5, 0.18, 0.35],
        [0, 0.09 + i * 0.18, s * 3.25],
        mats.slate,
      );
    for (let k = 0; k < 2; k++) {
      const group = new T.Group();
      group.position.set(s * 2.05, 0, (k === 0 ? -1 : 1) * 2.15);
      environment.add(group);
      for (let i = 0; i < 5; i++) {
        const c = new T.Mesh(
          new T.CylinderGeometry(0, 0.1, 0.48 + (i % 3) * 0.2, 5, 1),
          crystal,
        );
        c.position.set(
          Math.sin(i * 4) * 0.19,
          0.22 + (i % 3) * 0.1,
          Math.cos(i * 4) * 0.19,
        );
        c.rotation.z = Math.sin(i * 2) * 0.3;
        group.add(c);
        const b = box(
          group,
          "Base_mineral",
          [0.2, 0.12, 0.2],
          [c.position.x, 0.04, c.position.z],
          mats.slate,
        );
        b.rotation.y = i;
      }
    }
    for (const z of [-2.5, 2.5]) {
      box(
        environment,
        "Pilar",
        [0.26, 0.75, 0.26],
        [s * 1.9, 0.375, z],
        mats.slate,
        0.03,
      );
      box(
        environment,
        "Lámpara",
        [0.19, 0.12, 0.19],
        [s * 1.9, 0.81, z],
        lamp,
        0.04,
      );
      box(
        environment,
        "Tapa",
        [0.28, 0.06, 0.28],
        [s * 1.9, 0.9, z],
        mats.ink,
        0.02,
      );
    }
  }
  // Flat top exactly .760 m; all padding is below the collision plane.
  box(
    root,
    "Mesa_274x1525",
    [1.525, 0.055, 2.74],
    [0, 0.7325, 0],
    mats.petrol,
    0.008,
  );
  box(
    root,
    "Protector_inflable",
    [1.6, 0.085, 2.8],
    [0, 0.6725, 0],
    padded,
    0.035,
  );
  for (const x of [-0.71, 0.71])
    box(root, "Línea_lateral", [0.014, 0.002, 2.7], [x, 0.761, 0], mats.ivory);
  for (const z of [-1.32, 1.32])
    box(root, "Línea_fondo", [1.44, 0.002, 0.014], [0, 0.761, z], mats.ivory);
  box(root, "Línea_centro", [0.007, 0.002, 2.7], [0, 0.761, 0], mats.ivory);
  for (const x of [-0.56, 0.56])
    for (const z of [-0.93, 0.93])
      box(root, "Pata", [0.09, 0.62, 0.09], [x, 0.31, z], mats.ink, 0.015);
  for (const z of [-0.93, 0.93])
    box(root, "Travesaño", [1.22, 0.07, 0.08], [0, 0.19, z], mats.slate);
  for (const x of [-0.8, 0.8])
    box(root, "Poste_neumático", [0.07, 0.23, 0.08], [x, 0.8, 0], coral, 0.03);
  box(
    root,
    "Cinta_red",
    [1.6, 0.014, 0.014],
    [0, 0.9055, 0],
    mats.ivory,
    0.004,
  );
  for (let i = 0; i <= 40; i++)
    box(
      root,
      "Malla_vertical",
      [0.002, 0.145, 0.002],
      [-0.76 + i * 0.038, 0.8315, 0],
      mats.ivory,
    );
  for (let j = 0; j < 5; j++)
    box(
      root,
      "Malla_horizontal",
      [1.525, 0.002, 0.002],
      [0, 0.77 + j * 0.031, 0],
      mats.ivory,
    );
  const makePaddle = (color: T.Material) => {
    const g = new T.Group();
    g.name = "Pala_original_25cm";
    const head = new T.Mesh(new T.SphereGeometry(1, 20, 12), color);
    head.name = "Funda_acolchada";
    head.scale.set(0.087, 0.097, 0.017);
    g.add(head);
    const face = new T.Mesh(new T.CircleGeometry(0.08, 24), mats.ink);
    face.position.z = 0.018;
    g.add(face);
    const back = face.clone();
    back.position.z = -0.018;
    back.rotation.y = Math.PI;
    g.add(back);
    const seam = new T.Mesh(
      new T.TorusGeometry(0.084, 0.0015, 4, 36),
      mats.ivory,
    );
    seam.scale.y = 1.1;
    g.add(seam);
    box(
      g,
      "Mango_agarre",
      [0.027, 0.105, 0.025],
      [0, -0.133, 0],
      mats.stone,
      0.012,
    );
    box(
      g,
      "Válvula",
      [0.011, 0.011, 0.01],
      [0.061, -0.055, 0.016],
      mats.amber,
      0.003,
    );
    return g;
  };
  const paddles = [makePaddle(padded), makePaddle(coral)];
  paddles.forEach((p) => root.add(p));
  const ball = new T.Mesh(
    new T.SphereGeometry(0.02, 16, 12),
    new T.MeshBasicMaterial({ color: palette.ivory }),
  );
  ball.name = "Pelota_40mm";
  root.add(ball);
  const outline = new T.Mesh(
    new T.SphereGeometry(0.0218, 12, 8),
    new T.MeshBasicMaterial({ color: palette.ink, side: T.BackSide }),
  );
  ball.add(outline);
  const shadow = new T.Mesh(
    new T.CircleGeometry(0.032, 14),
    new T.MeshBasicMaterial({
      color: palette.ink,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  root.add(shadow);
  const bot = new T.Group();
  bot.name = "Autómata_de_fuelle";
  bot.position.set(0, 0, -2.1);
  root.add(bot);
  box(bot, "Zócalo", [0.52, 0.16, 0.38], [0, 0.08, 0], mats.slate, 0.04);
  const bellows = new T.Group();
  bot.add(bellows);
  for (let i = 0; i < 5; i++)
    box(
      bellows,
      "Pliegue_fuelle",
      [0.34 + (i % 2) * 0.09, 0.1, 0.3 + (i % 2) * 0.06],
      [0, 0.23 + i * 0.105, 0],
      i % 2 ? coral : mats.ink,
      0.035,
    );
  const core = new T.Mesh(new T.OctahedronGeometry(0.17), crystal);
  core.position.y = 0.9;
  bot.add(core);
  box(bot, "Ceja", [0.34, 0.035, 0.09], [0, 1.13, 0], mats.ink, 0.015);
  for (const x of [-0.09, 0.09])
    box(bot, "Ojo", [0.047, 0.022, 0.02], [x, 1.06, 0.16], lamp, 0.006);
  // Three purposeful stations and an original dispenser beside the bench.
  box(
    environment,
    "Banco_reparación",
    [0.45, 0.1, 1.2],
    [-1.67, 0.52, 1.2],
    mats.stone,
    0.04,
  );
  for (const z of [0.75, 1.65])
    box(
      environment,
      "Pata_banco",
      [0.06, 0.49, 0.06],
      [-1.67, 0.245, z],
      mats.slate,
    );
  const dispenser = new T.Group();
  dispenser.name = "Dispensador";
  dispenser.position.set(-1.08, 0, 1.3);
  root.add(dispenser);
  box(dispenser, "Columna", [0.18, 0.78, 0.18], [0, 0.39, 0], mats.ink, 0.035);
  box(dispenser, "Depósito", [0.29, 0.24, 0.28], [0, 0.91, 0], coral, 0.08);
  box(
    dispenser,
    "Ranura",
    [0.12, 0.035, 0.012],
    [0, 0.88, 0.145],
    mats.ink,
    0.008,
  );
  const valve = new T.Mesh(
    new T.TorusGeometry(0.065, 0.012, 6, 16),
    mats.amber,
  );
  valve.position.set(0, 0.98, 0.16);
  dispenser.add(valve);
  valve.name = "Válvula_saque";
  const scoreShell = box(
    root,
    "Marcador_cosido",
    [0.98, 0.48, 0.17],
    [1.48, 1.46, 0],
    padded,
    0.09,
  );
  const scoreFront = textPlane("A  0 : 0  B\nSAQUE A", 0.86, 0.37);
  scoreFront.position.set(1.48, 1.46, 0.12);
  root.add(scoreFront);
  const scoreBack = textPlane("B  0 : 0  A\nSAQUE A", 0.86, 0.37);
  scoreBack.position.set(1.48, 1.46, -0.12);
  scoreBack.rotation.y = Math.PI;
  root.add(scoreBack);
  const branding = new T.Group();
  branding.name = "Rotulo_club";
  root.add(branding);
  const title = textPlane(
    "REBOTE DE CRISTAL\nCLUB DE CANTERA · 07",
    2,
    0.42,
    51,
    palette.ivory,
  );
  title.position.set(0, 1.9, -3.1);
  branding.add(title);
  for (const [name, x, z, col] of [
    ["ENTRADA", 0, 2.8, palette.amber],
    ["BANCO", -1.4, 1.95, palette.jade],
    ["PUESTO A", 0, 1.9, palette.jade],
    ["PUESTO B", 0, -1.9, palette.coral],
  ] as const) {
    const ring = new T.Mesh(
      new T.RingGeometry(0.26, 0.28, 32),
      new T.MeshBasicMaterial({ color: col, side: T.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.004, z);
    environment.add(ring);
    ring.name = name;
  }
  const panel = new T.Group();
  panel.name = "Panel_espacial";
  root.add(panel);
  const actions: { mesh: T.Mesh; action: string }[] = [];
  function panelButton(
    label: string,
    action: string,
    x: number,
    y: number,
    w = 0.38,
  ) {
    const b = textPlane(label, w, 0.11, 66);
    b.position.set(x, y, 0);
    panel.add(b);
    actions.push({ mesh: b, action });
    return b;
  }
  const status = textPlane("TOMA LA PALA\nActiva el saque", 1.14, 0.24, 66);
  status.position.set(0, 0.14, 0);
  panel.add(status);
  const labels = [
    ["Tomar / recuperar", "grab"],
    ["Preparar saque", "serve"],
    ["Pausa / seguir", "pause"],
    ["CPU", "cpu"],
    ["Esperar rival", "wait"],
    ["Listo PvP", "ready"],
    ["Revancha", "rematch"],
    ["Entrada", "entry"],
    ["Banco", "bench"],
    ["Puesto", "play"],
    ["Mano D / I", "hand"],
    ["Sentado / pie", "seated"],
    ["Recentrar", "center"],
    ["Salir XR", "exit"],
    ["Colocar RM", "place"],
    ["Girar RM", "rotate"],
    ["Confirmar RM", "confirm"],
  ];
  labels.forEach(([l, a], i) =>
    panelButton(l, a, ((i % 3) - 1) * 0.39, -0.1 - Math.floor(i / 3) * 0.13),
  );
  panel.position.set(-1.3, 1.25, 1.7);
  panel.rotation.y = 0.25;
  const light = new T.HemisphereLight("#c6e8e0", "#5e4567", 2.6);
  root.add(light);
  const sun = new T.DirectionalLight("#ffe6bc", 2.1);
  sun.position.set(-3, 6, 2);
  root.add(sun);
  function mergeStatic(parent: T.Group, exclude: T.Object3D[] = []) {
    parent.updateMatrixWorld(true);
    const byMaterial = new Map<T.Material, T.Mesh[]>();
    for (const child of [...parent.children])
      if (
        child instanceof T.Mesh &&
        !exclude.includes(child) &&
        !Array.isArray(child.material)
      ) {
        const arr = byMaterial.get(child.material) || [];
        arr.push(child);
        byMaterial.set(child.material, arr);
      }
    for (const [material, meshes] of byMaterial) {
      if (meshes.length < 2) continue;
      const geometries = meshes.map((m) => {
        let g = m.geometry.index
          ? m.geometry.toNonIndexed()
          : m.geometry.clone();
        g.applyMatrix4(m.matrix);
        g.deleteAttribute("uv1");
        g.deleteAttribute("color");
        if (!g.getAttribute("uv"))
          g.setAttribute(
            "uv",
            new T.BufferAttribute(
              new Float32Array(g.getAttribute("position").count * 2),
              2,
            ),
          );
        return g;
      });
      const merged = mergeGeometries(geometries);
      if (merged) {
        const m = new T.Mesh(merged, material);
        m.name = "Estático_agrupado_" + meshes[0].name;
        parent.add(m);
        meshes.forEach((m) => parent.remove(m));
      }
      geometries.forEach((g) => g.dispose());
    }
  }
  mergeStatic(environment);
  const architecture = new T.Group();
  architecture.name = "Arquitectura_estatica";
  root.add(architecture);
  for (const c of [...root.children])
    if (
      c instanceof T.Mesh &&
      ![ball, shadow, scoreFront, scoreBack].includes(c)
    )
      architecture.add(c);
  mergeStatic(architecture);
  return {
    root,
    environment,
    architecture,
    branding,
    ball,
    shadow,
    paddles,
    bot,
    bellows,
    core,
    dispenser,
    valve,
    scoreFront,
    scoreBack,
    status,
    panel,
    actions,
    floor,
    scoreShell,
    mats,
  };
}
