
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";

export default function Investigation() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const serviceName = urlParams.get("service");

  // ✅ USAR CACHE COMPARTILHADO
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: Infinity,
    cacheTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 0, // ✅ ZERO RETRIES
  });

  const { data: investigations = [], isLoading } = useQuery({
    queryKey: ['investigations', user?.email],
    queryFn: () => base44.entities.Investigation.filter({ created_by: user?.email }),
    initialData: [],
    enabled: !!user,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 0, // ✅ ZERO RETRIES
  });

  useEffect(() => {
    if (!serviceName || !user || isLoading) return;

    const serviceRoutes = {
      'Instagram': 'InstagramSpy',
      'WhatsApp': 'WhatsAppSpy',
      'Facebook': 'FacebookSpy',
      'Localização': 'LocationSpy',
      'Câmera': 'CameraSpy',
      'Camera': 'CameraSpy',
      'Outras Redes': 'OtherNetworksSpy',
      'SMS': 'SMSSpy',
      'Chamadas': 'CallsSpy',
      'Detetive Particular': 'DetectiveSpy'
    };

    const route = serviceRoutes[serviceName];
    
    if (route) {
      const completedCallsInv = investigations.find(
        inv => inv.service_name === "Chamadas" && (inv.status === "completed" || inv.status === "accelerated")
      );

      if (serviceName === "Chamadas" && completedCallsInv) {
        navigate(createPageUrl("CallsSpyResults"), { replace: true });
      } else {
        navigate(createPageUrl(route), { replace: true });
      }
    } else {
      navigate(createPageUrl("Dashboard"), { replace: true });
    }
  }, [serviceName, user, isLoading, navigate, investigations]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
      <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
    </div>
  );
}
