
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Phone, CheckCircle2, Loader2, Zap } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ConfirmModal from "../components/dashboard/ConfirmModal";

export default function CallsSpy() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [currentScreen, setCurrentScreen] = useState("input");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showCreditAlert, setShowCreditAlert] = useState(false);
  const [creditsSpent, setCreditsSpent] = useState(0);
  const [xpGained, setXpGained] = useState(0);
  const [showAccelerateButton, setShowAccelerateButton] = useState(false);
  const autoStarted = useRef(false);
  // progressTimerRef is no longer used for the progress update logic,
  // but keeping it for the component cleanup in the first useEffect if needed elsewhere.
  // The new progress useEffect uses a local 'timer' variable.
  const progressTimerRef = useRef(null); 
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertConfig, setAlertConfig] = useState({});
  const [autoStartPhone, setAutoStartPhone] = useState(null);

  // ✅ FUNÇÃO DE SOM UNIVERSAL
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
      } else if (type === 'turbo') {
        oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1000, audioContext.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
      } else if (type === 'error') {
        oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
      }
    } catch (error) {
      // Silently fail
    }
  };

  // ✅ RESET autoStarted QUANDO COMPONENTE É MONTADO
  useEffect(() => {
    autoStarted.current = false;
    return () => {
      autoStarted.current = false;
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    };
  }, []);

  // Fetch current user using react-query
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: Infinity,
    cacheTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retry: 0, // ✅ ZERO RETRIES
  });

  // ✅ USAR O MESMO CACHE DO LAYOUT
  const { data: userProfile } = useQuery({
    queryKey: ['layoutUserProfile', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const profiles = await base44.entities.UserProfile.filter({ created_by: user?.email });
      return Array.isArray(profiles) && profiles.length > 0 ? profiles[0] : null;
    },
    enabled: !!user?.email,
    staleTime: 60 * 1000, // ✅ 60 segundos (igual ao Layout)
  });

  const { data: investigations = [], refetch } = useQuery({
    queryKey: ['investigations', user?.email],
    queryFn: () => base44.entities.Investigation.filter({ created_by: user?.email }),
    initialData: [],
    enabled: !!user,
    staleTime: Infinity, // ✅ CACHE INFINITO
    refetchOnWindowFocus: false, // ✅ DESATIVADO
    refetchOnMount: false, // ✅ DESATIVADO
    refetchOnReconnect: false,
    retry: 0, // ✅ ZERO RETRIES
  });

  const activeCallsInvestigation = investigations.find(
    inv => inv.service_name === "Chamadas" && inv.status === "processing"
  );

  const completedCallsInvestigation = investigations.find(
    inv => inv.service_name === "Chamadas" && (inv.status === "completed" || inv.status === "accelerated")
  );

  // ✅ 3. REDIRECIONAR PARA RESULTS SE JÁ ESTÁ COMPLETED
  useEffect(() => {
    if (completedCallsInvestigation) {
      navigate(createPageUrl("CallsSpyResults"));
    }
  }, [completedCallsInvestigation?.id, navigate]);

  // ✅ AUTO-START - UMA VEZ SÓ - IGUAL AO SMS
  useEffect(() => {
    if (autoStarted.current) return;
    if (!user || !userProfile || investigations.length === 0) return;
    
    // If there's a completed investigation, the dedicated useEffect will handle navigation.
    // This useEffect's purpose is to initialize state for input or loading, not to navigate to results.
    // So, if there's a completed investigation, we just mark autoStarted and let the other useEffect do its job.
    if (completedCallsInvestigation) {
        autoStarted.current = true; // Mark as started to prevent re-runs
        return; // Let the other useEffect handle the navigation
    }
    
    autoStarted.current = true; // Mark as started if we're going to process further
    
    // Se tem investigação ativa, mostrar loading
    if (activeCallsInvestigation) {
      const phone = activeCallsInvestigation.target_username;
      setPhoneNumber(phone);
      localStorage.setItem('saved_phone_calls', phone);
      setCurrentScreen("loading");
      setLoadingProgress(activeCallsInvestigation.progress); // Initialize with DB progress
      return;
    }
    
    // Buscar número do WhatsApp ou SMS
    const whatsappInvestigation = investigations
      .filter(inv => inv.service_name === "WhatsApp" && inv.target_username)
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
    
    const smsInvestigation = investigations
      .filter(inv => inv.service_name === "SMS" && inv.target_username)
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
    
    if (whatsappInvestigation || smsInvestigation) {
      const phone = whatsappInvestigation?.target_username || smsInvestigation?.target_username;
      setPhoneNumber(phone);
      // ✅ MARCAR PARA INICIAR INVESTIGAÇÃO AUTOMATICAMENTE
      setAutoStartPhone(phone);
      return;
    }
    
    setCurrentScreen("input");
  }, [user?.email, userProfile?.id, investigations.length, completedCallsInvestigation, activeCallsInvestigation, navigate]);

  useEffect(() => {
    if (currentScreen !== "loading") return;
    if (loadingProgress < 1 || loadingProgress >= 100) {
      setShowAccelerateButton(false);
      return;
    }
    setShowAccelerateButton(true);
  }, [currentScreen, loadingProgress]);

  // ✅ PROGRESSO COM TIMESTAMP - SEM ATUALIZAR CACHE A CADA SEGUNDO
  useEffect(() => {
    if (!activeCallsInvestigation || activeCallsInvestigation.status === "completed" || activeCallsInvestigation.status === "accelerated") {
      setLoadingProgress(0);
      return;
    }

    const investigationId = activeCallsInvestigation.id;
    const startTimeKey = `calls_start_${investigationId}`;
    
    if (!localStorage.getItem(startTimeKey)) {
      localStorage.setItem(startTimeKey, Date.now().toString());
    }

    const startTime = parseInt(localStorage.getItem(startTimeKey));
    const targetDuration = 240000; // 4 minutos em ms
    
    let lastSavedProgress = activeCallsInvestigation.progress;
    
    const updateProgress = async () => {
      const elapsed = Date.now() - startTime;
      let calculatedProgress = Math.min(100, Math.floor((elapsed / targetDuration) * 100));
      
      calculatedProgress = Math.max(calculatedProgress, activeCallsInvestigation.progress);
      
      // ✅ ATUALIZAR APENAS ESTADO LOCAL (UI)
      setLoadingProgress(calculatedProgress);
      
      // Salvar no banco a cada 10% de mudança
      if (Math.floor(calculatedProgress / 10) > Math.floor(lastSavedProgress / 10)) {
        lastSavedProgress = calculatedProgress;
        try {
          await base44.entities.Investigation.update(investigationId, {
            progress: calculatedProgress
          });
          // ✅ ATUALIZAR CACHE APENAS QUANDO SALVAR NO BANCO
          queryClient.setQueryData(['investigations', user?.email], (oldData) => {
            if (!oldData) return oldData;
            return oldData.map(inv => 
              inv.id === investigationId ? { ...inv, progress: calculatedProgress } : inv
            );
          });
        } catch (error) {
          console.error("Erro ao salvar progresso:", error);
        }
      }
      
      if (calculatedProgress >= 100) {
        if (currentScreen !== "complete") {
          setCurrentScreen("complete");
        }
        
        if (activeCallsInvestigation.status !== "completed" && activeCallsInvestigation.status !== "accelerated") {
          try {
            await base44.entities.Investigation.update(investigationId, {
              progress: 100,
              status: "completed"
            });
            queryClient.setQueryData(['investigations', user?.email], (oldData) => {
              if (!oldData) return oldData;
              return oldData.map(inv => 
                inv.id === investigationId ? { ...inv, progress: 100, status: "completed" } : inv
              );
            });
            localStorage.removeItem(startTimeKey);
            setTimeout(() => navigate(createPageUrl("CallsSpyResults")), 1500);
          } catch (error) {
            console.error("Erro ao completar investigação:", error);
          }
        }
      }
    };

    updateProgress();
    const timer = setInterval(updateProgress, 1000);
    
    return () => clearInterval(timer);
  }, [activeCallsInvestigation?.id, activeCallsInvestigation?.status, activeCallsInvestigation?.progress, currentScreen, navigate, queryClient, user?.email]);

  const formatPhone = (value) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const startInvestigation = async (phone = phoneNumber) => {
    playSound('click');
    
    try {
      if (!userProfile || userProfile.credits < 25) {
        playSound('error');
        setAlertConfig({
          title: "Créditos Insuficientes",
          message: "Você precisa de 25 créditos para iniciar esta investigação.",
          confirmText: "Comprar Créditos",
          onConfirm: () => {
            setShowAlertModal(false);
            navigate(createPageUrl("BuyCredits"));
          }
        });
        setShowAlertModal(true);
        return;
      }

      if (phone.replace(/\D/g, '').length !== 11) {
        playSound('error');
        setAlertConfig({
          title: "Número Inválido",
          message: "Por favor, insira um número de telefone válido com 11 dígitos.",
          confirmText: "Ok",
          onConfirm: () => setShowAlertModal(false)
        });
        setShowAlertModal(true);
        return;
      }
      
      localStorage.setItem('saved_phone_calls', phone);
      
      await base44.entities.UserProfile.update(userProfile.id, {
        credits: userProfile.credits - 25,
        xp: userProfile.xp + 12
      });
      
      // Invalidate userProfile query to refetch updated credits/xp
      queryClient.invalidateQueries({ queryKey: ['layoutUserProfile', user?.email] });

      await base44.entities.Investigation.create({
        service_name: "Chamadas",
        target_username: phone,
        status: "processing",
        progress: 1,
        estimated_days: 5, // Updated to 5 days estimate
        created_by: user?.email || ''
      });
      
      setCreditsSpent(25);
      setXpGained(12);
      setShowCreditAlert(true);
      setTimeout(() => setShowCreditAlert(false), 3000);
      
      // ✅ REFETCH MANUAL - SÓ AQUI
      // This refetch will make the activeCallsInvestigation available to the progress useEffect.
      setTimeout(() => refetch(), 1000);
      
      setCurrentScreen("loading");
      setLoadingProgress(1); // Set initial local progress to 1%
    } catch (error) {
      console.error("Erro ao iniciar:", error);
      playSound('error');
      setAlertConfig({
        title: "Erro ao Iniciar",
        message: "Não foi possível iniciar a investigação. Tente novamente mais tarde.",
        confirmText: "Ok",
        onConfirm: () => setShowAlertModal(false)
      });
      setShowAlertModal(true);
      setCurrentScreen("input");
    }
  };

  // ✅ USEEFFECT PARA INICIAR AUTOMATICAMENTE QUANDO autoStartPhone MUDAR
  useEffect(() => {
    if (autoStartPhone && userProfile && !activeCallsInvestigation && !completedCallsInvestigation) {
      startInvestigation(autoStartPhone);
      setAutoStartPhone(null); // Limpar para não iniciar novamente
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStartPhone, activeCallsInvestigation, completedCallsInvestigation, userProfile]);

  const handleAccelerate = async () => {
    try {
      if (!userProfile || userProfile.credits < 30) {
        playSound('error');
        setAlertConfig({
          title: "Créditos Insuficientes",
          message: "Você precisa de 30 créditos para acelerar a investigação.",
          confirmText: "Comprar Créditos",
          onConfirm: () => {
            setShowAlertModal(false);
            navigate(createPageUrl("BuyCredits"));
          }
        });
        setShowAlertModal(true);
        return;
      }

      playSound('turbo');
      await base44.entities.UserProfile.update(userProfile.id, {
        credits: userProfile.credits - 30,
        xp: userProfile.xp + 20
      });
      
      // Invalidate userProfile query to refetch updated credits/xp
      queryClient.invalidateQueries({ queryKey: ['layoutUserProfile', user?.email] });

      setLoadingProgress(100);
      
      setCreditsSpent(30);
      setXpGained(20);
      setShowCreditAlert(true);
      setTimeout(() => setShowCreditAlert(false), 3000);
      
      if (activeCallsInvestigation) {
        // Clear local progress for this investigation as it's now completed
        localStorage.removeItem(`calls_start_${activeCallsInvestigation.id}`); // Clear start timestamp as well
        await base44.entities.Investigation.update(activeCallsInvestigation.id, {
          status: "accelerated", // Use 'accelerated' status for accelerated investigations
          progress: 100
        });
        // Refetch to update the `investigations` query data
        refetch();
      }
      
      // Navigation will be handled by the dedicated useEffect when it detects the completed/accelerated status
      // This timeout is a fallback to ensure navigation if other hooks somehow miss it.
      setTimeout(() => {
        // If for some reason the dedicated completedCallsInvestigation useEffect doesn't catch it immediately, force navigation
        // This condition makes sure we only navigate if the current investigation isn't already registered as completed/accelerated by other means
        if (completedCallsInvestigation?.id !== activeCallsInvestigation?.id || (completedCallsInvestigation?.status !== 'accelerated' && completedCallsInvestigation?.status !== 'completed')) {
          navigate(createPageUrl("CallsSpyResults"));
        }
      }, 1500);
      
    } catch (error) {
      console.error("Erro ao acelerar:", error);
      playSound('error');
      setAlertConfig({
        title: "Erro ao Acelerar",
        message: "Não foi possível acelerar a investigação. Tente novamente mais tarde.",
        confirmText: "Ok",
        onConfirm: () => setShowAlertModal(false)
      });
      setShowAlertModal(true);
    }
  };

  const getSteps = (progress) => {
    const steps = [
      { id: 1, text: "Número verificado", threshold: 0 },
      { id: 2, text: "Acessando registros de chamadas...", threshold: 1 },
      { id: 3, text: "Recuperando histórico completo...", threshold: 25 },
      { id: 4, text: "Analisando chamadas recentes...", threshold: 50 },
      { id: 5, text: "Identificando contatos frequentes...", threshold: 70 },
      { id: 6, text: "Gerando relatório...", threshold: 90 }
    ];

    return steps.map((step, index) => {
      // Primeiro passo (Número verificado) sempre completed
      if (step.id === 1) {
        return { ...step, completed: true, active: false };
      }
      
      // Último passo só completa quando progress >= 100
      if (step.id === 6) {
        return {
          ...step,
          completed: progress >= 100,
          active: progress >= step.threshold && progress < 100
        };
      }
      
      // Outros passos
      return {
      ...step,
        completed: progress > step.threshold + 20,
        active: progress >= step.threshold && progress <= step.threshold + 20
      };
    });
  };

  if (currentScreen === "input") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
        <div className="w-full max-w-2xl mx-auto p-3">
          <Card className="bg-white border-0 shadow-md p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center mx-auto mb-4">
                <Phone className="w-8 h-8 text-orange-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">📞 Histórico de Chamadas</h2>
              <p className="text-sm text-gray-600">Digite o número para rastrear chamadas</p>
            </div>

            <div className="relative mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Número de telefone
              </label>
              <Phone className="absolute left-3 bottom-[14px] w-4 h-4 text-gray-500" />
              <Input
                type="tel"
                placeholder="(11) 99999-9999"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(formatPhone(e.target.value))}
                onKeyPress={(e) => e.key === 'Enter' && phoneNumber.replace(/\D/g, '').length === 11 && startInvestigation()}
                className="pl-10 h-12 text-base border-2 border-orange-200 focus:border-orange-400 focus:ring-orange-400"
                maxLength={15}
              />
              {phoneNumber.replace(/\D/g, '').length === 11 && (
                <CheckCircle2 className="absolute right-3 bottom-[14px] w-5 h-5 text-green-500" />
              )}
            </div>

            <Button
              onClick={() => startInvestigation()}
              disabled={phoneNumber.replace(/\D/g, '').length !== 11}
              className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-bold text-base rounded-xl"
            >
              Iniciar Investigação - 25 Créditos
            </Button>
          </Card>
        </div>

        {showCreditAlert && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-5 duration-300">
            <div className="bg-white rounded-xl shadow-2xl p-3 flex items-center gap-3 border border-gray-200 min-w-[280px]">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-2xl">💸</span>
                <div>
                  <p className="text-sm font-bold text-gray-900">Créditos gastos</p>
                  <p className="text-xs text-gray-600">-{creditsSpent} créditos | +{xpGained} XP</p>
                </div>
              </div>
              <button onClick={() => setShowCreditAlert(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
          </div>
        )}
        <ConfirmModal
          isOpen={showAlertModal}
          onConfirm={alertConfig.onConfirm || (() => setShowAlertModal(false))}
          onCancel={() => setShowAlertModal(false)}
          title={alertConfig.title}
          message={alertConfig.message}
          confirmText={alertConfig.confirmText}
          cancelText="Voltar"
          type="default"
        />
      </div>
    );
  }

  if (currentScreen === "loading") {
    const steps = getSteps(loadingProgress);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
        <div className="w-full max-w-2xl mx-auto p-3">
          <Card className="bg-white border-0 shadow-md p-4 mb-3">
            <div className="flex flex-col items-center justify-center py-4">
              <div className="relative mb-4">
                <div className="absolute inset-0 w-16 h-16 rounded-full bg-orange-200 animate-ping opacity-75"></div>
                <div className="absolute inset-2 w-12 h-12 rounded-full bg-orange-300 animate-pulse"></div>
                <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                  <Phone className="w-8 h-8 text-white animate-bounce" />
                </div>
              </div>

              <h3 className="text-base font-bold text-gray-900 mb-1">🔍 Analisando Chamadas</h3>
              <p className="text-sm text-gray-600 text-center">
                {phoneNumber}
              </p>
              <p className="text-xs text-gray-500 mb-3">
                Tempo estimado: 4 minutos
              </p>

              <div className="w-full mb-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="h-2 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full transition-all duration-500"
                    style={{ width: `${loadingProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-600 text-center mt-1 font-semibold">{loadingProgress}%</p>
              </div>

              <div className="space-y-1.5 w-full">
                {steps.map(step => (
                  <div
                    key={step.id}
                    className={`flex items-center gap-2 p-2 rounded-lg ${
                      step.completed ? 'bg-green-50 border-l-2 border-green-500' :
                      step.active ? 'bg-orange-50 border-l-3 border-orange-500' :
                      'opacity-40'
                    }`}
                  >
                    {step.completed ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                    ) : step.active ? (
                      <Loader2 className="w-3.5 h-3.5 text-orange-600 flex-shrink-0 animate-spin" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 flex-shrink-0" />
                    )}
                    <p className={`text-[11px] font-medium leading-tight ${
                      step.completed ? 'text-green-900' :
                      step.active ? 'text-gray-900' :
                      'text-gray-500'
                    }`}>
                      {step.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {showAccelerateButton && loadingProgress < 100 && (
              <Button 
                onClick={handleAccelerate}
              className="w-full h-10 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm rounded-xl"
              >
                <Zap className="w-4 h-4 mr-2" />
              Acelerar Agora - 30 créditos
              </Button>
          )}
        </div>

        {showCreditAlert && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-5 duration-300">
            <div className="bg-white rounded-xl shadow-2xl p-3 flex items-center gap-3 border border-gray-200 min-w-[280px]">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-2xl">💸</span>
                <div>
                  <p className="text-sm font-bold text-gray-900">Créditos gastos</p>
                  <p className="text-xs text-gray-600">-{creditsSpent} créditos | +{xpGained} XP</p>
                </div>
              </div>
              <button onClick={() => setShowCreditAlert(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
          </div>
        )}
        <ConfirmModal
          isOpen={showAlertModal}
          onConfirm={alertConfig.onConfirm || (() => setShowAlertModal(false))}
          onCancel={() => setShowAlertModal(false)}
          title={alertConfig.title}
          message={alertConfig.message}
          confirmText={alertConfig.confirmText}
          cancelText="Voltar"
          type="default"
        />
      </div>
    );
  }

  return null;
}
