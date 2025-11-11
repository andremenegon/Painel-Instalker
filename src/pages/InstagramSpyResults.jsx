import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Lock, Zap, AlertTriangle, Trash2, Loader2 } from "lucide-react";
import InstagramAppIcon from "@/components/icons/InstagramAppIcon";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ConfirmModal from "../components/dashboard/ConfirmModal";

export default function InstagramSpyResults() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreditAlert, setShowCreditAlert] = useState(false);
  const [creditsSpent, setCreditsSpent] = useState(0);
  const [xpGained, setXpGained] = useState(0);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertConfig, setAlertConfig] = useState({});
  const [passwordUnlockStatus, setPasswordUnlockStatus] = useState('idle'); // 'idle' | 'processing' | 'failed'
  const [passwordUnlockProgress, setPasswordUnlockProgress] = useState(0);
  const [remainingHours, setRemainingHours] = useState(36);
  const progressIntervalRef = useRef(null);
  const [showIntroSequence, setShowIntroSequence] = useState(true);
  const [introStep, setIntroStep] = useState(0);
  const [passwordAttempt, setPasswordAttempt] = useState('');

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: Infinity,
    cacheTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
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

  const { data: investigations = [] } = useQuery({
    queryKey: ['investigations', user?.email],
    queryFn: () => base44.entities.Investigation.filter({ created_by: user?.email }),
    initialData: [],
    enabled: !!user,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const completedInstagramInvestigation = investigations.find(
    inv => inv.service_name === "Instagram" && (inv.status === "completed" || inv.status === "accelerated")
  );

  // Gerar email mascarado baseado no username
  const getMaskedEmail = useMemo(() => {
    if (!completedInstagramInvestigation) return '';
    const username = completedInstagramInvestigation.target_username || 'user';
    const cleanUsername = username.replace('@', '');
    const firstThree = cleanUsername.substring(0, 3);
    return `${firstThree}******@gmail.com`;
  }, [completedInstagramInvestigation]);

  const finalizePasswordUnlock = useCallback(() => {
    if (!completedInstagramInvestigation) return;
    const statusKey = `password_unlock_status_${completedInstagramInvestigation.id}`;
    const progressKey = `password_unlock_progress_${completedInstagramInvestigation.id}`;

    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    setPasswordUnlockStatus('failed');
    setPasswordUnlockProgress(100);
    setRemainingHours(0);
    localStorage.setItem(statusKey, 'failed');
    localStorage.setItem(progressKey, '100');
  }, [completedInstagramInvestigation]);

  const targetUsername = useMemo(() => {
    if (!completedInstagramInvestigation) return "";
    const username = completedInstagramInvestigation.target_username || "perfil";
    return username.startsWith('@') ? username : `@${username}`;
  }, [completedInstagramInvestigation]);

  useEffect(() => {
    if (!completedInstagramInvestigation) {
      setShowIntroSequence(false);
      return;
    }

    const introShownKey = `instagram_intro_shown_${completedInstagramInvestigation.id}`;
    const hasSeenIntro = localStorage.getItem(introShownKey) === 'true';

    if (hasSeenIntro) {
      setShowIntroSequence(false);
      return;
    }

    setShowIntroSequence(true);
    setIntroStep(0);

    const stepsTotal = 5; // Aumentado para 5 passos
    const stepDurations = [2000, 2500, 1800, 2200, 2500]; // Durações diferentes por etapa
    let currentStep = 0;

    // Animação de senha para o passo 1
    const passwords = ['abc123', 'senha123', 'instagram', 'password', 'user2023', 'admin123'];
    let passwordIndex = 0;
    const passwordInterval = setInterval(() => {
      if (currentStep === 1) {
        setPasswordAttempt('*'.repeat(Math.floor(Math.random() * 3) + 6));
      }
    }, 100);

    const advanceStep = () => {
      currentStep += 1;
      if (currentStep >= stepsTotal) {
        clearInterval(passwordInterval);
        localStorage.setItem(introShownKey, 'true');
        setTimeout(() => setShowIntroSequence(false), 500);
      } else {
        setIntroStep(currentStep);
        setTimeout(advanceStep, stepDurations[currentStep]);
      }
    };

    setTimeout(advanceStep, stepDurations[0]);

    return () => {
      clearInterval(passwordInterval);
    };
  }, [completedInstagramInvestigation?.id]);

  // Carregar estado do desbloqueio de senha do localStorage
  useEffect(() => {
    if (!completedInstagramInvestigation) return;
    
    const unlockStartKey = `password_unlock_start_${completedInstagramInvestigation.id}`;
    const unlockProgressKey = `password_unlock_progress_${completedInstagramInvestigation.id}`;
    const unlockAcceleratedKey = `password_unlock_accelerated_${completedInstagramInvestigation.id}`;
    const unlockStatusKey = `password_unlock_status_${completedInstagramInvestigation.id}`;
    
    const savedStatus = localStorage.getItem(unlockStatusKey);
    const normalizedStatus = savedStatus === 'completed' || savedStatus === 'accelerated'
      ? 'failed'
      : savedStatus;
    const savedProgress = parseInt(localStorage.getItem(unlockProgressKey) || '0', 10);
    const savedStartTime = parseInt(localStorage.getItem(unlockStartKey) || '0');
    
    if (normalizedStatus === 'failed') {
      finalizePasswordUnlock();
      return;
    }
    
    if (normalizedStatus === 'processing' && savedProgress >= 100) {
      finalizePasswordUnlock();
      return;
    }

    if (normalizedStatus === 'processing' && savedStartTime > 0) {
      setPasswordUnlockStatus('processing');
      
      // Calcular progresso baseado no tempo decorrido - COM FÓRMULA NÃO-LINEAR
      const initialTimestamp = Date.now();
      const initialElapsed = initialTimestamp - savedStartTime;
      const totalDurationMs = 36 * 60 * 60 * 1000; // 36 horas em ms
      
      // ✅ Aplicar mesma fórmula não-linear do interval
      const linearProgress = initialElapsed / totalDurationMs;
      let adjustedProgress;
      if (linearProgress < 0.2) {
        // Primeiros 20% do tempo = 1% a 60% visual (MUITO RÁPIDO)
        adjustedProgress = 1 + (linearProgress / 0.2) * 59;
      } else if (linearProgress < 0.6) {
        // 20-60% do tempo = 60% a 85% visual (normal)
        adjustedProgress = 60 + ((linearProgress - 0.2) / 0.4) * 25;
      } else {
        // 60-100% do tempo = 85% a 100% visual (lento)
        adjustedProgress = 85 + ((linearProgress - 0.6) / 0.4) * 15;
      }
      
      const calculatedProgress = Math.min(100, Math.max(1, Math.round(adjustedProgress)));
      setPasswordUnlockProgress(calculatedProgress);
      
      // Se já completou
      if (calculatedProgress >= 100) {
        finalizePasswordUnlock();
        return;
      }
      
      // Iniciar intervalo de atualização do progresso
      progressIntervalRef.current = setInterval(() => {
        const now = Date.now();
        const elapsed = now - savedStartTime;
        const totalDurationMs = 36 * 60 * 60 * 1000; // 36 horas
        
        // ✅ Progresso MUITO RÁPIDO no início, lento no final
        const linearProgress = elapsed / totalDurationMs;
        let adjustedProgress;
        if (linearProgress < 0.2) {
          // Primeiros 20% = 1% a 60% (MUITO RÁPIDO)
          adjustedProgress = 1 + (linearProgress / 0.2) * 59;
        } else if (linearProgress < 0.6) {
          // 20-60% = 60% a 85% (normal)
          adjustedProgress = 60 + ((linearProgress - 0.2) / 0.4) * 25;
        } else {
          // 60-100% = 85% a 100% (lento)
          adjustedProgress = 85 + ((linearProgress - 0.6) / 0.4) * 15;
        }
        
        const progress = Math.min(100, Math.max(1, Math.round(adjustedProgress)));
        const remaining = Math.max(0, Math.ceil((totalDurationMs - elapsed) / (60 * 60 * 1000)));
        
        setPasswordUnlockProgress(progress);
        setRemainingHours(remaining);
        localStorage.setItem(unlockProgressKey, progress.toString());
        
        if (progress >= 100) {
          finalizePasswordUnlock();
        }
      }, 60000); // Atualizar a cada minuto
      
      // Calcular horas restantes inicial
      const now = Date.now();
      const elapsed = now - savedStartTime;
      const totalDurationMsInitial = 36 * 60 * 60 * 1000;
      const remaining = Math.max(0, Math.ceil((totalDurationMsInitial - elapsed) / (60 * 60 * 1000)));
      setRemainingHours(remaining);
    }
    
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [completedInstagramInvestigation, finalizePasswordUnlock]);

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
      } else if (type === 'trash') {
        oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
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

  const handleUnlockPassword = async () => {
    playSound('click');
    
    if (!userProfile || userProfile.credits < 50) {
      playSound('error');
      setAlertConfig({
        title: "Créditos Insuficientes",
        message: "Você precisa de 50 créditos para iniciar o desbloqueio da senha.",
        confirmText: "Comprar Créditos",
        onConfirm: () => {
          setShowAlertModal(false);
          navigate(createPageUrl("BuyCredits"));
        }
      });
      setShowAlertModal(true);
      return;
    }

    if (!completedInstagramInvestigation) return;

    playSound('unlock');
    await base44.entities.UserProfile.update(userProfile.id, {
      credits: userProfile.credits - 50,
      xp: (userProfile.xp || 0) + 30
    });
    queryClient.invalidateQueries(['userProfile', user?.email]);

    setCreditsSpent(50);
    setXpGained(30);
    setShowCreditAlert(true);
    setTimeout(() => setShowCreditAlert(false), 3000);

    // Iniciar processo de desbloqueio (36 horas) - COMEÇA EM 1%
    const startTime = Date.now();
    const unlockStartKey = `password_unlock_start_${completedInstagramInvestigation.id}`;
    const unlockProgressKey = `password_unlock_progress_${completedInstagramInvestigation.id}`;
    const unlockStatusKey = `password_unlock_status_${completedInstagramInvestigation.id}`;
    const unlockAcceleratedKey = `password_unlock_accelerated_${completedInstagramInvestigation.id}`;
    
    localStorage.setItem(unlockStartKey, startTime.toString());
    localStorage.setItem(unlockProgressKey, '1'); // ✅ Começa em 1%
    localStorage.setItem(unlockStatusKey, 'processing');
    localStorage.setItem(unlockAcceleratedKey, 'false');
    
    setPasswordUnlockStatus('processing');
    setPasswordUnlockProgress(1); // ✅ Começa em 1%
    
    // Atualizar progresso a cada minuto
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    
    setRemainingHours(36);
    
    progressIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = now - startTime;
      const totalDurationMs = 36 * 60 * 60 * 1000; // 36 horas
      
      // ✅ Progresso MUITO RÁPIDO no início, lento no final
      const linearProgress = elapsed / totalDurationMs;
      let adjustedProgress;
      if (linearProgress < 0.2) {
        // Primeiros 20% = 1% a 60% (MUITO RÁPIDO)
        adjustedProgress = 1 + (linearProgress / 0.2) * 59;
      } else if (linearProgress < 0.6) {
        // 20-60% = 60% a 85% (normal)
        adjustedProgress = 60 + ((linearProgress - 0.2) / 0.4) * 25;
      } else {
        // 60-100% = 85% a 100% (lento)
        adjustedProgress = 85 + ((linearProgress - 0.6) / 0.4) * 15;
      }
      
      const progress = Math.min(100, Math.max(1, Math.round(adjustedProgress)));
      const remaining = Math.max(0, Math.ceil((totalDurationMs - elapsed) / (60 * 60 * 1000)));
      
      setPasswordUnlockProgress(progress);
      setRemainingHours(remaining);
      localStorage.setItem(unlockProgressKey, progress.toString());
      
      if (progress >= 100) {
        finalizePasswordUnlock();
      }
    }, 60000); // Atualizar a cada minuto
  };

  const handleAcceleratePasswordUnlock = async () => {
    playSound('click');
    
    if (!userProfile || userProfile.credits < 30) {
      playSound('error');
      setAlertConfig({
        title: "Créditos Insuficientes",
        message: "Você precisa de 30 créditos para acelerar o desbloqueio.",
        confirmText: "Comprar Créditos",
        onConfirm: () => {
          setShowAlertModal(false);
          navigate(createPageUrl("BuyCredits"));
        }
      });
      setShowAlertModal(true);
      return;
    }

    if (!completedInstagramInvestigation) return;

    playSound('unlock');
    await base44.entities.UserProfile.update(userProfile.id, {
      credits: userProfile.credits - 30,
      xp: (userProfile.xp || 0) + 20
    });
    queryClient.invalidateQueries(['userProfile', user?.email]);

    setCreditsSpent(30);
    setXpGained(20);
    setShowCreditAlert(true);
    setTimeout(() => setShowCreditAlert(false), 3000);

    const unlockStatusKey = `password_unlock_status_${completedInstagramInvestigation.id}`;
    const unlockProgressKey = `password_unlock_progress_${completedInstagramInvestigation.id}`;
    const unlockAcceleratedKey = `password_unlock_accelerated_${completedInstagramInvestigation.id}`;

    const boost = Math.floor(Math.random() * 11) + 20; // 20-30%
    const baseProgress = passwordUnlockProgress || 0;
    const acceleratedProgress = Math.min(100, baseProgress + boost);

    const acceleratedFlag = true;
    setPasswordUnlockStatus('processing');
    setPasswordUnlockProgress(acceleratedProgress);

    const estimatedRemainingHours = Math.max(0, Math.ceil((100 - acceleratedProgress) * 0.36));
    setRemainingHours(estimatedRemainingHours);

    localStorage.setItem(unlockStatusKey, 'processing');
    localStorage.setItem(unlockProgressKey, acceleratedProgress.toString());
    localStorage.setItem(unlockAcceleratedKey, 'true');

    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    // Reiniciar intervalo com base no novo progresso acelerado
    progressIntervalRef.current = setInterval(() => {
      const savedStartKey = `password_unlock_start_${completedInstagramInvestigation.id}`;
      const storedStart = parseInt(localStorage.getItem(savedStartKey) || Date.now().toString(), 10);
      const totalDurationMs = 36 * 60 * 60 * 1000;
      const elapsed = Date.now() - storedStart;
      const progress = Math.min(100, Math.round((elapsed / totalDurationMs) * 100));
      const mergedProgress = Math.max(progress, acceleratedProgress);
      const remaining = Math.max(0, Math.ceil((totalDurationMs - elapsed) / (60 * 60 * 1000)));

      setPasswordUnlockProgress(mergedProgress);
      setRemainingHours(remaining);
      localStorage.setItem(unlockProgressKey, mergedProgress.toString());

      if (mergedProgress >= 100) {
        finalizePasswordUnlock();
      }
    }, 60000);

    if (acceleratedProgress >= 100) {
      finalizePasswordUnlock();
    }
  };

  const handleDeleteInvestigation = () => {
    playSound('trash');
    if (!completedInstagramInvestigation) return;
    setShowConfirmDelete(true);
  };

  const confirmDelete = async () => {
    playSound('trash');
    if (!completedInstagramInvestigation) return;

    try {
      localStorage.removeItem(`instagram_start_${completedInstagramInvestigation.id}`);
      localStorage.removeItem(`accelerate_shown_${completedInstagramInvestigation.id}`);
      localStorage.removeItem(`password_unlock_start_${completedInstagramInvestigation.id}`);
      localStorage.removeItem(`password_unlock_progress_${completedInstagramInvestigation.id}`);
      localStorage.removeItem(`password_unlock_status_${completedInstagramInvestigation.id}`);
      localStorage.removeItem(`password_unlock_accelerated_${completedInstagramInvestigation.id}`);
      
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }

      await base44.entities.Investigation.delete(completedInstagramInvestigation.id);
      
      queryClient.setQueryData(['investigations', user?.email], (oldData) => {
        if (!oldData) return [];
        return oldData.filter(inv => inv.id !== completedInstagramInvestigation.id);
      });
      
      await queryClient.invalidateQueries(['investigations', user?.email]);
      
      setShowConfirmDelete(false);
      navigate(createPageUrl("Dashboard"));
    } catch (error) {
      console.error("Erro ao deletar:", error);
      playSound('error');
      setAlertConfig({
        title: "Erro ao deletar investigação",
        message: "Ocorreu um erro ao tentar deletar a investigação. Por favor, tente novamente.",
        confirmText: "Ok",
        onConfirm: () => setShowAlertModal(false)
      });
      setShowAlertModal(true);
      setShowConfirmDelete(false);
    }
  };

  if (!completedInstagramInvestigation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0] flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#FF6B55] mx-auto" />
          <p className="text-sm text-gray-600 mt-3">Carregando investigação...</p>
        </div>
      </div>
    );
  }

  if (showIntroSequence) {
    const steps = [
      {
        text: `Invadindo Instagram de ${targetUsername}...`,
        subtext: 'Conectando aos servidores...',
        color: 'orange',
        icon: 'pulse'
      },
      {
        text: 'Testando combinações de senha',
        subtext: passwordAttempt,
        color: 'blue',
        icon: 'spin'
      },
      {
        text: '✓ Senha Encontrada!',
        subtext: 'Acesso obtido com sucesso',
        color: 'green',
        icon: 'check'
      },
      {
        text: 'Fazendo login...',
        subtext: 'Autenticando credenciais',
        color: 'blue',
        icon: 'spin'
      },
      {
        text: '✗ Erro: Autenticação de 2 Fatores',
        subtext: 'Email de verificação necessário',
        color: 'red',
        icon: 'error'
      }
    ];

    const currentStep = steps[introStep];
    const colorClasses = {
      orange: { bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200', bar: 'from-orange-400 to-orange-500' },
      blue: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200', bar: 'from-blue-400 to-blue-500' },
      green: { bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-200', bar: 'from-green-400 to-green-500' },
      red: { bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-200', bar: 'from-red-400 to-red-500' }
    };
    const colors = colorClasses[currentStep.color];

    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0] flex items-center justify-center p-6">
        <div className={`max-w-sm w-full bg-white rounded-2xl p-6 shadow-lg border-2 ${colors.border} transition-all duration-500`}>
          <div className="flex items-center justify-center mb-4">
            <div className={`w-14 h-14 rounded-full ${colors.bg} flex items-center justify-center ${currentStep.icon === 'pulse' ? 'animate-pulse' : currentStep.icon === 'spin' ? 'animate-spin' : ''}`}>
              {currentStep.icon === 'check' ? (
                <div className="text-3xl">✓</div>
              ) : currentStep.icon === 'error' ? (
                <div className="text-3xl">✗</div>
              ) : (
                <InstagramAppIcon size="md" className="flex-shrink-0" />
              )}
            </div>
          </div>
          <p className="text-center text-xs uppercase tracking-[0.3em] text-gray-500 mb-3">
            {introStep < 4 ? 'Processo em andamento' : 'Erro detectado'}
          </p>
          <p className={`text-center text-base font-bold ${colors.text} mb-2 transition-all duration-300`}>
            {currentStep.text}
          </p>
          <p className="text-center text-xs text-gray-600 font-mono h-5">
            {currentStep.subtext}
          </p>
          <div className="mt-6 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${colors.bar} transition-all duration-1000 ease-out`}
              style={{ width: `${((introStep + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-3 py-3 flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate(createPageUrl("Dashboard"))} className="h-9 px-3 hover:bg-gray-100" size="sm">
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
          {/* ALERTA DE EMAIL BLOQUEADO */}
          <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-300 p-5 mb-3">
            <div className="flex items-start gap-3 mb-3">
              <InstagramAppIcon size="md" className="flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-base font-bold text-gray-900 mb-2">✅ Senha Descoberta | ❌ Falta o Email</h3>
                
                <div className="bg-green-50 border-l-4 border-green-500 p-2 mb-2 rounded">
                  <p className="text-xs text-green-800 font-bold">
                    ✓ Senha do Instagram descoberta com sucesso!
                  </p>
                </div>
                
                <div className="bg-red-50 border-l-4 border-red-500 p-2 mb-2 rounded">
                  <p className="text-xs text-red-800 font-bold mb-1">
                    ✗ Precisa do email para fazer login
                  </p>
                  <p className="text-xs text-red-700">
                    O Instagram está pedindo um <span className="font-bold">código de verificação que foi enviado para o email</span> abaixo. <span className="font-bold">Ainda NÃO temos acesso a esse email.</span>
                  </p>
                </div>
                
                <div className="bg-white rounded-lg p-3 mt-2 border-2 border-yellow-300">
                  <p className="text-xs text-gray-600 mb-1">📧 Email necessário:</p>
                  <p className="text-sm font-mono font-bold text-gray-900 mb-2">{getMaskedEmail}</p>
                  <p className="text-xs text-orange-600 font-bold">
                    ⚠️ Você precisa desbloquear esse email para pegar o código!
                  </p>
                </div>
              </div>
            </div>

            {passwordUnlockStatus === 'idle' ? (
              <>
                <div className="bg-blue-50 rounded-lg p-3 mb-3 border-2 border-blue-300">
                  <p className="text-xs text-blue-900 font-bold mb-2">
                    💡 O que vai acontecer agora:
                  </p>
                  <ul className="text-xs text-blue-800 space-y-2 ml-1">
                    <li className="flex items-start gap-2">
                      <span className="font-bold">1.</span>
                      <span>Vamos <span className="font-bold">invadir o email {getMaskedEmail}</span></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold">2.</span>
                      <span>Pegar o <span className="font-bold">código de verificação</span> que o Instagram enviou</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold">3.</span>
                      <span>Fazer login no Instagram com a senha + código</span>
                    </li>
                  </ul>
                  <p className="text-xs text-blue-700 mt-2 font-semibold">
                    ⏱️ Tempo estimado: até 36 horas
                  </p>
                </div>
                
                <Button
                  onClick={handleUnlockPassword}
                  className="w-full h-12 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold text-sm rounded-xl shadow-lg"
                >
                  <Lock className="w-4 h-4 mr-2" />
                  🔓 Desbloquear Email Agora - 50 créditos
                </Button>
              </>
            ) : passwordUnlockStatus === 'processing' ? (
              <div className="bg-blue-50 border border-blue-300 rounded-lg p-4">
                <div className="flex items-start gap-3 mb-3">
                  <Loader2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5 animate-spin" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-blue-900 mb-1">Desbloqueando Email...</p>
                    <p className="text-xs text-blue-700 leading-relaxed mb-3">
                      Tentando acessar {getMaskedEmail} para obter código de verificação.
                    </p>
                    
                    {/* Barra de progresso */}
                    <div className="w-full bg-blue-200 rounded-full h-2 mb-2">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${passwordUnlockProgress}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-blue-600 font-medium">{passwordUnlockProgress}% concluído</p>
                    
                    {/* Tempo restante estimado */}
                    <p className="text-xs text-blue-600 mt-2">
                      ⏱️ Tempo restante: aproximadamente {remainingHours} horas
                    </p>
                  </div>
                </div>
                
                {passwordUnlockStatus === 'processing' && passwordUnlockProgress < 100 && (
                  <Button
                    onClick={handleAcceleratePasswordUnlock}
                    className="w-full h-9 bg-gradient-to-r from-[#FF6B55] to-[#FF9478] hover:from-[#FF7D64] hover:to-[#ffa891] text-white text-xs rounded-lg"
                  >
                    Acelerar desbloqueio - 30 créditos
                  </Button>
                )}
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3 mb-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-red-800 mb-2">🔒 Acesso Temporariamente Bloqueado</p>
                    <p className="text-xs text-gray-700 leading-relaxed mb-2">
                      Conseguimos acessar o email {getMaskedEmail}, porém o provedor <span className="font-bold">detectou atividade suspeita e bloqueou temporariamente</span> o acesso por medidas de segurança.
                    </p>
                    <div className="bg-white rounded-lg p-2 border border-yellow-200 mb-2">
                      <p className="text-xs font-bold text-gray-900 mb-1">⏰ Por que voltar mais tarde?</p>
                      <p className="text-xs text-gray-600">
                        Bloqueios temporários são removidos automaticamente após 12-24 horas. Nossa equipe está monitorando e tentará novamente assim que o bloqueio for liberado.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-3 border border-red-100">
                  <p className="text-xs text-gray-600 mb-1">Status do desbloqueio</p>
                  <p className="text-sm font-semibold text-gray-900">{passwordUnlockProgress}% concluído antes do bloqueio</p>
                  <p className="text-xs text-blue-600 mt-2">✓ Você será notificado quando houver novidades</p>
                </div>
              </div>
            )}
          </Card>

          {passwordUnlockStatus === 'failed' && (
            <Card className="bg-gradient-to-br from-[#FFF0EA] via-[#FFE8DE] to-[#FFE0D2] border-0 shadow-md p-5 mb-3">
              <h3 className="text-sm font-bold text-gray-900 mb-3">Estamos monitorando</h3>
              <ul className="text-xs text-gray-700 space-y-2">
                <li>• Vamos refazer a tentativa automaticamente nas próximas horas.</li>
                <li>• Você receberá um alerta caso a senha seja liberada.</li>
                <li>• Aproveite os demais dados do relatório enquanto aguardamos a liberação.</li>
              </ul>
            </Card>
          )}

          {/* INFORMAÇÕES BÁSICAS DISPONÍVEIS */}
          <Card className="bg-white border-0 shadow-md p-4 mb-3">
            <h3 className="text-sm font-bold text-gray-900 mb-3">📊 Informações Básicas</h3>
            
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Nome de usuário</p>
                <p className="text-sm font-bold text-gray-900">@{completedInstagramInvestigation.target_username}</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Status da Conta</p>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <p className="text-sm font-bold text-gray-900">Ativa</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Nível de Privacidade</p>
                <Badge className="bg-red-100 text-red-700 border-0 text-xs">
                  Alto • Criptografia Ativada
                </Badge>
              </div>
            </div>
          </Card>

          <Button
            onClick={handleDeleteInvestigation}
            variant="outline"
            className="w-full h-10 border border-red-200 text-red-600 hover:bg-red-50 font-medium text-sm rounded-xl mb-3"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Apagar essa investigação
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
        cancelText="Voltar"
        type="default"
      />
    </>
  );
}