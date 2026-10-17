// Presentation tokens for a published stack. Preview and public output read the
// same values, so a theme choice cannot look one way in the editor and another
// way once published.
export const STACK_THEMES = {
  daylight: { background: '#faf9f7', foreground: '#22252b', muted: '#5c616b', border: 'rgba(34,37,43,.16)', surface: '#ffffff', accent: '#b8451c' },
  midnight: { background: '#17181b', foreground: '#f2f3f5', muted: '#a7abb3', border: 'rgba(242,243,245,.18)', surface: '#1f2126', accent: '#ff9b55' },
};
export function themeTokens(theme) {
  return STACK_THEMES[theme] ?? STACK_THEMES.midnight;
}
