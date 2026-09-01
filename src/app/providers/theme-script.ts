export const THEME_STORAGE_KEY = "blogs:theme";

/**
 * Runs before first paint, inlined into <head>.
 *
 * Without this the server renders an unthemed document, the browser paints it
 * light, and React then swaps to dark on hydration — a white flash on every
 * hard refresh for anyone using the dark theme. On a black-and-white site that
 * flash is the whole page, so it reads as a bug rather than a nicety.
 *
 * It always writes an explicit `light` or `dark`, resolving `system` here
 * rather than in CSS, so the stylesheet needs one `[data-theme="dark"]` block
 * instead of that block plus a `prefers-color-scheme` copy that could drift.
 *
 * The default is `light`, not the OS preference: the platform is a white-ground
 * publication, and a visitor whose laptop happens to be in dark mode should
 * still land on it as designed. Dark stays one click away on the header switch,
 * and `system` still follows the OS for anyone who picks it.
 *
 * Wrapped in try/catch because `localStorage` throws outright in some
 * privacy modes — and a theme preference is never worth a blank page.
 */
export const themeScript = `
(function(){
  try {
    var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var theme = (stored === "light" || stored === "dark")
      ? stored
      : (stored === "system"
          ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
          : "light");
    var root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  } catch (e) {}
})();
`.trim();
