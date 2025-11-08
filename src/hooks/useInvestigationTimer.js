import { useEffect, useMemo, useRef, useState } from "react";
import {
  ensureTimer,
  getProgressData,
  applyAcceleration,
  shouldShowAccelerateButton,
  getDurationForInvestigation,
  FIRST_ACCEL_DELAY,
  NEXT_ACCEL_DELAY,
} from "@/lib/progressManager";

export function useInvestigationTimer({ service, investigation }) {
  const [progress, setProgress] = useState(0);
  const [remainingMs, setRemainingMs] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [canAccelerate, setCanAccelerate] = useState(false);

  const serviceName = service || investigation?.service_name;
  const investigationId = investigation?.id;
  const durationMs = useMemo(() => {
    if (!investigationId) return null;
    return getDurationForInvestigation({ service_name: serviceName, ...investigation });
  }, [serviceName, investigationId, investigation?.estimated_days]);

  const createdDateRef = useRef(null);
  useEffect(() => {
    if (!investigation) return;
    if (!createdDateRef.current && investigation.created_date) {
      createdDateRef.current = new Date(investigation.created_date).getTime();
    }
  }, [investigation]);

  useEffect(() => {
    if (!serviceName || !investigationId || !durationMs) return;

    ensureTimer({
      service: serviceName,
      id: investigationId,
      durationMs,
      startAt: createdDateRef.current || (investigation?.created_date ? new Date(investigation.created_date).getTime() : Date.now()),
    });

    const update = () => {
      const data = getProgressData({
        service: serviceName,
        id: investigationId,
        durationMs,
        startAt: createdDateRef.current || undefined,
      });
      setProgress(Math.round(data.progress * 100));
      setRemainingMs(data.remainingMs);
      setCompleted(data.completed);
      setCanAccelerate(shouldShowAccelerateButton({ service: serviceName, id: investigationId }));
    };

    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [serviceName, investigationId, durationMs]);

  const getRandomBoost = () => {
    if (serviceName === 'Instagram' || serviceName === 'WhatsApp' || serviceName === 'Facebook') {
      return Math.floor(Math.random() * 6) + 15; // 15% - 20%
    }
    return Math.floor(Math.random() * 11) + 20; // 20% - 30%
  };

  const accelerate = (customBoost) => {
    if (!serviceName || !investigationId || !durationMs) return progress;
    const boost = customBoost != null ? customBoost : getRandomBoost();
    const newProgress = applyAcceleration({
      service: serviceName,
      id: investigationId,
      durationMs,
      boostPercent: boost,
    });
    setProgress(newProgress);
    setCanAccelerate(false);
    return newProgress;
  };

  return {
    progress,
    remainingMs,
    completed,
    canAccelerate,
    accelerate,
    durationMs,
    accelerateDelays: {
      first: FIRST_ACCEL_DELAY,
      next: NEXT_ACCEL_DELAY,
    },
  };
}
