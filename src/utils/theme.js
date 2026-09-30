// ── Tema (claro/escuro) ────────────────────────────────────────────
// Preferência por dispositivo (localStorage), aplicada via
// <html data-theme="..."> — as variáveis CSS em index.css fazem o resto.
// Default: escuro (o tema original da app).

const THEME_KEY = 'thrive-theme'

export function getStoredTheme() {
  try { return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark' }
  catch { return 'dark' }
}

export function setTheme(theme) {
  document.documentElement.dataset.theme = theme
  try { localStorage.setItem(THEME_KEY, theme) } catch {} // eslint-disable-line no-empty
  // Persiste também no thrive-config.json: o main process lê-o ao criar a
  // janela e pinta o backgroundColor certo — sem flash escuro no tema claro.
  try { window.api?.saveConfig?.({ theme }) } catch {} // eslint-disable-line no-empty
}

export function initTheme() {
  const t = getStoredTheme()
  document.documentElement.dataset.theme = t
  return t
}
