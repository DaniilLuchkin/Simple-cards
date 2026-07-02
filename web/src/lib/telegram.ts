type TelegramWebApp = {
  initData: string;
  colorScheme?: "light" | "dark";
  ready: () => void;
  expand: () => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
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
  webApp.setBackgroundColor("#ffffff");
  webApp.setHeaderColor("#ffffff");
}

export function getInitData(): string {
  return getTelegramWebApp()?.initData ?? "";
}

export function haptic(style: "light" | "medium" | "heavy" = "light") {
  getTelegramWebApp()?.HapticFeedback?.impactOccurred(style);
}
