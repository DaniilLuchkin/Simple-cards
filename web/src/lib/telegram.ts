type TelegramWebApp = {
  initData: string;
  colorScheme?: "light" | "dark";
  ready: () => void;
  expand: () => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  disableVerticalSwipes?: () => void;
  openTelegramLink?: (url: string) => void;
  HapticFeedback?: {
    impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
    notificationOccurred: (type: "error" | "success" | "warning") => void;
  };
};

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}

export function getTelegramWebApp(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null;
}

export function initTelegram() {
  const webApp = getTelegramWebApp();
  if (!webApp) return;
  webApp.ready();
  webApp.expand();
  // Default to the light lavender canvas; the theme effect in prefs
  // corrects this to charcoal immediately if dark mode is active.
  webApp.setBackgroundColor("#eae3f7");
  webApp.setHeaderColor("#eae3f7");
  // Only the drag handle at the very top should minimize the app; swiping
  // content (cards, lists) must not close it.
  webApp.disableVerticalSwipes?.();
}

export function getInitData(): string {
  return getTelegramWebApp()?.initData ?? "";
}

export function haptic(style: "light" | "medium" | "heavy" = "light") {
  getTelegramWebApp()?.HapticFeedback?.impactOccurred(style);
}

// Opens Telegram's "share to a chat" sheet for the given link + text. Uses the
// in-app openTelegramLink when available (stays inside Telegram), else a tab.
export function shareToTelegram(url: string, text: string) {
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  const webApp = getTelegramWebApp();
  if (webApp?.openTelegramLink) webApp.openTelegramLink(shareUrl);
  else window.open(shareUrl, "_blank");
}
