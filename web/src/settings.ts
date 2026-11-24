/** Ajustes del jugador: se guardan en el navegador y se aplican como atributos de <html>. */
export type Settings = {
  text: "normal" | "grande" | "muy-grande";
  contrast: boolean;
  motion: boolean; // true = reducir movimiento
  sound: boolean;
  volume: number; // 0..100
  fps: boolean;
  cpuLevel: 0 | 1 | 2; // fácil, normal, difícil
  hand: "left" | "right";
  seated: boolean;
  shortcuts: boolean;
};

const KEY = "rebote-ajustes";

export function defaults(): Settings {
  let reduce = false;
  try {
    reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {}
  return {
    text: "normal",
    contrast: false,
    motion: reduce,
    sound: true,
    volume: 70,
    fps: true,
    cpuLevel: 1,
    hand: "right",
    seated: false,
    shortcuts: true,
  };
}

export function loadSettings(): Settings {
  const base = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const s = JSON.parse(raw) as Partial<Settings>;
    return {
      text:
        s.text === "grande" || s.text === "muy-grande" ? s.text : base.text,
      contrast: typeof s.contrast === "boolean" ? s.contrast : base.contrast,
      motion: typeof s.motion === "boolean" ? s.motion : base.motion,
      sound: typeof s.sound === "boolean" ? s.sound : base.sound,
      volume:
        typeof s.volume === "number"
          ? Math.min(100, Math.max(0, Math.round(s.volume)))
          : base.volume,
      fps: typeof s.fps === "boolean" ? s.fps : base.fps,
      cpuLevel: s.cpuLevel === 0 || s.cpuLevel === 2 ? s.cpuLevel : 1,
      hand: s.hand === "left" ? "left" : "right",
      seated: typeof s.seated === "boolean" ? s.seated : base.seated,
      shortcuts:
        typeof s.shortcuts === "boolean" ? s.shortcuts : base.shortcuts,
    };
  } catch {
    return base;
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}

/** Refleja los ajustes visuales en atributos de <html>; el CSS hace el resto. */
export function applyVisual(s: Settings) {
  const root = document.documentElement;
  root.dataset.text = s.text;
  root.dataset.contrast = s.contrast ? "high" : "normal";
  root.dataset.motion = s.motion ? "reduce" : "full";
  root.dataset.fps = s.fps ? "on" : "off";
}

/** Escribe los ajustes en el formulario de Opciones. */
export function writeForm(form: HTMLFormElement, s: Settings) {
  const radio = (name: string, value: string) => {
    const el = form.querySelector<HTMLInputElement>(
      `input[type=radio][name="${name}"][value="${value}"]`,
    );
    if (el) el.checked = true;
  };
  const check = (name: string, value: boolean) => {
    const el = form.querySelector<HTMLInputElement>(
      `input[type=checkbox][name="${name}"]`,
    );
    if (el) el.checked = value;
  };
  radio("text", s.text);
  radio("cpuLevel", String(s.cpuLevel));
  radio("hand", s.hand);
  radio("posture", s.seated ? "seated" : "standing");
  check("contrast", s.contrast);
  check("motion", s.motion);
  check("sound", s.sound);
  check("fps", s.fps);
  check("shortcuts", s.shortcuts);
  const vol = form.querySelector<HTMLInputElement>("input[name=volume]");
  if (vol) vol.value = String(s.volume);
  const out = form.querySelector("#volume-out");
  if (out) out.textContent = s.volume + " %";
}

/** Lee el formulario de Opciones. Los campos que faltan conservan su valor. */
export function readForm(form: HTMLFormElement, from: Settings): Settings {
  const data = new FormData(form);
  const str = (name: string, fallback: string) =>
    (data.get(name) as string | null) ?? fallback;
  const level = Number(str("cpuLevel", String(from.cpuLevel)));
  return {
    text: (["normal", "grande", "muy-grande"] as const).includes(
      str("text", from.text) as Settings["text"],
    )
      ? (str("text", from.text) as Settings["text"])
      : "normal",
    contrast: data.has("contrast"),
    motion: data.has("motion"),
    sound: data.has("sound"),
    volume: Math.min(100, Math.max(0, Number(str("volume", String(from.volume))))),
    fps: data.has("fps"),
    cpuLevel: level === 0 || level === 2 ? level : 1,
    hand: str("hand", from.hand) === "left" ? "left" : "right",
    seated: str("posture", from.seated ? "seated" : "standing") === "seated",
    shortcuts: data.has("shortcuts"),
  };
}
