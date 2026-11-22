import { api } from "@/backend/api";
import { useQuery } from "@/backend/client";
import { useEffect } from "react";

const FONT_STACKS = {
  vazirmatn: '"Vazirmatn", "Segoe UI", Tahoma, system-ui, sans-serif',
  tahoma: "Tahoma, Arial, sans-serif",
  system: "system-ui, -apple-system, Segoe UI, sans-serif",
} as const;

/**
 * Applies only the published CMS theme. Drafts are previewed inside the owner
 * console and never leak into the public stylesheet.
 */
export function SiteThemeSync() {
  const site = useQuery(api.siteCms.publicSite, {});
  const publishedTheme = site?.theme;
  // Migrate only the original palette; preserve intentionally customized CMS themes.
  const theme = publishedTheme?.primaryColor === "#4f5fa8" && publishedTheme?.backgroundColor === "#eef2f9"
    ? { ...publishedTheme, primaryColor: "#087e8b", secondaryColor: "#dceef0", backgroundColor: "#f2f7f9", darkBackgroundColor: "#0b1822", buttonColor: "#087e8b" }
    : publishedTheme;

  useEffect(() => {
    if (!theme) return;
    const root = document.documentElement;
    const styleId = "cafenet-published-theme";
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = `
      :root {
        --primary: ${theme.primaryColor};
        --secondary: ${theme.secondaryColor};
        --background: ${theme.backgroundColor};
        --accent: ${theme.secondaryColor};
        --ring: ${theme.primaryColor};
        --clay-primary-a: ${theme.buttonColor};
        --clay-primary-b: color-mix(in oklab, ${theme.buttonColor} 82%, #000000);
        --clay-primary-fg: ${theme.buttonTextColor};
        --radius: ${theme.cardRadius}px;
        --font-sans: ${FONT_STACKS[theme.fontFamily]};
        --font-display: ${FONT_STACKS[theme.fontFamily]};
        --site-text-scale: ${theme.textScale / 100};
      }
      .dark {
        --background: ${theme.darkBackgroundColor};
        --primary: #55dbe5;
        --ring: #55dbe5;
        --secondary: color-mix(in oklab, ${theme.darkBackgroundColor} 78%, #ffffff);
        --accent: color-mix(in oklab, ${theme.secondaryColor} 32%, ${theme.darkBackgroundColor});
      }
      html { font-size: calc(16px * var(--site-text-scale)); }
      body[data-site-card-style="flat"] .clay,
      body[data-site-card-style="flat"] .clay-sm {
        background-image: none;
        background-color: var(--card);
        box-shadow: none;
        border: 1px solid var(--border);
      }
      body[data-site-card-style="outline"] .clay,
      body[data-site-card-style="outline"] .clay-sm {
        background-image: none;
        background-color: transparent;
        box-shadow: none;
        border: 1px solid var(--border);
      }
      body[data-site-icon-style="circle"] :is(.tile-navy,.tile-mint,.tile-peach,.tile-lilac) {
        border-radius: 9999px !important;
      }
      body[data-site-icon-style="square"] :is(.tile-navy,.tile-mint,.tile-peach,.tile-lilac) {
        border-radius: 6px !important;
      }
      body.has-site-background::before {
        content: "";
        position: fixed;
        inset: 0;
        z-index: -1;
        pointer-events: none;
        background-image: var(--site-bg-image);
        background-size: cover;
        background-position: center;
        opacity: 0.18;
      }
    `;
    root.style.setProperty("--site-text-scale", String(theme.textScale / 100));
    document.body.dataset.siteCardStyle = theme.cardStyle;
    document.body.dataset.siteIconStyle = theme.iconStyle;
    if (
      theme.backgroundImageUrl &&
      /^https?:\/\//i.test(theme.backgroundImageUrl)
    ) {
      document.body.style.setProperty(
        "--site-bg-image",
        `url("${theme.backgroundImageUrl.replace(/"/g, "%22")}")`,
      );
      document.body.classList.add("has-site-background");
    } else {
      document.body.classList.remove("has-site-background");
      document.body.style.removeProperty("--site-bg-image");
    }
    if (!theme.darkModeEnabled) {
      root.classList.remove("dark");
      const stored = window.localStorage.getItem("cafenet-theme");
      if (stored === "dark") window.localStorage.setItem("cafenet-theme", "light");
    }
  }, [theme]);

  return null;
}
