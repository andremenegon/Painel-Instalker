import { useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  ensureTimer,
  getProgressData,
  getDurationForInvestigation,
  markCompleted,
  hasCompletionBeenNotified,
  markCompletionNotified,
} from "@/lib/progressManager";

const POLLING_INTERVAL = 1500;

export default function GlobalInvestigationWatcher() {
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: Infinity,
    cacheTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const { data: investigations = [] } = useQuery({
    queryKey: ['investigations', currentUser?.email],
    queryFn: () => base44.entities.Investigation.filter({ created_by: currentUser?.email }),
    enabled: !!currentUser?.email,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const activeInvestigations = useMemo(() => {
    return (investigations || []).filter((inv) => inv.status === 'processing');
  }, [investigations]);

  const activeIdsRef = useRef(new Set());

  useEffect(() => {
    if (!currentUser?.email) return;
    if (!investigations || investigations.length === 0) return;

    const tick = () => {
      activeInvestigations.forEach((investigation) => {
        const durationMs = getDurationForInvestigation(investigation);
        const startAt = investigation.created_date ? new Date(investigation.created_date).getTime() : undefined;
        ensureTimer({ service: investigation.service_name, id: investigation.id, durationMs, startAt });
        const { progressPercent, completed } = getProgressData({
          service: investigation.service_name,
          id: investigation.id,
          durationMs,
          startAt,
        });

        if (progressPercent >= 100 && !completed) {
          markCompleted({ service: investigation.service_name, id: investigation.id });
        }

        if (progressPercent >= 100 && investigation.status !== 'completed') {
          base44.entities.Investigation.update(investigation.id, {
            progress: 100,
            status: 'completed',
          }).then(() => {
            queryClient.invalidateQueries(['investigations', currentUser.email]);
          }).catch(() => {});
        } else if (progressPercent !== investigation.progress) {
          queryClient.setQueryData(['investigations', currentUser.email], (oldData) => {
            if (!oldData) return oldData;
            return oldData.map((inv) => (inv.id === investigation.id ? { ...inv, progress: progressPercent } : inv));
          });
        }
      });

      const completedInvestigations = (investigations || []).filter((inv) => inv.status === 'completed' || inv.status === 'accelerated');
      completedInvestigations.forEach((inv) => {
        if (hasCompletionBeenNotified({ service: inv.service_name, id: inv.id })) return;
        const pathname = typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '';
        if (
          inv.service_name === 'WhatsApp' &&
          pathname.includes('whatsapp')
        ) {
          markCompletionNotified({ service: inv.service_name, id: inv.id });
          activeIdsRef.current.add(inv.id);
          return;
        }

        if (!activeIdsRef.current.has(inv.id)) {
          activeIdsRef.current.add(inv.id);
          markCompletionNotified({ service: inv.service_name, id: inv.id });
        }
      });
    };

    tick();
    const interval = window.setInterval(tick, POLLING_INTERVAL);
    return () => window.clearInterval(interval);
  }, [activeInvestigations, investigations, currentUser, queryClient]);

  return null;
}
