export type EventType =
  | "onboarding_complete"
  | "draft_modified"
  | "plan_generated"
  | "task_clicked"
  | "task_completed"
  | "task_tier_selected"
  | "task_help_requested"
  | "emotion_checkin"
  | "plan_edited"
  | "session_returned";

export type ProfileEvent = {
  event_type: EventType;
  event_data: Record<string, unknown>;
  created_at: string;
};

const STORAGE_KEY = "qicheng_profile_events";

export function trackEvent(type: EventType, data?: Record<string, unknown>) {
  if (typeof window === "undefined") return;

  const event: ProfileEvent = {
    event_type: type,
    event_data: data || {},
    created_at: new Date().toISOString(),
  };

  const existing = getEvents();
  existing.push(event);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

export function getEvents(): ProfileEvent[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function getEventsByType(type: EventType): ProfileEvent[] {
  return getEvents().filter((e) => e.event_type === type);
}

export function getLastEvent(type: EventType): ProfileEvent | null {
  const events = getEventsByType(type);
  return events.length > 0 ? events[events.length - 1] : null;
}

export function getLastActiveTime(): string | null {
  const events = getEvents();
  if (events.length === 0) return null;
  return events[events.length - 1].created_at;
}

export function getDaysSinceLastActive(): number {
  const last = getLastActiveTime();
  if (!last) return 0;
  const diff = Date.now() - new Date(last).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
