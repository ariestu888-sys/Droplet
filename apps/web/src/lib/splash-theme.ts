import type { CSSProperties } from "react";

// Turns an organization's chosen splash colors into CSS variables for its
// splash pages. Tailwind's brand utilities (bg-droplet, bg-coral, …) read
// these variables, so setting them on a wrapper re-colors everything inside.
// Text colors are derived so they stay readable whatever color is chosen.

type Rgb = [number, number, number];

const toRgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
const toHex = (rgb: Rgb) => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;

// Blend `hex` toward `toward` by `amount` (0–1).
const mix = (hex: string, toward: Rgb, amount: number) =>
  toHex(toRgb(hex).map((c, i) => c + (toward[i]! - c) * amount) as Rgb);

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];
const INK = "#1c2430";

// WCAG relative luminance and contrast ratio.
function luminance(hex: string) {
  const [r, g, b] = toRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

// Darkens a color until it's readable as text on white (4.5:1).
export function readableOnWhite(hex: string) {
  let color = hex;
  for (let step = 0; step < 20 && contrast(color, "#ffffff") < 4.5; step++) color = mix(color, BLACK, 0.1);
  return color;
}

// White or dark text, whichever reads better on the color.
export const textOn = (hex: string) => (contrast(hex, "#ffffff") >= contrast(hex, INK) ? "#ffffff" : INK);

export type SplashColors = { primaryColor: string | null; secondaryColor: string | null };

export function splashThemeStyle({ primaryColor, secondaryColor }: SplashColors): CSSProperties {
  const vars: Record<string, string> = {};
  if (primaryColor) {
    Object.assign(vars, {
      "--color-droplet": primaryColor,
      "--color-droplet-tint": mix(primaryColor, WHITE, 0.9),
      "--color-droplet-tint-border": mix(primaryColor, WHITE, 0.75),
      "--color-sky": mix(primaryColor, WHITE, 0.93),
      "--color-hover": mix(primaryColor, WHITE, 0.94),
      "--splash-link": readableOnWhite(primaryColor),
      "--splash-on-primary": textOn(primaryColor),
    });
  }
  if (secondaryColor) {
    Object.assign(vars, {
      "--color-coral": secondaryColor,
      "--color-coral-tint": mix(secondaryColor, WHITE, 0.88),
      "--color-spark": secondaryColor,
    });
  }
  return vars as CSSProperties;
}
