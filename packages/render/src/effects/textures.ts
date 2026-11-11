import { CanvasTexture, SRGBColorSpace, Texture } from "three";

export type SplatKind = "hit" | "max" | "miss" | "heal";
/** Active overhead prayer icon kinds (from the snapshot's `player.overhead`). */
export type OverheadKind = "melee" | "ranged" | "magic" | "redemption";

/** Textures drawn at runtime. Injectable so logic can be tested without a canvas. */
export interface TextureFactory {
  splat(amount: number, kind: SplatKind): Texture;
  /** Soft radial glow for projectiles and flames. */
  glow(color: string): Texture;
  /** A line of overhead text; the texture is 8 x 1 in aspect. */
  text(text: string, color: string): Texture;
  /** Badge floating above an entity with an overhead prayer active. */
  overhead(kind: OverheadKind): Texture;
}

/** Plain textures with no image, for tests and environments without a canvas. */
export const blankTextureFactory: TextureFactory = {
  splat: () => new Texture(),
  glow: () => new Texture(),
  overhead: () => new Texture(),
  text: () => new Texture(),
};

const OVERHEAD_STYLE: Record<OverheadKind, { fill: string; glyph: string }> = {
  melee: { fill: "#7a2a22", glyph: "#f4d9a0" },
  ranged: { fill: "#2f5a2a", glyph: "#e2f0c0" },
  magic: { fill: "#283f78", glyph: "#cfe0ff" },
  redemption: { fill: "#6b5a1e", glyph: "#fff1b8" },
};

/**
 * Original overhead badge: a pointed hexagonal plate with a simple glyph
 * (a blade, an arrow, a four-point star or a cross). Not based on game art.
 */
function drawOverhead(ctx: CanvasRenderingContext2D, size: number, kind: OverheadKind): void {
  const c = size / 2;
  const style = OVERHEAD_STYLE[kind];
  ctx.clearRect(0, 0, size, size);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(c + Math.cos(a) * size * 0.44, c + Math.sin(a) * size * 0.44);
  }
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, "#ffffff40");
  grad.addColorStop(0.5, style.fill);
  grad.addColorStop(1, style.fill);
  ctx.fillStyle = style.fill;
  ctx.fill();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = size * 0.05;
  ctx.strokeStyle = "#0b0b0b";
  ctx.stroke();

  ctx.strokeStyle = style.glyph;
  ctx.fillStyle = style.glyph;
  ctx.lineWidth = size * 0.07;
  ctx.lineCap = "round";
  const u = size / 100;
  ctx.beginPath();
  if (kind === "melee") {
    ctx.moveTo(50 * u, 22 * u); ctx.lineTo(50 * u, 66 * u); // blade
    ctx.moveTo(36 * u, 62 * u); ctx.lineTo(64 * u, 62 * u); // guard
    ctx.moveTo(50 * u, 66 * u); ctx.lineTo(50 * u, 78 * u); // grip
    ctx.stroke();
  } else if (kind === "ranged") {
    ctx.moveTo(30 * u, 72 * u); ctx.lineTo(68 * u, 34 * u);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(74 * u, 26 * u); ctx.lineTo(56 * u, 32 * u); ctx.lineTo(68 * u, 44 * u);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "magic") {
    for (let i = 0; i < 8; i++) {
      const r = (i % 2 === 0 ? 28 : 9) * u;
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.moveTo(50 * u, 28 * u); ctx.lineTo(50 * u, 72 * u);
    ctx.moveTo(30 * u, 48 * u); ctx.lineTo(70 * u, 48 * u);
    ctx.stroke();
  }
}

const SPLAT_STYLE: Record<SplatKind, { fill: string; edge: string; light: string }> = {
  hit: { fill: "#b0170f", edge: "#3d0503", light: "#e0402e" },
  max: { fill: "#c21a10", edge: "#f0b020", light: "#ff6a3a" },
  miss: { fill: "#1d4fa8", edge: "#081a3d", light: "#4f86e0" },
  heal: { fill: "#2f9a2a", edge: "#0a3008", light: "#6ad85a" },
};

/** Font used for numbers drawn on textures; the app loads it, with a bold sans fallback. */
export const GAME_FONT = '"Pixelify Sans", "Trebuchet MS", system-ui, sans-serif';

/**
 * Original hitsplat design: an irregular blob (a core plus seven lobes) in
 * red for damage, blue for zero, red with a gold rim for a max hit, and a
 * white number with a black outline.
 */
function drawSplat(ctx: CanvasRenderingContext2D, size: number, amount: number, kind: SplatKind): void {
  const c = size / 2;
  const style = SPLAT_STYLE[kind];
  ctx.clearRect(0, 0, size, size);
  const blob = (r: number) => {
    ctx.beginPath();
    ctx.arc(c, c, r * 0.8, 0, Math.PI * 2);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.3;
      const rr = r * (0.32 + ((i * 37) % 5) * 0.03);
      ctx.moveTo(c + Math.cos(a) * r * 0.62 + rr, c + Math.sin(a) * r * 0.62);
      ctx.arc(c + Math.cos(a) * r * 0.62, c + Math.sin(a) * r * 0.62, rr, 0, Math.PI * 2);
    }
  };
  ctx.fillStyle = style.edge;
  blob(size * 0.44);
  ctx.fill();
  const grad = ctx.createRadialGradient(c - size * 0.08, c - size * 0.1, size * 0.02, c, c, size * 0.4);
  grad.addColorStop(0, style.light);
  grad.addColorStop(1, style.fill);
  ctx.fillStyle = grad;
  blob(size * 0.39);
  ctx.fill();

  ctx.font = `bold ${Math.round(size * (amount >= 100 ? 0.34 : 0.42))}px ${GAME_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = size * 0.08;
  ctx.strokeStyle = "#000000";
  ctx.strokeText(String(amount), c, c + size * 0.03);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(String(amount), c, c + size * 0.03);
}

/** Overhead chat text: yellow with a black drop shadow, the genre convention for things characters say. */
function drawText(ctx: CanvasRenderingContext2D, width: number, height: number, text: string, color: string): void {
  ctx.clearRect(0, 0, width, height);
  ctx.font = `bold ${Math.round(height * 0.62)}px ${GAME_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#000000";
  ctx.fillText(text, width / 2 + 3, height / 2 + 3);
  ctx.fillStyle = color;
  ctx.fillText(text, width / 2, height / 2);
}

export function createCanvasTextureFactory(doc: Document = document): TextureFactory {
  const cache = new Map<string, Texture>();
  const make = (key: string, size: number, draw: (ctx: CanvasRenderingContext2D) => void): Texture => {
    const hit = cache.get(key);
    if (hit) return hit;
    const canvas = doc.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return new Texture();
    draw(ctx);
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    cache.set(key, tex);
    return tex;
  };
  return {
    splat: (amount, kind) => make(`splat:${kind}:${amount}`, 128, (ctx) => drawSplat(ctx, 128, amount, kind)),
    text: (text, color) => {
      const key = `text:${color}:${text}`;
      const hit = cache.get(key);
      if (hit) return hit;
      const canvas = doc.createElement("canvas");
      canvas.width = 1024;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");
      if (!ctx) return new Texture();
      drawText(ctx, 1024, 128, text, color);
      const tex = new CanvasTexture(canvas);
      tex.colorSpace = SRGBColorSpace;
      cache.set(key, tex);
      return tex;
    },
    overhead: (kind) => make(`overhead:${kind}`, 96, (ctx) => drawOverhead(ctx, 96, kind)),
    glow: (color) =>
      make(`glow:${color}`, 64, (ctx) => {
        const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, color);
        g.addColorStop(0.35, `${color}aa`);
        g.addColorStop(1, `${color}00`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 64, 64);
      }),
  };
}
