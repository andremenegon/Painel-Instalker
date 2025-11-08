const STORAGE_PREFIX = 'instalker_timer_v1';
const EASING_POWER = 0.45;
const INSTAGRAM_EASING_POWER = 0.35;
const FIRST_ACCEL_DELAY = 4000; // ms
const NEXT_ACCEL_DELAY = 1000; // ms

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

const SERVICE_DEFAULT_DURATIONS = {
  Instagram: 5 * DAY_MS,
  WhatsApp: 7 * DAY_MS,
  Facebook: 7 * DAY_MS,
  'Outras Redes': 6 * DAY_MS,
  Localização: 5 * MINUTE_MS,
  SMS: 3 * MINUTE_MS,
  Chamadas: 4 * MINUTE_MS,
  Câmera: 12 * HOUR_MS,
  'Detetive Particular': 14 * DAY_MS,
  Investigation: 5 * DAY_MS,
};

const SERVICE_MIN_PROGRESS = {
  Instagram: 0.01,
  WhatsApp: 0.01,
  Facebook: 0.01,
  'Outras Redes': 0.01,
  Localização: 0.003,
  SMS: 0.01,
  Chamadas: 0.01,
  Câmera: 0.01,
  'Detetive Particular': 0.01,
};

const FULL_COMPLETION_SERVICES = new Set(['Instagram', 'WhatsApp', 'Facebook']);

const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const noopRecord = {
  progress: 0,
  remainingMs: 0,
  completed: false,
};

function getRecordKey(service, id) {
  return `${STORAGE_PREFIX}:${service}:${id}`;
}

function loadRecord(service, id) {
  if (!isBrowser) return null;
  const key = getRecordKey(service, id);
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    window.localStorage.removeItem(key);
    return null;
  }
}

function saveRecord(record) {
  if (!isBrowser) return;
  const key = getRecordKey(record.service, record.id);
  window.localStorage.setItem(key, JSON.stringify(record));
}

function defaultDurationMs(service, investigation) {
  if (investigation && investigation.estimated_days && investigation.estimated_days > 0) {
    return investigation.estimated_days * DAY_MS;
  }
  return SERVICE_DEFAULT_DURATIONS[service] || 5 * DAY_MS;
}

function ensureTimer({ service, id, durationMs, startAt }) {
  if (!service || !id) return null;

  const existing = loadRecord(service, id);
  const now = Date.now();
  const resolvedDuration = durationMs && durationMs > 0 ? durationMs : SERVICE_DEFAULT_DURATIONS[service] || 5 * DAY_MS;
  const resolvedStart = startAt || now;

  if (!existing) {
    const record = {
      service,
      id,
      startAt: resolvedStart,
      durationMs: resolvedDuration,
      minProgress: SERVICE_MIN_PROGRESS[service] ?? 0.01,
      lastAccelerationAt: null,
      accelerationsCount: 0,
      createdAt: now,
      notifiedCompleted: false,
    };
    saveRecord(record);
    return record;
  }

  let changed = false;
  if (!existing.durationMs || existing.durationMs !== resolvedDuration) {
    existing.durationMs = resolvedDuration;
    changed = true;
  }
  if (!existing.startAt || (startAt && startAt < existing.startAt)) {
    existing.startAt = startAt;
    changed = true;
  }
  if (existing.minProgress && existing.minProgress > 1) {
    existing.minProgress = 1;
    changed = true;
  }
  if (changed) saveRecord(existing);
  return existing;
}

function powEase(value) {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return Math.pow(value, EASING_POWER);
}

function computeProgress(record) {
  if (!record) return noopRecord;
  const { startAt, durationMs, minProgress = 0 } = record;
  if (!durationMs || durationMs <= 0) {
    return { progress: 1, remainingMs: 0, completed: true };
  }

  const now = Date.now();
  const elapsed = Math.max(0, now - startAt);
  const baseRatio = Math.min(1, elapsed / durationMs);
  const easingPower = record.service === 'Instagram' ? INSTAGRAM_EASING_POWER : EASING_POWER;
  const eased = baseRatio <= 0
    ? 0
    : baseRatio >= 1
      ? 1
      : Math.pow(baseRatio, easingPower);
  let progress = Math.max(minProgress, eased);

  if (record.service !== 'Localização' && progress > minProgress && progress < 0.12) {
    const boostFactor = record.service === 'Instagram' ? 1.5 : 1.35;
    const delta = progress - minProgress;
    progress = Math.min(minProgress + delta * boostFactor, 0.12);
  }
  const remainingMs = Math.max(0, durationMs - elapsed);
  return {
    progress,
    remainingMs,
    completed: progress >= 1,
  };
}

function getProgressPercent({ service, id, durationMs, startAt }) {
  const record = ensureTimer({ service, id, durationMs, startAt });
  const { progress } = computeProgress(record);
  return Math.round(progress * 100);
}

function getProgressData({ service, id, durationMs, startAt }) {
  const record = ensureTimer({ service, id, durationMs, startAt });
  const data = computeProgress(record);
  return {
    ...data,
    progressPercent: Math.round(data.progress * 100),
  };
}

function applyAcceleration({ service, id, durationMs, boostPercent = 20 }) {
  const record = ensureTimer({ service, id, durationMs });
  if (!record) return 0;

  const { progress } = computeProgress(record);
  const boost = Math.max(0, Math.min(boostPercent, 100));
  const maxTarget = FULL_COMPLETION_SERVICES.has(service)
    ? 1
    : service === 'Detetive Particular'
      ? 0.99
      : 0.995;
  const target = Math.min(maxTarget, progress + boost / 100);
  record.minProgress = Math.max(record.minProgress || 0, target);
  record.lastAccelerationAt = Date.now();
  record.accelerationsCount = (record.accelerationsCount || 0) + 1;
  saveRecord(record);
  return Math.round(target * 100);
}

function shouldShowAccelerateButton({ service, id }) {
  const record = loadRecord(service, id);
  if (!record) return false;
  const { progress } = computeProgress(record);
  if (progress >= 0.99) return false;

  const now = Date.now();
  if (!record.lastAccelerationAt) {
    return now - record.startAt >= FIRST_ACCEL_DELAY;
  }
  return now - record.lastAccelerationAt >= NEXT_ACCEL_DELAY;
}

function markCompleted({ service, id }) {
  const record = loadRecord(service, id);
  if (!record) return;
  record.minProgress = 1;
  record.completedAt = Date.now();
  saveRecord(record);
}

function markCompletionNotified({ service, id }) {
  const record = loadRecord(service, id);
  if (!record) return;
  record.notifiedCompleted = true;
  saveRecord(record);
}

function hasCompletionBeenNotified({ service, id }) {
  const record = loadRecord(service, id);
  if (!record) return false;
  return !!record.notifiedCompleted;
}

function resetTimer({ service, id }) {
  if (!isBrowser) return;
  const key = getRecordKey(service, id);
  window.localStorage.removeItem(key);
}

function getDurationForInvestigation(investigation) {
  if (!investigation) return 5 * DAY_MS;
  const duration = defaultDurationMs(investigation.service_name || investigation.service || 'Investigation', investigation);
  return duration;
}

export {
  ensureTimer,
  getProgressPercent,
  getProgressData,
  applyAcceleration,
  shouldShowAccelerateButton,
  markCompleted,
  markCompletionNotified,
  hasCompletionBeenNotified,
  resetTimer,
  getDurationForInvestigation,
  SERVICE_DEFAULT_DURATIONS,
  DAY_MS,
  HOUR_MS,
  MINUTE_MS,
  FIRST_ACCEL_DELAY,
  NEXT_ACCEL_DELAY,
};
