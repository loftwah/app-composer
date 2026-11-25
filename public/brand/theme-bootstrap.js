try {
  const root = document.documentElement;
  const theme = localStorage.getItem(root.dataset.themeKey ?? "composer-theme");
  if (theme === "light" || theme === "dark") {
    root.dataset.theme = theme;
    const color = document.querySelector("meta[name=theme-color]");
    if (color?.dataset[theme]) color.content = color.dataset[theme];
  }
} catch {}
