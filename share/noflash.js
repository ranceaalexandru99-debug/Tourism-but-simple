// No-flash theme + set <html lang> from the saved language, applied before the
// React bundle mounts so there's no light->dark flicker on load.
// Kept as an external file (not inline) so the page can ship a strict
// Content-Security-Policy with script-src 'self' (no 'unsafe-inline').
try {
  var m = localStorage.getItem("vai_theme_mode") || "light";
  if (m === "dark") {
    document.body.style.background = "#060e1c";
    var mc = document.querySelector('meta[name="theme-color"]');
    if (mc) mc.setAttribute("content", "#0A1628");
  }
  var lang = localStorage.getItem("vai_lang");
  if (lang) document.documentElement.lang = lang;
} catch (e) {}
