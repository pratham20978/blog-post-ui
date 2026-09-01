/**
 * The Canerly logo.
 *
 * Inlined rather than loaded from `/brand/*.svg` as an <img>, for one reason
 * that matters on a black-and-white site: `fill="currentColor"` lets the mark
 * follow the theme, so it is black on the light ground and white on the dark
 * one without shipping two files or a filter hack. `brand/README.md` names this
 * as the supported way to recolour it.
 *
 * The paths are copied verbatim from `brand/canerly-lockup-horizontal.svg` and
 * `brand/canerly-symbol.svg`; the same files live in `public/brand/` for
 * anything outside React that needs them. Do not redraw or re-space them — the
 * symbol-to-wordmark gap is part of the lockup.
 */

/** The bird, one closed silhouette with the eye knocked out. */
const SYMBOL_PATH =
  "M114 48L95 37C94 26 86 16 74 15C75 8 69 2 61 4C65 9 65 14 61 18C50 22 42 30 38 40C34 49 32 56 33 64C34 72 35 79 38 83C30 88 17 97 5 107L18 105C32 99 45 93 53 87C62 92 74 93 84 88C98 81 106 68 104 56C103 51 99 49 95 51ZM89 35a5.6 5.6 0 1 1-11.2 0a5.6 5.6 0 1 1 11.2 0Z";

/** "Canerly" in Manrope 800, outlined, with the swept `y` descender. */
const WORDMARK_PATH =
  "M48.47 102.08Q33.47 102.08 22.60 95.56Q11.73 89.03 5.86 77.29Q-0.00 65.56 -0.00 50.00Q-0.00 34.44 5.86 22.71Q11.73 10.97 22.60 4.44Q33.47 -2.08 48.47 -2.08Q65.69 -2.08 77.39 6.46Q89.09 15.00 93.89 29.58L74.86 34.86Q72.08 25.76 65.48 20.73Q58.89 15.69 48.47 15.69Q38.95 15.69 32.60 19.93Q26.25 24.17 23.05 31.87Q19.86 39.58 19.86 50.00Q19.86 60.42 23.05 68.12Q26.25 75.83 32.60 80.07Q38.95 84.31 48.47 84.31Q58.89 84.31 65.48 79.24Q72.08 74.17 74.86 65.14L93.89 70.42Q89.09 85.00 77.39 93.54Q65.69 102.08 48.47 102.08ZM125.14 102.08Q117.08 102.08 111.49 98.99Q105.90 95.90 103.02 90.73Q100.14 85.56 100.14 79.31Q100.14 74.10 101.73 69.79Q103.33 65.49 106.91 62.19Q110.48 58.89 116.52 56.67Q120.69 55.14 126.46 53.96Q132.22 52.78 139.51 51.70Q146.80 50.62 155.55 49.31L148.75 53.06Q148.75 46.39 145.55 43.26Q142.36 40.14 134.86 40.14Q130.69 40.14 126.18 42.15Q121.66 44.17 119.86 49.31L102.77 43.89Q105.62 34.58 113.47 28.75Q121.32 22.92 134.86 22.92Q144.79 22.92 152.50 25.97Q160.20 29.03 164.16 36.53Q166.39 40.69 166.80 44.86Q167.22 49.03 167.22 54.17V100.00H150.69V84.58L153.05 87.78Q147.57 95.35 141.21 98.72Q134.86 102.08 125.14 102.08ZM129.16 87.22Q134.37 87.22 137.95 85.38Q141.52 83.54 143.64 81.18Q145.76 78.82 146.52 77.22Q147.98 74.17 148.23 70.10Q148.47 66.04 148.47 63.33L154.02 64.72Q145.62 66.11 140.41 67.05Q135.20 67.99 132.01 68.75Q128.82 69.51 126.39 70.42Q123.61 71.53 121.91 72.81Q120.20 74.10 119.41 75.62Q118.61 77.15 118.61 79.03Q118.61 81.60 119.89 83.44Q121.18 85.28 123.54 86.25Q125.90 87.22 129.16 87.22ZM231.52 100.00V64.58Q231.52 62.01 231.25 58.02Q230.97 54.03 229.51 50.00Q228.05 45.97 224.75 43.26Q221.46 40.56 215.41 40.56Q212.98 40.56 210.21 41.32Q207.43 42.08 205.00 44.27Q202.57 46.46 201.00 50.69Q199.44 54.93 199.44 61.94L188.61 56.81Q188.61 47.92 192.22 40.14Q195.83 32.36 203.09 27.57Q210.34 22.78 221.39 22.78Q230.21 22.78 235.76 25.76Q241.32 28.75 244.41 33.33Q247.50 37.92 248.82 42.88Q250.14 47.85 250.41 51.94Q250.69 56.04 250.69 57.92V100.00ZM180.27 100.00V25.00H197.08V49.86H199.44V100.00ZM298.75 102.08Q287.22 102.08 278.43 97.12Q269.65 92.15 264.68 83.44Q259.72 74.72 259.72 63.47Q259.72 51.18 264.58 42.08Q269.44 32.99 277.98 27.95Q286.52 22.92 297.64 22.92Q309.44 22.92 317.71 28.47Q325.97 34.03 329.93 44.10Q333.89 54.17 332.71 67.78H314.02V60.83Q314.02 49.38 310.38 44.34Q306.73 39.31 298.47 39.31Q288.82 39.31 284.27 45.17Q279.72 51.04 279.72 62.50Q279.72 72.99 284.27 78.72Q288.82 84.44 297.64 84.44Q303.19 84.44 307.15 82.01Q311.11 79.58 313.19 75.00L332.08 80.42Q327.84 90.69 318.71 96.39Q309.58 102.08 298.75 102.08ZM273.89 67.78V53.75H323.61V67.78ZM343.47 100.00V25.00H360.14V43.33L358.33 40.97Q359.79 37.08 362.22 33.89Q364.65 30.69 368.19 28.61Q370.90 26.94 374.09 26.01Q377.29 25.07 380.69 24.83Q384.09 24.58 387.50 25.00V42.64Q384.37 41.67 380.24 41.98Q376.11 42.29 372.77 43.89Q369.44 45.42 367.15 47.95Q364.86 50.49 363.68 53.92Q362.50 57.36 362.50 61.67V100.00ZM397.22 100.00V-2.08H416.11V100.00ZM441.67 133.33L456.11 93.61L456.39 105.28L423.75 25.00H443.33L465.28 81.81H460.83L482.64 25.00H501.53L463.86 121.50C458.36 132.00 447.36 139.00 430.36 141.00C438.36 136.00 442.36 130.00 444.16 124.60Z";

/**
 * Primary logo — symbol plus wordmark. Set the size with a height class
 * (`h-7`); the width follows from the aspect ratio.
 */
export function Logo({ className, title = "Canerly" }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 700.40 163.50"
      fill="currentColor"
      role="img"
      aria-label={title}
      className={className}
    >
      <path
        fillRule="evenodd"
        transform="translate(-7.012 -5.063) scale(1.40246)"
        d={SYMBOL_PATH}
      />
      <path transform="translate(198.868 22.500)" d={WORDMARK_PATH} />
    </svg>
  );
}

/** The bird alone, for avatars and tight spaces. Below 16px tall the tail
 *  thins out — use the app icon there instead. */
export function LogoSymbol({ className, title = "Canerly" }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 109.00 103.39"
      fill="currentColor"
      role="img"
      aria-label={title}
      className={className}
    >
      <path fillRule="evenodd" transform="translate(-5 -3.61)" d={SYMBOL_PATH} />
    </svg>
  );
}
