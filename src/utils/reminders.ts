export interface ParsedReminderItem {
  title: string;
  dueAt: number | null;
  notes?: string;
  checked?: boolean;
}

export function parseFlexibleDueDate(raw?: string | null): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || /^(sem\s*prazo|sem\s*data|nenhum|livre|-)$/i.test(trimmed)) {
    return null;
  }

  // ISO or YYYY-MM-DD HH:mm
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{1,2}):(\d{2}))?/);
  if (isoMatch) {
    const [, y, m, d, hh = '09', mm = '00'] = isoMatch;
    const dt = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), 0, 0);
    if (!Number.isNaN(dt.getTime())) return dt.getTime();
  }

  // DD/MM/YYYY [HH:mm] or DD/MM [HH:mm]
  const brDateMatch = trimmed.match(
    /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?:\s*(?:às|as|-|,)?\s*(\d{1,2})(?::(\d{2})|h(\d{2})?)?)?/i
  );
  if (brDateMatch) {
    const now = new Date();
    const day = Number(brDateMatch[1]);
    const month = Number(brDateMatch[2]) - 1;
    let year = brDateMatch[3] ? Number(brDateMatch[3]) : now.getFullYear();
    if (year < 100) year += 2000;
    const hour = brDateMatch[4] ? Number(brDateMatch[4]) : 9;
    const min = Number(brDateMatch[5] || brDateMatch[6] || 0);
    const dt = new Date(year, month, day, hour, min, 0, 0);
    if (!Number.isNaN(dt.getTime())) return dt.getTime();
  }

  // Natural PT-BR: "hoje às 19h30", "amanhã 08:00"
  const relMatch = trimmed.match(
    /\b(hoje|amanh[aã])\b(?:\s*(?:às|as|para|pra)?\s*(\d{1,2})(?::(\d{2})|h(\d{2})?)?)?/i
  );
  if (relMatch) {
    const base = new Date();
    if (/amanh/i.test(relMatch[1])) {
      base.setDate(base.getDate() + 1);
    }
    const hour = relMatch[2] ? Number(relMatch[2]) : 9;
    const min = Number(relMatch[3] || relMatch[4] || 0);
    base.setHours(hour, min, 0, 0);
    return base.getTime();
  }

  // Time only: "19:30" or "19h"
  const timeOnlyMatch = trimmed.match(/^(\d{1,2})(?::(\d{2})|h(\d{2})?)$/i);
  if (timeOnlyMatch) {
    const now = new Date();
    const hour = Number(timeOnlyMatch[1]);
    const min = Number(timeOnlyMatch[2] || timeOnlyMatch[3] || 0);
    if (hour >= 0 && hour <= 23 && min >= 0 && min <= 59) {
      const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, min, 0, 0);
      if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 1);
      }
      return target.getTime();
    }
  }

  const fallbackMs = Date.parse(trimmed);
  return Number.isNaN(fallbackMs) ? null : fallbackMs;
}

export function parseReminderBlockItems(blockContent: string): ParsedReminderItem[] {
  const lines = blockContent
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const items: ParsedReminderItem[] = [];

  for (const rawLine of lines) {
    const checkMatch = rawLine.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
    const checked = Boolean(checkMatch && checkMatch[1].toLowerCase() === 'x');
    const cleanLine = (checkMatch ? checkMatch[2] : rawLine.replace(/^([-*•]|\d+[.)])\s+/, '')).trim();
    if (!cleanLine) continue;

    const segments = cleanLine.split('|').map((s) => s.trim());
    const title = (segments[0] || '').slice(0, 200);
    if (!title) continue;

    let dueAt: number | null = null;
    let notes: string | undefined;

    if (segments.length >= 2) {
      const parsedDue = parseFlexibleDueDate(segments[1]);
      if (parsedDue !== null) {
        dueAt = parsedDue;
        const rawNote = segments.slice(2).join(' • ').trim();
        if (rawNote && !/^(-|nenhum|nenhuma|n\/a)$/i.test(rawNote)) {
          notes = rawNote.slice(0, 300);
        }
      } else {
        const rawNote = segments.slice(1).join(' • ').trim();
        if (rawNote && !/^(-|nenhum|nenhuma|n\/a)$/i.test(rawNote)) {
          notes = rawNote.slice(0, 300);
        }
      }
    }

    items.push({ title, dueAt, notes, checked });
  }

  return items;
}

export function formatReminderDue(dueAt?: number | null): string {
  if (!dueAt) return 'Sem horário';
  const target = new Date(dueAt);
  if (Number.isNaN(target.getTime())) return 'Sem horário';

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startTomorrow = startToday + 86_400_000;
  const startDayAfter = startTomorrow + 86_400_000;
  const timeStr = target.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  if (dueAt >= startToday && dueAt < startTomorrow) {
    return `Hoje às ${timeStr}`;
  }
  if (dueAt >= startTomorrow && dueAt < startDayAfter) {
    return `Amanhã às ${timeStr}`;
  }

  const dateStr = target.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `${dateStr} às ${timeStr}`;
}
