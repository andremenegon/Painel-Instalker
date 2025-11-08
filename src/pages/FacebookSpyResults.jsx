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
    if (!userProfile || userProfile.credits < 60) {
      setAlertConfig({
        title: "Créditos insuficientes",
        message: "Você precisa de 60 créditos para iniciar o desbloqueio da senha.",
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
      credits: userProfile.credits - 60,
      xp: (userProfile.xp || 0) + 35
    });
    queryClient.invalidateQueries(['userProfile', user?.email]);

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
      queryClient.invalidateQueries(['userProfile', user?.email]);

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
              <h3 className="font-bold text-gray-900 text-sm">🔐 Desbloquear Senha</h3>
            </div>

            {passwordStatus === 'idle' ? (
              <>
                <p className="text-xs text-gray-600 mb-3">A senha está blindada por criptografia de nível corporativo. Inicie a descriptografia para liberar mensagens privadas, registros sigilosos e configurações ocultas do perfil.</p>
                <Button
                  onClick={handleUnlockPassword}
                  className="w-full h-11 bg-[#1877F2] hover:bg-[#1653C0] text-white font-semibold text-sm rounded-xl"
                >
                  <Lock className="w-4 h-4 mr-2" />
                  Iniciar desbloqueio - 60 créditos
                </Button>
              </>
            ) : passwordStatus === 'processing' ? (
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                    <p className="text-sm font-semibold text-blue-900">Desbloqueio em andamento</p>
                  </div>
                  <p className="text-xs text-blue-700">Quebrando criptografia AES-256 através de força bruta distribuída.</p>
                  <div className="mt-3">
                    <div className="w-full bg-blue-200 rounded-full h-2">
                      <div className="h-2 bg-gradient-to-r from-[#1877F2] to-[#0F4BC6] rounded-full" style={{ width: `${passwordProgress}%` }}></div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-blue-800 mt-1">
                      <span>{passwordProgress}%</span>
                      <span>Restante: ~{remainingHours}h</span>
                    </div>
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

                {accelerateCount > 0 && (
                  <p className="text-[11px] text-blue-700 text-center">⚡ Acelerações aplicadas: {accelerateCount}</p>
                )}

                {isAccelerated && (
                  <p className="text-[11px] text-blue-600 text-center">Prioridade máxima ativa para finalizar a descriptografia.</p>
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
