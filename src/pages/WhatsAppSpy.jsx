
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, Loader2, Zap, Lock, AlertTriangle, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import WhatsAppIcon from "../components/icons/WhatsAppIcon";
import ConfirmModal from "../components/dashboard/ConfirmModal";
import Confetti from "../components/effects/Confetti";
import Particles from "../components/effects/Particles";
import Toast from "../components/effects/Toast";
import ScreenShake from "../components/effects/ScreenShake";

export default function WhatsAppSpy() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showCreditAlert, setShowCreditAlert] = useState(false);
  const [creditsSpent, setCreditsSpent] = useState(0);
  const [xpGained, setXpGained] = useState(0);
  const [showAccelerateButton, setShowAccelerateButton] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [unlockedSections, setUnlockedSections] = useState({});
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertConfig, setAlertConfig] = useState({});
  const autoStarted = useRef(false); // New: autoStarted useRef
  
  // ✅ Estados para efeitos
  const [showConfetti, setShowConfetti] = useState(false);
  const [showParticles, setShowParticles] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [shakeScreen, setShakeScreen] = useState(0);

  // ✅ USAR CACHE COMPARTILHADO DO USER
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: Infinity,
    cacheTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

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
    staleTime: Infinity, // ✅ CACHE INFINITO
    refetchOnWindowFocus: false, // ✅ DESATIVADO
    refetchOnMount: false, // ✅ DESATIVADO
  });

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
      } else if (type === 'complete') {
        const times = [0, 0.1, 0.2];
        const freqs = [523.25, 659.25, 783.99];
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

  const activeWhatsAppInvestigation = investigations.find(
    inv => inv.service_name === "WhatsApp" && (inv.status === "processing" || inv.status === "completed")
  );

  // ✅ RESET autoStarted QUANDO COMPONENTE É MONTADO
  useEffect(() => {
    autoStarted.current = false;
    return () => {
      autoStarted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!activeWhatsAppInvestigation) {
      setLoadingProgress(0);
    }
  }, [activeWhatsAppInvestigation]);

  // ✅ PROGRESSO - 7 DIAS - SEM ATUALIZAR CACHE A CADA SEGUNDO
  useEffect(() => {
    if (!activeWhatsAppInvestigation) {
      setLoadingProgress(0);
      return;
    }

    const investigationId = activeWhatsAppInvestigation.id;
    const startTimeKey = `whatsapp_start_${investigationId}`;
    
    if (!localStorage.getItem(startTimeKey)) {
      localStorage.setItem(startTimeKey, Date.now().toString());
    }

    const startTime = parseInt(localStorage.getItem(startTimeKey));
    const targetDuration = 604800000; // ✅ 7 DIAS em ms
    
    let lastSavedProgress = activeWhatsAppInvestigation.progress;
    
    const updateProgress = async () => {
      const elapsed = Date.now() - startTime;
      let calculatedProgress = Math.min(100, Math.floor((elapsed / targetDuration) * 100));
      
      calculatedProgress = Math.max(calculatedProgress, activeWhatsAppInvestigation.progress);
      
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
        if (activeWhatsAppInvestigation.status !== "completed" && activeWhatsAppInvestigation.status !== "accelerated") {
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
            playSound('complete');
            setShowConfetti(true);
            setToastMessage('Investigação Completa! 🎉');
            setToastType('success');
            setShowToast(true);
          } catch (error) {
            console.error("Erro ao completar investigação:", error);
          }
        }
      }
    };

    updateProgress();
    const timer = setInterval(updateProgress, 1000);
    
    return () => clearInterval(timer);
  }, [activeWhatsAppInvestigation?.id, activeWhatsAppInvestigation?.status, activeWhatsAppInvestigation?.progress, queryClient, user?.email, playSound]);

  useEffect(() => {
    if (!activeWhatsAppInvestigation) {
      setShowAccelerateButton(false);
      return;
    }
    if (loadingProgress < 1 || loadingProgress >= 100) {
      setShowAccelerateButton(false);
      return;
    }
    
    const storageKey = `accelerate_shown_${activeWhatsAppInvestigation.id}`;
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
  }, [activeWhatsAppInvestigation?.id, loadingProgress]);

  const startInvestigation = useCallback(async (phoneArg = phoneNumber) => { // Modified: added phoneArg
    playSound('click');
    
    const phone = phoneArg; // Use the argument or the state

    if (!phone || phone.replace(/\D/g, '').length < 10) {
      playSound('error');
      setAlertConfig({
        title: "Telefone Inválido",
        message: "Por favor, digite um número de telefone válido com DDD.",
        confirmText: "Ok",
        onConfirm: () => {
          playSound('click');
          setShowAlertModal(false);
        }
      });
      setShowAlertModal(true);
      return;
    }

    // ✅ VERIFICAR SE JÁ EXISTE INVESTIGAÇÃO (evitar duplicação)
    if (activeWhatsAppInvestigation) {
      return; // ✅ NÃO FAZER NADA SE JÁ EXISTE
    }

    if (!userProfile || userProfile.credits < 40) {
      playSound('error');
      setShakeScreen(prev => prev + 1);
      setAlertConfig({
        title: "Créditos Insuficientes",
        message: "Você precisa de 40 créditos para iniciar uma nova investigação.",
        confirmText: "Comprar Créditos",
        onConfirm: () => {
          playSound('click');
          setShowAlertModal(false);
          navigate(createPageUrl("BuyCredits"));
        },
        cancelText: "Voltar"
      });
      setShowAlertModal(true);
      return;
    }

    try {
      const updatedCredits = userProfile.credits - 40;
      const updatedXp = userProfile.xp + 25;

      await base44.entities.UserProfile.update(userProfile.id, {
        credits: updatedCredits,
        xp: updatedXp
      });
      // Invalidate profile query to refetch latest credits/xp
      queryClient.invalidateQueries({ queryKey: ['userProfile', user?.email] });
      
      await base44.entities.Investigation.create({
        service_name: "WhatsApp",
        target_username: phone,
        status: "processing",
        progress: 1,
        estimated_days: 7,
        is_accelerated: false,
        created_by: user.email,
      });
      
      queryClient.invalidateQueries({ queryKey: ['investigations', user?.email] }); // ✅ INVALIDAR PARA ATUALIZAR

      setCreditsSpent(40);
      setXpGained(25);
      setShowCreditAlert(true);
      setTimeout(() => setShowCreditAlert(false), 1500);
      
      await refetch();
    } catch (error) {
      console.error("Erro ao criar investigação:", error);
      playSound('error');
    }
  }, [phoneNumber, activeWhatsAppInvestigation, userProfile, navigate, refetch, user?.email, queryClient]);

  // ✅ AUTO-START - COM PROTEÇÃO CONTRA DUPLICAÇÃO
  useEffect(() => {
    if (autoStarted.current) return;
    if (!user || !userProfile || investigations.length === 0) return;
    
    // Se já tem investigação ativa ou completa, não precisa auto-start
    if (activeWhatsAppInvestigation) {
      autoStarted.current = true; // Mark as started even if no new inv is needed
      return;
    }
    
    autoStarted.current = true; // Mark as started to prevent re-execution

    // ✅ BUSCAR TELEFONE DE OUTRAS INVESTIGAÇÕES (SMS ou Chamadas)
    const smsInvestigation = investigations
      .filter(inv => inv.service_name === "SMS" && inv.target_username)
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
    
    const callsInvestigation = investigations
      .filter(inv => inv.service_name === "Chamadas" && inv.target_username)
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
    
    if (smsInvestigation || callsInvestigation) {
      const phone = smsInvestigation?.target_username || callsInvestigation?.target_username;
      if (phone) {
        setPhoneNumber(phone);
        // ✅ SMALL DELAY PARA GARANTIR QUE NÃO DUPLICA
        setTimeout(() => {
          startInvestigation(phone); // Pass phone directly for auto-start
        }, 500);
      }
    }
  }, [user, userProfile, investigations, activeWhatsAppInvestigation, startInvestigation]);

  // ✅ ACELERAR - 30 CRÉDITOS
  const handleAccelerate = async () => {
    playSound('turbo'); // ✅ SOM AO ACELERAR
    
    if (!activeWhatsAppInvestigation || !userProfile || userProfile.credits < 30) {
      playSound('error');
      setShakeScreen(prev => prev + 1);
      setAlertConfig({
        title: "Créditos Insuficientes",
        message: "Você precisa de 30 créditos para acelerar esta investigação.",
        confirmText: "Comprar Créditos",
        onConfirm: () => {
          playSound('click');
          setShowAlertModal(false);
          navigate(createPageUrl("BuyCredits"));
        },
        cancelText: "Voltar"
      });
      setShowAlertModal(true);
      return;
    }

    try {
      const updatedCredits = userProfile.credits - 30;
      const updatedXp = userProfile.xp + 30;

      await base44.entities.UserProfile.update(userProfile.id, {
        credits: updatedCredits,
        xp: updatedXp
      });
      queryClient.invalidateQueries({ queryKey: ['userProfile', user?.email] });

      // ✅ ACELERA ENTRE 14-20% (ALEATÓRIO)
      const accelerateAmount = Math.floor(Math.random() * 7) + 14; // 14 a 20
      const newProgress = Math.min(100, loadingProgress + accelerateAmount);
      setLoadingProgress(newProgress);
      // Update the local storage timestamp so the new progress is the "start" for future calculations
      localStorage.setItem(`whatsapp_start_${activeWhatsAppInvestigation.id}`, Date.now().toString());

      await base44.entities.Investigation.update(activeWhatsAppInvestigation.id, {
        progress: newProgress,
        status: newProgress >= 100 ? "completed" : "processing"
      });
      
      queryClient.setQueryData(['investigations', user?.email], (oldData) => {
        if (!oldData) return oldData;
        return oldData.map(inv => 
          inv.id === activeWhatsAppInvestigation.id ? { ...inv, progress: newProgress } : inv
        );
      });

      setCreditsSpent(30);
      setXpGained(30);
      setShowCreditAlert(true);
      setTimeout(() => setShowCreditAlert(false), 3000);
      
      // ✅ NÃO MOSTRAR TOAST/PARTÍCULAS SE MOSTRAR ALERT DE CRÉDITOS
      if (newProgress >= 100) {
        setShowConfetti(true);
      }

    } catch (error) {
      console.error("❌ Erro ao acelerar:", error);
      playSound('error');
      setAlertConfig({
        title: "Erro ao Acelerar",
        message: "Ocorreu um erro ao tentar acelerar a investigação. Por favor, tente novamente.",
        confirmText: "Ok",
        onConfirm: () => {
          playSound('click');
          setShowAlertModal(false);
        }
      });
      setShowAlertModal(true);
    }
  };

  const handleCancelInvestigation = async () => {
    playSound('trash');
    if (!activeWhatsAppInvestigation) return;
    setShowConfirmDelete(true);
  };

  const confirmDelete = async () => {
    playSound('trash');
    if (!activeWhatsAppInvestigation) return;
    
    try {
      localStorage.removeItem(`whatsapp_unlocked_${activeWhatsAppInvestigation.id}`);
      localStorage.removeItem(`whatsapp_start_${activeWhatsAppInvestigation.id}`); // Clear local start timestamp too
      setUnlockedSections({});
      
      await base44.entities.Investigation.delete(activeWhatsAppInvestigation.id);
      
      queryClient.setQueryData(['investigations', user?.email], (oldData) => {
        if (!oldData) return [];
        return oldData.filter(inv => inv.id !== activeWhatsAppInvestigation.id);
      });
      
      await queryClient.invalidateQueries({ queryKey: ['investigations'] });
      await new Promise(resolve => setTimeout(resolve, 300)); // Small delay for UI feedback
      
      setShowConfirmDelete(false);
      navigate(createPageUrl("Dashboard"));
    } catch (error) {
      console.error("Erro ao deletar:", error);
      playSound('error');
      setAlertConfig({
        title: "Erro ao Deletar",
        message: `Ocorreu um erro ao tentar deletar a investigação: ${error.message}`,
        confirmText: "Ok",
        onConfirm: () => {
          playSound('click');
          setShowAlertModal(false);
        }
      });
      setShowAlertModal(true);
    }
  };

  const handleUnlockSection = async (sectionKey, credits) => {
    playSound('click');
    
    if (!userProfile || userProfile.credits < credits) {
      playSound('error');
      setShakeScreen(prev => prev + 1);
      setAlertConfig({
        title: "Créditos Insuficientes",
        message: `Você precisa de ${credits} créditos para desbloquear este conteúdo.`,
        confirmText: "Comprar Créditos",
        onConfirm: () => {
          playSound('click');
          setShowAlertModal(false);
          navigate(createPageUrl("BuyCredits"));
        },
        cancelText: "Voltar"
      });
      setShowAlertModal(true);
      return;
    }

    try {
      
      await base44.entities.UserProfile.update(userProfile.id, {
        credits: userProfile.credits - credits,
        xp: userProfile.xp + (credits / 2) // Half credits as XP
      });
      
      queryClient.invalidateQueries({ queryKey: ['userProfile', user?.email] });
      
      const newUnlocked = { ...unlockedSections, [sectionKey]: true };
      setUnlockedSections(newUnlocked);
      
      if (activeWhatsAppInvestigation?.id) {
        localStorage.setItem(`whatsapp_unlocked_${activeWhatsAppInvestigation.id}`, JSON.stringify(newUnlocked));
      }
      
      setCreditsSpent(credits);
      setXpGained(credits / 2);
      setShowCreditAlert(true);
      setTimeout(() => setShowCreditAlert(false), 3000);
      
      setShowParticles(true);
      setToastMessage('Conteúdo Desbloqueado! ✨');
      setToastType('success');
      setShowToast(true);
    } catch (error) {
      console.error("Erro ao desbloquear seção:", error);
      playSound('error');
      setAlertConfig({
        title: "Erro ao Desbloquear",
        message: "Ocorreu um erro ao tentar desbloquear o conteúdo. Por favor, tente novamente.",
        confirmText: "Ok",
        onConfirm: () => {
          playSound('click');
          setShowAlertModal(false);
        }
      });
      setShowAlertModal(true);
    }
  };

  useEffect(() => {
    if (!activeWhatsAppInvestigation?.id) {
      setUnlockedSections({});
      return;
    }
    
    const savedUnlocked = localStorage.getItem(`whatsapp_unlocked_${activeWhatsAppInvestigation.id}`);
    if (savedUnlocked) {
      try {
        setUnlockedSections(JSON.parse(savedUnlocked));
      } catch (error) {
        console.error("Erro ao carregar seções desbloqueadas:", error);
      }
    }
  }, [activeWhatsAppInvestigation?.id]);

  const getSteps = (progress) => {
    const steps = [
      { id: 1, text: "Conectando ao servidor seguro...", threshold: 0 },
      { id: 2, text: "Acessando conversas criptografadas...", threshold: 15 },
      { id: 3, text: "Sincronizando mensagens e histórico...", threshold: 35 },
      { id: 4, text: "Baixando mídias (fotos, vídeos, áudios)...", threshold: 55 },
      { id: 5, text: "Analisando contatos e grupos...", threshold: 75 },
      { id: 6, text: "Gerando relatório final...", threshold: 90 }
    ];

    return steps.map(step => ({
      ...step,
      completed: progress > step.threshold + 5,
      active: progress >= step.threshold && progress <= step.threshold + 15
    }));
  };

  // ✅ TELA INICIAL - SOLICITAR TELEFONE
  if (!activeWhatsAppInvestigation) {
    return (
      <>
        <ScreenShake trigger={shakeScreen} />
        <Toast show={showToast} message={toastMessage} type={toastType} onClose={() => setShowToast(false)} />
        <Particles show={showParticles} />
        
        <div className="min-h-screen bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
          <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
            <div className="max-w-3xl mx-auto px-3 py-3 flex items-center justify-between">
              <Button variant="ghost" onClick={() => { playSound('click'); navigate(createPageUrl("Dashboard")); }} className="h-9 px-3 hover:bg-gray-100" size="sm">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Voltar
              </Button>
              <h1 className="text-base font-bold text-gray-900">WhatsApp Spy</h1>
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
                <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-400 to-green-500 flex items-center justify-center">
                    <WhatsAppIcon className="w-6 h-6" color="white" />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-base font-semibold text-gray-700 mb-2">
                    Digite o número de telefone
                  </label>
                  <input
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={phoneNumber}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      if (value.length <= 11) {
                        let formatted = value;
                        if (value.length > 2) {
                          formatted = `(${value.slice(0, 2)}) ${value.slice(2)}`;
                        }
                        if (value.length > 7) {
                          formatted = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
                        }
                        setPhoneNumber(formatted);
                      }
                    }}
                    onKeyPress={(e) => e.key === 'Enter' && startInvestigation()}
                    className="w-full h-12 px-4 text-base border-2 border-green-200 focus:border-green-400 focus:ring-green-400 rounded-xl"
                  />
                </div>

                <Button
                  onClick={() => startInvestigation()}
                  disabled={!phoneNumber || phoneNumber.replace(/\D/g, '').length < 10}
                  className="w-full h-12 bg-gradient-to-r from-green-400 to-green-500 hover:from-green-500 hover:to-green-600 text-white font-bold text-base rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Iniciar Investigação - 45 créditos
                </Button>

                <div className="text-center text-xs text-gray-500">
                  <p>Tempo estimado: 7 dias</p>
                </div>
              </div>
            </Card>
          </div>

          <ConfirmModal
            isOpen={showAlertModal}
            onConfirm={alertConfig.onConfirm || (() => { playSound('click'); setShowAlertModal(false); })}
            onCancel={() => { playSound('click'); setShowAlertModal(false); }}
            title={alertConfig.title}
            message={alertConfig.message}
            confirmText={alertConfig.confirmText}
            cancelText={alertConfig.cancelText || "Voltar"}
            type="default"
          />
        </div>
      </>
    );
  }

  // ✅ LOADING STATE - MOSTRA 7 DIAS
  if (activeWhatsAppInvestigation && loadingProgress < 100) {
    const steps = getSteps(loadingProgress);
    
    return (
      <>
        <Confetti show={showConfetti} onComplete={() => setShowConfetti(false)} />
        <ScreenShake trigger={shakeScreen} />
        <Toast show={showToast} message={toastMessage} type={toastType} onClose={() => setShowToast(false)} />
        <Particles show={showParticles} />
        
        <div className="min-h-screen bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
          <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
            <div className="max-w-3xl mx-auto px-3 py-3 flex items-center justify-between">
              <Button variant="ghost" onClick={() => { playSound('click'); navigate(createPageUrl("Dashboard")); }} className="h-9 px-3 hover:bg-gray-100" size="sm">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Voltar
              </Button>
              <h1 className="text-base font-bold text-gray-900">WhatsApp Spy</h1>
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
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-400 to-green-500 flex items-center justify-center">
                  <WhatsAppIcon className="w-6 h-6" color="white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900">Investigando WhatsApp</h3>
                  <p className="text-xs text-gray-600">Acessando conversas...</p>
                </div>
                <Badge className="bg-orange-100 text-orange-700 border-0 flex-shrink-0">
                  {loadingProgress}%
                </Badge>
              </div>

              <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                <div
                  className="h-2 rounded-full transition-all duration-1000 bg-gradient-to-r from-green-400 to-green-500"
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
                    <span className="font-bold">⏳ Investigação em andamento</span><br/>
                    Tempo estimado: 7 dias
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {showAccelerateButton && (
                  <Button 
                    onClick={handleAccelerate}
                    className="w-full h-10 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold text-sm rounded-lg shadow-sm"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Acelerar - 30 créditos
                  </Button>
                )}
                
                <Button
                  onClick={handleCancelInvestigation}
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
                <button onClick={() => { playSound('click'); setShowCreditAlert(false); }} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
            </div>
          )}

          <ConfirmModal
            isOpen={showConfirmDelete}
            onConfirm={confirmDelete}
            onCancel={() => { playSound('click'); setShowConfirmDelete(false); }}
            title="Apagar Investigação?"
            message="⚠️ Todos os dados desta investigação serão perdidos permanentemente, e os créditos gastos não serão reembolsados."
            confirmText="Sim, apagar"
            cancelText="Cancelar"
            type="danger"
          />

          <ConfirmModal
            isOpen={showAlertModal}
            onConfirm={alertConfig.onConfirm || (() => { playSound('click'); setShowAlertModal(false); })}
            onCancel={() => { playSound('click'); setShowAlertModal(false); }}
            title={alertConfig.title}
            message={alertConfig.message}
            confirmText={alertConfig.confirmText}
            cancelText={alertConfig.cancelText || "Voltar"}
            type="default"
          />
        </div>
      </>
    );
  }

  // ✅ TELA DE RESULTADOS COM EFEITOS
  if (activeWhatsAppInvestigation && loadingProgress >= 100) {
    return (
      <>
        <Confetti show={showConfetti} onComplete={() => setShowConfetti(false)} />
        <ScreenShake trigger={shakeScreen} />
        <Toast show={showToast} message={toastMessage} type={toastType} onClose={() => setShowToast(false)} />
        <Particles show={showParticles} />
        
        <div className="min-h-screen bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
          <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
            <div className="max-w-3xl mx-auto px-3 py-3 flex items-center justify-between">
              <Button variant="ghost" onClick={() => { playSound('click'); navigate(createPageUrl("Dashboard")); }} className="h-9 px-3 hover:bg-gray-100" size="sm">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Voltar
              </Button>
              <h1 className="text-base font-bold text-gray-900">WhatsApp Spy</h1>
              {userProfile && (
                <div className="flex items-center gap-1 bg-orange-50 rounded-full px-3 py-1 border border-orange-200">
                  <Zap className="w-3 h-3 text-orange-500" />
                  <span className="text-sm font-bold text-gray-900">{userProfile.credits}</span>
                </div>
              )}
            </div>
          </div>

          <div className="w-full max-w-3xl mx-auto p-3">
            <div className="bg-gradient-to-r from-green-400 to-green-500 border border-green-200 rounded-xl p-4 mb-3 text-white">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5" />
                <p className="font-bold text-sm">Investigação Completa!</p>
              </div>
              <p className="text-xs opacity-90">Dados do WhatsApp coletados com sucesso</p>
            </div>

            <Card className="bg-white border-0 shadow-lg p-4 mb-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-900">📱 Conversas Recentes</h3>
                {!unlockedSections.messages && (
                  <Button
                    onClick={() => handleUnlockSection('messages', 40)}
                    size="sm"
                    className="h-8 bg-gradient-to-r from-green-400 to-green-500 hover:from-green-500 hover:to-green-600 text-white text-xs"
                  >
                    <Lock className="w-3 h-3 mr-1" />
                    Desbloquear - 40 créditos
                  </Button>
                )}
              </div>
              
              {unlockedSections.messages ? (
                <div className="space-y-2">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm font-bold text-gray-900 mb-1">Maria Silva</p>
                    <p className="text-xs text-gray-600">Tá livre hoje à noite? 👀</p>
                    <p className="text-[10px] text-gray-400 mt-1">Hoje às 14:32</p>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm font-bold text-gray-900 mb-1">João Santos</p>
                    <p className="text-xs text-gray-600">Vamos marcar aquele lance... 🤝</p>
                    <p className="text-[10px] text-gray-400 mt-1">Ontem às 22:15</p>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm font-bold text-gray-900 mb-1">Ana Costa</p>
                    <p className="text-xs text-gray-600">Oi amor, me liga quando puder 💕</p>
                    <p className="text-[10px] text-gray-400 mt-1">2 dias atrás</p>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-100 rounded-lg p-4 text-center">
                  <Lock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-xs text-gray-600">Conteúdo bloqueado</p>
                </div>
              )}
            </Card>

            <Card className="bg-white border-0 shadow-lg p-4 mb-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-900">📸 Fotos Enviadas</h3>
                {!unlockedSections.photos && (
                  <Button
                    onClick={() => handleUnlockSection('photos', 35)}
                    size="sm"
                    className="h-8 bg-gradient-to-r from-green-400 to-green-500 hover:from-green-500 hover:to-green-600 text-white text-xs"
                  >
                    <Lock className="w-3 h-3 mr-1" />
                    Desbloquear - 35 créditos
                  </Button>
                )}
              </div>
              
              {unlockedSections.photos ? (
                <div className="grid grid-cols-3 gap-2">
                  {[1,2,3,4,5,6].map((i) => (
                    <div key={i} className="aspect-square bg-gray-200 rounded-lg relative overflow-hidden">
                      <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs">
                        Foto {i}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-100 rounded-lg p-4 text-center">
                  <Lock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-xs text-gray-600">Conteúdo bloqueado</p>
                </div>
              )}
            </Card>

            <Button
              onClick={handleCancelInvestigation}
              variant="outline"
              className="w-full h-10 border border-red-200 text-red-600 hover:bg-red-50 font-medium text-sm rounded-xl mb-4"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Apagar investigação
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
                <button onClick={() => { playSound('click'); setShowCreditAlert(false); }} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
            </div>
          )}

          <ConfirmModal
            isOpen={showConfirmDelete}
            onConfirm={confirmDelete}
            onCancel={() => { playSound('click'); setShowConfirmDelete(false); }}
            title="Apagar Investigação?"
            message="⚠️ Todos os dados desta investigação serão perdidos permanentemente, e os créditos gastos não serão reembolsados."
            confirmText="Sim, apagar"
            cancelText="Cancelar"
            type="danger"
          />

          <ConfirmModal
            isOpen={showAlertModal}
            onConfirm={alertConfig.onConfirm || (() => { playSound('click'); setShowAlertModal(false); })}
            onCancel={() => { playSound('click'); setShowAlertModal(false); }}
            title={alertConfig.title}
            message={alertConfig.message}
            confirmText={alertConfig.confirmText}
            cancelText={alertConfig.cancelText || "Voltar"}
            type="default"
          />
        </div>
      </>
    );
  }
  
  return null;
}
