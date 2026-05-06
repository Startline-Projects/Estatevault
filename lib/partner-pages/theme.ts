// Partner whitelabel theming.
// Combines a curated preset (mood) with HSL-derived tints from the partner's accent
// so headers, hero, and section bands always harmonize with the brand color.

export type ThemePresetId = "warm" | "cool" | "mono" | "bold" | "earth";

export interface ThemePreset {
  id: ThemePresetId;
  label: string;
  description: string;
  // Hero strategy: how the hero band is painted.
  // "accent-dark"  → deep shade of accent (good for vivid brand colors)
  // "accent-light" → light wash of accent + dark text (airy, premium)
  // "neutral-dark" → near-black neutral (classic, accent stays as highlight)
  hero: "accent-dark" | "accent-light" | "neutral-dark";
  // Section band tint strength (0–1). Drives bg-50/100 alpha on alt sections.
  sectionTint: number;
  // Saturation multiplier applied to derived tints (keeps mono themes calm).
  saturation: number;
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: "warm",  label: "Warm",  description: "Cream + accent. Inviting, premium.",            hero: "accent-light", sectionTint: 0.06, saturation: 0.85 },
  { id: "cool",  label: "Cool",  description: "Deep brand hero, clean white sections.",         hero: "accent-dark",  sectionTint: 0.04, saturation: 1.00 },
  { id: "mono",  label: "Mono",  description: "Near-black hero, accent as highlight only.",     hero: "neutral-dark", sectionTint: 0.03, saturation: 0.55 },
  { id: "bold",  label: "Bold",  description: "Saturated accent hero, high contrast.",          hero: "accent-dark",  sectionTint: 0.08, saturation: 1.15 },
  { id: "earth", label: "Earth", description: "Soft accent wash, muted bands. Calm.",           hero: "accent-light", sectionTint: 0.05, saturation: 0.75 },
];

// ── Color math ───────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (x: number) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

function relLum([r, g, b]: [number, number, number]): number {
  const c = (x: number) => {
    x /= 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
}

export function contrastRatio(hexA: string, hexB: string): number {
  const la = relLum(hexToRgb(hexA));
  const lb = relLum(hexToRgb(hexB));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export function readableTextOn(bgHex: string): "#FFFFFF" | "#1C3557" {
  return contrastRatio(bgHex, "#FFFFFF") >= 4.5 ? "#FFFFFF" : "#1C3557";
}

// ── Palette derivation ───────────────────────────────────────────────────────

export type PaletteKey = "50" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900";
export type DerivedPalette = Record<PaletteKey, string>;

export function buildPalette(accentHex: string, satMul = 1): DerivedPalette {
  const [h, s] = rgbToHsl(...hexToRgb(accentHex));
  const sat = Math.max(0, Math.min(1, s * satMul));
  // Lightness ramp tuned for UI (50=lightest tint, 900=darkest shade).
  const ramp: Record<PaletteKey, number> = {
    "50": 0.97, "100": 0.93, "200": 0.86, "300": 0.74, "400": 0.62,
    "500": 0.50, "600": 0.42, "700": 0.34, "800": 0.24, "900": 0.16,
  };
  const out = {} as DerivedPalette;
  (Object.keys(ramp) as PaletteKey[]).forEach((k) => {
    // Slightly desaturate extremes so tints don't look neon and shades don't look muddy.
    const desat = k === "50" || k === "100" ? sat * 0.6 : k === "900" ? sat * 0.85 : sat;
    out[k] = hslToHex(h, desat, ramp[k]);
  });
  return out;
}

// ── Theme assembly ───────────────────────────────────────────────────────────

export interface PartnerTheme {
  presetId: ThemePresetId;
  accent: string;
  palette: DerivedPalette;
  // Resolved roles consumed by PartnerPageClient.
  heroBg: string;        // hero section background (solid or gradient stop)
  heroBgEnd: string;     // hero gradient end stop
  heroText: string;      // primary hero text color
  heroSubtext: string;   // secondary hero text (rgba string)
  sectionAlt: string;    // alt-band background for between-section variation
  surface: string;       // base page surface (usually white)
  ctaText: string;       // text color on accent CTA buttons
}

export function buildPartnerTheme(accentHex: string, presetId: ThemePresetId = "cool"): PartnerTheme {
  const preset = THEME_PRESETS.find((p) => p.id === presetId) ?? THEME_PRESETS[1];
  const palette = buildPalette(accentHex, preset.saturation);

  let heroBg: string, heroBgEnd: string, heroText: string;
  switch (preset.hero) {
    case "accent-dark":
      heroBg = palette["800"];
      heroBgEnd = palette["900"];
      heroText = contrastRatio(heroBg, "#FFFFFF") >= 4.5 ? "#FFFFFF" : "#1C3557";
      break;
    case "accent-light":
      heroBg = palette["50"];
      heroBgEnd = palette["100"];
      heroText = "#1C3557";
      break;
    case "neutral-dark":
    default:
      heroBg = "#0E1420";
      heroBgEnd = "#1C3557";
      heroText = "#FFFFFF";
      break;
  }

  return {
    presetId: preset.id,
    accent: accentHex,
    palette,
    heroBg,
    heroBgEnd,
    heroText,
    heroSubtext: heroText === "#FFFFFF" ? "rgba(255,255,255,0.72)" : "rgba(28,53,87,0.72)",
    sectionAlt: hslToHex(...((): [number, number, number] => {
      const [h, s] = rgbToHsl(...hexToRgb(accentHex));
      return [h, Math.min(s * preset.saturation, 1), 1 - preset.sectionTint];
    })()),
    surface: "#FFFFFF",
    ctaText: readableTextOn(accentHex),
  };
}

// ── Hero recipes (algorithmic backgrounds) ───────────────────────────────────
// Each recipe is a deterministic function of the accent. Output is consumed by
// PartnerPageClient and rendered as inline style on the hero <section>.

export type HeroRecipeId = "mesh" | "spotlight" | "geometric" | "twilight";

export interface HeroRecipe {
  id: HeroRecipeId;
  label: string;
  description: string;
  background: string;     // CSS background shorthand (gradients/url(svg))
  heroText: string;       // primary text color (already contrast-checked)
  heroHighlight: string;  // accent-tone text color, contrast ≥ 4.5 vs hero
  heroSubtext: string;    // rgba for body copy
  overlay?: string;       // optional darkening overlay layer
  ctaText: string;
}

// Pick a highlight color guaranteed to read on the hero base.
// Tries: pale tint (200), very pale (100), pure white, deep shade (800), navy.
function pickHighlight(palette: DerivedPalette, baseHex: string): string {
  const candidates = [palette["200"], palette["100"], "#FFFFFF", palette["800"], "#1C3557"];
  for (const c of candidates) if (contrastRatio(c, baseHex) >= 4.5) return c;
  return "#FFFFFF";
}

function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export interface ColorOverrides {
  highlightDark?: string | null;   // overrides hero/dark-section highlight color
  highlightLight?: string | null;  // overrides on-light icon/pill text color
  ctaText?: string | null;         // overrides CTA button text color
}

function _buildHeroRecipeBase(accentHex: string, id: HeroRecipeId): HeroRecipe {
  const palette = buildPalette(accentHex, 1);

  switch (id) {
    case "mesh": {
      // Multi-stop radial mesh on dark accent base.
      const base = palette["900"];
      const heroText = "#FFFFFF";
      return {
        id, label: "Mesh", description: "Soft, premium, multi-tone glow.",
        background: [
          `radial-gradient(at 18% 22%, ${rgba(palette["400"], 0.55)} 0%, transparent 45%)`,
          `radial-gradient(at 82% 28%, ${rgba(palette["600"], 0.45)} 0%, transparent 50%)`,
          `radial-gradient(at 50% 88%, ${rgba(palette["300"], 0.35)} 0%, transparent 55%)`,
          `radial-gradient(at 8% 92%, ${rgba("#000000", 0.35)} 0%, transparent 60%)`,
          `linear-gradient(180deg, ${base} 0%, ${palette["800"]} 100%)`,
        ].join(", "),
        heroText,
        heroHighlight: pickHighlight(palette, base),
        heroSubtext: "rgba(255,255,255,0.75)",
        overlay: "linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.38) 100%)",
        ctaText: readableTextOn(accentHex),
      };
    }
    case "spotlight": {
      // Cinematic single-beam spotlight from top, heavy vignette.
      const base = "#06080F";
      return {
        id, label: "Spotlight", description: "Cinematic, dramatic, single light source.",
        background: [
          `radial-gradient(ellipse 80% 60% at 50% 0%, ${rgba(palette["400"], 0.55)} 0%, transparent 55%)`,
          `radial-gradient(ellipse 60% 40% at 50% 0%, ${rgba(palette["200"], 0.35)} 0%, transparent 45%)`,
          `radial-gradient(ellipse 100% 80% at 50% 50%, transparent 30%, rgba(0,0,0,0.55) 80%)`,
          `linear-gradient(180deg, ${palette["900"]} 0%, ${base} 100%)`,
        ].join(", "),
        heroText: "#FFFFFF",
        heroHighlight: pickHighlight(palette, base),
        heroSubtext: "rgba(255,255,255,0.78)",
        overlay: "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.35) 100%)",
        ctaText: readableTextOn(accentHex),
      };
    }
    case "geometric": {
      // Inline SVG dot pattern over deep accent.
      const base = palette["900"];
      const dot = encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><circle cx='2' cy='2' r='1.2' fill='${palette["300"]}' fill-opacity='0.18'/></svg>`
      );
      return {
        id, label: "Geometric", description: "Architected, calm, structured.",
        background: [
          `url("data:image/svg+xml;utf8,${dot}")`,
          `radial-gradient(at 70% 20%, ${rgba(palette["500"], 0.35)} 0%, transparent 55%)`,
          `linear-gradient(180deg, ${base} 0%, #0B1220 100%)`,
        ].join(", "),
        heroText: "#FFFFFF",
        heroHighlight: pickHighlight(palette, base),
        heroSubtext: "rgba(255,255,255,0.72)",
        ctaText: readableTextOn(accentHex),
      };
    }
    case "twilight":
    default: {
      // Sky-at-dusk: deep top, accent horizon glow, dark earth bottom + scattered stars.
      const stars = encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320'>` +
          [
            [40, 60, 1.2, 0.7], [120, 30, 0.8, 0.5], [220, 80, 1, 0.6], [280, 40, 0.6, 0.4],
            [60, 180, 0.7, 0.45], [180, 140, 1.1, 0.65], [260, 200, 0.9, 0.55], [90, 260, 1.3, 0.7],
            [200, 280, 0.8, 0.5], [300, 240, 1, 0.6], [30, 120, 0.6, 0.4], [150, 220, 1, 0.55],
          ]
            .map(([x, y, r, o]) => `<circle cx='${x}' cy='${y}' r='${r}' fill='white' fill-opacity='${o}'/>`)
            .join("") +
          `</svg>`
      );
      const horizon = palette["600"];
      const base = "#070A14";
      return {
        id: "twilight", label: "Twilight", description: "Sky at dusk. Deep, contemplative, premium.",
        background: [
          `url("data:image/svg+xml;utf8,${stars}")`,
          `radial-gradient(ellipse 120% 50% at 50% 70%, ${rgba(horizon, 0.55)} 0%, transparent 60%)`,
          `radial-gradient(ellipse 90% 30% at 50% 75%, ${rgba(palette["300"], 0.35)} 0%, transparent 55%)`,
          `linear-gradient(180deg, ${base} 0%, #0E1428 35%, ${palette["800"]} 72%, #050811 100%)`,
        ].join(", "),
        heroText: "#FFFFFF",
        heroHighlight: pickHighlight(palette, base),
        heroSubtext: "rgba(255,255,255,0.78)",
        overlay: "linear-gradient(180deg, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.32) 100%)",
        ctaText: readableTextOn(accentHex),
      };
    }
  }
}

export function buildHeroRecipe(accentHex: string, id: HeroRecipeId, overrides: ColorOverrides = {}): HeroRecipe {
  const r = _buildHeroRecipeBase(accentHex, id);
  return {
    ...r,
    heroHighlight: overrides.highlightDark || r.heroHighlight,
    ctaText: overrides.ctaText || r.ctaText,
  };
}

export const HERO_RECIPES: HeroRecipeId[] = ["mesh", "spotlight", "geometric", "twilight"];

// CSS custom-property map. Spread into a style={} on the page root.
export function themeToCssVars(t: PartnerTheme): Record<string, string> {
  const v: Record<string, string> = {
    "--brand-accent": t.accent,
    "--brand-hero-from": t.heroBg,
    "--brand-hero-to": t.heroBgEnd,
    "--brand-hero-text": t.heroText,
    "--brand-hero-subtext": t.heroSubtext,
    "--brand-section-alt": t.sectionAlt,
    "--brand-surface": t.surface,
    "--brand-cta-text": t.ctaText,
  };
  (Object.keys(t.palette) as PaletteKey[]).forEach((k) => {
    v[`--brand-${k}`] = t.palette[k];
  });
  return v;
}
