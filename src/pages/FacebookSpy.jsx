
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Facebook,
  Search,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Zap,
  AlertCircle
} from "lucide-react";
import ConfirmModal from "@/components/dashboard/ConfirmModal";
import { useInvestigationTimer } from "@/hooks/useInvestigationTimer";
import { ensureTimer, getDurationForInvestigation, resetTimer, markCompleted } from "@/lib/progressManager";

export default function FacebookSpy() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  // Removed [userProfile, setUserProfile] = useState(null); as it's now handled by useQuery
  const [showCreditAlert, setShowCreditAlert] = useState(false);
  const [creditsSpent, setCreditsSpent] = useState(0);
  const [xpGained, setXpGained] = useState(0);
  const [accelerating, setAccelerating] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState({});
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertConfig, setAlertConfig] = useState({});
  const [urlError, setUrlError] = useState("");
  const queryClient = useQueryClient();
  // Removed hasShownAccelerate useRef as it's replaced by localStorage
  const completionHandledRef = useRef(false);

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

  useEffect(() => {
    base44.auth.me().then(async (userData) => {
      setUser(userData);
      // userProfile is now fetched via useQuery
    }).catch(() => {
      setUser(null); // Ensure user is cleared on error
    });
  }, []);

  const { data: userProfiles = [] } = useQuery({
    queryKey: ['userProfile', user?.email],
    queryFn: () => base44.entities.UserProfile.filter({ created_by: user.email }),
    enabled: !!user,
    staleTime: Infinity,
    cacheTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const userProfile = userProfiles[0];

  const { data: investigations = [], refetch } = useQuery({
    queryKey: ['investigations', user?.email],
    queryFn: () => base44.entities.Investigation.filter({ created_by: user?.email }),
    initialData: [],
    enabled: !!user,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const activeFacebookInvestigation = investigations.find(
    inv => inv.service_name === "Facebook" && inv.status === "processing"
  );

  const completedFacebookInvestigation = investigations.find(
    inv => inv.service_name === "Facebook" && (inv.status === "completed" || inv.status === "accelerated")
  );

  const {
    progress: timerProgress,
    canAccelerate,
    accelerate: accelerateTimer,
  } = useInvestigationTimer({ service: "Facebook", investigation: activeFacebookInvestigation });

  useEffect(() => {
    if (!activeFacebookInvestigation) {
      completionHandledRef.current = false;
      return;
    }

    if (timerProgress >= 100 && !completionHandledRef.current) {
      completionHandledRef.current = true;

      (async () => {
        try {
          await base44.entities.Investigation.update(activeFacebookInvestigation.id, {
            progress: 100,
            status: "completed",
          });

          markCompleted({ service: "Facebook", id: activeFacebookInvestigation.id });
          playSound('complete');
          queryClient.invalidateQueries({ queryKey: ['investigations', user?.email] });
          await refetch();
        } catch (error) {
          console.error("Erro ao finalizar investigação do Facebook:", error);
          completionHandledRef.current = false;
        }
      })();
    }
  }, [timerProgress, activeFacebookInvestigation?.id, queryClient, refetch, user?.email]);

  useEffect(() => {
    if (completedFacebookInvestigation) {
      navigate(createPageUrl("FacebookSpyResults"));
    }
  }, [completedFacebookInvestigation?.id, navigate]);

  const validateFacebookUrl = (url) => {
    const facebookPatterns = [
      /^(https?:\/\/)?(www\.)?facebook\.com\/.+/i,
      /^(https?:\/\/)?(www\.)?fb\.com\/.+/i,
      /^(https?:\/\/)?(www\.)?m\.facebook\.com\/.+/i
    ];

    if (!url || url.trim().length === 0) {
      setUrlError("");
      return false;
    }

    const isValid = facebookPatterns.some(pattern => pattern.test(url));
    
    if (!isValid) {
      setUrlError("Digite uma URL válida do Facebook (ex: facebook.com/username)");
      return false;
    }

    setUrlError("");
    return true;
  };

  const handleUrlChange = (e) => {
    const rawValue = e.target.value;
    const sanitizedValue = rawValue.replace(/\s+/g, "");
    setSearchQuery(sanitizedValue);

    if (sanitizedValue.length > 0) {
      validateFacebookUrl(sanitizedValue);
    } else {
      setUrlError("");
    }
  };

  const formatFacebookUrl = (url) => {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return `https://${url}`;
    }
    return url;
  };

  const extractUsername = (url) => {
    // Remove protocol and www
    let clean = url.replace(/^(https?:\/\/)?(www\.)?/, '');
    // Remove facebook.com, fb.com, m.facebook.com
    clean = clean.replace(/^(facebook\.com\/|fb\.com\/|m\.facebook\.com\/)/, '');
    // Remove trailing slash and query params
    clean = clean.split('?')[0].split('/')[0].replace(/\/$/, '');
    return clean;
  };

  const getSteps = (progress) => {
    const steps = [
      { id: 1, text: "Perfil localizado", threshold: 0 },
      { id: 2, text: "Quebrando privacidade do perfil...", threshold: 1 },
      { id: 3, text: "Acessando timeline e posts...", threshold: 25 },
      { id: 4, text: "Recuperando mensagens do Messenger...", threshold: 50 },
      { id: 5, text: "Analisando fotos privadas...", threshold: 75 },
      { id: 6, text: "Gerando relatório completo...", threshold: 90 }
    ];

    return steps.map(step => ({
      ...step,
      completed: step.id === 1 ? progress >= 1 : progress > step.threshold + 10,
      active: step.id === 1 ? false : (progress >= step.threshold && progress <= step.threshold + 15)
    }));
  };

  const getEstimatedTime = (progress) => {
    if (progress >= 95) return "menos de 1 dia";
    if (progress >= 80) return "1-2 dias";
    if (progress >= 60) return "3-4 dias";
    if (progress >= 40) return "5-6 dias";
    return "7 dias";
  };

  const handleStartInvestigation = async () => {
    playSound('click');
    if (!searchQuery.trim()) return;

    if (!validateFacebookUrl(searchQuery)) {
      return;
    }

    if (activeFacebookInvestigation) {
      playSound('error');
      setAlertConfig({
        title: "Investigação em Andamento",
        message: "Você já tem uma investigação do Facebook em andamento!",
        confirmText: "Ok"
      });
      setShowAlertModal(true);
      return;
    }

    if (!userProfile || userProfile.credits < 45) {
      playSound('error');
      setAlertConfig({
        title: "Créditos Insuficientes",
        message: "Você precisa de 45 créditos.",
        confirmText: "Comprar Créditos",
        onConfirm: () => {
          setShowAlertModal(false);
          navigate(createPageUrl("BuyCredits"));
        }
      });
      setShowAlertModal(true);
      return;
    }

    setLoading(true);

    const username = extractUsername(searchQuery);

    await base44.entities.UserProfile.update(userProfile.id, {
      credits: userProfile.credits - 45,
      xp: userProfile.xp + 20
    });

    const newInvestigation = await base44.entities.Investigation.create({
      target_username: username,
      service_name: "Facebook",
      status: "processing",
      progress: 1,
      estimated_days: 7,
      is_accelerated: false,
      created_by: user?.email || ''
    });

    ensureTimer({
      service: "Facebook",
      id: newInvestigation.id,
      durationMs: getDurationForInvestigation(newInvestigation),
      startAt: Date.now(),
    });

    setCreditsSpent(45);
    setXpGained(20);
    setShowCreditAlert(true);
    setTimeout(() => setShowCreditAlert(false), 3000);
    
    queryClient.invalidateQueries({ queryKey: ['investigations', user?.email] });
    queryClient.invalidateQueries({ queryKey: ['userProfile', user?.email] }); // Invalidate userProfile for credit update
    setLoading(false);
  };

  const handleCancelInvestigation = async () => {
    playSound('trash');
    if (!activeFacebookInvestigation) return;
    
    setConfirmModalConfig({
      title: "Cancelar Investigação?",
      message: "⚠️ Você perderá o progresso atual.\n\n❌ Os créditos gastos não serão reembolsados.",
      confirmText: "Sim, cancelar",
      cancelText: "Voltar",
      type: "danger",
      onConfirm: async () => {
        await base44.entities.Investigation.delete(activeFacebookInvestigation.id);
        
        queryClient.invalidateQueries({ queryKey: ['investigations'] });
        queryClient.invalidateQueries({ queryKey: ['userProfile', user?.email] });
        
        setShowConfirmModal(false);
        navigate(createPageUrl("Dashboard"));
      }
    });
    setShowConfirmModal(true);
  };

  const showAccelerateButton = canAccelerate && !accelerating && timerProgress > 0 && timerProgress < 100;

  const handleAccelerate = async () => {
    if (!userProfile || userProfile.credits < 30) {
      playSound('error');
      setAlertConfig({
        title: "Créditos Insuficientes",
        message: "Você precisa de 30 créditos.",
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
    setAccelerating(true);

    await base44.entities.UserProfile.update(userProfile.id, {
      credits: userProfile.credits - 30,
      xp: userProfile.xp + 25
    });

    queryClient.setQueryData(['userProfile', user?.email], (oldData) => {
      if (!oldData) return oldData;
      return oldData.map((profile) =>
        profile.id === userProfile.id
          ? { ...profile, credits: userProfile.credits - 30, xp: userProfile.xp + 25 }
          : profile
      );
    });
    queryClient.setQueryData(['layoutUserProfile', user?.email], (oldProfile) => {
      if (!oldProfile) return oldProfile;
      return { ...oldProfile, credits: userProfile.credits - 30, xp: userProfile.xp + 25 };
    });
    queryClient.invalidateQueries({ queryKey: ['userProfile', user?.email] });
    queryClient.invalidateQueries({ queryKey: ['layoutUserProfile', user?.email] });

    const newProgress = accelerateTimer();
    const newStatus = newProgress >= 100 ? "completed" : "processing";

    await base44.entities.Investigation.update(activeFacebookInvestigation.id, {
      progress: newProgress,
      status: newStatus
    });

    queryClient.setQueryData(['investigations', user?.email], (oldData) => {
      if (!oldData) return oldData;
      return oldData.map(inv => 
        inv.id === activeFacebookInvestigation.id ? { ...inv, progress: newProgress, status: newStatus } : inv
      );
    });

    if (newProgress >= 100) {
      markCompleted({ service: "Facebook", id: activeFacebookInvestigation.id });
    }

    queryClient.invalidateQueries({ queryKey: ['investigations', user?.email] });
    queryClient.invalidateQueries({ queryKey: ['layoutUserProfile', user?.email] });

    setCreditsSpent(30);
    setXpGained(25);
    setShowCreditAlert(true);
    setTimeout(() => setShowCreditAlert(false), 3000);

    setAccelerating(false);
  };


  return (
    <>
      {activeFacebookInvestigation ? (
        // Active Investigation UI
        <div className="min-h-screen bg-[#F0F2F5]">
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
              
              <h1 className="text-base font-bold text-gray-900">Facebook</h1>
              
              {userProfile && (
                <div className="flex items-center gap-1 bg-orange-50 rounded-full px-3 py-1 border border-orange-200">
                  <Zap className="w-3 h-3 text-orange-500" />
                  <span className="text-sm font-bold text-gray-900">{userProfile.credits}</span>
                </div>
              )}
            </div>
          </div>

          <div className="w-full max-w-2xl mx-auto p-3">
            <Card className="bg-white border-0 shadow-md p-4 mb-3">
              {/* Card content */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-[#1877F2] flex items-center justify-center">
                  <Facebook className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 truncate">fb.com/{activeFacebookInvestigation.target_username}</h3>
                  <p className="text-xs text-gray-500">Analisando Facebook...</p>
                </div>
                <Badge className="bg-[#E7F3FF] text-[#1877F2] border-0 flex-shrink-0">
                  {timerProgress}%
                </Badge>
              </div>

              <div className="w-full bg-[#E4E6EB] rounded-full h-2 mb-4">
                <div
                  className="h-2 rounded-full transition-all duration-1000 bg-[#1877F2]"
                  style={{ width: `${timerProgress}%` }}
                />
              </div>

              <div className="space-y-2">
                {getSteps(timerProgress).map(step => (
                  <div
                    key={step.id}
                    className={`flex items-center gap-2 p-2 rounded-lg ${
                      step.completed ? 'bg-[#E7F3FF] border-l-2 border-[#1877F2]' :
                      step.active ? 'bg-white border-l-4 border-[#1877F2]' :
                      'opacity-40'
                    }`}
                  >
                    {step.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-[#1877F2] flex-shrink-0" />
                    ) : step.active ? (
                      <Loader2 className="w-4 h-4 text-[#1877F2] flex-shrink-0 animate-spin" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
                    )}
                    <p className={`text-xs font-medium ${
                      step.completed ? 'text-[#1877F2]' :
                      step.active ? 'text-gray-900' :
                      'text-gray-500'
                    }`}>
                      {step.text}
                    </p>
                  </div>
                ))}

                {timerProgress < 100 && (
                  <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded-r mt-3">
                    <p className="text-xs text-blue-900">
                      <span className="font-bold">⏳ Análise em andamento</span><br/>
                      Progresso: {timerProgress}% • Tempo estimado: {getEstimatedTime(timerProgress)}
                    </p>
                  </div>
                )}

                {timerProgress >= 100 && (
                  <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded-r mt-3">
                    <p className="text-xs text-green-900 font-bold">
                      ✓ Investigação concluída!
                    </p>
                  </div>
                )}
              </div>

              {activeFacebookInvestigation.progress < 100 && (
                <Button
                  onClick={handleCancelInvestigation}
                  variant="outline"
                  className="w-full h-9 mt-3 text-red-600 border-red-300 hover:bg-red-50"
                >
                  Cancelar Investigação
                </Button>
              )}
            </Card>

            {/* Accelerate button section */}
            {showAccelerateButton && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-3 shadow-sm border border-blue-200">
                  <p className="text-center text-gray-600 text-xs mb-2">
                    A análise está demorando...
                  </p>
                  <Button 
                    onClick={handleAccelerate}
                    disabled={accelerating}
                    className="w-full h-10 bg-[#1877F2] hover:bg-[#1565C0] text-white font-semibold text-sm rounded-lg shadow-sm"
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
                <button 
                  onClick={() => setShowCreditAlert(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        // No Active Investigation UI
        <div className="min-h-screen bg-[#F0F2F5]">
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
              
              <h1 className="text-base font-bold text-gray-900">Facebook</h1>
              
              {userProfile && (
                <div className="flex items-center gap-1 bg-orange-50 rounded-full px-3 py-1 border border-orange-200">
                  <Zap className="w-3 h-3 text-orange-500" />
                  <span className="text-sm font-bold text-gray-900">{userProfile.credits}</span>
                </div>
              )}
            </div>
          </div>

          <div className="w-full max-w-2xl mx-auto p-3">
            <Card className="bg-white border-0 shadow-md p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-[#1877F2] flex items-center justify-center">
                  <Facebook className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Investigação de perfil do Facebook</p>
                </div>
              </div>

              <div className="bg-[#E7F3FF] border-l-4 border-[#1877F2] p-3 rounded-r mb-4">
                <p className="text-xs text-[#1877F2]">
                  <span className="font-bold">🔍 Como funciona:</span><br/>
                  Cole a URL completa do perfil do Facebook que deseja investigar. Nosso sistema irá acessar timeline, 
                  posts privados, mensagens do Messenger e muito mais.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <Input
                    placeholder="Cole a URL do perfil (facebook.com/username)"
                    value={searchQuery}
                    onChange={handleUrlChange}
                    onKeyPress={(e) => e.key === 'Enter' && !urlError && handleStartInvestigation()}
                    className={`h-11 text-xs ${urlError ? 'border-red-300 focus:border-red-400 focus:ring-red-400' : ''}`}
                  />
                  {urlError && (
                    <p className="text-xs text-red-600 mt-1 ml-1">{urlError}</p>
                  )}
                </div>

                <Button
                  onClick={handleStartInvestigation}
                  disabled={!searchQuery.trim() || !!urlError || loading}
                  className="w-full h-11 bg-[#1877F2] hover:bg-[#1565C0] text-white font-semibold"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Localizando perfil...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Search className="w-4 h-4" />
                      Iniciar Investigação - 45 Créditos
                    </div>
                  )}
                </Button>
              </div>

              <div className="mt-4 space-y-2">
                <div className="bg-green-50 border-l-4 border-green-400 p-3 rounded-r">
                  <p className="text-xs text-green-800">
                    <span className="font-bold">✓ Exemplos válidos:</span><br/>
                    • facebook.com/username<br/>
                    • https://www.facebook.com/username<br/>
                    • fb.com/username<br/>
                    • m.facebook.com/username
                  </p>
                </div>
                
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded-r">
                  <div className="flex gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-yellow-800">
                      <span className="font-bold">Custo:</span> 45 créditos para investigação completa
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

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
        onConfirm={alertConfig.onConfirm || (() => setShowAlertModal(false))}
        onCancel={() => setShowAlertModal(false)}
        title={alertConfig.title}
        message={alertConfig.message}
        confirmText={alertConfig.confirmText}
        cancelText={alertConfig.cancelText || "Voltar"}
        type={alertConfig.type || "default"}
      />
    </>
  );
}
