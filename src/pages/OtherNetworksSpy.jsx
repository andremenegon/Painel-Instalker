
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, Loader2, Zap, Lock, AlertTriangle, Trash2, Share2, MapPin, Phone, User, Eye } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ConfirmModal from "../components/dashboard/ConfirmModal";
import { useInvestigationTimer } from "@/hooks/useInvestigationTimer";
import { ensureTimer, getDurationForInvestigation, resetTimer } from "@/lib/progressManager";

export default function OtherNetworksSpy() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  // const [userProfile, setUserProfile] = useState(null); // Removed: userProfile will be derived from useQuery
  const [showCreditAlert, setShowCreditAlert] = useState(false);
  const [creditsSpent, setCreditsSpent] = useState(0);
  const [xpGained, setXpGained] = useState(0);
  const autoStarted = useRef(false);
  const isCreating = useRef(false);
  const [accelerating, setAccelerating] = useState(false);
  const [showAllPlatforms, setShowAllPlatforms] = useState(false);
  const [unlockedPackages, setUnlockedPackages] = useState({
    dating: false,
    adult: false,
    ashley: false,
    complete: false
  });
  const [currentInvestigationId, setCurrentInvestigationId] = useState(null);
  const [leadData, setLeadData] = useState({
    phone: null,
    instagram: null,
    facebook: null,
    location: null,
    city: null,
    state: null
  });
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertConfig, setAlertConfig] = useState({});

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
      } else if (type === 'unlock') {
        oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
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
      // const profiles = await base44.entities.UserProfile.filter({ created_by: userData.email });
      // if (profiles.length > 0) setUserProfile(profiles[0]); // Replaced by useQuery below
    });
  }, []);

  const { data: userProfiles = [] } = useQuery({
    queryKey: ['userProfile', user?.email],
    queryFn: () => base44.entities.UserProfile.filter({ created_by: user.email }),
    enabled: !!user,
    staleTime: Infinity, // ✅ CACHE INFINITO
    cacheTime: Infinity,
    refetchOnWindowFocus: false, // ✅ DESATIVADO
    refetchOnMount: false, // ✅ DESATIVADO
  });

  const userProfile = userProfiles[0];

  const { data: investigations = [], refetch } = useQuery({
    queryKey: ['investigations', user?.email],
    queryFn: () => base44.entities.Investigation.filter({ created_by: user?.email }),
    initialData: [],
    enabled: !!user,
    staleTime: Infinity, // ✅ CACHE INFINITO (changed from 60000)
    refetchOnWindowFocus: false, // ✅ DESATIVADO
    refetchOnMount: false, // ✅ DESATIVADO
  });

  const activeInvestigation = investigations.find(
    inv => inv.service_name === "Outras Redes" && inv.status === "processing"
  );

  const completedInvestigation = investigations.find(
    inv => inv.service_name === "Outras Redes" && (inv.status === "completed" || inv.status === "accelerated")
  );

  const currentInvestigation = activeInvestigation || completedInvestigation;

  const {
    progress: timerProgress,
    canAccelerate,
    accelerate: accelerateTimer,
  } = useInvestigationTimer({ service: "Outras Redes", investigation: activeInvestigation || completedInvestigation });

  const loadingProgress = activeInvestigation
    ? timerProgress
    : completedInvestigation
      ? 100
      : 0;

  const showAccelerateButton = Boolean(activeInvestigation) && canAccelerate && !accelerating && loadingProgress > 0 && loadingProgress < 100;

  const resultInvestigation = completedInvestigation || (loadingProgress >= 100 ? activeInvestigation : null);

  useEffect(() => {
    if (!currentInvestigation) return;
    ensureTimer({
      service: "Outras Redes",
      id: currentInvestigation.id,
      durationMs: getDurationForInvestigation(currentInvestigation),
      startAt: currentInvestigation.created_date ? new Date(currentInvestigation.created_date).getTime() : undefined,
    });
  }, [currentInvestigation?.id, currentInvestigation?.created_date, currentInvestigation?.estimated_days]);

  useEffect(() => {
    if (autoStarted.current || isCreating.current) return;
    if (!user || !userProfile) return;
    
    const hasActiveInvestigation = investigations.some(
      inv => inv.service_name === "Outras Redes" && (inv.status === "processing" || inv.status === "completed" || inv.status === "accelerated")
    );
    
    if (hasActiveInvestigation) {
      autoStarted.current = true;
      return;
    }
    
    autoStarted.current = true;
    isCreating.current = true;
    
    (async () => {
      if (userProfile.credits < 40) {
        setAlertConfig({
          title: "Créditos Insuficientes",
          message: "Você precisa de 40 créditos para iniciar uma nova investigação.",
          confirmText: "Comprar Créditos",
          onConfirm: () => {
            setShowAlertModal(false);
            navigate(createPageUrl("BuyCredits"));
          },
          cancelText: "Voltar"
        });
        setShowAlertModal(true);
        isCreating.current = false;
        return;
      }
      
      const updatedCredits = userProfile.credits - 40;
      const updatedXp = userProfile.xp + 20;

      await base44.entities.UserProfile.update(userProfile.id, {
        credits: updatedCredits,
        xp: updatedXp
      });
      // setUserProfile(prev => ({ ...prev, credits: updatedCredits, xp: updatedXp })); // Replaced by invalidateQueries
      queryClient.invalidateQueries(['userProfile', user?.email]);
      
      const newInvestigation = await base44.entities.Investigation.create({
        service_name: "Outras Redes",
        target_username: user.email,
        status: "processing",
        progress: 1,
        estimated_days: 0,
        is_accelerated: false,
        created_by: user.email,
      });

      ensureTimer({
        service: "Outras Redes",
        id: newInvestigation.id,
        durationMs: getDurationForInvestigation(newInvestigation),
        startAt: Date.now(),
      });
      setCurrentInvestigationId(newInvestigation.id);
      
      setCreditsSpent(40);
      setXpGained(20);
      setShowCreditAlert(true);
      setTimeout(() => setShowCreditAlert(false), 1500);
      
      await refetch();
      isCreating.current = false;
    })();
  }, [user?.email, userProfile, investigations, navigate, refetch, queryClient]); // Added userProfile and queryClient to dependencies

  useEffect(() => {
    if (!activeInvestigation) return;
    if (loadingProgress >= 100 && activeInvestigation.status !== "completed") {
      base44.entities.Investigation.update(activeInvestigation.id, {
        progress: 100,
        status: "completed",
      }).then(() => refetch());
    }
  }, [activeInvestigation?.id, activeInvestigation?.status, loadingProgress, refetch]);

  const handleAccelerate = async () => {
    if (!activeInvestigation || !userProfile || userProfile.credits < 30) {
      playSound('error');
      setAlertConfig({
        title: "Créditos Insuficientes",
        message: "Você precisa de 30 créditos para acelerar esta investigação.",
        confirmText: "Comprar Créditos",
        onConfirm: () => {
          setShowAlertModal(false);
          navigate(createPageUrl("BuyCredits"));
        },
        cancelText: "Voltar"
      });
      setShowAlertModal(true);
      return;
    }

    try {
      setAccelerating(true);
      playSound('turbo');
      const updatedCredits = userProfile.credits - 30;
      const updatedXp = userProfile.xp + 30;

      await base44.entities.UserProfile.update(userProfile.id, {
        credits: updatedCredits,
        xp: updatedXp
      });
      queryClient.invalidateQueries(['userProfile', user?.email]);

      const boost = Math.floor(Math.random() * 11) + 20; // 20% - 30%
      const newProgress = accelerateTimer(boost);

      await base44.entities.Investigation.update(activeInvestigation.id, {
        progress: newProgress,
        status: newProgress >= 100 ? "completed" : "processing"
      });

      setCreditsSpent(30);
      setXpGained(30);
      setShowCreditAlert(true);
      setTimeout(() => setShowCreditAlert(false), 3000);

      setTimeout(() => refetch(), 500);
    } catch (error) {
      console.error("❌ Erro ao acelerar:", error);
      setAlertConfig({
        title: "Erro ao Acelerar",
        message: "Ocorreu um erro ao tentar acelerar a investigação. Por favor, tente novamente.",
        confirmText: "Ok",
        onConfirm: () => setShowAlertModal(false)
      });
      setShowAlertModal(true);
    } finally {
      setAccelerating(false);
    }
  };

  const handleDeleteInvestigation = async () => {
    playSound('trash');
    if (!currentInvestigation) return;
    setShowConfirmDelete(true);
  };

  const confirmDelete = async () => {
    playSound('trash');
    if (!currentInvestigation) return;
    
    try {
      localStorage.removeItem(`unlocked_packages_${currentInvestigation.id}`);
      resetTimer({ service: "Outras Redes", id: currentInvestigation.id });
      setUnlockedPackages({ dating: false, adult: false, ashley: false, complete: false });
      
      await base44.entities.Investigation.delete(currentInvestigation.id);
      
      queryClient.setQueryData(['investigations', user?.email], (oldData) => {
        if (!oldData) return [];
        return oldData.filter(inv => inv.id !== currentInvestigation.id);
      });
      
      await queryClient.invalidateQueries({ queryKey: ['investigations'] });
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setShowConfirmDelete(false);
      navigate(createPageUrl("Dashboard"));
    } catch (error) {
      console.error("Erro ao deletar:", error);
      setAlertConfig({
        title: "Erro ao Deletar",
        message: `Ocorreu um erro ao tentar deletar a investigação: ${error.message}`,
        confirmText: "Ok",
        onConfirm: () => setShowAlertModal(false)
      });
      setShowAlertModal(true);
    }
  };

  const handleUnlockPackage = async (packageName, credits, packageKey) => {
    if (!userProfile || userProfile.credits < credits) {
      playSound('error');
      setAlertConfig({
        title: "Créditos Insuficientes",
        message: `Você precisa de ${credits} créditos para desbloquear este pacote.`,
        confirmText: "Comprar Créditos",
        onConfirm: () => {
          setShowAlertModal(false);
          navigate(createPageUrl("BuyCredits"));
        },
        cancelText: "Voltar"
      });
      setShowAlertModal(true);
      return;
    }

    try {
      playSound('unlock');
      await base44.entities.UserProfile.update(userProfile.id, {
        credits: userProfile.credits - credits,
        xp: userProfile.xp + (credits / 2)
      });
      
      queryClient.invalidateQueries(['userProfile', user?.email]);
      // setUserProfile(prev => ({ ...prev, credits: prev.credits - credits, xp: prev.xp + (credits / 2) })); // Replaced by invalidateQueries
      
      const newUnlocked = { ...unlockedPackages, [packageKey]: true };
      if (packageKey === "complete") {
        newUnlocked.dating = true;
        newUnlocked.adult = true;
        newUnlocked.ashley = true;
      }
      setUnlockedPackages(newUnlocked);
      
      if (currentInvestigation?.id) {
        localStorage.setItem(`unlocked_packages_${currentInvestigation.id}`, JSON.stringify(newUnlocked));
      }
      
      setCreditsSpent(credits);
      setXpGained(credits / 2);
      setShowCreditAlert(true);
      setTimeout(() => setShowCreditAlert(false), 3000);
    } catch (error) {
      console.error("Erro ao desbloquear pacote:", error);
      setAlertConfig({
        title: "Erro ao Desbloquear",
        message: "Ocorreu um erro ao tentar desbloquear o pacote. Por favor, tente novamente.",
        confirmText: "Ok",
        onConfirm: () => setShowAlertModal(false)
      });
      setShowAlertModal(true);
    }
  };

  const handleViewApp = (appName, url) => {
    playSound('click');
    window.open(url, '_blank');
  };

  useEffect(() => {
    if (!currentInvestigation?.id) {
      setUnlockedPackages({ dating: false, adult: false, ashley: false, complete: false });
      setCurrentInvestigationId(null);
      return;
    }
    
    if (currentInvestigationId !== currentInvestigation.id) {
      setCurrentInvestigationId(currentInvestigation.id);
      setUnlockedPackages({ dating: false, adult: false, ashley: false, complete: false });
    }
    
    const savedUnlocked = localStorage.getItem(`unlocked_packages_${currentInvestigation.id}`);
    if (savedUnlocked) {
      try {
        setUnlockedPackages(JSON.parse(savedUnlocked));
      } catch (error) {
        console.error("Erro ao carregar pacotes:", error);
      }
    }
  }, [currentInvestigation?.id, currentInvestigationId]);

  useEffect(() => {
    if (!user || investigations.length === 0) return;

    const smsInv = investigations.find(inv => inv.service_name === "SMS");
    const callsInv = investigations.find(inv => inv.service_name === "Chamadas");
    const phone = smsInv?.target_username || callsInv?.target_username || null;

    // ✅ BUSCAR INSTAGRAM CORRETO - INVESTIGAÇÃO MAIS RECENTE
    const instaInvestigations = investigations
      .filter(inv => inv.service_name === "Instagram" && inv.target_username)
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    const instagram = instaInvestigations[0]?.target_username || null;

    const fbInv = investigations.find(inv => inv.service_name === "Facebook");
    const facebook = fbInv?.target_username || null;

    const savedLocation = localStorage.getItem('spy_location_data');
    let city = null;
    let state = null;
    let location = null;
    
    if (savedLocation) {
      try {
        const locationData = JSON.parse(savedLocation);
        city = locationData.city;
        state = locationData.state;
        location = `${city}, ${state}`;
      } catch (error) {
        console.error("Erro ao carregar localização:", error);
      }
    }

    setLeadData({ phone, instagram, facebook, location, city, state });
  }, [user, investigations]);

  const getSteps = (progress) => {
    const steps = [
      { id: 1, text: "Verificando dados...", threshold: 0 },
      { id: 2, text: "Buscando em 47 plataformas...", threshold: 10 },
      { id: 3, text: "Analisando redes sociais...", threshold: 30 },
      { id: 4, text: "Verificando apps de namoro...", threshold: 50 },
      { id: 5, text: "Buscando conteúdo adulto...", threshold: 70 },
      { id: 6, text: "Compilando resultados...", threshold: 90 }
    ];

    return steps.map(step => ({
      ...step,
      completed: progress > step.threshold + 5,
      active: progress >= step.threshold && progress <= step.threshold + 10
    }));
  };

  if (activeInvestigation && loadingProgress < 100) {
    const steps = getSteps(loadingProgress);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-3 py-3 flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate(createPageUrl("Dashboard"))} className="h-9 px-3 hover:bg-gray-100" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Voltar
            </Button>
            <h1 className="text-base font-bold text-gray-900">Outras Redes</h1>
            {userProfile && (
              <div className="flex items-center gap-1 bg-orange-50 rounded-full px-3 py-1 border border-orange-200">
                <Zap className="w-3 h-3 text-orange-500" />
                <span className="text-sm font-bold text-gray-900">{userProfile.credits}</span>
              </div>
            )}
          </div>
        </div>

        <div className="w-full max-w-2xl mx-auto p-3">
          <Card className="bg-white border-0 shadow-lg p-4 mb-3">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center">
                <Share2 className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900">Buscando em 47 plataformas</h3>
                <p className="text-xs text-gray-600">Analisando perfis...</p>
              </div>
              <Badge className="bg-orange-100 text-orange-700 border-0 flex-shrink-0">
                {loadingProgress}%
              </Badge>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div
                className="h-2 rounded-full transition-all duration-1000 bg-gradient-to-r from-orange-400 to-orange-500"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>

            <div className="space-y-2">
              {steps.map(step => (
                <div
                  key={step.id}
                  className={`flex items-center gap-2 p-2 rounded-lg ${
                    step.completed ? 'bg-green-50 border-l-2 border-green-500' :
                    step.active ? 'bg-orange-50 border-l-4 border-orange-500' :
                    'opacity-40'
                  }`}
                >
                  {step.completed ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                  ) : step.active ? (
                    <Loader2 className="w-4 h-4 text-orange-600 flex-shrink-0 animate-spin" />
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

              <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded mt-3">
                <p className="text-xs text-blue-900">
                  <span className="font-bold">⏳ Busca completa em múltiplas plataformas</span><br/>
                  Tempo estimado: 11 minutos
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {showAccelerateButton && (
                <Button 
                  onClick={handleAccelerate}
                  disabled={accelerating}
                  className="w-full h-10 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold text-sm rounded-lg shadow-sm"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Acelerar 100% - 30 créditos
                </Button>
              )}
              
              <Button
                onClick={handleDeleteInvestigation}
                variant="outline"
                className="w-full h-9 text-red-600 border-red-300 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Apagar investigação
              </Button>
            </div>
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
          isOpen={showConfirmDelete}
          onConfirm={confirmDelete}
          onCancel={() => setShowConfirmDelete(false)}
          title="Apagar Investigação?"
          message="⚠️ Todos os dados desta investigação serão perdidos permanentemente, e os créditos gastos não serão reembolsados."
          confirmText="Sim, apagar"
          cancelText="Cancelar"
          type="danger"
        />

        <ConfirmModal
          isOpen={showAlertModal}
          onConfirm={alertConfig.onConfirm || (() => setShowAlertModal(false))}
          onCancel={() => setShowAlertModal(false)}
          title={alertConfig.title}
          message={alertConfig.message}
          confirmText={alertConfig.confirmText}
          cancelText={alertConfig.cancelText || "Voltar"}
          type="default"
        />
      </div>
    );
  }

  if (resultInvestigation) {
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
          <div className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
            <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between">
              <Button 
                variant="ghost" 
                onClick={() => navigate(createPageUrl("Dashboard"))} 
                className="h-9 px-3 hover:bg-gray-100"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
              
              {userProfile && (
                <div className="flex items-center gap-2 bg-orange-50 rounded-full px-3 sm:px-4 py-2 border border-orange-200">
                  <Zap className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-bold text-gray-900">{userProfile.credits}</span>
                </div>
              )}
            </div>
          </div>

          <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-20">
            <div className="text-center mb-4 sm:mb-6">
              <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-3 sm:px-4 py-1.5 mb-3">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-xs sm:text-sm font-semibold text-green-900">Busca Concluída</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2">47 Plataformas Analisadas</h1>
              <p className="text-sm sm:text-base text-gray-600">Perfis e atividades encontradas nas redes</p>
            </div>

            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 p-4 sm:p-5 mb-4 sm:mb-6 shadow-lg">
              <div className="flex items-center gap-3 mb-3 sm:mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-gray-900">Dados da Busca</h2>
                  <p className="text-xs text-gray-600">Informações utilizadas para rastrear</p>
                </div>
              </div>
              
              <div className="space-y-2 sm:space-y-3">
                {leadData.phone && (
                  <div className="flex items-center gap-2 sm:gap-3 bg-white/60 backdrop-blur rounded-lg p-2 sm:p-3">
                    <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] sm:text-xs text-gray-600 font-medium">Telefone</p>
                      <p className="text-xs sm:text-sm font-bold text-gray-900">{leadData.phone}</p>
                    </div>
                  </div>
                )}
                
                {leadData.instagram && (
                  <div className="flex items-center gap-2 sm:gap-3 bg-white/60 backdrop-blur rounded-lg p-2 sm:p-3">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" fill="url(#instagram-gradient)" viewBox="0 0 24 24">
                      <defs>
                        <linearGradient id="instagram-gradient">
                          <stop offset="0%" stopColor="#833AB4"/>
                          <stop offset="100%" stopColor="#E1306C"/>
                        </linearGradient>
                      </defs>
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zM12 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] sm:text-xs text-gray-600 font-medium">Instagram</p>
                      <p className="text-xs sm:text-sm font-bold text-gray-900">@{leadData.instagram}</p>
                    </div>
                  </div>
                )}
                
                {leadData.facebook && (
                  <div className="flex items-center gap-2 sm:gap-3 bg-white/60 backdrop-blur rounded-lg p-2 sm:p-3">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] sm:text-xs text-gray-600 font-medium">Facebook</p>
                      <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">{leadData.facebook}</p>
                    </div>
                  </div>
                )}
                
                {leadData.location && (
                  <div className="flex items-center gap-2 sm:gap-3 bg-white/60 backdrop-blur rounded-lg p-2 sm:p-3">
                    <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] sm:text-xs text-gray-600 font-medium">Localização (IP)</p>
                      <p className="text-xs sm:text-sm font-bold text-gray-900">{leadData.location}</p>
                    </div>
                  </div>
                )}
                
                {!leadData.location && leadData.city && leadData.state && (
                  <div className="flex items-center gap-2 sm:gap-3 bg-white/60 backdrop-blur rounded-lg p-2 sm:p-3">
                    <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] sm:text-xs text-gray-600 font-medium">Localização (IP)</p>
                      <p className="text-xs sm:text-sm font-bold text-gray-900">{leadData.city}, {leadData.state}</p>
                    </div>
                  </div>
                )}
              </div>

            </Card>

            <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
              <Card className="p-3 sm:p-4 text-center bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                <p className="text-xl sm:text-2xl font-black text-green-600 mb-1">13</p>
                <p className="text-[10px] sm:text-xs font-medium text-gray-700">Ativos</p>
              </Card>
              <Card className="p-3 sm:p-4 text-center bg-gradient-to-br from-red-50 to-pink-50 border-red-200">
                <p className="text-xl sm:text-2xl font-black text-red-600 mb-1">4</p>
                <p className="text-[10px] sm:text-xs font-medium text-gray-700">Suspeitos</p>
              </Card>
              <Card className="p-3 sm:p-4 text-center bg-gradient-to-br from-gray-50 to-slate-50 border-gray-200">
                <p className="text-xl sm:text-2xl font-black text-gray-600 mb-1">30</p>
                <p className="text-[10px] sm:text-xs font-medium text-gray-700">Sem Conta</p>
              </Card>
              <Card className="p-3 sm:p-4 text-center bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                <p className="text-xl sm:text-2xl font-black text-blue-600 mb-1">47</p>
                <p className="text-[10px] sm:text-xs font-medium text-gray-700">Total</p>
              </Card>
            </div>

            <div className="mb-4 sm:mb-6">
              <h2 className="text-base sm:text-lg font-black text-gray-900 mb-2">📱 Redes Sociais Encontradas</h2>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-3">
                <p className="text-xs text-blue-900">
                  ✅ <span className="font-bold">Perfis confirmados</span> {leadData.phone ? `vinculados ao número ${leadData.phone}` : leadData.instagram ? `ao usuário @${leadData.instagram}` : 'encontrados na busca'}
                </p>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                <Card className="bg-white p-2 border border-gray-200">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm" style={{ background: 'radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%,#d6249f 60%,#285AEB 90%)' }}>
                      <svg className="w-5 h-5" fill="white" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zM12 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-gray-900 mb-0.5">Instagram</h4>
                      <p className="text-[10px] text-green-600 font-semibold">Ativo</p>
                    </div>
                  </div>
                </Card>

                <Card className="bg-white p-2 border border-gray-200">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-gray-900 mb-0.5">Facebook</h4>
                      <p className="text-[10px] text-green-600 font-semibold">Ativo</p>
                    </div>
                  </div>
                </Card>

                <Card className="bg-white p-2 border border-gray-200">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <svg className="w-5 h-5" fill="white" viewBox="0 0 24 24"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2ZM12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 15 3.8 13.47 3.8 11.91C3.81 7.37 7.50 3.67 12.05 3.67ZM8.53 7.33C8.37 7.33 8.10 7.39 7.87 7.64C7.65 7.89 7 8.50 7 9.71C7 10.93 7.89 12.10 8 12.27C8.14 12.44 9.76 14.94 12.25 16C12.84 16.27 13.30 16.42 13.66 16.53C14.25 16.72 14.79 16.69 15.22 16.63C15.70 16.56 16.68 16.03 16.89 15.45C17.10 14.87 17.10 14.38 17.04 14.27C16.97 14.17 16.81 14.11 16.56 14C16.31 13.86 15.09 13.26 14.87 13.18C14.64 13.10 14.50 13.06 14.31 13.3C14.15 13.55 13.67 14.11 13.53 14.27C13.38 14.44 13.24 14.46 13 14.34C12.74 14.21 11.94 13.95 11 13.11C10.26 12.45 9.77 11.64 9.62 11.39C9.50 11.15 9.61 11 9.73 10.89C9.84 10.78 10 10.60 10.10 10.45C10.23 10.31 10.27 10.20 10.35 10.04C10.43 9.87 10.39 9.73 10.33 9.61C10.27 9.50 9.77 8.26 9.56 7.77C9.36 7.29 9.16 7.35 9 7.34C8.86 7.34 8.70 7.33 8.53 7.33Z"/></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-gray-900 mb-0.5">WhatsApp</h4>
                      <p className="text-[10px] text-green-600 font-semibold">Ativo</p>
                    </div>
                  </div>
                </Card>

                <Card className="bg-white p-2 border border-gray-200">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center flex-shrink-0 shadow-sm">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-gray-900 mb-0.5">TikTok</h4>
                      <p className="text-[10px] text-green-600 font-semibold">Ativo</p>
                    </div>
                  </div>
                </Card>

                <Card className="bg-white p-2 border border-gray-200">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden bg-black">
                      <img 
                        src="https://play-lh.googleusercontent.com/G6jK9S77RN0laf9_6nhDo3AVxbRP9SgMmt8ZmQjKQ2hibn9xhOY-W5YFn_7stJD1CA" 
                        alt="Threads"
                        className="w-8 h-8 object-contain"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-gray-900 mb-0.5">Threads</h4>
                      <p className="text-[10px] text-green-600 font-semibold">Ativo</p>
                    </div>
                  </div>
                </Card>

                <Card className="bg-white p-2 border border-gray-200">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden">
                      <img 
                        src="https://s2-techtudo.glbimg.com/f5K6FXnCmZnRvij2SNsrZSn9Iso=/600x0/filters:quality(70)/https://i.s3.glbimg.com/po/tt2/f/original/2016/01/13/grindraccounts.jpg" 
                        alt="Twitter/X"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-gray-900 mb-0.5">Twitter/X</h4>
                      <p className="text-[10px] text-green-600 font-semibold">Ativo</p>
                    </div>
                  </div>
                </Card>

                <Card className="bg-white p-2 border border-gray-200">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-gray-900 mb-0.5">YouTube</h4>
                      <p className="text-[10px] text-green-600 font-semibold">Ativo</p>
                    </div>
                  </div>
                </Card>

                <Card className="bg-white p-2 border border-gray-200">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden">
                      <img 
                        src="https://preview.redd.it/does-americans-use-telegram-v0-oi9xp9bgowma1.jpg?auto=webp&s=73e53cc48367bd79cd9057fbf72dbfe98847fe69" 
                        alt="Telegram"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-gray-900 mb-0.5">Telegram</h4>
                      <p className="text-[10px] text-green-600 font-semibold">Ativo</p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>

            <div className="mb-4 sm:mb-6">
              <Card className="bg-gradient-to-br from-pink-50 to-pink-100 border border-pink-200 p-3 sm:p-4 rounded-xl">
                <h2 className="text-sm sm:text-base font-black text-gray-900 mb-1">💕 Sites de Relacionamento</h2>
                <div className="bg-pink-200/40 backdrop-blur rounded-lg p-2 mb-3">
                  <p className="text-xs text-pink-900">
                    ⚠️ <span className="font-bold">4 perfis encontrados</span> vinculados {leadData.phone ? `ao número ${leadData.phone}` : leadData.instagram ? `ao perfil @${leadData.instagram}` : 'aos dados fornecidos'}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-white/80 backdrop-blur border border-pink-100 p-2 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden">
                        <img 
                          src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ9hN4vMbntJsb4rIgVoCHOLBOzmFqRAJi7UQ&s" 
                          alt="Tinder"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-gray-900 mb-0.5">Tinder</h4>
                        <p className="text-[10px] text-gray-600">Ativo</p>
                      </div>
                    </div>
                    {(unlockedPackages.dating || unlockedPackages.complete) && (
                      <Button 
                        onClick={() => handleViewApp("Tinder", "https://tinder.com")}
                        size="sm" 
                        className="w-full h-6 text-white text-[10px] mt-1" style={{ background: 'linear-gradient(135deg, #FD297B 0%, #FF5864 100%)' }}
                      >
                        Ver
                      </Button>
                    )}
                  </div>

                  <div className="bg-white/80 backdrop-blur border border-yellow-100 p-2 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden" style={{ background: '#FFC629' }}>
                        <img 
                          src="https://play-lh.googleusercontent.com/OuLFZunBcYuFvVCZ_ntwMfu4N-X5e8tLLeYRGDz5YHFR6gE6tyXoNewB9VsK8t2Qqg" 
                          alt="Bumble"
                          className="w-10 h-10 object-contain"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-gray-900 mb-0.5">Bumble</h4>
                        <p className="text-[10px] text-gray-600">Ativo</p>
                      </div>
                    </div>
                    {(unlockedPackages.dating || unlockedPackages.complete) && (
                      <Button 
                        onClick={() => handleViewApp("Bumble", "https://bumble.com")}
                        size="sm" 
                        className="w-full h-6 hover:opacity-90 text-white text-[10px] mt-1" style={{ background: '#FFC629' }}
                      >
                        Ver
                      </Button>
                    )}
                  </div>

                  <div className="bg-white/80 backdrop-blur border border-purple-100 p-2 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden" style={{ background: '#7B5CFF' }}>
                        <img 
                          src="https://raichu-uploads.s3.amazonaws.com/company_424c829b-edaf-40df-981e-2346e3eb5344.png" 
                          alt="Badoo"
                          className="w-11 h-11 object-contain"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-gray-900 mb-0.5">Badoo</h4>
                        <p className="text-[10px] text-gray-600">Ativo</p>
                      </div>
                    </div>
                    {(unlockedPackages.dating || unlockedPackages.complete) && (
                      <Button 
                        onClick={() => handleViewApp("Badoo", "https://badoo.com")}
                        size="sm" 
                        className="w-full h-6 hover:opacity-90 text-white text-[10px] mt-1" style={{ background: '#7B5CFF' }}
                      >
                        Ver
                      </Button>
                    )}
                  </div>

                  <div className="bg-white/80 backdrop-blur border border-orange-100 p-2 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden">
                        <img 
                          src="https://s2-techtudo.glbimg.com/A13Hy4By8o2gxoKHg122fbvZxGo=/0x0:1778x1000/984x0/smart/filters:strip_icc()/s.glbimg.com/po/tt2/f/original/2016/01/13/grindraccounts.jpg" 
                          alt="Grindr"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-gray-900 mb-0.5">Grindr</h4>
                        <p className="text-[10px] text-gray-600">Ativo</p>
                      </div>
                    </div>
                    {(unlockedPackages.dating || unlockedPackages.complete) && (
                      <Button 
                        onClick={() => handleViewApp("Grindr", "https://grindr.com")}
                        size="sm" 
                        className="w-full h-6 text-white text-[10px] mt-1" style={{ background: 'linear-gradient(135deg, #FFDC2E 0%, #FF6F00 100%)' }}
                      >
                        Ver
                      </Button>
                    )}
                  </div>
                </div>

                {(unlockedPackages.dating || unlockedPackages.complete) && (
                  <div className="bg-pink-100/60 backdrop-blur rounded-lg p-2 mb-3 text-center">
                    <p className="text-[10px] text-pink-800">⏳ Carregando mais dados dos perfis... volte mais tarde para ver informações completas</p>
                  </div>
                )}

                {!(unlockedPackages.dating || unlockedPackages.complete) && (
                  <div className="bg-pink-200/60 backdrop-blur rounded-lg p-2 text-center">
                    <p className="text-xs font-bold text-gray-900 mb-1">💕 Pacote Completo</p>
                    <p className="text-[10px] text-gray-700 mb-2">Tinder + Bumble + Badoo + Grindr</p>
                    <Button 
                      onClick={() => handleUnlockPackage("Pacote Sites de Relacionamento", 50, "dating")}
                      className="w-full h-8 bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 text-white font-bold text-xs rounded-lg shadow-sm"
                    >
                      Desbloquear - 50 créditos
                    </Button>
                  </div>
                )}
              </Card>
            </div>

            <div className="mb-4 sm:mb-6">
              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 p-3 sm:p-4 rounded-xl">
                <h2 className="text-sm sm:text-base font-black text-gray-900 mb-1">🔞 Conteúdo Adulto</h2>
                <div className="bg-purple-200/40 backdrop-blur rounded-lg p-2 mb-3">
                  <p className="text-xs text-purple-900">
                    ⚠️ <span className="font-bold">3 contas encontradas</span> vinculadas {leadData.phone ? `ao número ${leadData.phone}` : leadData.instagram ? `ao perfil @${leadData.instagram}` : 'aos dados fornecidos'}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-white/80 backdrop-blur border border-blue-100 p-2 rounded-lg">
                    <div className="flex flex-col items-center text-center">
                      <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-1.5 shadow-sm overflow-hidden" style={{ background: '#00AFF0' }}>
                        <img 
                          src="https://www.reuters.com/resizer/v2/2UGMLJZWKNNEDMU6EN5SLJIWG4.jpg?auth=ab747153e382f3895ca7ca04d6acba08c94835c67341bf99bfde294120204911&width=2100&quality=80" 
                          alt="OnlyFans"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <h4 className="text-sm font-bold text-gray-900 mb-0.5">OnlyFans</h4>
                      <p className="text-[10px] text-gray-600 mb-1">Ativo</p>
                      {(unlockedPackages.adult || unlockedPackages.complete) && (
                        <Button 
                          onClick={() => handleViewApp("OnlyFans", "https://onlyfans.com")}
                          size="sm" 
                          className="w-full h-5 hover:opacity-90 text-white text-[9px]" style={{ background: '#00AFF0' }}
                        >
                          Ver
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="bg-white/80 backdrop-blur border border-pink-100 p-2 rounded-lg">
                    <div className="flex flex-col items-center text-center">
                      <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-1.5 shadow-sm overflow-hidden">
                        <img 
                          src="https://www.remessaonline.com.br/blog/wp-content/uploads/2025/04/como-ganhar-dinheiro-no-privacy.png" 
                          alt="Privacy"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <h4 className="text-sm font-bold text-gray-900 mb-0.5">Privacy</h4>
                      <p className="text-[10px] text-gray-600 mb-1">Ativo</p>
                      {(unlockedPackages.adult || unlockedPackages.complete) && (
                        <Button 
                          onClick={() => handleViewApp("Privacy", "https://privacy.com.br")}
                          size="sm" 
                          className="w-full h-5 text-white text-[9px] hover:opacity-90" style={{ background: 'linear-gradient(135deg, #FF1B6D 0%, #FF006E 100%)' }}
                        >
                          Ver
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="bg-white/80 backdrop-blur border border-red-100 p-2 rounded-lg">
                    <div className="flex flex-col items-center text-center">
                      <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-1.5 shadow-sm overflow-hidden bg-red-600">
                        <img 
                          src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRJcbt2eiu0qr5WHMYp3O_nlAA2TTN2sxuklQ&s" 
                          alt="Xvideos"
                          className="w-12 h-12 object-contain"
                        />
                      </div>
                      <h4 className="text-sm font-bold text-gray-900 mb-0.5">Xvideos</h4>
                      <p className="text-[10px] text-gray-600 mb-1">Detectado</p>
                      {(unlockedPackages.adult || unlockedPackages.complete) && (
                        <Button 
                          onClick={() => handleViewApp("Xvideos", "https://xvideos.com")}
                          size="sm" 
                          className="w-full h-5 bg-red-600 hover:bg-red-700 text-white text-[9px]"
                        >
                          Ver
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {(unlockedPackages.adult || unlockedPackages.complete) && (
                  <div className="bg-purple-100/60 backdrop-blur rounded-lg p-2 mb-3 text-center">
                    <p className="text-[10px] text-purple-800">⏳ Carregando mais dados dos perfis... volte mais tarde para ver informações completas</p>
                  </div>
                )}

                {!(unlockedPackages.adult || unlockedPackages.complete) && (
                  <div className="bg-purple-200/60 backdrop-blur rounded-lg p-2 text-center">
                    <p className="text-xs font-bold text-gray-900 mb-1">🔞 Pacote Completo</p>
                    <p className="text-[10px] text-gray-700 mb-2">OnlyFans + Privacy + Xvideos</p>
                    <Button 
                      onClick={() => handleUnlockPackage("Pacote Conteúdo Adulto", 50, "adult")}
                      className="w-full h-8 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-bold text-xs rounded-lg shadow-sm"
                    >
                      Desbloquear - 50 créditos
                    </Button>
                  </div>
                )}
              </Card>
            </div>

            <Card className="mb-4 sm:mb-6 overflow-hidden border-0" style={{ background: '#E73475' }}>
              <div className="p-3">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center flex-shrink-0 shadow-lg overflow-hidden">
                    <img 
                      src="https://review42.com/wp-content/uploads/2022/05/AM-logo.jpeg" 
                      alt="Ashley Madison"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-black text-white mb-0.5">Ashley Madison</h3>
                    <p className="text-xs text-white/90">⚠️ Site de relacionamentos extraconjugais</p>
                  </div>
                </div>
                
                <div className="bg-white/10 backdrop-blur rounded-lg p-2 mb-2">
                  <p className="text-xs text-white font-medium">
                    🔍 <span className="font-bold">Perfil encontrado</span> - Vinculado {leadData.phone ? `ao número ${leadData.phone}` : leadData.instagram ? `ao perfil do Instagram @${leadData.instagram}` : 'aos dados fornecidos'}
                  </p>
                </div>
                
                {(unlockedPackages.ashley || unlockedPackages.complete) ? (
                  <>
                    <Button 
                      onClick={() => handleViewApp("Ashley Madison", "https://www.ashleymadison.com/pt-br/")}
                      className="w-full h-8 bg-white hover:bg-gray-100 font-bold text-xs rounded-lg shadow-xl mb-2" style={{ color: '#E73475' }}
                    >
                      Ver perfil
                    </Button>
                    <div className="bg-white/10 backdrop-blur rounded-lg p-2 text-center">
                      <p className="text-[10px] text-white/90">⏳ Carregando mais informações... volte mais tarde para ver detalhes completos</p>
                    </div>
                  </>
                ) : (
                  <Button 
                    onClick={() => handleUnlockPackage("Ashley Madison", 40, "ashley")}
                    className="w-full h-9 bg-white hover:bg-gray-100 font-bold text-xs rounded-lg shadow-xl" style={{ color: '#E73475' }}
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    Desbloquear - 40 créditos
                  </Button>
                )}
              </div>
            </Card>

            <div className="mb-4 sm:mb-6">
              <h2 className="text-base sm:text-lg font-black text-gray-500 mb-3">❌ Sem Contas (30 plataformas)</h2>
              
              {!showAllPlatforms ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {["LinkedIn", "Snapchat", "Discord", "Reddit", "Spotify", "Pinterest"].map((platform) => (
                    <div key={platform} className="bg-white/60 backdrop-blur border border-gray-200 rounded-lg p-2 text-center">
                      <div className="w-8 h-8 rounded-lg bg-gray-300 flex items-center justify-center mb-1 mx-auto">
                        <span className="text-white text-[10px] font-bold">{platform.slice(0, 2)}</span>
                      </div>
                      <p className="text-[10px] font-semibold text-gray-700 truncate">{platform}</p>
                      <p className="text-[9px] text-gray-400">✕</p>
                    </div>
                  ))}
                  <button 
                    onClick={() => setShowAllPlatforms(true)}
                    className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-300 rounded-lg p-2 flex items-center justify-center hover:from-gray-100 hover:to-gray-200 transition-colors"
                  >
                    <p className="text-xs font-bold text-gray-600">+24 outras</p>
                  </button>
                </div>
              ) : (
                <div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-2">
                    {["LinkedIn", "Snapchat", "Discord", "Reddit", "Spotify", "Pinterest", "Happn", "Coffee Meets Bagel", "Hinge", "Match", "eHarmony", "Plenty of Fish", "OkCupid", "Her", "Seeking", "SugarDaddy", "Meetup", "Twitch", "Quora", "Medium", "Tumblr", "Flickr", "Vimeo", "SoundCloud", "Skype", "Viber", "WeChat", "Line", "KakaoTalk", "Steam"].map((platform) => (
                      <div key={platform} className="bg-white/60 backdrop-blur border border-gray-200 rounded-lg p-2 text-center">
                        <div className="w-8 h-8 rounded-lg bg-gray-300 flex items-center justify-center mb-1 mx-auto">
                          <span className="text-white text-[10px] font-bold">{platform.slice(0, 2)}</span>
                        </div>
                        <p className="text-[10px] font-semibold text-gray-700 truncate">{platform}</p>
                        <p className="text-[9px] text-gray-400">✕</p>
                      </div>
                    ))}
                  </div>
                  <button 
                    onClick={() => setShowAllPlatforms(false)}
                    className="w-full py-2 bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-300 rounded-lg text-xs font-semibold text-gray-600 hover:from-gray-100 hover:to-gray-200 transition-colors"
                  >
                    Mostrar menos ▲
                  </button>
                </div>
              )}
            </div>

            {!unlockedPackages.complete && (
              <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 p-3 rounded-xl mb-4 shadow-md">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 mx-auto mb-2 flex items-center justify-center shadow-lg">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-base font-black text-gray-900 mb-1">PACOTE COMPLETO</h3>
                  <p className="text-xs text-gray-700 mb-2">Desbloqueie TODOS os perfis suspeitos</p>
                  <p className="text-[10px] text-gray-600 mb-3">Sites de Relacionamento + Conteúdo Adulto + Ashley Madison</p>
                  
                  <div className="bg-white/60 backdrop-blur rounded-lg p-2 mb-3">
                    <p className="text-xs text-gray-500 line-through mb-1">140 créditos</p>
                    <p className="text-3xl font-black text-gray-900 mb-1">90</p>
                    <p className="text-xs text-gray-700">créditos</p>
                    <Badge className="w-full justify-center mt-1 bg-yellow-400 text-yellow-900 border-0 font-bold py-1 text-[10px]">
                      ECONOMIZE 50 CRÉDITOS!
                    </Badge>
                  </div>
                  
                  <Button 
                    onClick={() => handleUnlockPackage("Pacote Completo", 90, "complete")}
                    className="w-full h-10 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-bold text-xs rounded-lg shadow-xl"
                  >
                    🔥 DESBLOQUEAR TUDO - 90 CRÉDITOS
                  </Button>
                </div>
              </Card>
            )}

            <Button
              onClick={handleDeleteInvestigation}
              variant="outline"
              className="w-full h-10 border-2 border-red-200 text-red-600 hover:bg-red-50 font-semibold"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Apagar esta investigação
            </Button>
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
        </div>

        <ConfirmModal
          isOpen={showConfirmDelete}
          onConfirm={confirmDelete}
          onCancel={() => setShowConfirmDelete(false)}
          title="Apagar Investigação?"
          message="⚠️ Todos os dados desta investigação serão perdidos permanentemente, e os créditos gastos não serão reembolsados."
          confirmText="Sim, apagar"
          cancelText="Cancelar"
          type="danger"
        />

        <ConfirmModal
          isOpen={showAlertModal}
          onConfirm={alertConfig.onConfirm || (() => setShowAlertModal(false))}
          onCancel={() => setShowAlertModal(false)}
          title={alertConfig.title}
          message={alertConfig.message}
          confirmText={alertConfig.confirmText}
          cancelText={alertConfig.cancelText || "Voltar"}
          type="default"
        />
      </>
    );
  }
  
  return null;
}
