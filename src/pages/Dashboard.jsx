
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trophy, Sparkles, AlertCircle, CheckCircle2, Trash2 } from "lucide-react";
import ServiceCard from "../components/dashboard/ServiceCard";
import WelcomeCard from "../components/dashboard/WelcomeCard";
import ConfirmCreditModal from "../components/dashboard/ConfirmCreditModal";
import ConfirmModal from "../components/dashboard/ConfirmModal";
import { Button } from "@/components/ui/button";

const playSound = (type) => {
  if (typeof window === 'undefined') return;
  if (!window.AudioContext && !window.webkitAudioContext) return;

  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    if (type === 'click') {
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.05);
    } else if (type === 'trash') {
      oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.2);
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    }
  } catch (error) {
    // Silently fail
  }
};

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedService, setSelectedService] = useState(null);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpData, setLevelUpData] = useState(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [investigationToDelete, setInvestigationToDelete] = useState(null);

  // ✅ USER - Refetch ao montar para garantir dados atualizados após login
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const userData = await base44.auth.me();
      
      // ✅ CRIAR PERFIL APENAS SE NÃO EXISTIR (PROTEÇÃO)
      try {
        const profiles = await base44.entities.UserProfile.filter({ created_by: userData.email });
        if (profiles.length === 0) {
          // Criar perfil apenas se não existir, sem forçar créditos
          await base44.entities.UserProfile.create({
            created_by: userData.email,
            credits: 0, // Começar com 0 créditos por padrão
            level: 1,
            xp: 0,
            total_investigations: 0
          });
        }
        // NÃO atualizar créditos se o perfil já existe
      } catch (profileError) {
        console.error("Erro ao criar perfil:", profileError);
      }
      
      return userData;
    },
    staleTime: 0, // Sempre considerar stale para garantir dados atualizados
    refetchOnWindowFocus: false,
    refetchOnMount: true, // ✅ REFETCH AO MONTAR para pegar usuário correto após login
    refetchOnReconnect: false,
    retry: 0,
  });

  // ✅ SERVICES - CACHE 5 MINUTOS (serviços não mudam)
  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => base44.entities.Service.list(),
    enabled: !!user,
    staleTime: 300000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 0, // ✅ ZERO RETRIES
  });

  // ✅ INVESTIGATIONS - SEM REFETCH INTERVAL (só lê do cache atualizado pelas páginas)
  const { data: investigations = [] } = useQuery({
    queryKey: ['investigations', user?.email],
    queryFn: () => base44.entities.Investigation.filter({ created_by: user.email }),
    enabled: !!user,
    staleTime: Infinity, // ✅ NUNCA BUSCA DO SERVIDOR AUTOMATICAMENTE
    refetchOnWindowFocus: false,
    refetchOnMount: true, // ✅ BUSCA APENAS AO MONTAR
    retry: 0,
  });

  // ✅ USER PROFILE - ATUALIZA APENAS COM invalidateQueries MANUAL
  const { data: userProfiles = [] } = useQuery({
    queryKey: ['userProfile', user?.email],
    queryFn: () => base44.entities.UserProfile.filter({ created_by: user.email }),
    enabled: !!user,
    staleTime: Infinity, // ✅ NUNCA ATUALIZA AUTOMATICAMENTE
    cacheTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 0, // ✅ ZERO RETRIES
  });

  useEffect(() => {
    const pendingLevelUp = localStorage.getItem('pending_level_up');
    if (pendingLevelUp) {
      const data = JSON.parse(pendingLevelUp);
      if (Date.now() - data.timestamp < 60000) {
        setLevelUpData(data);
        setShowLevelUp(true);
      }
      localStorage.removeItem('pending_level_up');
    }
  }, []);

  const userProfile = useMemo(() => userProfiles[0], [userProfiles]);

  const investigatingServiceNames = useMemo(() => 
    investigations
      .filter(inv => inv.status === "processing")
      .map(inv => inv.service_name),
    [investigations]
  );

  const completedServiceNames = useMemo(() => 
    investigations
      .filter(inv => 
        (
          inv.service_name === "Instagram" ||
          inv.service_name === "Facebook" ||
          inv.service_name === "WhatsApp" ||
          inv.service_name === "Localização" || 
          inv.service_name === "SMS" || 
          inv.service_name === "Chamadas" || 
          inv.service_name === "Câmera" ||
          inv.service_name === "Outras Redes"
        ) && 
        (inv.status === "completed" || inv.status === "accelerated")
      )
      .map(inv => inv.service_name),
    [investigations]
  );

  // ✅ REMOVIDO getRealProgress - Dashboard APENAS LÊ do banco de dados

  const activeInvestigations = useMemo(() => {
    const processed = new Set();
    const active = [];

    const sorted = [...investigations].sort((a, b) => 
      new Date(b.created_date) - new Date(a.created_date)
    );

    sorted.forEach((inv) => {
      if (processed.has(inv.service_name)) return;
      
      const shouldShow = inv.status === "processing" ||
        (
          (
            inv.service_name === "Instagram" ||
            inv.service_name === "Facebook" ||
            inv.service_name === "WhatsApp" ||
            inv.service_name === "Localização" ||
            inv.service_name === "SMS" ||
            inv.service_name === "Chamadas" ||
            inv.service_name === "Câmera" ||
            inv.service_name === "Outras Redes"
          ) &&
          (inv.status === "completed" || inv.status === "accelerated")
        );
      
      if (shouldShow) {
        active.push(inv);
        processed.add(inv.service_name);
      }
    });

    return active;
  }, [investigations]);

  const formatPhoneDisplay = (phone) => {
    if (!phone) return "";
    const numbers = phone.replace(/\D/g, '');
    if (numbers.length === 11) {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    }
    if (numbers.length === 10) {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
    }
    return phone;
  };

  const activeServices = useMemo(() => 
    services.filter((service) =>
      service.is_active !== false &&
      service.name !== "Gmail" &&
      service.name !== "Wifi"
    ),
    [services]
  );

  const orderedServices = useMemo(() => {
    const serviceOrder = [
      "Instagram",
      "WhatsApp", 
      "Facebook",
      "Localização",
      "SMS",
      "Chamadas",
      "Câmera",
      "Camera",
      "Redes Sociais",
      "Outras Redes",
      "Detetive Particular"
    ];

    return [...activeServices].sort((a, b) => {
      const indexA = serviceOrder.indexOf(a.name);
      const indexB = serviceOrder.indexOf(b.name);
      
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      
      return indexA - indexB;
    });
  }, [activeServices]);

  const handleServiceClick = (service) => {
    playSound('click');
    const existingInvestigation = investigations.find(
      inv => inv.service_name === service.name && (
        inv.status === "processing" || 
        ((inv.service_name === "Localização" || inv.service_name === "SMS" || inv.service_name === "Chamadas" || inv.service_name === "Câmera" || inv.service_name === "Redes Sociais" || inv.service_name === "Outras Redes" || inv.service_name === "WhatsApp" || inv.service_name === "Facebook") && 
         (inv.status === "completed" || inv.status === "accelerated"))
      )
    );

    if (existingInvestigation) {
      navigate(createPageUrl("Investigation") + `?service=${service.name}`);
      return;
    }

    if (service.name === "Instagram") {
      navigate(createPageUrl("Investigation") + `?service=${service.name}`);
      return;
    }

    setSelectedService(service);
  };

  const handleConfirmService = () => {
    playSound('click');
    if (selectedService) {
      navigate(createPageUrl("Investigation") + `?service=${selectedService.name}`);
      setSelectedService(null);
    }
  };

  const handleCancelService = () => {
    playSound('click');
    setSelectedService(null);
  };

  const handleDeleteInvestigation = async (investigation) => {
    playSound('trash');
    setInvestigationToDelete(investigation);
    setShowConfirmDelete(true);
  };

  const confirmDelete = async () => {
    playSound('trash');
    if (!investigationToDelete) return;

    try {
      if (investigationToDelete.service_name === "SMS") {
        const phone = investigationToDelete.target_username;
        localStorage.removeItem('saved_phone_sms');
        localStorage.removeItem(`sms_messages_${phone}`);
        
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('sms_chat_')) {
            localStorage.removeItem(key);
          }
        }
      }
      
      if (investigationToDelete.service_name === "Chamadas") {
        const phone = investigationToDelete.target_username;
        localStorage.removeItem('saved_phone_calls');
        localStorage.removeItem(`calls_data_${phone}`);
        localStorage.removeItem(`calls_transcripts_${phone}`);
        localStorage.removeItem(`calls_visible_${phone}`);
      }

      if (investigationToDelete.service_name === "Outras Redes") {
        localStorage.removeItem('spy_location_data'); // This might be unrelated to progress, but kept from original logic
      }
      
      await base44.entities.Investigation.delete(investigationToDelete.id);
      
      queryClient.setQueryData(['investigations', user?.email], (oldData) => {
        if (!oldData) return [];
        return oldData.filter(inv => inv.id !== investigationToDelete.id);
      });
      
      setShowConfirmDelete(false);
      setInvestigationToDelete(null);
    } catch (error) {
      console.error("Erro ao deletar:", error);
    }
  };

  if (userLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-4" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Erro ao carregar</h2>
        <p className="text-sm text-gray-600 mb-4 text-center max-w-md">
          Não foi possível carregar seus dados. Verifique sua conexão com a internet e tente novamente.
        </p>
        <Button
          onClick={() => window.location.reload()}
          className="gradient-primary text-white h-11 px-6"
        >
          Recarregar Página
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      <WelcomeCard
        user={user}
        activeInvestigations={activeInvestigations.length}
        userProfile={userProfile}
      />

      {activeInvestigations.length > 0 && (
        <div className="mt-4">
          <h3 className="text-gray-900 mb-3 px-1 text-[15px] font-bold">
            ✅ Serviços Contratados
          </h3>

          <div className="space-y-2">
            {activeInvestigations.map((investigation) => {
              const isCompleted = 
                (investigation.service_name === "Instagram" && (investigation.status === "completed" || investigation.status === "accelerated")) ||
                (investigation.service_name === "Localização" && (investigation.status === "completed" || investigation.status === "accelerated")) ||
                (investigation.service_name === "SMS" && (investigation.status === "completed" || investigation.status === "accelerated")) ||
                (investigation.service_name === "Chamadas" && (investigation.status === "completed" || investigation.status === "accelerated")) ||
                (investigation.service_name === "Câmera" && (investigation.status === "completed" || investigation.status === "accelerated")) ||
                (investigation.service_name === "Outras Redes" && (investigation.status === "completed" || investigation.status === "accelerated")) ||
                (investigation.service_name === "Facebook" && (investigation.status === "completed" || investigation.status === "accelerated")) ||
                (investigation.service_name === "WhatsApp" && ((investigation.status === "completed" || investigation.status === "accelerated") || (investigation.progress ?? 0) >= 100));
              
              // ✅ DASHBOARD APENAS LÊ O PROGRESSO DO BANCO - NÃO CALCULA NADA
              const displayProgress = investigation.progress || 0;

              let displayUsername = "";
              if (investigation.service_name === "Outras Redes") {
                displayUsername = "47 redes sociais";
              } else if (investigation.service_name === "Instagram") {
                displayUsername = "@" + investigation.target_username;
              } else if (investigation.service_name === "WhatsApp" || investigation.service_name === "SMS" || investigation.service_name === "Chamadas") {
                displayUsername = formatPhoneDisplay(investigation.target_username);
              } else if (investigation.service_name === "Facebook") {
                const cleaned = (investigation.target_username || "").replace(/^fb\//i, "");
                displayUsername = `fb/${cleaned}`;
              } else if (investigation.service_name === "Câmera") {
                displayUsername = "Dispositivo Alvo";
              } else if (investigation.service_name === "Localização") {
                displayUsername = "Rastreamento GPS";
              } else {
                displayUsername = investigation.target_username;
              }
              
              return (
                <Card
                  key={investigation.id}
                  className="gradient-card border-0 shadow-soft p-3"
                >
                  <div className="flex items-center gap-3 mb-2">
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <Loader2 className="w-4 h-4 text-orange-500 animate-spin flex-shrink-0" />
                    )}
                    <div 
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => navigate(createPageUrl("Investigation") + `?service=${investigation.service_name}`)}
                    >
                      <h3 className="font-bold text-sm text-gray-900">{investigation.service_name}</h3>
                      <p className="text-xs text-gray-600 truncate">
                        {displayUsername}
                      </p>
                    </div>
                    <Badge className={`${isCompleted ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'} border-0 text-xs font-semibold px-2 py-1 flex-shrink-0`}>
                      {isCompleted ? '✓ Completa' : `${displayProgress}%`}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteInvestigation(investigation);
                      }}
                      className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  {!isCompleted && (
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className="gradient-primary h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${displayProgress}%` }}
                      />
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-4">
        <h2 className="text-[15px] font-bold text-gray-900 mb-3">🔥 Serviços Disponíveis</h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
          {orderedServices.map((service) => {
            // ✅ DASHBOARD APENAS LÊ O PROGRESSO DO BANCO - NÃO CALCULA NADA
            const investigation = investigations.find(inv => 
              inv.service_name === service.name && inv.status === "processing"
            );
            const displayProgress = investigation ? (investigation.progress || 0) : null;
 
            return (
              <ServiceCard
                key={service.id}
                service={service}
                onClick={() => handleServiceClick(service)}
                isInvestigating={investigatingServiceNames.includes(service.name)}
                isCompleted={completedServiceNames.includes(service.name)}
                progress={displayProgress}
              />
            );
          })}
        </div>
      </div>

      {selectedService && (
        <ConfirmCreditModal
          service={selectedService}
          onConfirm={handleConfirmService}
          onCancel={handleCancelService}
        />
      )}

      {showLevelUp && levelUpData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-300">
          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-3xl shadow-2xl w-full max-w-sm p-6 relative animate-in zoom-in duration-500">
            <div className="absolute -top-12 left-1/2 -translate-x-1/2">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-2xl animate-bounce">
                <Trophy className="w-12 h-12 text-white" />
              </div>
            </div>

            <div className="text-center mt-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                🎉 LEVEL UP!
              </h2>
              <p className="text-lg text-gray-700 mb-4">
                Você alcançou o <span className="font-bold text-orange-600">Nível {levelUpData.newLevel}</span>!
              </p>

              <div className="bg-white rounded-2xl p-4 mb-4 border-2 border-orange-200">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5 text-yellow-500" />
                  <p className="text-sm font-semibold text-gray-700">Bônus Desbloqueado!</p>
                </div>
                <div className="text-3xl font-bold text-orange-600 mb-1">
                  +{levelUpData.bonusCredits} Créditos
                </div>
                <p className="text-xs text-gray-600">Adicionados à sua conta</p>
              </div>

              <Button
                onClick={() => setShowLevelUp(false)}
                className="w-full h-12 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold text-base rounded-xl shadow-lg hover:shadow-xl transition-all"
              >
                Continuar
              </Button>
            </div>

            <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className="absolute text-2xl animate-ping"
                  style={{
                    top: `${Math.random() * 100}%`,
                    left: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 2}s`,
                    animationDuration: '3s'
                  }}
                >
                  ✨
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showConfirmDelete}
        onConfirm={confirmDelete}
        onCancel={() => {
          setShowConfirmDelete(false);
          setInvestigationToDelete(null);
        }}
        title="Apagar Investigação?"
        message="⚠️ Todos os dados desta investigação serão perdidos permanentemente, e os créditos gastos não serão reembolsados."
        confirmText="Sim, apagar"
        cancelText="Cancelar"
        type="danger"
      />
    </div>
  );
}
