// The bot's @username, fetched once at startup (getMe). Used to build referral
// deep links (https://t.me/<username>?start=ref_<userId>). null until fetched
// or when getMe fails (e.g. no network in local dev).
let botUsername: string | null = null;

export function setBotUsername(username: string | null) {
  botUsername = username;
}

export function getBotUsername(): string | null {
  return botUsername;
}

// The referral deep link for a user, or null when the bot username is unknown.
export function referralLink(userId: string): string | null {
  if (!botUsername) return null;
  return `https://t.me/${botUsername}?start=ref_${userId}`;
}
