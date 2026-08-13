import { prisma } from "./db.js";

// A weekly leaderboard over the user's referral circle - the friends they
// invited, whoever invited them, and themselves. No extra tables: it sums the
// existing ReviewDay counts for the current week.

export type LeagueEntry = {
  name: string;
  count: number;
  isMe: boolean;
};

// Monday-anchored start of the current week, as a UTC-midnight Date matching
// ReviewDay.day. Uses the user's timezone so the week flips at their midnight.
function startOfWeek(tz: string | null, date = new Date()): Date {
  let y: number;
  let m: number;
  let d: number;
  try {
    const s = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz ?? "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
    [y, m, d] = s.split("-").map(Number);
  } catch {
    y = date.getUTCFullYear();
    m = date.getUTCMonth() + 1;
    d = date.getUTCDate();
  }
  const today = new Date(Date.UTC(y, m - 1, d));
  // getUTCDay: 0=Sun..6=Sat; shift so Monday is the first day.
  const offset = (today.getUTCDay() + 6) % 7;
  today.setUTCDate(today.getUTCDate() - offset);
  return today;
}

function displayName(user: { firstName: string | null; username: string | null }): string {
  return user.firstName || (user.username ? `@${user.username}` : "Друг");
}

export async function getLeague(userId: string): Promise<LeagueEntry[]> {
  const me = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, firstName: true, username: true, timezone: true, referredById: true },
  });

  const circle = await prisma.user.findMany({
    where: {
      OR: [
        { id: userId },
        { referredById: userId },
        ...(me.referredById ? [{ id: me.referredById }, { referredById: me.referredById }] : []),
      ],
    },
    select: { id: true, firstName: true, username: true },
  });

  const since = startOfWeek(me.timezone);
  const grouped = await prisma.reviewDay.groupBy({
    by: ["userId"],
    where: { userId: { in: circle.map((u) => u.id) }, day: { gte: since } },
    _sum: { count: true },
  });
  const counts = new Map(grouped.map((g) => [g.userId, g._sum.count ?? 0]));

  return circle
    .map((u) => ({
      name: u.id === userId ? displayName(me) : displayName(u),
      count: counts.get(u.id) ?? 0,
      isMe: u.id === userId,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
