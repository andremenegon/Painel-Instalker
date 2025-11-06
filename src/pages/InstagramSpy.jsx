
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Instagram, Search, CheckCircle2, Loader2, AtSign, Zap } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ConfirmModal from "../components/dashboard/ConfirmModal";

export default function InstagramSpy() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [accelerating, setAccelerating] = useState(false);
  const [showAccelerateButton, setShowAccelerateButton] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState({});
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [displayedProgress, setDisplayedProgress] = useState(0); // New state for reactive UI progress
  const queryClient = useQueryClient();

  // ✅ ÚNICA CHAMADA DE USER - COM CACHE
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: Infinity,
    cacheTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 0, // ✅ ZERO RETRIES
  });

  const { data: userProfiles = [] } = useQuery({
    queryKey: ['userProfile', user?.email],
    queryFn: () => base44.entities.UserProfile.filter({ created_by: user.email }),
    enabled: !!user,
    staleTime: Infinity, // ✅ CACHE INFINITO
    cacheTime: Infinity,
    refetchOnWindowFocus: false, // ✅ DESATIVADO
    refetchOnMount: false, // ✅ DESATIVADO
    retry: 0, // ✅ ZERO RETRIES
  });

  const userProfile = userProfiles[0];

  const { data: investigations = [], refetch } = useQuery({
    queryKey: ['investigations', user?.email],
    queryFn: () => base44.entities.Investigation.filter({ created_by: user?.email }),
    initialData: [],
    enabled: !!user,
    staleTime: Infinity, // ✅ CACHE INFINITO
    refetchOnWindowFocus: false, // ✅ DESATIVADO
    refetchOnMount: false, // ✅ DESATIVADO
    retry: 0, // ✅ ZERO RETRIES
  });

  const playSound = (type) => {
    if (typeof window === 'undefined') return;
    if (!window.AudioContext && !window.webkitAudioContext) return;

    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      // Ensure audio context is ready
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

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
      } else if (type === 'start') {
        // Som de "swoosh" - frequência descendente rápida
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
      } else if (type === 'complete') {
        // Som de conclusão - arpejo ascendente
        const times = [0, 0.1, 0.2];
        const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5
        times.forEach((time, i) => {
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();
          osc.connect(gain);
          gain.connect(audioContext.destination);
          osc.frequency.setValueAtTime(freqs[i], audioContext.currentTime + time);
          gain.gain.setValueAtTime(0.2, audioContext.currentTime + time);
          gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + time + 0.3);
          osc.start(audioContext.currentTime + time);
          osc.stop(audioContext.currentTime + time + 0.3);
        });
        return;
      } else if (type === 'accelerate') {
        // Som de boost - frequência ascendente
        oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
      } else if (type === 'error') {
        oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
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

  const activeInstagramInvestigation = investigations.find(
    inv => inv.service_name === "Instagram" && inv.status === "processing"
  );

  const completedInstagramInvestigation = investigations.find(
    inv => inv.service_name === "Instagram" && (inv.status === "completed" || inv.status === "accelerated")
  );

  // ✅ REDIRECIONAR PARA RESULTS SE COMPLETOU
  useEffect(() => {
    if (completedInstagramInvestigation) {
      navigate(createPageUrl("InstagramSpyResults"));
    }
  }, [completedInstagramInvestigation?.id, navigate]);

  // Initialize displayedProgress when an active investigation is found or changes
  useEffect(() => {
    if (activeInstagramInvestigation) {
      setDisplayedProgress(activeInstagramInvestigation.progress);
    } else {
      setDisplayedProgress(0); // Reset if no active investigation
    }
  }, [activeInstagramInvestigation]);


  // ✅ PROGRESSO COM TIMESTAMP - SEM ATUALIZAR CACHE A CADA SEGUNDO
  useEffect(() => {
    if (!activeInstagramInvestigation || activeInstagramInvestigation.status === "completed" || activeInstagramInvestigation.status === "accelerated") {
      return;
    }
    
    const investigationId = activeInstagramInvestigation.id;
    const startTimeKey = `instagram_start_${investigationId}`;
    
    if (!localStorage.getItem(startTimeKey)) {
      localStorage.setItem(startTimeKey, Date.now().toString());
    }

    const startTime = parseInt(localStorage.getItem(startTimeKey));
    let lastSavedProgress = activeInstagramInvestigation.progress;
    
    const updateProgress = async () => {
      const elapsed = Date.now() - startTime;
      let calculatedProgress = 1;
      
      if (elapsed < 10000) {
        calculatedProgress = Math.min(5, 1 + Math.floor((elapsed / 10000) * 4));
      }
      else if (elapsed < 70000) {
        calculatedProgress = Math.min(10, 5 + Math.floor(((elapsed - 10000) / 60000) * 5));
      }
      else {
        const remainingTime = elapsed - 70000;
        calculatedProgress = Math.min(100, 10 + Math.floor((remainingTime / 3600000) * 90));
      }
      
      calculatedProgress = Math.max(calculatedProgress, activeInstagramInvestigation.progress);
      
      // ✅ ATUALIZAR APENAS ESTADO LOCAL (UI)
      setDisplayedProgress(calculatedProgress);
      
      // Salvar no banco a cada 10% de mudança
      if (Math.floor(calculatedProgress / 10) > Math.floor(lastSavedProgress / 10) || calculatedProgress === 100) {
        lastSavedProgress = calculatedProgress;
        try {
          await base44.entities.Investigation.update(investigationId, {
            progress: calculatedProgress,
            ...(calculatedProgress >= 100 && { status: "completed" })
          });
          // ✅ ATUALIZAR CACHE APENAS QUANDO SALVAR NO BANCO
          queryClient.setQueryData(['investigations', user?.email], (oldData) => {
            if (!oldData) return oldData;
            return oldData.map(inv => 
              inv.id === investigationId 
                ? { ...inv, progress: calculatedProgress, ...(calculatedProgress >= 100 && { status: "completed" }) }
                : inv
            );
          });
          if (calculatedProgress >= 100) {
            playSound('complete');
            localStorage.removeItem(startTimeKey);
            localStorage.removeItem(`accelerate_shown_${investigationId}`);
          }
        } catch (error) {
          console.error("Erro ao salvar progresso:", error);
        }
      }
    };

    updateProgress();
    const timer = setInterval(updateProgress, 1000);
    
    return () => clearInterval(timer);
  }, [activeInstagramInvestigation?.id, activeInstagramInvestigation?.status, activeInstagramInvestigation?.progress, playSound, queryClient, user?.email]);

  // Mostrar botão de acelerar: delay de 5s APENAS na primeira vez (persiste no localStorage)
  useEffect(() => {
    if (!activeInstagramInvestigation) {
      setShowAccelerateButton(false);
      return;
    }
    // Use displayedProgress here to check if it's less than 100,
    // as displayedProgress is the source of truth for UI progress now.
    if (displayedProgress < 1 || displayedProgress >= 100) {
      setShowAccelerateButton(false);
      return;
    }
    
    const storageKey = `accelerate_shown_${activeInstagramInvestigation.id}`;
    const alreadyShown = localStorage.getItem(storageKey) === 'true';
    
    if (alreadyShown) {
      setShowAccelerateButton(true);
    } else {
      setShowAccelerateButton(false);
      const timer = setTimeout(() => {
        setShowAccelerateButton(true);
        localStorage.setItem(storageKey, 'true');
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [activeInstagramInvestigation?.id, displayedProgress]); // Use displayedProgress as dependency for UI logic

  const handleCancelInvestigation = async () => {
    playSound('trash');
    if (!activeInstagramInvestigation) return;
    
    setConfirmModalConfig({
      title: "Cancelar Investigação?",
      message: "⚠️ Você perderá o progresso atual.\n\nℹ️ O Instagram é grátis, então não há reembolso de créditos.",
      confirmText: "Sim, cancelar",
      cancelText: "Voltar",
      type: "danger",
      onConfirm: async () => {
        await base44.entities.Investigation.delete(activeInstagramInvestigation.id);
        setShowConfirmModal(false);
        // Clear local storage start time for this investigation
        const localStorageStartTimeKey = `instagram_start_${activeInstagramInvestigation.id}`;
        localStorage.removeItem(localStorageStartTimeKey);
        localStorage.removeItem(`accelerate_shown_${activeInstagramInvestigation.id}`); // Clear accelerate flag too
        await refetch();
        navigate(createPageUrl("Dashboard"));
      }
    });
    setShowConfirmModal(true);
  };

  const handleAccelerate = async () => {
    if (!activeInstagramInvestigation || !userProfile || userProfile.credits < 20) {
      playSound('error');
      setAlertMessage("Créditos insuficientes! Você precisa de 20 créditos para acelerar.");
      setShowAlertModal(true);
      return;
    }

    // Tocar som de aceleração
    playSound('accelerate');

    setAccelerating(true);
    setShowAccelerateButton(false);

    const updatedCredits = userProfile.credits - 20;
    const updatedXp = userProfile.xp + 20;

    await base44.entities.UserProfile.update(userProfile.id, {
      credits: updatedCredits,
      xp: updatedXp
    });
    // Invalidate and refetch user profile to update credits display immediately
    queryClient.invalidateQueries(['userProfile', user?.email]);

    const boost = 17; // Sempre aumenta 17%
    // Use displayedProgress as the base for acceleration
    const newProgressAfterAccelerate = Math.min(100, displayedProgress + boost);

    // Update displayed state immediately
    setDisplayedProgress(newProgressAfterAccelerate); 

    // If acceleration completes the investigation, update DB as well
    if (newProgressAfterAccelerate >= 100) {
      await base44.entities.Investigation.update(activeInstagramInvestigation.id, {
        progress: 100, // Explicitly 100
        status: "completed"
      });
      playSound('complete'); // Play completion sound if accelerated to 100
      
      const localStorageStartTimeKey = `instagram_start_${activeInstagramInvestigation.id}`;
      localStorage.removeItem(localStorageStartTimeKey); // Clean up start time
      localStorage.removeItem(`accelerate_shown_${activeInstagramInvestigation.id}`); // Clean up accelerate flag

      await refetch(); // Refetch to update activeInstagramInvestigation from DB
    } else {
      // If not completed, reset the startTime in localStorage to reflect accelerated progress
      // This ensures subsequent time-based calculations start from the accelerated point,
      // rather than continuing from the original start.
      const localStorageStartTimeKey = `instagram_start_${activeInstagramInvestigation.id}`;
      // Recalculate startTime based on newProgressAfterAccelerate to correctly reset elapsed time.
      let newStartTime = Date.now();
      if (newProgressAfterAccelerate <= 5) {
        // (newProgressAfterAccelerate - 1) because progress starts at 1
        newStartTime = Date.now() - ((newProgressAfterAccelerate - 1) / 4) * 10000;
      } else if (newProgressAfterAccelerate <= 10) {
        // 10000ms for first 5%, then (newProgressAfterAccelerate - 5) for next 5% over 60000ms
        newStartTime = Date.now() - (10000 + ((newProgressAfterAccelerate - 5) / 5) * 60000);
      } else { // newProgressAfterAccelerate > 10
        // 70000ms for first 10%, then (newProgressAfterAccelerate - 10) for next 90% over 3600000ms
        newStartTime = Date.now() - (70000 + ((newProgressAfterAccelerate - 10) / 90) * 3600000);
      }
      localStorage.setItem(localStorageStartTimeKey, newStartTime.toString());

      // Update DB with the accelerated progress
      await base44.entities.Investigation.update(activeInstagramInvestigation.id, {
        progress: newProgressAfterAccelerate
      });
      refetch(); // Refetch to ensure activeInstagramInvestigation reflects updated progress in DB
    }

    setAccelerating(false);
    
    // Only show accelerate button again if not completed and after a delay
    if (newProgressAfterAccelerate < 100) {
      setTimeout(() => setShowAccelerateButton(true), 5000);
    } else {
      setShowAccelerateButton(false); // Hide if completed
    }
  };

  const getSteps = (progress) => {
    const steps = [
      { id: 1, text: "Perfil encontrado", threshold: 0 }, // Sempre completo
      { id: 2, text: "Acessando feed e stories...", threshold: 1 },
      { id: 3, text: "Recuperando mensagens privadas...", threshold: 30 },
      { id: 4, text: "Analisando lista de stalkers...", threshold: 60 },
      { id: 5, text: "Mapeando curtidas ocultas...", threshold: 80 },
      { id: 6, text: "Gerando relatório completo...", threshold: 95 }
    ];

    return steps.map(step => ({
      ...step,
      completed: step.id === 1 || progress > step.threshold + 5, // Primeiro sempre completo
      active: step.id !== 1 && progress >= step.threshold && progress <= step.threshold + 10
    }));
  };

  const getEstimatedTime = (progress) => {
    if (progress >= 95) return "menos de 1 dia";
    if (progress >= 80) return "1 dia";
    if (progress >= 60) return "2 dias";
    if (progress >= 30) return "3 dias";
    return "5 dias";
  };

  const formatUsername = (value) => {
    // Remove @, espaços, converte para minúsculas, remove acentos
    let formatted = value
      .replace(/@/g, '')
      .replace(/\s/g, '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Remove acentos
    
    // Remove caracteres especiais, mantém apenas letras, números, . _ -
    formatted = formatted.replace(/[^a-z0-9._-]/g, '');
    
    // Limita a 30 caracteres
    formatted = formatted.slice(0, 30);
    return formatted;
  };

  const validateUsername = (value) => {
    if (value.length < 5) {
      setUsernameError("Mínimo 5 caracteres");
      return false;
    }
    if (value.length > 30) {
      setUsernameError("Máximo 30 caracteres");
      return false;
    }
    setUsernameError("");
    return true;
  };

  const handleUsernameChange = (e) => {
    const formatted = formatUsername(e.target.value);
    setUsername(formatted);
    if (formatted.length > 0) {
      validateUsername(formatted);
    } else {
      setUsernameError("");
    }
  };

  const startInvestigation = async () => {
    playSound('click');
    
    if (!username.trim()) return;
    
    if (!validateUsername(username)) {
      return;
    }

    if (activeInstagramInvestigation) {
      playSound('error');
      setAlertMessage("Você já tem uma investigação do Instagram em andamento!");
      setShowAlertModal(true);
      return;
    }

    // Tocar som de início
    playSound('start');
    
    setLoading(true);

    const newInvestigation = await base44.entities.Investigation.create({
      service_name: "Instagram",
      target_username: username,
      status: "processing",
      progress: 1, // Começa em 1%
      estimated_days: 5,
      is_accelerated: false
    });

    // Initialize local storage start time for the new investigation
    const localStorageStartTimeKey = `instagram_start_${newInvestigation.id}`;
    localStorage.setItem(localStorageStartTimeKey, Date.now().toString()); // Set start time

    if (userProfile) {
      await base44.entities.UserProfile.update(userProfile.id, {
        xp: userProfile.xp + 10,
        total_investigations: (userProfile.total_investigations || 0) + 1
      });
      // Invalidate and refetch user profile to update XP/total_investigations display immediately
      queryClient.invalidateQueries(['userProfile', user?.email]);
    }

    setLoading(false);
    await refetch();
  };

  let mainContent;

  if (activeInstagramInvestigation) {
    const progress = displayedProgress; // Use displayedProgress for UI rendering
    const showAccelerate = progress >= 1 && progress < 100 && showAccelerateButton;
    const steps = getSteps(progress);
    const estimatedTime = getEstimatedTime(progress);

    mainContent = (
      <div className="min-h-screen bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-3 py-3 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => navigate(createPageUrl("Dashboard"))}
              className="h-9 px-3 hover:bg-gray-100"
              size="sm"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Voltar
            </Button>
            
            <h1 className="text-base font-bold text-gray-900">Instagram</h1>
            
            {userProfile && (
              <div className="flex items-center gap-1 bg-orange-50 rounded-full px-3 py-1 border border-orange-200">
                <Zap className="w-3 h-3 text-orange-500" />
                <span className="text-sm font-bold text-gray-900">{userProfile.credits}</span>
              </div>
            )}
          </div>
        </div>

        <div className="w-full max-w-2xl mx-auto p-3">
          <Card className="bg-white border-0 shadow-lg p-4 mb-3 relative overflow-hidden">
            {/* Efeito de partículas quando em progresso */}
            {progress < 100 && (
              <div className="absolute inset-0 pointer-events-none">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-1 h-1 bg-purple-400 rounded-full animate-particle"
                    style={{
                      left: `${20 + i * 15}%`,
                      animationDelay: `${i * 0.5}s`,
                      animationDuration: '2s',
                      // Ensure particles are always visible relative to the card,
                      // even if it overflows briefly during animation start.
                      transform: 'translateY(100%)' // Start from bottom
                    }}
                  />
                ))}
              </div>
            )}

            {/* Confete quando completo */}
            {progress === 100 && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {[...Array(20)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute text-lg animate-confetti"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: '-10%',
                      animationDelay: `${Math.random() * 0.5}s`,
                      animationDuration: `${1 + Math.random()}s`
                    }}
                  >
                    {['🎉', '✨', '🎊', '⭐'][Math.floor(Math.random() * 4)]}
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Instagram className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 truncate">@{activeInstagramInvestigation.target_username}</h3>
                <p className="text-xs text-gray-600">Analisando perfil...</p>
              </div>
              <Badge className="bg-purple-100 text-purple-700 border-0 flex-shrink-0">
                {progress}%
              </Badge>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div
                className="h-2 rounded-full transition-all duration-1000 bg-gradient-to-r from-purple-500 to-pink-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="space-y-2">
              {steps.map(step => (
                <div
                  key={step.id}
                  className={`flex items-center gap-2 p-2 rounded-lg ${
                    step.completed ? 'bg-green-50 border-l-2 border-green-500' :
                    step.active ? 'bg-purple-50 border-l-4 border-purple-500' :
                    'opacity-40'
                  }`}
                >
                  {step.completed ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                  ) : step.active ? (
                    <Loader2 className="w-4 h-4 text-purple-600 flex-shrink-0 animate-spin" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
                  )}
                  <p className={`text-xs font-medium ${
                    step.completed ? 'text-green-900' :
                    step.active ? 'text-gray-900' :
                    'text-gray-500'
                  }`}>
                    {step.text}
                  </p>
                </div>
              ))}

              {progress < 100 && (
                <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded mt-3">
                  <p className="text-xs text-blue-900">
                    <span className="font-bold">⏳ Análise em andamento</span><br/>
                    Progresso: {progress}% • Tempo estimado: {estimatedTime}
                  </p>
                </div>
              )}

              {progress === 100 && (
                <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded mt-3">
                  <p className="text-xs text-green-900 font-bold">
                    ✓ Análise completa!
                  </p>
                </div>
              )}
            </div>
            
            {progress < 100 && (
              <Button
                onClick={handleCancelInvestigation}
                variant="outline"
                className="w-full h-9 mt-3 text-red-600 border-red-300 hover:bg-red-50"
              >
                Cancelar Investigação
              </Button>
            )}
          </Card>

          {showAccelerate && (
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-3 shadow-sm border border-purple-200">
              <p className="text-center text-gray-600 text-xs mb-2">
                A análise está demorando...
              </p>
              <Button 
                onClick={handleAccelerate}
                disabled={accelerating}
                className="w-full h-10 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold text-sm rounded-lg shadow-sm"
              >
                {accelerating ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Acelerando...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Acelerar por 20 créditos
                  </div>
                )}
              </Button>
            </div>
          )}
        </div>

        <style>{`
          @keyframes particle {
            0% { 
              transform: translateY(100%) scale(0.5); /* Start from bottom, smaller */
              opacity: 0.5;
            }
            50% {
              opacity: 1;
            }
            100% { 
              transform: translateY(-100%) scale(1.5); /* Move up and grow */
              opacity: 0;
            }
          }
          @keyframes confetti {
            0% { 
              transform: translateY(0) rotate(0deg);
              opacity: 1;
            }
            100% { 
              transform: translateY(500px) rotate(720deg);
              opacity: 0;
            }
          }
          .animate-particle {
            animation: particle 2s ease-out infinite;
          }
          .animate-confetti {
            animation: confetti 1.5s ease-out forwards;
          }
        `}</style>
      </div>
    );
  } else {
    mainContent = (
      <div className="min-h-screen bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-3 py-3 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => navigate(createPageUrl("Dashboard"))}
              className="h-9 px-3 hover:bg-gray-100"
              size="sm"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Voltar
            </Button>
            
            <h1 className="text-base font-bold text-gray-900">Instagram</h1>
            
            {userProfile && (
              <div className="flex items-center gap-1 bg-orange-50 rounded-full px-3 py-1 border border-orange-200">
                <Zap className="w-3 h-3 text-orange-500" />
                <span className="text-sm font-bold text-gray-900">{userProfile.credits}</span>
              </div>
            )}
          </div>
        </div>

        <div className="w-full max-w-2xl mx-auto p-3">
          <Card className="bg-white border-0 shadow-lg p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-pink-100 flex items-center justify-center mx-auto mb-4 shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <Instagram className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-2">
                  Informe o nome de usuário
                </label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="nome_de_usuario"
                    value={username}
                    onChange={handleUsernameChange}
                    onKeyPress={(e) => e.key === 'Enter' && startInvestigation()}
                    className={`pl-12 h-12 text-base border-2 ${
                      usernameError 
                        ? 'border-red-300 focus:border-red-400 focus:ring-red-400' 
                        : 'border-purple-200 focus:border-purple-400 focus:ring-purple-400'
                    } rounded-xl`}
                    disabled={loading}
                    maxLength={30}
                  />
                  {usernameError && (
                    <p className="text-xs text-red-600 mt-1 ml-1">{usernameError}</p>
                  )}
                </div>
              </div>

              <Button
                onClick={startInvestigation}
                disabled={!username.trim() || username.length < 5 || loading}
                className="w-full h-12 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold text-base rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Buscando perfil...
                  </div>
                ) : (
                  "Iniciar Investigação"
                )}
              </Button>

              <div className="text-center">
                <Badge className="bg-green-500 text-white border-0 text-xs font-bold px-3 py-1">
                  🎉 GRÁTIS
                </Badge>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <>
      {mainContent}
      <ConfirmModal
        isOpen={showConfirmModal}
        onConfirm={confirmModalConfig.onConfirm}
        onCancel={() => setShowConfirmModal(false)}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
        confirmText={confirmModalConfig.confirmText}
        cancelText={confirmModalConfig.cancelText}
        type={confirmModalConfig.type}
      />

      <ConfirmModal
        isOpen={showAlertModal}
        onConfirm={() => {
          setShowAlertModal(false);
          if (alertMessage.includes("insuficientes")) {
            navigate(createPageUrl("BuyCredits"));
          }
        }}
        onCancel={() => setShowAlertModal(false)}
        title={alertMessage.includes("insuficientes") ? "Créditos Insuficientes" : "Atenção"}
        message={alertMessage}
        confirmText={alertMessage.includes("insuficientes") ? "Comprar Créditos" : "Fechar"}
        cancelText="Fechar"
        type="default"
      />
    </>
  );
}
