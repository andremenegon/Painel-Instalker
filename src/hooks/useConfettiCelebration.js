import { useCallback, useEffect, useMemo, useState } from "react";

const isBrowser = typeof window !== "undefined";

export default function useConfettiCelebration(serviceName, options = {}) {
  const { showOnFirstVisit = false } = options;
  const [showConfetti, setShowConfetti] = useState(false);

  const storageKey = useMemo(() => {
    if (!serviceName) return null;
    return `instalker_confetti_seen_${serviceName.toLowerCase()}`;
  }, [serviceName]);

  useEffect(() => {
    if (!showOnFirstVisit || !storageKey || !isBrowser) return;

    const hasSeen = window.localStorage.getItem(storageKey);
    if (!hasSeen) {
      window.localStorage.setItem(storageKey, Date.now().toString());
      const timer = window.setTimeout(() => setShowConfetti(true), 250);
      return () => window.clearTimeout(timer);
    }
  }, [showOnFirstVisit, storageKey]);

  const triggerConfetti = useCallback(() => {
    setShowConfetti(true);
  }, []);

  const handleConfettiComplete = useCallback(() => {
    setShowConfetti(false);
  }, []);

  return {
    showConfetti,
    triggerConfetti,
    handleConfettiComplete,
    setShowConfetti,
  };
}

