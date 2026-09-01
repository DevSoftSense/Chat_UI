export const SIDEBAR_CUSTOM_COLORS_KEY = "sb_sidebar_custom_colors_v1";

export const DEFAULT_SIDEBAR_BG_COLOR = "#1d98dc";
export const DEFAULT_SIDEBAR_MENU_TEXT_COLOR = "#ffffff";
export const DEFAULT_SIDEBAR_MENU_MUTED_COLOR = "rgba(255, 255, 255, 0.82)";
export const DEFAULT_SIDEBAR_SUB_MENU_COLOR = "rgba(255, 255, 255, 0.68)";
export const DEFAULT_SIDEBAR_MENU_TITLE_COLOR = "rgba(255, 255, 255, 0.45)";

export const defaultSidebarCustomColors = {
  customColor: DEFAULT_SIDEBAR_BG_COLOR,
  menuColor: DEFAULT_SIDEBAR_MENU_TEXT_COLOR,
  menuMutedColor: DEFAULT_SIDEBAR_MENU_MUTED_COLOR,
  subMenuColor: DEFAULT_SIDEBAR_SUB_MENU_COLOR,
  menuTitleColor: DEFAULT_SIDEBAR_MENU_TITLE_COLOR,
};

export const SIDEBAR_BG = `var(--vz-vertical-menu-bg-custom, ${DEFAULT_SIDEBAR_BG_COLOR})`;

const hexToRgb = (hex) => {
  const normalized = hex.replace("#", "");
  const full = normalized.length === 3 ? normalized.split("").map((c) => c + c).join("") : normalized;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
};

const persistSidebarCustomColors = (colors) => {
  try {
    localStorage.setItem(SIDEBAR_CUSTOM_COLORS_KEY, JSON.stringify(colors));
  } catch {
    // ignore
  }
};

export const getSidebarCustomColors = () => {
  try {
    const saved = localStorage.getItem(SIDEBAR_CUSTOM_COLORS_KEY);
    if (saved) {
      return { ...defaultSidebarCustomColors, ...JSON.parse(saved) };
    }
  } catch {
    // keep defaults
  }
  return { ...defaultSidebarCustomColors };
};

export const applySidebarCustomColors = (colors = getSidebarCustomColors()) => {
  const resolved = { ...defaultSidebarCustomColors, ...colors };
  const { r, g, b } = hexToRgb(resolved.customColor);
  const root = document.documentElement;

  root.style.setProperty("--vz-vertical-menu-bg-custom", resolved.customColor);
  root.style.setProperty("--vz-vertical-menu-item-color-custom", resolved.menuColor);
  root.style.setProperty("--vz-vertical-menu-sub-item-color-custom", resolved.subMenuColor);
  root.style.setProperty("--vz-vertical-menu-item-muted-custom", resolved.menuMutedColor);
  root.style.setProperty("--vz-vertical-menu-title-color-custom", resolved.menuTitleColor);
  root.style.setProperty("--vz-vertical-menu-item-color", resolved.menuMutedColor);
  root.style.setProperty("--vz-vertical-menu-item-hover-color", resolved.menuColor);
  root.style.setProperty("--vz-vertical-menu-item-active-color", resolved.menuColor);
  root.style.setProperty("--vz-vertical-menu-sub-item-color", resolved.subMenuColor);
  root.style.setProperty("--vz-vertical-menu-sub-item-hover-color", resolved.menuColor);
  root.style.setProperty("--vz-vertical-menu-sub-item-active-color", resolved.menuColor);
  root.style.setProperty("--vz-vertical-menu-title-color", resolved.menuTitleColor);
  root.style.setProperty("--landing-accent", resolved.customColor);
  root.style.setProperty("--landing-accent-rgb", `${r}, ${g}, ${b}`);
  root.style.setProperty("--vz-primary", resolved.customColor);

  return resolved;
};

export const initSidebarBrandColors = () => {
  const colors = getSidebarCustomColors();
  applySidebarCustomColors(colors);
  document.documentElement.setAttribute("data-sidebar", "custom");
  try {
    if (!localStorage.getItem(SIDEBAR_CUSTOM_COLORS_KEY)) {
      persistSidebarCustomColors(colors);
    }
  } catch {
    // ignore
  }
  return colors;
};

export const applyLandingSidebarTheme = () => {
  document.documentElement.setAttribute("data-sidebar", "custom");
  return applySidebarCustomColors();
};

if (typeof document !== "undefined") {
  initSidebarBrandColors();
}
