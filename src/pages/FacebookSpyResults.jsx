import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Facebook,
  ArrowLeft,
  Shield,
  Lock,
  Loader2,
  Zap,
  Trash2,
  Users,
  Globe,
  Image,
  AlertTriangle,
  MessageCircle
} from "lucide-react";
import ConfirmModal from "@/components/dashboard/ConfirmModal";
import { useInvestigationTimer } from "@/hooks/useInvestigationTimer";
import { ensureTimer, getDurationForInvestigation } from "@/lib/progressManager";

const PASSWORD_TOTAL_DURATION = 24 * 60 * 60 * 1000; // 24 horas
const PASSWORD_INITIAL_BOOST_DELAY = 2 * 60 * 1000; // 2 minutos

export default function FacebookSpyResults() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertConfig, setAlertConfig] = useState({});
  const [passwordStatus, setPasswordStatus] = useState('idle');
  const [passwordProgress, setPasswordProgress] = useState(0);
  const [remainingHours, setRemainingHours] = useState(24);
  const [isAccelerated, setIsAccelerated] = useState(false);
  const [accelerateCount, setAccelerateCount] = useState(0);
  const [acceleratingPassword, setAcceleratingPassword] = useState(false);
  const [messengerStatus, setMessengerStatus] = useState('locked');
  const [showCreditAlert, setShowCreditAlert] = useState(false);
  const [creditsSpent, setCreditsSpent] = useState(0);
  const [xpGained, setXpGained] = useState(0);
  const progressIntervalRef = useRef(null);
  const initialBoostTimeoutRef = useRef(null);

  const scheduleInitialBoost = useCallback((currentProgress, unlockProgressKey, unlockBoostKey, unlockStatusKey) => {
    if (initialBoostTimeoutRef.current) {
      clearTimeout(initialBoostTimeoutRef.current);
      initialBoostTimeoutRef.current = null;
    }

    if (currentProgress >= 10) {
      localStorage.setItem(unlockBoostKey, 'true');
      return;
    }

    initialBoostTimeoutRef.current = setTimeout(() => {
      const currentStatus = localStorage.getItem(unlockStatusKey);
      if (currentStatus !== 'processing') {
        initialBoostTimeoutRef.current = null;
        return;
      }

      setPasswordProgress((prev) => {
        if (prev >= 10) {
          localStorage.setItem(unlockBoostKey, 'true');
          return prev;
        }
        const boosted = Math.min(12, prev + Math.floor(Math.random() * 4) + 3);
        localStorage.setItem(unlockProgressKey, boosted.toString());
        const remainingBoosted = Math.max(0, Math.ceil(((100 - boosted) / 100) * 24));
        setRemainingHours(remainingBoosted);
        localStorage.setItem(unlockBoostKey, 'true');
        return boosted;
      });

      initialBoostTimeoutRef.current = null;
    }, PASSWORD_INITIAL_BOOST_DELAY);
  }, [setPasswordProgress, setRemainingHours]);

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

  const completedFacebookInvestigation = investigations.find(
    inv => inv.service_name === "Facebook" && (inv.status === "completed" || inv.status === "accelerated")
  );

  const activeFacebookInvestigation = investigations.find(
    inv => inv.service_name === "Facebook" && inv.status === "processing"
  );

  const {
    progress: timerProgress,
  } = useInvestigationTimer({ service: "Facebook", investigation: activeFacebookInvestigation });

  useEffect(() => {
    if (!completedFacebookInvestigation) return;

    const unlockStartKey = `facebook_password_start_${completedFacebookInvestigation.id}`;
    const unlockProgressKey = `facebook_password_progress_${completedFacebookInvestigation.id}`;
    const unlockStatusKey = `facebook_password_status_${completedFacebookInvestigation.id}`;
    const unlockAcceleratedKey = `facebook_password_accelerated_${completedFacebookInvestigation.id}`;
    const unlockAccelerationsKey = `facebook_password_accelerations_${completedFacebookInvestigation.id}`;
    const unlockBoostKey = `facebook_password_initial_boost_${completedFacebookInvestigation.id}`;
    const messengerStatusKey = `facebook_messenger_unlock_${completedFacebookInvestigation.id}`;

    const savedStatus = localStorage.getItem(unlockStatusKey);
    const savedProgress = parseInt(localStorage.getItem(unlockProgressKey) || '0', 10);
    const savedAccelerated = localStorage.getItem(unlockAcceleratedKey) === 'true';
    const savedStart = parseInt(localStorage.getItem(unlockStartKey) || '0', 10);
    const savedAccelerations = parseInt(localStorage.getItem(unlockAccelerationsKey) || '0', 10);
    const savedMessengerStatus = localStorage.getItem(messengerStatusKey) || 'locked';
    const savedBoostApplied = localStorage.getItem(unlockBoostKey) === 'true';

    setAccelerateCount(savedAccelerations);
    setMessengerStatus(savedMessengerStatus);

    if (savedStatus === 'completed' || savedStatus === 'accelerated' || savedStatus === 'failed') {
      setPasswordStatus('failed');
      setPasswordProgress(100);
      setIsAccelerated(savedAccelerated);
      setRemainingHours(0);
      localStorage.setItem(unlockStatusKey, 'failed');
      localStorage.setItem(unlockProgressKey, '100');
      localStorage.setItem(unlockBoostKey, 'true');
      return;
    }

    if (savedProgress > 0 && savedStart === 0) {
      setPasswordStatus('processing');
      setPasswordProgress(savedProgress);
      setIsAccelerated(savedAccelerated);
      const remainingFallback = Math.max(0, Math.ceil((100 - savedProgress) / 100 * 24));
      setRemainingHours(remainingFallback);
      if (!savedBoostApplied && savedProgress < 10) {
        scheduleInitialBoost(savedProgress, unlockProgressKey, unlockBoostKey, unlockStatusKey);
      }
      return;
    }

    if (savedStatus === 'processing' && savedStart > 0) {
      setPasswordStatus('processing');
      setIsAccelerated(savedAccelerated);

      const elapsed = Date.now() - savedStart;
      const computedProgress = Math.min(100, Math.floor((elapsed / PASSWORD_TOTAL_DURATION) * 100));
      const progress = Math.max(computedProgress, savedProgress);
      const remaining = Math.max(0, Math.ceil((PASSWORD_TOTAL_DURATION - elapsed) / (60 * 60 * 1000)));

      setPasswordProgress(progress);
      setRemainingHours(remaining);

      progressIntervalRef.current = setInterval(() => {
        const elapsedLoop = Date.now() - savedStart;
        const computed = Math.min(100, Math.floor((elapsedLoop / PASSWORD_TOTAL_DURATION) * 100));
        const merged = Math.max(computed, savedProgress);
        const remainingLoop = Math.max(0, Math.ceil((PASSWORD_TOTAL_DURATION - elapsedLoop) / (60 * 60 * 1000)));

        setPasswordProgress(merged);
        setRemainingHours(remainingLoop);
        localStorage.setItem(unlockProgressKey, merged.toString());

        if (merged >= 100) {
          setPasswordStatus('failed');
          setRemainingHours(0);
          localStorage.setItem(unlockStatusKey, 'failed');
          localStorage.setItem(unlockProgressKey, '100');
          localStorage.setItem(unlockBoostKey, 'true');
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
          }
        }
      }, 60000);

      if (!savedBoostApplied && progress < 10) {
        scheduleInitialBoost(progress, unlockProgressKey, unlockBoostKey, unlockStatusKey);
      }
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      if (initialBoostTimeoutRef.current) {
        clearTimeout(initialBoostTimeoutRef.current);
        initialBoostTimeoutRef.current = null;
      }
    };
  }, [completedFacebookInvestigation, scheduleInitialBoost]);

  const handleUnlockPassword = async () => {
    if (!userProfile || userProfile.credits < 50) {
      setAlertConfig({
        title: "Créditos insuficientes",
        message: "Você precisa de 50 créditos para iniciar o bypass de segurança.",
        confirmText: "Comprar Créditos",
        onConfirm: () => {
          setShowAlertModal(false);
          navigate(createPageUrl("BuyCredits"));
        }
      });
      setShowAlertModal(true);
      return;
    }

    if (!completedFacebookInvestigation) return;

    await base44.entities.UserProfile.update(userProfile.id, {
      credits: userProfile.credits - 50,
      xp: (userProfile.xp || 0) + 30
    });
    queryClient.setQueryData(['userProfile', user?.email], (oldData) => {
      if (!oldData) return oldData;
      return oldData.map((profile) =>
        profile.id === userProfile.id
          ? { ...profile, credits: userProfile.credits - 50, xp: (userProfile.xp || 0) + 30 }
          : profile
      );
    });
    queryClient.setQueryData(['layoutUserProfile', user?.email], (oldProfile) => {
      if (!oldProfile) return oldProfile;
      return { ...oldProfile, credits: userProfile.credits - 50, xp: (userProfile.xp || 0) + 30 };
    });
    queryClient.invalidateQueries(['userProfile', user?.email]);
    queryClient.invalidateQueries(['layoutUserProfile', user?.email]);
    
    // ✅ MOSTRAR POP-UP DE CRÉDITOS
    setCreditsSpent(50);
    setXpGained(30);
    setShowCreditAlert(true);
    setTimeout(() => setShowCreditAlert(false), 3000);

    const startTime = Date.now();
    const unlockStartKey = `facebook_password_start_${completedFacebookInvestigation.id}`;
    const unlockProgressKey = `facebook_password_progress_${completedFacebookInvestigation.id}`;
    const unlockStatusKey = `facebook_password_status_${completedFacebookInvestigation.id}`;
    const unlockAcceleratedKey = `facebook_password_accelerated_${completedFacebookInvestigation.id}`;
    const unlockAccelerationsKey = `facebook_password_accelerations_${completedFacebookInvestigation.id}`;
    const unlockBoostKey = `facebook_password_initial_boost_${completedFacebookInvestigation.id}`;
    const messengerStatusKey = `facebook_messenger_unlock_${completedFacebookInvestigation.id}`;

    localStorage.setItem(unlockStartKey, startTime.toString());
    localStorage.setItem(unlockProgressKey, '1');
    localStorage.setItem(unlockStatusKey, 'processing');
    localStorage.setItem(unlockAcceleratedKey, 'false');
    localStorage.setItem(unlockAccelerationsKey, '0');
    localStorage.setItem(unlockBoostKey, 'false');
    localStorage.setItem(messengerStatusKey, 'locked');

    setIsAccelerated(false);
    setPasswordStatus('processing');
    setPasswordProgress(1);
    setRemainingHours(24);
    setAccelerateCount(0);
    setMessengerStatus('locked');

    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (initialBoostTimeoutRef.current) {
      clearTimeout(initialBoostTimeoutRef.current);
      initialBoostTimeoutRef.current = null;
    }

    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, Math.floor((elapsed / PASSWORD_TOTAL_DURATION) * 100));
      const remaining = Math.max(0, Math.ceil((PASSWORD_TOTAL_DURATION - elapsed) / (60 * 60 * 1000)));

      setPasswordProgress(progress);
      setRemainingHours(remaining);
      localStorage.setItem(unlockProgressKey, progress.toString());

      if (progress >= 100) {
        setPasswordStatus('failed');
        setRemainingHours(0);
        localStorage.setItem(unlockStatusKey, 'failed');
        localStorage.setItem(unlockProgressKey, '100');
        localStorage.setItem(unlockBoostKey, 'true');
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
      }
    }, 60000);

    scheduleInitialBoost(1, unlockProgressKey, unlockBoostKey, unlockStatusKey);
  };

  const handleAcceleratePasswordUnlock = async () => {
    if (!userProfile || userProfile.credits < 30) {
      setAlertConfig({
        title: "Créditos insuficientes",
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

    if (!completedFacebookInvestigation) return;

    if (passwordProgress >= 100) return;

    setAcceleratingPassword(true);

    try {
      await base44.entities.UserProfile.update(userProfile.id, {
        credits: userProfile.credits - 30,
        xp: (userProfile.xp || 0) + 20
      });
      queryClient.setQueryData(['userProfile', user?.email], (oldData) => {
        if (!oldData) return oldData;
        return oldData.map((profile) =>
          profile.id === userProfile.id
            ? { ...profile, credits: userProfile.credits - 30, xp: (userProfile.xp || 0) + 20 }
            : profile
        );
      });
      queryClient.setQueryData(['layoutUserProfile', user?.email], (oldProfile) => {
        if (!oldProfile) return oldProfile;
        return { ...oldProfile, credits: userProfile.credits - 30, xp: (userProfile.xp || 0) + 20 };
      });
      queryClient.invalidateQueries(['userProfile', user?.email]);
      queryClient.invalidateQueries(['layoutUserProfile', user?.email]);
      
      // ✅ MOSTRAR POP-UP DE CRÉDITOS
      setCreditsSpent(30);
      setXpGained(20);
      setShowCreditAlert(true);
      setTimeout(() => setShowCreditAlert(false), 3000);

      const unlockProgressKey = `facebook_password_progress_${completedFacebookInvestigation.id}`;
      const unlockStatusKey = `facebook_password_status_${completedFacebookInvestigation.id}`;
      const unlockAcceleratedKey = `facebook_password_accelerated_${completedFacebookInvestigation.id}`;
      const unlockAccelerationsKey = `facebook_password_accelerations_${completedFacebookInvestigation.id}`;
      const unlockStartKey = `facebook_password_start_${completedFacebookInvestigation.id}`;
      const unlockBoostKey = `facebook_password_initial_boost_${completedFacebookInvestigation.id}`;

      const boost = Math.floor(Math.random() * 11) + 20; // 20-30%
      const newProgress = Math.min(100, (passwordProgress || 0) + boost);
      const savedAccelerations = parseInt(localStorage.getItem(unlockAccelerationsKey) || '0', 10);

      setIsAccelerated(true);
      setPasswordStatus(newProgress >= 100 ? 'failed' : 'processing');
      setPasswordProgress(newProgress);

      const remainingPercentage = Math.max(0, 100 - newProgress);
      const remaining = Math.max(0, Math.ceil((remainingPercentage / 100) * 24));
      setRemainingHours(remaining);

      localStorage.setItem(unlockStatusKey, newProgress >= 100 ? 'failed' : 'processing');
      localStorage.setItem(unlockProgressKey, newProgress.toString());
      localStorage.setItem(unlockAcceleratedKey, 'true');
      localStorage.setItem(unlockAccelerationsKey, (savedAccelerations + 1).toString());
      localStorage.setItem(unlockBoostKey, 'true');
      if (!localStorage.getItem(unlockStartKey)) {
        localStorage.setItem(unlockStartKey, Date.now().toString());
      }

      setAccelerateCount(savedAccelerations + 1);

      if (newProgress >= 100) {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        if (initialBoostTimeoutRef.current) {
          clearTimeout(initialBoostTimeoutRef.current);
          initialBoostTimeoutRef.current = null;
        }
      }
    } finally {
      setAcceleratingPassword(false);
    }
  };

  const handleUnlockMessenger = async () => {
    if (!userProfile || userProfile.credits < 40) {
      setAlertConfig({
        title: "Créditos insuficientes",
        message: "Você precisa de 40 créditos para revisar as conversas suspeitas.",
        confirmText: "Comprar Créditos",
        onConfirm: () => {
          setShowAlertModal(false);
          navigate(createPageUrl("BuyCredits"));
        }
      });
      setShowAlertModal(true);
      return;
    }

    if (!completedFacebookInvestigation) return;

    await base44.entities.UserProfile.update(userProfile.id, {
      credits: userProfile.credits - 40,
      xp: (userProfile.xp || 0) + 15
    });

    queryClient.setQueryData(['userProfile', user?.email], (oldData) => {
      if (!oldData) return oldData;
      return oldData.map((profile) =>
        profile.id === userProfile.id
          ? { ...profile, credits: userProfile.credits - 40, xp: (userProfile.xp || 0) + 15 }
          : profile
      );
    });
    queryClient.setQueryData(['layoutUserProfile', user?.email], (oldProfile) => {
      if (!oldProfile) return oldProfile;
      return { ...oldProfile, credits: userProfile.credits - 40, xp: (userProfile.xp || 0) + 15 };
    });
    queryClient.invalidateQueries({ queryKey: ['userProfile', user?.email] });
    queryClient.invalidateQueries({ queryKey: ['layoutUserProfile', user?.email] });

    const messengerStatusKey = `facebook_messenger_unlock_${completedFacebookInvestigation.id}`;
    localStorage.setItem(messengerStatusKey, 'loading');
    setMessengerStatus('loading');
  };

  const handleDeleteInvestigation = () => {
    if (!completedFacebookInvestigation) return;

    setShowConfirmDelete(true);
  };

  const confirmDelete = async () => {
    if (!completedFacebookInvestigation) return;

    const keys = [
      `facebook_password_start_${completedFacebookInvestigation.id}`,
      `facebook_password_progress_${completedFacebookInvestigation.id}`,
      `facebook_password_status_${completedFacebookInvestigation.id}`,
      `facebook_password_accelerated_${completedFacebookInvestigation.id}`,
      `facebook_password_accelerations_${completedFacebookInvestigation.id}`,
      `facebook_password_initial_boost_${completedFacebookInvestigation.id}`,
      `facebook_messenger_unlock_${completedFacebookInvestigation.id}`
    ];

    keys.forEach((key) => localStorage.removeItem(key));

    try {
      await base44.entities.Investigation.delete(completedFacebookInvestigation.id);
      queryClient.setQueryData(['investigations', user?.email], (oldData) => {
        if (!oldData) return [];
        return oldData.filter(inv => inv.id !== completedFacebookInvestigation.id);
      });
      navigate(createPageUrl("Dashboard"));
    } finally {
      setShowConfirmDelete(false);
    }
  };

  const closeAlert = () => setShowAlertModal(false);

  if (!completedFacebookInvestigation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#EEF2FF] via-[#E6EEFF] to-[#F5F9FF] p-4">
        <Card className="bg-white border-0 shadow-xl p-6 max-w-md text-center">
          <AlertTriangle className="w-12 h-12 text-blue-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-900 mb-2">Nenhuma investigação concluída</h3>
          <p className="text-sm text-gray-600 mb-4">Finalize uma investigação de Facebook para visualizar os resultados completos.</p>
          <Button onClick={() => navigate(createPageUrl("FacebookSpy"))} className="w-full bg-[#1877F2] hover:bg-[#1664d4] text-white font-semibold">
            Iniciar investigação
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#EEF2FF] via-[#E6EEFF] to-[#F5F9FF]">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-3 py-3 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(createPageUrl("Dashboard"))} className="h-9 px-3 hover:bg-gray-100" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Voltar
          </Button>
          <h1 className="text-base font-bold text-gray-900">Facebook Spy</h1>
          {userProfile && (
            <div className="flex items-center gap-1 bg-blue-50 rounded-full px-3 py-1 border border-blue-200">
              <Zap className="w-3 h-3 text-[#1877F2]" />
              <span className="text-sm font-bold text-gray-900">{userProfile.credits}</span>
            </div>
          )}
        </div>
      </div>

      <div className="w-full max-w-3xl mx-auto p-3 space-y-4">
        <div className="bg-gradient-to-r from-[#1877F2] to-[#1653C0] rounded-2xl p-5 text-white shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest opacity-70">Relatório Facebook</p>
              <h2 className="text-lg font-extrabold">Investigação parcialmente concluída.</h2>
              <p className="text-[11px] sm:text-xs opacity-90">Timeline, mensagens do Messenger, fotos privadas e metadados foram sincronizados e armazenados com segurança.</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2">
                <p className="uppercase tracking-wide text-[10px] opacity-80">Ligações</p>
                <p className="text-lg font-bold">12</p>
              </div>
              <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2">
                <p className="uppercase tracking-wide text-[10px] opacity-80">Mensagens</p>
                <p className="text-lg font-bold">259</p>
              </div>
              <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2">
                <p className="uppercase tracking-wide text-[10px] opacity-80">Fotos</p>
                <p className="text-lg font-bold">66</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Card className="bg-white border-0 shadow-lg p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Facebook className="w-5 h-5 text-[#1877F2]" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500">Perfil Analisado:</p>
                <p className="text-sm font-semibold text-gray-900 truncate">fb/{completedFacebookInvestigation.target_username}</p>
              </div>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3">
                <Users className="w-4 h-4 text-[#1877F2]" />
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-blue-900 font-semibold">Rede Social</p>
                  <p className="text-xs text-blue-800">Mapa de interações recentes, solicitações e bloqueios identificado.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-lg p-3">
                <Globe className="w-4 h-4 text-indigo-600" />
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-indigo-700 font-semibold">Geolocalização</p>
                  <p className="text-xs text-indigo-600">Check-ins públicos e privados correlacionados com viagens e compromissos.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-lg p-3">
                <Image className="w-4 h-4 text-purple-600" />
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-purple-700 font-semibold">Galeria</p>
                  <p className="text-xs text-purple-600">Álbuns ocultos, stories e fotos marcadas foram baixados com sucesso.</p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="bg-white border-0 shadow-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-5 h-5 text-[#1877F2]" />
              <h3 className="font-bold text-gray-900 text-sm">⚡ Bypass de Segurança Facebook</h3>
            </div>

            {passwordStatus === 'idle' ? (
              <>
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 mb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Lock className="w-4 h-4 text-green-700" />
                    <p className="text-sm font-bold text-green-900">SENHA DESCOBERTA ✓</p>
                  </div>
                  <p className="text-xs text-green-700 font-mono">senha: ••••••••••</p>
                </div>

                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-orange-700" />
                    <p className="text-sm font-bold text-orange-900">OBSTÁCULOS DETECTADOS</p>
                  </div>
                  <p className="text-xs text-orange-800 mb-3">Para acessar o perfil com a senha descoberta, é necessário contornar as proteções de segurança ativadas pelo Facebook.</p>
                  
                  <div className="space-y-2 text-xs text-orange-900">
                    <div className="flex items-start gap-2">
                      <Shield className="w-3 h-3 mt-0.5 flex-shrink-0 text-orange-600" />
                      <p><span className="font-semibold">Firewall:</span> dispositivos não autorizados</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <MessageCircle className="w-3 h-3 mt-0.5 flex-shrink-0 text-orange-600" />
                      <p><span className="font-semibold">Verificação SMS:</span> código de 6 dígitos</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <Lock className="w-3 h-3 mt-0.5 flex-shrink-0 text-orange-600" />
                      <p><span className="font-semibold">Token de sessão:</span> criptografado</p>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3 text-xs text-blue-800">
                  <p className="flex items-center gap-1 mb-1">
                    <span className="font-semibold">⏱️ Processo de bypass:</span> 24-36 horas
                  </p>
                  <p className="flex items-center gap-1">
                    <span className="font-semibold">🔓 Após desbloqueio:</span> acesso completo garantido
                  </p>
                </div>

                <Button
                  onClick={handleUnlockPassword}
                  className="w-full h-11 bg-gradient-to-r from-[#1877F2] to-[#1653C0] hover:from-[#1653C0] hover:to-[#1242A0] text-white font-semibold text-sm rounded-xl shadow-lg"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Iniciar bypass - 50 créditos
                </Button>
              </>
            ) : passwordStatus === 'processing' ? (
              <div className="space-y-3">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-green-700" />
                    <p className="text-sm font-bold text-green-900">SENHA CAPTURADA ✓</p>
                  </div>
                  <p className="text-xs text-green-700 font-mono mt-1">senha: ••••••••••</p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                    <p className="text-sm font-semibold text-blue-900">BYPASS EM ANDAMENTO</p>
                  </div>

                  {/* Firewall */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5 text-blue-700" />
                        <p className="text-xs font-semibold text-blue-900">Firewall do Facebook</p>
                      </div>
                      <span className="text-[10px] font-bold text-blue-700">{Math.min(85, Math.floor(passwordProgress * 0.85))}%</span>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-1.5">
                      <div className="h-1.5 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500" style={{ width: `${Math.min(85, Math.floor(passwordProgress * 0.85))}%` }}></div>
                    </div>
                    <p className="text-[10px] text-blue-600 mt-0.5">{Math.min(85, Math.floor(passwordProgress * 0.85)) >= 85 ? 'Bypass concluído' : 'Bypass em andamento...'}</p>
                  </div>

                  {/* SMS Verification */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="w-3.5 h-3.5 text-orange-600" />
                        <p className="text-xs font-semibold text-gray-900">Verificação SMS</p>
                      </div>
                      <span className="text-[10px] font-bold text-gray-700">{Math.max(0, Math.floor(passwordProgress * 0.3))}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div className="h-1.5 bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all duration-500" style={{ width: `${Math.max(0, Math.floor(passwordProgress * 0.3))}%` }}></div>
                    </div>
                    <p className="text-[10px] text-gray-600 mt-0.5">{passwordProgress < 30 ? 'Aguardando token de acesso' : 'Interceptando código...'}</p>
                  </div>

                  {/* Token de Sessão */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5 text-purple-600" />
                        <p className="text-xs font-semibold text-gray-900">Token de sessão</p>
                      </div>
                      <span className="text-[10px] font-bold text-gray-700">{Math.floor(passwordProgress * 0.5)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div className="h-1.5 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all duration-500" style={{ width: `${Math.floor(passwordProgress * 0.5)}%` }}></div>
                    </div>
                    <p className="text-[10px] text-gray-600 mt-0.5">{passwordProgress < 50 ? 'Gerando credenciais...' : 'Validando acesso...'}</p>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-blue-800 pt-2 border-t border-blue-200">
                    <span className="font-semibold">Progresso geral: {passwordProgress}%</span>
                    <span>⏱️ ~{remainingHours}h restantes</span>
                  </div>
                </div>

                {passwordProgress < 100 && (
                  <Button
                    onClick={handleAcceleratePasswordUnlock}
                    disabled={acceleratingPassword}
                    className="w-full h-10 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-semibold text-xs rounded-xl disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Zap className="w-3 h-3 mr-2" />
                    {acceleratingPassword ? "Aplicando aceleração..." : "Aplicar aceleração - 30 créditos"}
                  </Button>
                )}
              </div>
            ) : passwordStatus === 'failed' ? (
              <div className="space-y-3">
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600 mt-1" />
                    <div>
                      <p className="text-sm font-semibold text-red-900 mb-1">Não foi possível concluir o desbloqueio.</p>
                      <p className="text-xs text-red-700">
                        O Facebook investigado está desconectado do aparelho monitorado ou sem conexão ativa. Assim que o dispositivo voltar a ficar online, tente iniciar o desbloqueio novamente.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </Card>
        </div>

        <Card className="bg-white border-0 shadow-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle className="w-5 h-5 text-[#1877F2]" />
            <h3 className="font-bold text-gray-900 text-sm">💬 Conversas suspeitas no Messenger</h3>
          </div>
          <p className="text-xs text-gray-600 mb-3">
            Identificamos trocas recentes com linguagem sugestiva e anexos ocultos no Messenger. É necessário desbloquear essa área para visualizar os diálogos completos, áudios e anexos associados.
          </p>

          {messengerStatus === 'locked' ? (
            <Button
              onClick={handleUnlockMessenger}
              className="w-full h-10 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-semibold text-xs rounded-xl"
            >
              Desbloquear conversas suspeitas - 40 créditos
            </Button>
          ) : (
            <div className="flex items-center justify-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-3">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
              <p className="text-[12px] text-blue-700 font-medium">Carregando conversas do Messenger em modo sigiloso...</p>
            </div>
          )}
        </Card>

        <Card className="bg-white border-0 shadow-lg p-5">
          <h3 className="font-bold text-gray-900 text-sm mb-3">🧠 Insights relevantes</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-gray-200 p-3 bg-gray-50">
              <p className="text-xs font-semibold text-gray-800">Eventos privados confirmados</p>
              <p className="text-[11px] text-gray-600 mt-1">Agenda oculta com 3 compromissos marcados como "Somente eu" nos próximos 10 dias.</p>
            </div>
            <div className="rounded-xl border border-gray-200 p-3 bg-gray-50">
              <p className="text-xs font-semibold text-gray-800">Interações suspeitas</p>
              <p className="text-[11px] text-gray-600 mt-1">Mensagens frequentes com perfil recém-criado, contendo palavras-chave sensíveis.</p>
            </div>
            <div className="rounded-xl border border-gray-200 p-3 bg-gray-50">
              <p className="text-xs font-semibold text-gray-800">Publicações ocultas</p>
              <p className="text-[11px] text-gray-600 mt-1">6 posts configurados como "Somente eu" com anexos em alta resolução.</p>
            </div>
            <div className="rounded-xl border border-gray-200 p-3 bg-gray-50">
              <p className="text-xs font-semibold text-gray-800">Grupos monitorados</p>
              <p className="text-[11px] text-gray-600 mt-1">Participação ativa em 4 comunidades privadas com conteúdo sensível.</p>
            </div>
          </div>
        </Card>

        <Button
          onClick={handleDeleteInvestigation}
          variant="outline"
          className="w-full h-11 border border-red-200 text-red-600 hover:bg-red-50 font-medium text-sm rounded-2xl"
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
            <button onClick={() => setShowCreditAlert(false)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showConfirmDelete}
        onConfirm={confirmDelete}
        onCancel={() => setShowConfirmDelete(false)}
        title="Apagar investigação?"
        message={"⚠️ Todos os dados desta investigação serão perdidos permanentemente, e os créditos gastos não serão reembolsados."}
        confirmText="Sim, apagar"
        cancelText="Cancelar"
        type="danger"
      />

      <ConfirmModal
        isOpen={showAlertModal}
        onConfirm={alertConfig.onConfirm || closeAlert}
        onCancel={closeAlert}
        title={alertConfig.title}
        message={alertConfig.message}
        confirmText={alertConfig.confirmText}
        cancelText={alertConfig.cancelText || "Voltar"}
        type="default"
      />
    </div>
  );
}
