
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Camera, CheckCircle2, Loader2, Zap, Video, Lock, Trash2, Image as ImageIcon, Mic, AlertTriangle, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ConfirmModal from "../components/dashboard/ConfirmModal";
import { useInvestigationTimer } from "@/hooks/useInvestigationTimer";
import { ensureTimer, getDurationForInvestigation, resetTimer, markCompleted } from "@/lib/progressManager";

export default function CameraSpy() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  // const [userProfile, setUserProfile] = useState(null); // Removed, now derived from useQuery
  const [showCreditAlert, setShowCreditAlert] = useState(false);
  const [creditsSpent, setCreditsSpent] = useState(0);
  const [xpGained, setXpGained] = useState(0);
  const autoStarted = useRef(false);
  const isCreating = useRef(false);
  const [accelerating, setAccelerating] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [visiblePhotos, setVisiblePhotos] = useState(12);
  const completionHandledRef = useRef(false);
  
  // ✅ ESTADOS DE DESBLOQUEIO
  const [unlockProgress, setUnlockProgress] = useState(0);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showUnlockAccelerate, setShowUnlockAccelerate] = useState(false);
  
  // ✅ ESTADOS DE CÂMERA AO VIVO
  const [isCameraActivating, setIsCameraActivating] = useState(false);
  const [cameraRetryTime, setCameraRetryTime] = useState(null);
  const [isCameraActivated, setIsCameraActivated] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertConfig, setAlertConfig] = useState({});

  // ✅ FOTOS FIXAS PADRÃO (sempre as mesmas) - FOTOS SEXY E ESPECÍFICAS
  const FIXED_PHOTOS = [
    { url: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=400", badge: 'SUSPEITO', date: 'Hoje, 23:45' },
    { url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400", badge: 'DELETADA', date: 'Ontem, 01:23' },
    { url: "https://images.unsplash.com/photo-1616349488528-42654c44bf0a?w=400", badge: 'SCREENSHOT', date: 'Hoje, 14:32' },
    { url: "https://images.unsplash.com/photo-1519677100203-a0e668c92439?w=400", badge: 'NOTURNA', date: '2 dias atrás, 22:15' },
    { url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400", badge: 'LOCAL', date: '3 dias atrás, 18:20' },
    { url: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400", badge: null, date: 'Hoje, 09:45' },
    { url: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400", badge: null, date: '5 dias atrás, 16:30' },
    { url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400", badge: null, date: '1 dia atrás, 12:10' },
    { url: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400", badge: null, date: '6 dias atrás, 20:05' },
    { url: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400", badge: null, date: '4 dias atrás, 11:22' },
    { url: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400", badge: null, date: '7 dias atrás, 15:40' },
    { url: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400", badge: null, date: 'Hoje, 08:15' },
    // +6 fotos extras
    { url: "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=400", badge: 'SUSPEITO', date: '8 dias atrás, 23:50' },
    { url: "https://images.unsplash.com/photo-1509967419530-da38b4704bc6?w=400", badge: null, date: '9 dias atrás, 10:30' },
    { url: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400", badge: 'DELETADA', date: '10 dias atrás, 19:15' },
    { url: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400", badge: null, date: '11 dias atrás, 13:25' },
    { url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400", badge: 'NOTURNA', date: '12 dias atrás, 22:40' },
    { url: "https://images.unsplash.com/photo-1504257432389-52343af06ae3?w=400", badge: null, date: '13 dias atrás, 17:55' },
    // +6 fotos finais
    { url: "https://images.unsplash.com/photo-1499952127939-9bbf5af6c51c?w=400", badge: null, date: '14 dias atrás, 09:10' },
    { url: "https://images.unsplash.com/photo-1617019114583-affb34d1b3cd?w=400", badge: 'SCREENSHOT', date: '15 dias atrás, 21:30' },
    { url: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=400", badge: null, date: '16 dias atrás, 14:20' },
    { url: "https://images.unsplash.com/photo-1542596594-649edbc13630?w=400", badge: null, date: '17 dias atrás, 11:45' },
    { url: "https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=400", badge: 'LOCAL', date: '18 dias atrás, 16:05' },
    { url: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=400", badge: null, date: '19 dias atrás, 12:35' }
  ];

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
      // Removed old userProfile fetch, now handled by useQuery
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
    staleTime: Infinity, // ✅ CACHE INFINITO
    refetchOnWindowFocus: false, // ✅ DESATIVADO
    refetchOnMount: false, // ✅ DESATIVADO
  });

  const activeCameraInvestigation = investigations.find(
    inv => inv.service_name === "Câmera" && (inv.status === "processing" || inv.status === "completed")
  );

  const {
    progress: timerProgress,
    canAccelerate,
    accelerate: accelerateTimer,
  } = useInvestigationTimer({ service: "Câmera", investigation: activeCameraInvestigation });

  const loadingProgress = timerProgress;
  const showAccelerateButton = canAccelerate && !accelerating && loadingProgress > 0 && loadingProgress < 100;

  useEffect(() => {
    if (!activeCameraInvestigation) return;
    ensureTimer({
      service: "Câmera",
      id: activeCameraInvestigation.id,
      durationMs: getDurationForInvestigation(activeCameraInvestigation),
      startAt: activeCameraInvestigation.created_date ? new Date(activeCameraInvestigation.created_date).getTime() : undefined,
    });
  }, [activeCameraInvestigation?.id, activeCameraInvestigation?.created_date, activeCameraInvestigation?.estimated_days]);

  useEffect(() => {
    if (!activeCameraInvestigation) {
      completionHandledRef.current = false;
      return;
    }

    if (timerProgress >= 100 && !completionHandledRef.current) {
      completionHandledRef.current = true;

      (async () => {
        try {
          await base44.entities.Investigation.update(activeCameraInvestigation.id, {
            progress: 100,
            status: "completed",
          });

          markCompleted({ service: "Câmera", id: activeCameraInvestigation.id });
          queryClient.invalidateQueries({ queryKey: ['investigations', user?.email] });
          await refetch();
        } catch (error) {
          console.error("Erro ao finalizar investigação da Câmera:", error);
          completionHandledRef.current = false;
        }
      })();
    }
  }, [timerProgress, activeCameraInvestigation?.id, queryClient, refetch, user?.email]);

  // ✅ CARREGAR ESTADOS SALVOS
  useEffect(() => {
    if (!activeCameraInvestigation) return;
    
    const storageKey = `camera_unlock_${activeCameraInvestigation.id}`;
    const savedUnlock = localStorage.getItem(storageKey);
    
    if (savedUnlock) {
      try {
        const data = JSON.parse(savedUnlock);
        if (data.unlocked) {
          setIsUnlocked(true);
          setUnlockProgress(100);
        } else if (data.unlocking) {
          setIsUnlocking(true);
          setUnlockProgress(data.progress || 0);
        }
      } catch (error) {
        console.error("Erro ao carregar estado de desbloqueio:", error);
      }
    }
    
    const cameraKey = `camera_live_${activeCameraInvestigation.id}`;
    const savedCamera = localStorage.getItem(cameraKey);
    
    if (savedCamera) {
      try {
        const data = JSON.parse(savedCamera);
        if (data.activated) {
          setIsCameraActivated(true);
          if (data.retryTime) {
            setCameraRetryTime(new Date(data.retryTime));
          }
        }
      } catch (error) {
        console.error("Erro ao carregar estado da câmera:", error);
      }
    }
  }, [activeCameraInvestigation?.id]);

  // ✅ CARREGAR FOTOS FIXAS (sempre as mesmas)
  useEffect(() => {
    if (activeCameraInvestigation && loadingProgress >= 100 && photos.length === 0) {
      setPhotos(FIXED_PHOTOS);
    }
  }, [activeCameraInvestigation?.id, loadingProgress, photos.length]);

  // ✅ PROGRESSO DE DESBLOQUEIO (7 DIAS)
  useEffect(() => {
    if (!isUnlocking || unlockProgress >= 100 || !activeCameraInvestigation) return;

    const interval = 604800000 / 100; // 7 dias dividido por 100 (7 * 24 * 60 * 60 * 1000 / 100)
    
    const timer = setInterval(() => {
      setUnlockProgress(prev => {
        const newProgress = Math.min(100, prev + 1);
        
        // ✅ SALVAR PROGRESSO
        const storageKey = `camera_unlock_${activeCameraInvestigation.id}`;
        localStorage.setItem(storageKey, JSON.stringify({
          unlocking: newProgress < 100,
          unlocked: newProgress >= 100,
          progress: newProgress
        }));
        
        if (newProgress >= 100) {
          setIsUnlocked(true);
          setIsUnlocking(false);
        }
        
        return newProgress;
      });
    }, interval);
    
    return () => clearInterval(timer);
  }, [isUnlocking, unlockProgress, activeCameraInvestigation?.id]);

  // ✅ MOSTRAR BOTÃO ACELERAR DESBLOQUEIO
  useEffect(() => {
    if (!isUnlocking || unlockProgress < 1 || unlockProgress >= 100) {
      setShowUnlockAccelerate(false);
      return;
    }
    
    const timer = setTimeout(() => {
      setShowUnlockAccelerate(true);
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [isUnlocking, unlockProgress]);

  // ✅ AUTO-START
  useEffect(() => {
    if (autoStarted.current || isCreating.current) return;
    if (!user || !userProfile) return; // userProfile needed for credits check
    
    const hasActiveInvestigation = investigations.some(
      inv => inv.service_name === "Câmera" && (inv.status === "processing" || inv.status === "completed")
    );
    
    if (hasActiveInvestigation) {
      autoStarted.current = true;
      return;
    }
    
    autoStarted.current = true;
    isCreating.current = true;
    
    (async () => {
      if (userProfile.credits < 55) {
        setAlertConfig({
          title: "Créditos Insuficientes",
          message: "Você precisa de 55 créditos para iniciar o acesso à câmera.",
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
      
      const updatedCredits = userProfile.credits - 55;
      const updatedXp = userProfile.xp + 30;

      await base44.entities.UserProfile.update(userProfile.id, {
        credits: updatedCredits,
        xp: updatedXp
      });
      // setUserProfile(prevProfile => ({ ...prevProfile, credits: updatedCredits, xp: updatedXp })); // Replaced
      await queryClient.invalidateQueries(['userProfile', user?.email]); // Invalidate to refetch updated profile
      
      await base44.entities.Investigation.create({
        service_name: "Câmera",
        target_username: "Dispositivo Alvo",
        status: "processing",
        progress: 1,
        estimated_days: 0,
        is_accelerated: false,
        created_by: user.email,
      });
      
      setCreditsSpent(55);
      setXpGained(30);
      setShowCreditAlert(true);
      setTimeout(() => setShowCreditAlert(false), 1500);
      
      await refetch(); // Refetch investigations
      isCreating.current = false;
    })();
  }, [user?.email, userProfile, investigations, navigate, refetch, queryClient]); // Added queryClient and userProfile to deps

  const startInvestigation = async () => {
    playSound('click');
    
    if (isCreating.current) return;

    const hasActiveInvestigation = investigations.some(
      inv => inv.service_name === "Câmera" && (inv.status === "processing" || inv.status === "completed")
    );

    if (hasActiveInvestigation) {
      playSound('error');
      setAlertConfig({
        title: "Investigação em Andamento",
        message: "Você já tem uma investigação de Câmera em andamento!",
        confirmText: "Ok"
      });
      setShowAlertModal(true);
      return;
    }

    if (!userProfile || userProfile.credits < 55) {
      playSound('error');
      setAlertConfig({
        title: "Créditos Insuficientes",
        message: "Você precisa de 55 créditos.",
        confirmText: "Comprar Créditos",
        onConfirm: () => {
          setShowAlertModal(false);
          navigate(createPageUrl("BuyCredits"));
        }
      });
      setShowAlertModal(true);
      return;
    }
    
    isCreating.current = true;

    const updatedCredits = userProfile.credits - 55;
    const updatedXp = userProfile.xp + 30;

    await base44.entities.UserProfile.update(userProfile.id, {
      credits: updatedCredits,
      xp: updatedXp
    });
    // setUserProfile(prevProfile => ({ ...prevProfile, credits: updatedCredits, xp: updatedXp })); // Replaced
    await queryClient.invalidateQueries(['userProfile', user?.email]); // Invalidate to refetch updated profile

    const newInvestigation = await base44.entities.Investigation.create({
      service_name: "Câmera",
      target_username: "Dispositivo Alvo",
      status: "processing",
      progress: 1,
      estimated_days: 0,
      is_accelerated: false,
      created_by: user.email,
    });
    ensureTimer({
      service: "Câmera",
      id: newInvestigation.id,
      durationMs: getDurationForInvestigation(newInvestigation),
      startAt: Date.now(),
    });

    setCreditsSpent(60);
    setXpGained(30);
    setShowCreditAlert(true);
    setTimeout(() => setShowCreditAlert(false), 1500);

    await refetch(); // Refetch investigations
    isCreating.current = false;
  };

  const handleAccelerate = async () => {
    playSound('turbo'); // ✅ ADICIONAR SOM
    
    if (!activeCameraInvestigation || !userProfile || userProfile.credits < 30) {
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

    try {
      setAccelerating(true);
      const updatedCredits = userProfile.credits - 30;
      const updatedXp = userProfile.xp + 40;

      await base44.entities.UserProfile.update(userProfile.id, {
        credits: updatedCredits,
        xp: updatedXp
      });
      await queryClient.invalidateQueries(['userProfile', user?.email]); // Invalidate to refetch updated profile

      const boost = Math.floor(Math.random() * 11) + 20; // 20% - 30%
      const newProgress = accelerateTimer(boost);

      await base44.entities.Investigation.update(activeCameraInvestigation.id, {
        progress: newProgress,
        status: newProgress >= 100 ? "completed" : "processing"
      });

      setCreditsSpent(30);
      setXpGained(40);
      setShowCreditAlert(true);
      setTimeout(() => setShowCreditAlert(false), 3000);

      setTimeout(() => refetch(), 500); // Refetch investigations
    } catch (error) {
      console.error("❌ Erro ao acelerar:", error);
      // alert("Erro ao acelerar. Tente novamente."); // Removed this alert as per outline
    } finally {
      setAccelerating(false);
    }
  };

  const handleDeleteInvestigation = async () => {
    playSound('trash');
    if (!activeCameraInvestigation) return;
    setShowConfirmDelete(true);
  };

  const confirmDelete = async () => {
    playSound('trash');
    if (!activeCameraInvestigation) return;
    
    try {
      // ✅ LIMPAR LOCALSTORAGE
      localStorage.removeItem(`camera_unlock_${activeCameraInvestigation.id}`);
      localStorage.removeItem(`camera_live_${activeCameraInvestigation.id}`);
      resetTimer({ service: "Câmera", id: activeCameraInvestigation.id });

      await base44.entities.Investigation.delete(activeCameraInvestigation.id);
      
      // ✅ INVALIDAR QUERY CORRETAMENTE
      queryClient.setQueryData(['investigations', user?.email], (oldData) => {
        if (!oldData) return [];
        return oldData.filter(inv => inv.id !== activeCameraInvestigation.id);
      });
      
      // Invalidate for good measure, will trigger refetch if enabled (but it's disabled for investigations)
      // This is mostly for any other components that might be using this query and not using setQueryData
      await queryClient.invalidateQueries(['investigations', user?.email]);
      
      setPhotos([]);
      setIsUnlocking(false);
      setIsUnlocked(false);
      setUnlockProgress(0);
      setVisiblePhotos(12);
      setCameraRetryTime(null);
      setIsCameraActivated(false);
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

  const handleUnlockPhotos = async () => {
    if (!userProfile || userProfile.credits < 70) {
      playSound('error');
      setAlertConfig({
        title: "Créditos Insuficientes",
        message: "Você precisa de 70 créditos.",
        confirmText: "Comprar Créditos",
        onConfirm: () => {
          setShowAlertModal(false);
          navigate(createPageUrl("BuyCredits"));
        }
      });
      setShowAlertModal(true);
      return;
    }

    playSound('unlock');
    await base44.entities.UserProfile.update(userProfile.id, {
      credits: userProfile.credits - 70,
      xp: userProfile.xp + 35
    });
    
    // setUserProfile(prev => ({ ...prev, credits: prev.credits - 70, xp: prev.xp + 35 })); // Replaced
    await queryClient.invalidateQueries(['userProfile', user?.email]); // Invalidate to refetch updated profile
    
    setCreditsSpent(70);
    setXpGained(35);
    setShowCreditAlert(true);
    setTimeout(() => setShowCreditAlert(false), 2000);
    
    // ✅ INICIAR PROGRESSO DE DESBLOQUEIO
    setIsUnlocking(true);
    setUnlockProgress(1); // Start progress at 1%
    
    if (activeCameraInvestigation) {
      const storageKey = `camera_unlock_${activeCameraInvestigation.id}`;
      localStorage.setItem(storageKey, JSON.stringify({
        unlocking: true,
        unlocked: false,
        progress: 1
      }));
    }
  };

  const handleUnlockMorePhotos = async () => {
    playSound('click');
    
    if (!userProfile || userProfile.credits < 20) {
      playSound('error');
      setAlertConfig({
        title: "Créditos Insuficientes",
        message: "Você precisa de 20 créditos.",
        confirmText: "Comprar Créditos",
        onConfirm: () => {
          setShowAlertModal(false);
          navigate(createPageUrl("BuyCredits"));
        }
      });
      setShowAlertModal(true);
      return;
    }

    playSound('unlock');
    await base44.entities.UserProfile.update(userProfile.id, {
      credits: userProfile.credits - 20,
      xp: userProfile.xp + 15
    });
    
    // setUserProfile(prev => ({ ...prev, credits: prev.credits - 20, xp: prev.xp + 15 })); // Replaced
    await queryClient.invalidateQueries(['userProfile', user?.email]); // Invalidate to refetch updated profile
    
    setVisiblePhotos(prev => Math.min(24, prev + 6));
    
    setCreditsSpent(20);
    setXpGained(15);
    setShowCreditAlert(true);
    setTimeout(() => setShowCreditAlert(false), 2000);
  };

  const handleActivateLive = async () => {
    if (!userProfile || userProfile.credits < 40) {
      playSound('error');
      setAlertConfig({
        title: "Créditos Insuficientes",
        message: "Você precisa de 40 créditos.",
        confirmText: "Comprar Créditos",
        onConfirm: () => {
          setShowAlertModal(false);
          navigate(createPageUrl("BuyCredits"));
        }
      });
      setShowAlertModal(true);
      return;
    }

    playSound('click');
    await base44.entities.UserProfile.update(userProfile.id, {
      credits: userProfile.credits - 40,
      xp: userProfile.xp + 30
    });
    
    // setUserProfile(prev => ({ ...prev, credits: prev.credits - 40, xp: prev.xp + 30 })); // Replaced
    await queryClient.invalidateQueries(['userProfile', user?.email]); // Invalidate to refetch updated profile
    
    setCreditsSpent(40);
    setXpGained(30);
    setShowCreditAlert(true);
    setTimeout(() => setShowCreditAlert(false), 2000);
    
    // ✅ SIMULAR ATIVAÇÃO
    setIsCameraActivating(true);
    
    setTimeout(() => {
      setIsCameraActivating(false);
      setIsCameraActivated(true); // Set camera activated state
      
      // ✅ DEFINIR TEMPO DE RETENTATIVA (3 horas)
      const retryTime = new Date(Date.now() + 3 * 60 * 60 * 1000);
      setCameraRetryTime(retryTime);
      
      // ✅ SALVAR ESTADO
      if (activeCameraInvestigation) {
        const cameraKey = `camera_live_${activeCameraInvestigation.id}`;
        localStorage.setItem(cameraKey, JSON.stringify({
          activated: true,
          retryTime: retryTime.toISOString()
        }));
      }
    }, 3000);
  };

  const handleAccelerateUnlock = async () => {
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
    await base44.entities.UserProfile.update(userProfile.id, {
      credits: userProfile.credits - 30,
      xp: userProfile.xp + 25
    });
    
    // setUserProfile(prev => ({ ...prev, credits: prev.credits - 30, xp: prev.xp + 25 })); // Replaced
    await queryClient.invalidateQueries(['userProfile', user?.email]); // Invalidate to refetch updated profile
    
    const newProgress = Math.min(100, unlockProgress + 19);
    setUnlockProgress(newProgress);
    
    // ✅ SALVAR PROGRESSO
    if (activeCameraInvestigation) {
      const storageKey = `camera_unlock_${activeCameraInvestigation.id}`;
      localStorage.setItem(storageKey, JSON.stringify({
        unlocking: newProgress < 100,
        unlocked: newProgress >= 100,
        progress: newProgress
      }));
      
      if (newProgress >= 100) {
        setIsUnlocked(true);
        setIsUnlocking(false);
      }
    }
    
    setCreditsSpent(30);
    setXpGained(25);
    setShowCreditAlert(true);
    setTimeout(() => setShowCreditAlert(false), 2000);
  };

  const getBadgeStyle = (badge) => {
    switch (badge) {
      case 'SUSPEITO': return 'bg-red-500 text-white';
      case 'DELETADA': return 'bg-orange-500 text-white';
      case 'SCREENSHOT': return 'bg-purple-500 text-white'; // Changed from blue-500
      case 'NOTURNA': return 'bg-indigo-700 text-white'; // Changed from purple-700
      case 'LOCAL': return 'bg-green-600 text-white';
      default: return '';
    }
  };

  const getBadgeIcon = (badge) => {
    switch (badge) {
      case 'SUSPEITO': return '🔥';
      case 'DELETADA': return '🗑️';
      case 'SCREENSHOT': return '📱'; // Changed from 💬
      case 'NOTURNA': return '🌙';
      case 'LOCAL': return '📍';
      default: return '';
    }
  };

  const getSteps = (progress) => {
    const steps = [
      { id: 1, text: "Conectando ao dispositivo...", threshold: 0 },
      { id: 2, text: "Ativando câmera frontal...", threshold: 10 },
      { id: 3, text: "Configurando transmissão...", threshold: 30 },
      { id: 4, text: "Capturando vídeo ao vivo...", threshold: 60 },
      { id: 5, text: "Salvando gravações...", threshold: 90 }
    ];

    return steps.map(step => ({
      ...step,
      completed: progress > step.threshold + 5,
      active: progress >= step.threshold && progress <= step.threshold + 10
    }));
  };

  // ✅ SE COMPLETOU, MOSTRAR RESULTADOS
  if (activeCameraInvestigation && loadingProgress >= 100) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-3 py-3 flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate(createPageUrl("Dashboard"))} className="h-9 px-3 hover:bg-gray-100" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Voltar
            </Button>
            <h1 className="text-base font-bold text-gray-900">Câmera</h1>
            {userProfile && (
              <div className="flex items-center gap-1 bg-orange-50 rounded-full px-3 py-1 border border-orange-200">
                <Zap className="w-3 h-3 text-orange-500" />
                <span className="text-sm font-bold text-gray-900">{userProfile.credits}</span>
              </div>
            )}
          </div>
        </div>

        <div className="w-full max-w-3xl mx-auto p-3">
          {/* ESTATÍSTICAS */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-0 shadow-md p-3 text-center">
              <ImageIcon className="w-5 h-5 text-green-600 mx-auto mb-1" />
              <p className="text-xl font-bold text-green-700">211</p>
              <p className="text-[10px] text-green-600 font-semibold">Fotos</p>
            </Card>

            <Card className="bg-gradient-to-br from-red-50 to-red-100 border-0 shadow-md p-3 text-center">
              <Trash2 className="w-5 h-5 text-red-600 mx-auto mb-1" />
              <p className="text-xl font-bold text-red-700">89</p>
              <p className="text-[10px] text-red-600 font-semibold">Deletadas</p>
            </Card>

            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-0 shadow-md p-3 text-center">
              <Camera className="w-5 h-5 text-blue-600 mx-auto mb-1" />
              <p className="text-xl font-bold text-blue-700">34</p>
              <p className="text-[10px] text-blue-600 font-semibold">Screenshots</p>
            </Card>
          </div>

          {/* GALERIA */}
          <Card className="bg-white border-0 shadow-md p-4 mb-3">
            <h3 className="text-sm font-bold text-gray-900 mb-3">📸 Galeria Completa ({FIXED_PHOTOS.length} fotos)</h3>
            
            <div className="grid grid-cols-3 gap-2">
              {photos.slice(0, visiblePhotos).map((photo, index) => (
                <div key={index} className="relative aspect-square rounded-xl overflow-hidden">
                  <img 
                    src={photo.url} 
                    alt="" 
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ filter: isUnlocked ? 'none' : 'blur(12px)' }}
                  />
                  
                  {photo.badge && (
                    <Badge className={`absolute top-1.5 left-1.5 ${getBadgeStyle(photo.badge)} border-0 text-[9px] px-1.5 py-0.5 shadow-lg`}>
                      {getBadgeIcon(photo.badge)} {photo.badge}
                    </Badge>
                  )}

                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm p-1.5">
                    <p className="text-[9px] text-white font-medium text-center">{photo.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* BOTÃO +6 FOTOS */}
          {visiblePhotos < FIXED_PHOTOS.length && (
            <Button
              onClick={handleUnlockMorePhotos}
              className="w-full h-11 mb-3 bg-gradient-to-r from-purple-400 to-purple-500 hover:from-purple-500 hover:to-purple-600 text-white font-bold text-sm rounded-xl shadow-lg"
            >
              <Zap className="w-4 h-4 mr-2" />
              Liberar mais 6 fotos - 20 créditos
            </Button>
          )}

          {/* ✅ DESBLOQUEAR FOTOS - COM PROGRESSO NA MESMA DIV */}
          {!isUnlocked && (
            <Card className="bg-gradient-to-br from-orange-50 to-pink-50 border-2 border-orange-200 p-5 mb-3">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center flex-shrink-0">
                  {isUnlocking ? (
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  ) : (
                    <Lock className="w-6 h-6 text-white" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-gray-900 mb-1">
                    {isUnlocking ? 'Desbloqueando Galeria' : 'Desbloquear Fotos e Vídeos'}
                  </h3>
                  <p className="text-xs text-gray-700">
                    {isUnlocking 
                      ? 'Estamos processando as fotos deletadas e arquivos corrompidos recuperados. Este processo pode levar até 7 dias para garantir a melhor qualidade.' 
                      : 'Acesse todas as 211 fotos e 156 vídeos da galeria completa'
                    }
                  </p>
                </div>
                {isUnlocking && (
                  <Badge className="bg-orange-100 text-orange-700 border-0 flex-shrink-0">
                    {unlockProgress}%
                  </Badge>
                )}
              </div>
              
              {isUnlocking && (
                <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                  <div
                    className="h-2 rounded-full transition-all duration-1000 bg-gradient-to-r from-orange-400 to-orange-500"
                    style={{ width: `${unlockProgress}%` }}
                  />
                </div>
              )}
              
              {!isUnlocking ? (
                <Button
                  onClick={handleUnlockPhotos}
                  className="w-full h-12 bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white font-bold text-sm rounded-xl shadow-lg"
                >
                  🔓 Desbloquear por 70 créditos
                </Button>
              ) : showUnlockAccelerate && (
                <Button 
                  onClick={handleAccelerateUnlock}
                  className="w-full h-9 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white text-xs rounded-lg"
                >
                  Acelerar - 30 créditos
                </Button>
              )}
            </Card>
          )}

          {/* ✅ CÂMERA E MICROFONE - SALVA ESTADO */}
          {!isCameraActivated ? (
            <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-200 p-5 mb-3">
              <Badge className="bg-orange-500 text-white border-0 text-xs mb-3 px-3 py-1">🔥 POPULAR</Badge>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                  {isCameraActivating ? (
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  ) : (
                    <Video className="w-6 h-6 text-white" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-gray-900 mb-1">Câmera + Microfone em Tempo Real</h3>
                  <p className="text-xs text-gray-700">
                    Acesse a câmera e microfone do dispositivo remotamente em tempo real
                  </p>
                </div>
              </div>
              
              {isCameraActivating && (
                <div className="bg-blue-100 border border-blue-300 rounded-lg p-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                    <p className="text-xs text-blue-900 font-semibold">Tentando ativar câmera...</p>
                  </div>
                </div>
              )}
              
              {!isCameraActivating && (
                <Button
                  onClick={handleActivateLive}
                  className="w-full h-12 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold text-sm rounded-xl shadow-lg"
                >
                  ⚡ Ativar por 40 créditos
                </Button>
              )}
            </Card>
          ) : (
            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-300 p-5 mb-3">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-gray-900 mb-1">Câmera Não Ativada</h3>
                  <p className="text-xs text-orange-700 mb-2">
                    O dispositivo está sem conexão com a internet no momento.
                  </p>
                  <p className="text-xs text-gray-700 mb-2">
                    Não se preocupe! Continuaremos tentando ativar automaticamente a cada algumas horas até que o dispositivo fique online.
                  </p>
                  {cameraRetryTime && (
                    <p className="text-xs text-orange-600 font-semibold">
                      🔄 Próxima tentativa automática: {cameraRetryTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          )}

          <div className="bg-orange-50 border-l-4 border-orange-400 p-3 rounded mb-3">
            <div className="flex gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-orange-900">
                <span className="font-bold">Atenção:</span> A maioria das fotos foram deletadas ou estão corrompidas. Os recursos podem não funcionar se o dispositivo estiver offline.
              </p>
            </div>
          </div>

          <Button 
            onClick={handleDeleteInvestigation}
            variant="outline" 
            className="w-full h-10 border border-red-200 text-red-600 hover:bg-red-50 font-medium text-sm rounded-xl"
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
    );
  }

  // ✅ SE TEM INVESTIGAÇÃO EM PROGRESSO
  if (activeCameraInvestigation) {
    const steps = getSteps(loadingProgress);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-3 py-3 flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate(createPageUrl("Dashboard"))} className="h-9 px-3 hover:bg-gray-100" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Voltar
            </Button>
            <h1 className="text-base font-bold text-gray-900">Câmera</h1>
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
                <Camera className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900">Acesso à Câmera e Galeria</h3>
                <p className="text-xs text-gray-600">Conectando...</p>
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

              {loadingProgress < 100 && (
                <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded mt-3">
                  <p className="text-xs text-blue-900">
                    <span className="font-bold">⏳ Acesso em andamento</span><br/>
                    Tempo estimado: 3 dias
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 space-y-2">
              {showAccelerateButton && loadingProgress < 100 && (
                <Button 
                  onClick={handleAccelerate}
                  disabled={accelerating}
                  className="w-full h-10 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold text-sm rounded-lg shadow-sm"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Acelerar por 30 créditos
                </Button>
              )}
              
              {loadingProgress < 100 && (
                <Button
                  onClick={handleDeleteInvestigation}
                  variant="outline"
                  className="w-full h-9 border-red-200 text-red-600 hover:bg-red-50 text-sm"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Apagar investigação
                </Button>
              )}
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
      </div>
    );
  }

  // ✅ TELA INICIAL
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-3 py-3 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(createPageUrl("Dashboard"))} className="h-9 px-3 hover:bg-gray-100" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Voltar
          </Button>
          <h1 className="text-base font-bold text-gray-900">Câmera</h1>
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
            <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center mx-auto mb-4 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Acesso à Câmera e Galeria</h2>
            <p className="text-sm text-gray-600">Visualize a câmera e todas as fotos do dispositivo</p>
          </div>

          <div className="bg-orange-50 border-l-4 border-orange-400 p-3 rounded mb-4">
            <div className="flex gap-2">
              <Lock className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-orange-900 mb-1">Recurso Premium</p>
                <p className="text-xs text-orange-700">Acesso completo à câmera ao vivo e galeria de fotos do dispositivo alvo.</p>
              </div>
            </div>
          </div>

          <Button
            onClick={startInvestigation}
            className="w-full h-12 bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white font-bold text-base rounded-xl shadow-lg"
          >
            <Video className="w-5 h-5 mr-2" />
            Ativar Câmera - 60 Créditos
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
    </div>
  );
}
