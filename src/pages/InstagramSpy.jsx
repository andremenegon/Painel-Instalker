
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Search, CheckCircle2, Loader2, Zap } from "lucide-react";
import InstagramAppIcon from "@/components/icons/InstagramAppIcon";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ConfirmModal from "../components/dashboard/ConfirmModal";
import { useInvestigationTimer } from "@/hooks/useInvestigationTimer";
import { markCompleted } from "@/lib/progressManager";

export default function InstagramSpy() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [accelerating, setAccelerating] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState({});
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [displayedProgress, setDisplayedProgress] = useState(0); // New state for reactive UI progress
  const completionHandledRef = useRef(false);
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

  // ✅ USAR O MESMO CACHE DO LAYOUT
  const { data: userProfile } = useQuery({
    queryKey: ['layoutUserProfile', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const profiles = await base44.entities.UserProfile.filter({ created_by: user.email });
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

  const {
    progress: timerProgress,
    canAccelerate,
    accelerate: accelerateTimer,
  } = useInvestigationTimer({ service: "Instagram", investigation: activeInstagramInvestigation });

  useEffect(() => {
    if (activeInstagramInvestigation) {
      const safeProgress = timerProgress > 0 ? timerProgress : 1;
      setDisplayedProgress(Math.min(100, safeProgress));
    } else {
      setDisplayedProgress(0);
    }
  }, [timerProgress, activeInstagramInvestigation?.id]);

  const showAccelerateButton = canAccelerate && !accelerating;

  useEffect(() => {
    if (!activeInstagramInvestigation) {
      completionHandledRef.current = false;
      return;
    }

    if (timerProgress >= 99 && !completionHandledRef.current) {
      completionHandledRef.current = true;
      (async () => {
        await base44.entities.Investigation.update(activeInstagramInvestigation.id, {
          progress: 100,
          status: "completed",
        });
        markCompleted({ service: "Instagram", id: activeInstagramInvestigation.id });
        playSound('complete');
        await refetch();
      })();
    }
  }, [timerProgress, activeInstagramInvestigation?.id, refetch]);

  const handleCancelInvestigation = async () => {
    playSound('trash');
    if (!activeInstagramInvestigation) return;
    
    setConfirmModalConfig({
      title: "Cancelar Investigação?",
      message: "⚠️ Você perderá o progresso atual.",
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
    if (!activeInstagramInvestigation || !userProfile || userProfile.credits < 30) {
      playSound('error');
      setAlertMessage("Créditos insuficientes! Você precisa de 30 créditos para acelerar.");
      setShowAlertModal(true);
      return;
    }

    // Tocar som de aceleração
    playSound('accelerate');

    setAccelerating(true);

    const updatedCredits = userProfile.credits - 30;
    const updatedXp = userProfile.xp + 25;

    await base44.entities.UserProfile.update(userProfile.id, {
      credits: updatedCredits,
      xp: updatedXp
    });
    // Invalidate and refetch user profile to update credits display imediatamente
    queryClient.invalidateQueries(['userProfile', user?.email]);

    const boost = Math.floor(Math.random() * 6) + 15; // 15% - 20%
    const newProgressAfterAccelerate = accelerateTimer(boost);

    if (newProgressAfterAccelerate >= 99) {
      await base44.entities.Investigation.update(activeInstagramInvestigation.id, {
        progress: 100, // Explicitly 100
        status: "completed"
      });
      markCompleted({ service: "Instagram", id: activeInstagramInvestigation.id });
      playSound('complete'); // Play completion sound if accelerated to 100
      completionHandledRef.current = true;
      await refetch();
    } else {
      await base44.entities.Investigation.update(activeInstagramInvestigation.id, {
        progress: newProgressAfterAccelerate
      });
      refetch();
    }

    setAccelerating(false);
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
    
    // Remove caracteres especiais, mantém apenas letras, números, . e _
    formatted = formatted.replace(/[^a-z0-9._]/g, '');
    
    // Limita a 30 caracteres (regra do Instagram)
    return formatted.slice(0, 30);
  };

  const validateUsername = (value) => {
    if (!value || value.length === 0) {
      setUsernameError("");
      return false;
    }
    
    if (value.length > 30) {
      setUsernameError("Máximo 30 caracteres");
      return false;
    }

    if (!/^[a-z0-9._]+$/.test(value)) {
      setUsernameError("Apenas letras, números, . e _ são permitidos");
      return false;
    }

    if (value.startsWith('.')) {
      setUsernameError("Não pode começar com .");
      return false;
    }

    if (value.endsWith('.')) {
      setUsernameError("Não pode terminar com .");
      return false;
    }

    if (value.includes('..')) {
      setUsernameError("Não pode ter dois pontos seguidos");
      return false;
    }

    setUsernameError("");
    return true;
  };

  const handleUsernameChange = (e) => {
    const rawValue = e.target.value;
    const formatted = formatUsername(rawValue);
    setUsername(formatted);
    // Só validar se tiver algum caractere digitado
    if (formatted.length > 0) {
      validateUsername(formatted);
    } else {
      setUsernameError("");
    }
  };

  const startInvestigation = async () => {
    playSound('click');
    
    if (!username.trim()) {
      setAlertMessage("Por favor, digite um username do Instagram");
      setShowAlertModal(true);
      return;
    }
    
    if (!validateUsername(username)) {
      if (usernameError) {
        setAlertMessage(usernameError);
        setShowAlertModal(true);
      }
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

    try {
      const newInvestigation = await base44.entities.Investigation.create({
        service_name: "Instagram",
        target_username: username,
        status: "processing",
        progress: 1, // Começa em 1%
        estimated_days: 5,
        is_accelerated: false,
        created_by: user?.email || ''
      });

      // Initialize local storage start time for the new investigation
      const localStorageStartTimeKey = `instagram_start_${newInvestigation.id}`;
      localStorage.setItem(localStorageStartTimeKey, Date.now().toString()); // Set start time

      if (userProfile) {
        await base44.entities.UserProfile.update(userProfile.id, {
          xp: (userProfile.xp || 0) + 10,
          total_investigations: (userProfile.total_investigations || 0) + 1
        });
        // Invalidate and refetch user profile to update XP/total_investigations display immediately
        queryClient.invalidateQueries(['userProfile', user?.email]);
      }

      // Invalidate investigations to refetch
      queryClient.invalidateQueries(['investigations', user?.email]);
      await refetch();
    } catch (error) {
      console.error("Erro ao criar investigação:", error);
      setAlertMessage("Erro ao iniciar investigação. Tente novamente.");
      setShowAlertModal(true);
      playSound('error');
    } finally {
      setLoading(false);
    }
  };

  let mainContent;

  if (activeInstagramInvestigation) {
    const progress = displayedProgress; // Use displayedProgress for UI rendering
    const showAccelerate = progress >= 1 && progress < 100 && localStorage.getItem(`accelerate_shown_${activeInstagramInvestigation.id}`) === 'true';
    const steps = getSteps(progress);
    const estimatedTime = getEstimatedTime(progress);

    mainContent = (
      <div className="min-h-screen bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
        <div className="w-full max-w-2xl mx-auto p-3">
          <Card className="bg-white border-0 shadow-lg p-4 mb-3 relative overflow-hidden">

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
              <InstagramAppIcon size="md" />
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 truncate">@{activeInstagramInvestigation.target_username}</h3>
                <p className="text-xs text-gray-600">Analisando perfil...</p>
              </div>
              <Badge className="bg-orange-100 text-orange-700 border-0 flex-shrink-0">
                {progress >= 100 ? '✔ Completo' : `${progress}%`}
              </Badge>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div
                className="h-2 rounded-full transition-all duration-1000"
                style={{
                  width: `${progress}%`,
                  background: progress >= 100
                    ? '#34D399'
                    : 'linear-gradient(90deg, #FF6B4A 0%, #FF8B68 55%, #FFD2C1 100%)'
                }}
              />
            </div>

            <div className="space-y-2">
              {steps.map(step => (
                <div
                  key={step.id}
                  className={`flex items-center gap-2 p-2 rounded-lg ${
                    step.completed ? 'bg-green-50 border-l-2 border-green-500' :
                    step.active ? 'bg-[#FFEAE1] border-l-4 border-[#FF6B4A]' :
                    'opacity-40'
                  }`}
                >
                  {step.completed ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                  ) : step.active ? (
                    <Loader2 className="w-4 h-4 text-[#FF6B4A] flex-shrink-0 animate-spin" />
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
                <div className="bg-orange-50 border-l-4 border-orange-500 p-3 rounded mt-3">
                  <p className="text-xs text-orange-900">
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

          {showAccelerateButton && (
            <div className="bg-gradient-to-br from-[#FFF5ED] to-[#FFEEE0] rounded-xl p-3 shadow-sm border border-orange-200">
              <p className="text-center text-gray-600 text-xs mb-2">
                A análise está demorando...
              </p>
              <Button 
                onClick={handleAccelerate}
                disabled={accelerating}
                className="w-full h-10 bg-gradient-to-r from-[#FF6B4A] to-[#FF8B68] hover:from-[#FF7A58] hover:to-[#FFA07F] text-white font-semibold text-sm rounded-lg shadow-sm"
              >
                {accelerating ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Acelerando...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Acelerar por 30 créditos
                  </div>
                )}
              </Button>
            </div>
          )}
        </div>

        <style>{`
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
          .animate-confetti {
            animation: confetti 1.5s ease-out forwards;
          }
        `}</style>
      </div>
    );
  } else {
    mainContent = (
      <div className="min-h-screen bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
        <div className="w-full max-w-2xl mx-auto p-3">
          <Card className="bg-white border border-[#FFD9CB] shadow-lg p-6 overflow-hidden">
            <div className="absolute -top-12 -right-10 w-32 h-32 bg-[#FFE7DC] rounded-full opacity-60" aria-hidden="true" />
            <div className="relative space-y-6">
              <div className="flex items-center gap-3">
                <InstagramAppIcon size="md" />
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Investigar Instagram</h2>
                  <p className="text-xs text-gray-500">Descubra seguidores ocultos, conversas, stalkers e muito mais.</p>
                </div>
              </div>

              <div className="bg-[#FFF0EB] border border-[#FFE0D4] rounded-xl p-3 text-xs text-[#7A5B51]">
                <span className="font-semibold text-[#FF6B4A]">Dica:</span> informe exatamente como aparece no Instagram. Não precisa colocar @, letras maiúsculas ou espaços.
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Digite o nome de usuário (sem o @)
                </label>
                <div className={`flex items-center gap-2 bg-white rounded-xl border-2 px-3 py-2 transition-colors ${
                  usernameError 
                    ? 'border-red-300 focus-within:border-red-400' 
                    : 'border-[#FFCDBA] focus-within:border-[#FF9C7A]'
                }`}>
                  <span className="text-[#FF6B4A] font-semibold text-lg">@</span>
                  <Input
                    type="text"
                    placeholder="Ex: lucas_silva10"
                    value={username}
                    onChange={handleUsernameChange}
                    onKeyPress={(e) => e.key === 'Enter' && startInvestigation()}
                    className="flex-1 border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm h-9"
                    disabled={loading}
                    maxLength={30}
                    autoComplete="off"
                  />
                </div>
            
                {usernameError && (
                  <p className="text-xs text-red-600 mt-1">{usernameError}</p>
                )}
              </div>

              <Button
                onClick={startInvestigation}
                disabled={!username.trim() || username.length < 3 || loading}
                className="w-full h-12 bg-gradient-to-r from-[#FF6B4A] to-[#FF8B68] hover:from-[#FF7A58] hover:to-[#FFA07F] text-white font-bold text-base rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Buscando perfil...
                  </div>
                ) : (
                  "Iniciar investigação"
                )}
              </Button>

              <p className="text-center text-[13px] text-gray-500">
                🎉 Investigação gratuita, sem gastar créditos.
              </p>
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
