
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Zap, Shield, Eye, MessageCircle, FileText, Clock, CheckCircle2, Loader2, Trash2, User, Phone } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ConfirmModal from "../components/dashboard/ConfirmModal";
import { useInvestigationTimer } from "@/hooks/useInvestigationTimer";
import { ensureTimer, getDurationForInvestigation, resetTimer } from "@/lib/progressManager";

export default function DetectiveSpy() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  // Removed userProfile state, it will be derived from useQuery
  const [showCreditAlert, setShowCreditAlert] = useState(false);
  const [creditsSpent, setCreditsSpent] = useState(0);
  const [xpGained, setXpGained] = useState(0);
  const [showConfirmHire, setShowConfirmHire] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [accelerating, setAccelerating] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [alertConfig, setAlertConfig] = useState({
    title: "Créditos Insuficientes",
    message: "Você precisa de 1000 créditos para contratar o detetive particular.",
    confirmText: "Comprar Créditos",
    cancelText: "Voltar",
    onConfirm: () => {
      setShowAlertModal(false);
      navigate(createPageUrl("BuyCredits"));
    },
    onCancel: () => setShowAlertModal(false),
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
      }
    } catch (error) {
      // Silently fail
    }
  };

  useEffect(() => {
    base44.auth.me().then(async (userData) => {
      setUser(userData);
      // Removed userProfile fetching from useEffect as it's now handled by useQuery
    });
  }, []);

  const { data: userProfiles = [], refetch: refetchUserProfile } = useQuery({
    queryKey: ['userProfile', user?.email],
    queryFn: () => base44.entities.UserProfile.filter({ created_by: user.email }),
    enabled: !!user,
    staleTime: Infinity, // ✅ CACHE INFINITO
    cacheTime: Infinity,
    refetchOnWindowFocus: false, // ✅ DESATIVADO
    refetchOnMount: false, // ✅ DESATIVADO
  });

  const userProfile = userProfiles[0];

  const { data: investigations = [], refetch: refetchInvestigations } = useQuery({
    queryKey: ['investigations', user?.email],
    queryFn: () => base44.entities.Investigation.filter({ created_by: user?.email }),
    initialData: [],
    enabled: !!user,
    staleTime: Infinity, // ✅ CACHE INFINITO
    refetchOnWindowFocus: false, // ✅ DESATIVADO
    refetchOnMount: false, // ✅ DESATIVADO
  });

  const activeInvestigation = useMemo(() => (
    investigations.find(
      (inv) => inv.service_name === "Detetive Particular" && inv.status === "processing"
    ) || null
  ), [investigations]);

  const completedInvestigation = useMemo(() => (
    investigations.find(
      (inv) => inv.service_name === "Detetive Particular" && (inv.status === "completed" || inv.status === "accelerated")
    ) || null
  ), [investigations]);

  const currentInvestigation = activeInvestigation || completedInvestigation;

  const {
    progress: timerProgress,
    canAccelerate,
    accelerate: accelerateTimer,
  } = useInvestigationTimer({ service: "Detetive Particular", investigation: currentInvestigation });

  const loadingProgress = activeInvestigation ? timerProgress : completedInvestigation ? 100 : 0;
  const showAccelerateButton = Boolean(activeInvestigation) && canAccelerate && !accelerating && loadingProgress > 0 && loadingProgress < 100;
  const resultInvestigation = completedInvestigation || (loadingProgress >= 100 ? activeInvestigation : null);

  useEffect(() => {
    if (!currentInvestigation) return;
    ensureTimer({
      service: "Detetive Particular",
      id: currentInvestigation.id,
      durationMs: getDurationForInvestigation(currentInvestigation),
      startAt: currentInvestigation.created_date ? new Date(currentInvestigation.created_date).getTime() : undefined,
    });
  }, [currentInvestigation?.id, currentInvestigation?.created_date, currentInvestigation?.estimated_days]);

  useEffect(() => {
    if (!activeInvestigation) return;
    if (loadingProgress >= 100 && activeInvestigation.status !== "completed") {
      base44.entities.Investigation.update(activeInvestigation.id, {
        progress: 100,
        status: "completed",
      }).then(() => refetchInvestigations());
    }
  }, [activeInvestigation?.id, activeInvestigation?.status, loadingProgress, refetchInvestigations]);

  useEffect(() => {
    if (!resultInvestigation) {
      setReportData(null);
      return;
    }

    const storageKey = `detective_report_${resultInvestigation.id}`;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        setReportData(JSON.parse(stored));
        return;
      } catch (error) {
        console.warn("Erro ao carregar relatório do detetive:", error);
      }
    }

    const defaultReport = {
      contactPhone: "(11) 99876-5432",
      detectiveName: "Carlos Matos",
      summary: "O alvo estabeleceu contato frequente com possíveis interesses amorosos e demonstrou comportamento incompatível com relacionamento exclusivo.",
      keyFindings: [
        {
          title: "Interação constante com perfil suspeito",
          detail: "Troca de 46 mensagens diretas com o perfil @camilafreitas_fit, incluindo convites para encontros presenciais.",
          timestamp: "12/11 - 22h14",
        },
        {
          title: "Perfil ativo em aplicativos de namoro",
          detail: "Match recente no Tinder com usuário 'Mariana R.'. Capturas anexas com conversas iniciadas.",
          timestamp: "14/11 - 01h03",
        },
        {
          title: "Mentiras recorrentes",
          detail: "Relatou trabalhar até tarde em 3 ocasiões nas quais esteve conectado e interagindo com outros perfis.",
          timestamp: "15/11 - 19h42",
        },
      ],
      recommendations: [
        "Guardar todas as evidências anexadas antes do confronto.",
        "Evitar contato direto com @camilafreitas_fit para não comprometer a infiltração em caso de novo acompanhamento.",
        "Caso decida confrontar, faça em ambiente neutro, após avaliar os prints finais (anexo 05).",
      ],
      attachments: [
        { label: "Anexo 01 - Prints Instagram", description: "Conversas recentes no direct", type: "print" },
        { label: "Anexo 02 - Prints WhatsApp", description: "Propostas de encontro", type: "print" },
        { label: "Anexo 03 - Áudio 12-11", description: "Mensagem de voz enviada às 22h03", type: "audio" },
        { label: "Anexo 04 - Vídeo 13-11", description: "Story salvo do alvo em evento", type: "video" },
        { label: "Anexo 05 - Relatório PDF", description: "Resumo completo com linha do tempo", type: "document" },
      ],
      lastUpdate: new Date().toISOString(),
    };

    localStorage.setItem(storageKey, JSON.stringify(defaultReport));
    setReportData(defaultReport);
  }, [resultInvestigation?.id]);

  const getSteps = (progress) => {
    const steps = [
      { id: 1, title: "Briefing recebido", threshold: 0 },
      { id: 2, title: "Contato inicial com o alvo", threshold: 5 },
      { id: 3, title: "Infiltração em redes sociais", threshold: 20 },
      { id: 4, title: "Construção de confiança", threshold: 40 },
      { id: 5, title: "Testes de fidelidade", threshold: 65 },
      { id: 6, title: "Coleta de evidências", threshold: 85 },
      { id: 7, title: "Relatório final", threshold: 100 },
    ];

    return steps.map((step, index) => {
      const nextThreshold = steps[index + 1]?.threshold ?? 100;
      const completed = progress >= nextThreshold;
      const active = progress >= step.threshold && progress < nextThreshold;
      return { ...step, completed, active };
    });
  };

  const getEstimatedTime = (progress) => {
    if (progress >= 95) return "24h para entrega do relatório";
    if (progress >= 75) return "1-2 dias para finalizar";
    if (progress >= 50) return "3-4 dias restantes";
    if (progress >= 25) return "5-8 dias restantes";
    return "Contato inicial em até 24-48h";
  };

  const progressSteps = useMemo(() => getSteps(loadingProgress), [loadingProgress]);
  const estimatedTime = useMemo(() => getEstimatedTime(loadingProgress), [loadingProgress]);
  const ACCELERATE_COST = 200;

  const handleHire = async () => {
    playSound('click');

    if (currentInvestigation) {
      navigate(createPageUrl("Investigation") + "?service=Detetive Particular");
      return;
    }
    
    if (!userProfile || userProfile.credits < 1000) {
      setAlertConfig({
        title: "Créditos Insuficientes",
        message: "Você precisa de 1000 créditos para contratar o detetive particular.",
        confirmText: "Comprar Créditos",
        cancelText: "Voltar",
        onConfirm: () => {
          setShowAlertModal(false);
          navigate(createPageUrl("BuyCredits"));
        },
        onCancel: () => setShowAlertModal(false),
      });
      setShowAlertModal(true);
      return;
    }

    setShowConfirmHire(true);
  };

  const confirmHire = async () => {
    playSound('click');
    
    try {
      if (!userProfile) {
        console.error("User profile not loaded, cannot confirm hire.");
        setShowConfirmHire(false);
        return;
      }

      await base44.entities.UserProfile.update(userProfile.id, {
        credits: userProfile.credits - 1000,
        xp: userProfile.xp + 100
      });

      // Instead of setUserProfile, we now invalidate/refetch the query
      await refetchUserProfile(); 
      
      setCreditsSpent(1000);
      setXpGained(100);
      setShowCreditAlert(true);
      setTimeout(() => setShowCreditAlert(false), 3000);
      
      const newInvestigation = await base44.entities.Investigation.create({
        service_name: "Detetive Particular",
        target_username: user?.email || "Cliente",
        status: "processing",
        progress: 1,
        estimated_days: 14,
        is_accelerated: false,
        created_by: user?.email || "unknown",
      });

      ensureTimer({
        service: "Detetive Particular",
        id: newInvestigation.id,
        durationMs: getDurationForInvestigation(newInvestigation),
        startAt: Date.now(),
      });

      await refetchInvestigations();
      queryClient.invalidateQueries(['investigations', user?.email]);

      playSound('complete');
      
      setShowConfirmHire(false);
      setShowSuccessModal(true);
    } catch (error) {
      console.error("Erro ao contratar detetive:", error);
      setShowConfirmHire(false);
    }
  };

  const handleAccelerateInvestigation = async () => {
    if (!activeInvestigation || !userProfile) return;

    if (userProfile.credits < ACCELERATE_COST) {
      playSound('click');
      setAlertConfig({
        title: "Créditos Insuficientes",
        message: `Você precisa de ${ACCELERATE_COST} créditos para acelerar a investigação do detetive.`,
        confirmText: "Comprar Créditos",
        cancelText: "Voltar",
        onConfirm: () => {
          setShowAlertModal(false);
          navigate(createPageUrl("BuyCredits"));
        },
        onCancel: () => setShowAlertModal(false),
      });
      setShowAlertModal(true);
      return;
    }

    try {
      setAccelerating(true);
      playSound('click');

      await base44.entities.UserProfile.update(userProfile.id, {
        credits: userProfile.credits - ACCELERATE_COST,
        xp: userProfile.xp + 80,
      });
      await refetchUserProfile();

      const boost = Math.floor(Math.random() * 11) + 20; // 20% - 30%
      const newProgress = accelerateTimer(boost);

      await base44.entities.Investigation.update(activeInvestigation.id, {
        progress: newProgress,
        status: newProgress >= 100 ? "completed" : "processing",
        is_accelerated: true,
      });

      setCreditsSpent(ACCELERATE_COST);
      setXpGained(80);
      setShowCreditAlert(true);
      setTimeout(() => setShowCreditAlert(false), 3000);

      setTimeout(() => refetchInvestigations(), 500);
    } catch (error) {
      console.error("Erro ao acelerar detetive:", error);
      setAlertConfig({
        title: "Erro ao acelerar",
        message: "Não foi possível acelerar agora. Tente novamente em instantes.",
        confirmText: "Fechar",
        cancelText: "Voltar",
        onConfirm: () => setShowAlertModal(false),
        onCancel: () => setShowAlertModal(false),
      });
      setShowAlertModal(true);
    } finally {
      setAccelerating(false);
    }
  };

  const handleCancelInvestigation = () => {
    if (!activeInvestigation) return;
    setShowCancelModal(true);
  };

  const confirmCancelInvestigation = async () => {
    if (!activeInvestigation) return;

    try {
      resetTimer({ service: "Detetive Particular", id: activeInvestigation.id });
      await base44.entities.Investigation.delete(activeInvestigation.id);

      queryClient.setQueryData(['investigations', user?.email], (oldData) => {
        if (!oldData) return [];
        return oldData.filter((inv) => inv.id !== activeInvestigation.id);
      });

      await refetchInvestigations();
      setShowCancelModal(false);
    } catch (error) {
      console.error("Erro ao cancelar detetive:", error);
      setAlertConfig({
        title: "Erro ao cancelar",
        message: "Não foi possível cancelar agora. Tente novamente.",
        confirmText: "Fechar",
        cancelText: "Voltar",
        onConfirm: () => setShowAlertModal(false),
        onCancel: () => setShowAlertModal(false),
      });
      setShowAlertModal(true);
    }
  };

  const handleDeleteInvestigation = () => {
    if (!resultInvestigation) return;
    setShowDeleteModal(true);
  };

  const confirmDeleteInvestigation = async () => {
    if (!resultInvestigation) return;

    try {
      resetTimer({ service: "Detetive Particular", id: resultInvestigation.id });
      localStorage.removeItem(`detective_report_${resultInvestigation.id}`);

      await base44.entities.Investigation.delete(resultInvestigation.id);

      queryClient.setQueryData(['investigations', user?.email], (oldData) => {
        if (!oldData) return [];
        return oldData.filter((inv) => inv.id !== resultInvestigation.id);
      });

      await refetchInvestigations();
      setShowDeleteModal(false);
      navigate(createPageUrl("Dashboard"));
    } catch (error) {
      console.error("Erro ao deletar relatório do detetive:", error);
      setAlertConfig({
        title: "Erro ao apagar",
        message: "Não foi possível apagar agora. Tente novamente.",
        confirmText: "Fechar",
        cancelText: "Voltar",
        onConfirm: () => setShowAlertModal(false),
        onCancel: () => setShowAlertModal(false),
      });
      setShowAlertModal(true);
    }
  };

  const renderHeader = () => (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-3xl mx-auto px-3 py-3 flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate(createPageUrl("Dashboard"))} className="h-9 px-3 hover:bg-gray-100" size="sm">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Voltar
        </Button>
        <h1 className="text-base font-bold text-gray-900">Detetive Particular</h1>
        {userProfile && (
          <div className="flex items-center gap-1 bg-orange-50 rounded-full px-3 py-1 border border-orange-200">
            <Zap className="w-3 h-3 text-orange-500" />
            <span className="text-sm font-bold text-gray-900">{userProfile.credits}</span>
          </div>
        )}
      </div>
    </div>
  );

  const creditToast = showCreditAlert ? (
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
  ) : null;

  const sharedModals = (
    <>
      {creditToast}
      <ConfirmModal
        isOpen={showConfirmHire}
        onConfirm={confirmHire}
        onCancel={() => setShowConfirmHire(false)}
        title="Confirmar Contratação?"
        message="✅ Detetive real profissional\n✅ WhatsApp direto com ele\n✅ Relatório completo\n\nCusto: 1000 créditos"
        confirmText="Sim, contratar"
        cancelText="Cancelar"
        type="default"
      />
      <ConfirmModal
        isOpen={showSuccessModal}
        onConfirm={() => setShowSuccessModal(false)}
        onCancel={() => setShowSuccessModal(false)}
        title="✅ Detetive Contratado!"
        message="📱 WhatsApp do detetive:\n(11) 99876-5432\n\nO detetive Carlos entrará em contato em até 24h.\n\nVocê receberá todas as instruções via WhatsApp."
        confirmText="Acompanhar investigação"
        cancelText="Fechar"
        type="default"
      />
      <ConfirmModal
        isOpen={showAlertModal}
        onConfirm={alertConfig.onConfirm || (() => setShowAlertModal(false))}
        onCancel={alertConfig.onCancel || (() => setShowAlertModal(false))}
        title={alertConfig.title}
        message={alertConfig.message}
        confirmText={alertConfig.confirmText || "Confirmar"}
        cancelText={alertConfig.cancelText || "Cancelar"}
        type="default"
      />
      <ConfirmModal
        isOpen={showCancelModal}
        onConfirm={confirmCancelInvestigation}
        onCancel={() => setShowCancelModal(false)}
        title="Cancelar investigação?"
        message="⚠️ Você perderá o progresso atual.\n\nOs créditos utilizados não serão reembolsados."
        confirmText="Sim, cancelar"
        cancelText="Voltar"
        type="danger"
      />
      <ConfirmModal
        isOpen={showDeleteModal}
        onConfirm={confirmDeleteInvestigation}
        onCancel={() => setShowDeleteModal(false)}
        title="Apagar relatório?"
        message="⚠️ O relatório e todas as evidências serão removidos permanentemente."
        confirmText="Apagar"
        cancelText="Manter"
        type="danger"
      />
    </>
  );

  if (activeInvestigation && loadingProgress < 100) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
        {renderHeader()}
        <div className="max-w-3xl mx-auto p-3 pb-24 space-y-4">
          <Card className="bg-white border-0 shadow-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Operação em andamento</p>
                <h2 className="text-lg font-bold text-gray-900">Detetive em campo</h2>
              </div>
              <Badge className="bg-orange-100 text-orange-700 border-0">{loadingProgress}%</Badge>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed mb-4">
              O detetive está infiltrado e atualiza o relatório constantemente. Você receberá todas as evidências assim que a operação atingir 100%.
            </p>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden mb-4">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 transition-all duration-1000"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
            <div className="space-y-2">
              {progressSteps.map((step) => (
                <div
                  key={step.id}
                  className={`flex items-center gap-2 p-2 rounded-lg ${
                    step.completed
                      ? "bg-green-50 border border-green-200"
                      : step.active
                        ? "bg-orange-50 border-l-4 border-orange-500"
                        : "bg-white/30 border border-gray-100 opacity-70"
                  }`}
                >
                  {step.completed ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  ) : step.active ? (
                    <Loader2 className="w-4 h-4 text-orange-600 flex-shrink-0 animate-spin" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
                  )}
                  <p
                    className={`text-xs font-medium ${
                      step.completed
                        ? "text-green-900"
                        : step.active
                          ? "text-gray-900"
                          : "text-gray-500"
                    }`}
                  >
                    {step.title}
                  </p>
                </div>
              ))}
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mt-4">
              <p className="text-xs text-orange-800 font-semibold uppercase tracking-wide">Próxima atualização</p>
              <p className="text-sm font-bold text-gray-900">{estimatedTime}</p>
            </div>
            <div className="mt-4 space-y-2">
              {showAccelerateButton && (
                <Button
                  onClick={handleAccelerateInvestigation}
                  disabled={accelerating}
                  className="w-full h-11 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold text-sm rounded-xl shadow-lg"
                >
                  {accelerating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4 mr-2" />
                  )}
                  {accelerating ? "Acelerando..." : `Acelerar 25% - ${ACCELERATE_COST} créditos`}
                </Button>
              )}
              <Button
                onClick={handleCancelInvestigation}
                variant="outline"
                className="w-full h-10 border border-red-200 text-red-600 hover:bg-red-50 text-sm rounded-xl"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Cancelar investigação
              </Button>
            </div>
          </Card>

          <Card className="bg-white border-0 shadow-md p-5">
            <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-orange-500" />
              Linha do tempo da operação
            </h3>
            <ul className="space-y-2 text-xs text-gray-700">
              <li>• Briefing detalhado enviado para o detetive ✔️</li>
              <li>• Perfis fake já interagindo com o alvo em Instagram e Facebook</li>
              <li>• Monitoramento diário de stories e directs com capturas automáticas</li>
              <li>• Fase de teste de fidelidade com convites e perguntas estratégicas</li>
              <li>• Preparação do relatório PDF com prints, áudios e cronologia completa</li>
            </ul>
          </Card>
        </div>
        {sharedModals}
      </div>
    );
  }

  if (resultInvestigation) {
    const phoneDigits = reportData?.contactPhone ? reportData.contactPhone.replace(/\D/g, "") : null;
    const whatsappUrl = phoneDigits ? `https://wa.me/55${phoneDigits}` : null;

    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
        {renderHeader()}
        <div className="max-w-3xl mx-auto p-3 pb-24 space-y-4">
          <Card className="bg-white border-0 shadow-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <Badge className="bg-green-100 text-green-700 border-0 mb-2">Investigação concluída</Badge>
                <h2 className="text-lg font-bold text-gray-900">Relatório final disponível</h2>
              </div>
              <Badge className="bg-gray-900 text-white border-0">100%</Badge>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">
              {reportData ? reportData.summary : "Gerando resumo do relatório..."}
            </p>
            {reportData && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <User className="w-4 h-4 text-gray-700" />
                  <div>
                    <p className="text-[11px] text-gray-500 uppercase font-semibold">Detetive responsável</p>
                    <p className="text-sm font-bold text-gray-900">{reportData.detectiveName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <Phone className="w-4 h-4 text-green-600" />
                  <div>
                    <p className="text-[11px] text-gray-500 uppercase font-semibold">WhatsApp direto</p>
                    <p className="text-sm font-bold text-gray-900">{reportData.contactPhone}</p>
                  </div>
                </div>
              </div>
            )}
            {whatsappUrl && (
              <Button
                onClick={() => window.open(whatsappUrl, "_blank", "noopener")}
                className="w-full h-11 mt-4 bg-green-500 hover:bg-green-600 text-white font-semibold text-sm rounded-xl shadow-lg"
              >
                Abrir conversa com o detetive
              </Button>
            )}
          </Card>

          {reportData ? (
            <Card className="bg-white border-0 shadow-md p-5">
              <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Eye className="w-5 h-5 text-purple-500" />
                Principais evidências coletadas
              </h3>
              <div className="space-y-3">
                {reportData.keyFindings.map((item, index) => (
                  <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <p className="text-sm font-bold text-gray-900 mb-1">{item.title}</p>
                    <p className="text-xs text-gray-600 leading-relaxed">{item.detail}</p>
                    <p className="text-[11px] text-gray-500 font-semibold mt-2">Atualizado em {item.timestamp}</p>
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <Card className="bg-white border-0 shadow-md p-5 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
            </Card>
          )}

          {reportData && (
            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-0 shadow-md p-5">
              <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-500" />
                Próximos passos recomendados
              </h3>
              <ul className="space-y-2 text-xs text-gray-700">
                {reportData.recommendations.map((tip, index) => (
                  <li key={index}>• {tip}</li>
                ))}
              </ul>
            </Card>
          )}

          {reportData && (
            <Card className="bg-white border-0 shadow-md p-5">
              <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-700" />
                Anexos do relatório
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {reportData.attachments.map((file, index) => (
                  <div key={index} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <FileText className="w-4 h-4 text-gray-700 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-gray-900">{file.label}</p>
                      <p className="text-[11px] text-gray-600">{file.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Button
            onClick={handleDeleteInvestigation}
            variant="outline"
            className="w-full h-10 border border-red-200 text-red-600 hover:bg-red-50 text-sm rounded-xl"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Apagar relatório e investigação
          </Button>
        </div>
        {sharedModals}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
      {renderHeader()}
      <div className="max-w-2xl mx-auto p-3 pb-20">
        <div className="text-center mb-4">
          <div className="text-6xl mb-3">🕵️</div>
          <h1 className="text-lg font-bold text-gray-900 mb-2">Detetive Particular Profissional</h1>
          <Badge className="bg-gradient-to-r from-gray-600 to-gray-700 text-white border-0 text-[10px] font-bold px-3 py-1">
            ⭐ INVESTIGAÇÃO REAL E MANUAL
          </Badge>
        </div>

        <Card className="bg-white border-0 shadow-md p-5 mb-3">
          <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-2xl">🎯</span>
            Como Funciona a Investigação
          </h3>
          <div className="space-y-4">
            {["Briefing Inicial", "Início Imediato", "Infiltração e Aproximação", "Construção de Confiança", "Teste de Fidelidade", "Coleta de Evidências", "Relatório Final Completo"].map((title, idx) => (
              <div key={idx} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-gray-700">{idx + 1}</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 mb-1">{title}</p>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {[
                      "Você passa todas as informações do alvo: nome completo, redes sociais, telefone, hábitos, horários. Quanto mais detalhes, melhor será a investigação.",
                      "A investigação começa IMEDIATAMENTE após a contratação. O detetive analisa o perfil, monta a estratégia e já inicia o contato.",
                      "O detetive cria um perfil fake convincente e adiciona o alvo nas redes sociais, aproximando-se do círculo social.",
                      "Ele mantém conversas naturais, comenta nas fotos e usa técnicas de persuasão para ganhar confiança.",
                      "Com a confiança estabelecida, o detetive aplica testes sutis para medir a fidelidade.",
                      "Todas as interações relevantes são registradas com prints, áudios e vídeos.",
                      "Você recebe um relatório em PDF com todas as evidências e análise comportamental completa."
                    ][idx]}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-blue-50 rounded-lg p-3 mt-4 border border-blue-200">
            <p className="text-xs text-gray-900 font-medium text-center">
              📱 <span className="font-bold">Você acompanha tudo pelo WhatsApp</span> do detetive em tempo real
            </p>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-200 p-5 mb-3">
          <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
            <span className="text-2xl">⏱️</span>
            Quanto Tempo Demora?
          </h3>
          <p className="text-sm text-gray-700 mb-3 leading-relaxed">
            <span className="font-bold text-gray-900">A investigação não tem prazo fixo.</span> Ela continua até você ter todas as respostas que precisa e conseguir tomar uma decisão consciente.
          </p>
          <div className="space-y-2 text-xs text-gray-700">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-orange-600 flex-shrink-0" />
              <span>Contato inicial geralmente ocorre em <span className="font-bold">24-48h</span></span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-orange-600 flex-shrink-0" />
              <span>Construção de confiança leva <span className="font-bold">3-7 dias</span></span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-orange-600 flex-shrink-0" />
              <span>Evidências começam a aparecer em <span className="font-bold">7-14 dias</span></span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-orange-600 flex-shrink-0" />
              <span><span className="font-bold">Você decide quando parar</span> - quando tiver certeza</span>
            </div>
          </div>
          <div className="bg-white/60 rounded-lg p-3 mt-3">
            <p className="text-xs text-gray-900 text-center">
              <span className="font-bold">💡 Dica:</span> Quanto mais cooperativo o alvo for, mais rápido você terá respostas
            </p>
          </div>
        </Card>

        <Card className="bg-white border-0 shadow-md p-5 mb-3">
          <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-2xl">📦</span>
            O Que Está Incluído
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {["Detetive Real e Profissional", "WhatsApp Direto com Detetive", "Relatório Completo em PDF", "Updates em Tempo Real", "Prints e Evidências", "Análise Comportamental"].map((item, index) => (
              <div key={item} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <CheckCircle2 className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-gray-900">{item}</p>
                  <p className="text-xs text-gray-600">
                    {[
                      "Investigador treinado com anos de experiência em infidelidade",
                      "Linha direta 24/7 para tirar dúvidas e receber updates",
                      "Documento profissional com todas as evidências documentadas",
                      "Você recebe notificações de cada passo da investigação",
                      "Capturas de tela, conversas, comportamento documentado",
                      "Interpretação profissional de reações e linguagem corporal digital"
                    ][index]}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 shadow-md p-5 mb-3">
          <div className="flex items-start gap-3">
            <Shield className="w-8 h-8 text-green-600 flex-shrink-0" />
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-2">Garantia de Satisfação Total</h3>
              <p className="text-sm text-gray-700 leading-relaxed mb-3">
                Se o detetive não conseguir fazer contato com o alvo ou não coletar nenhuma informação relevante em até 15 dias, devolvemos <span className="font-bold">100% dos créditos</span>.
              </p>
              <p className="text-xs text-gray-600 leading-relaxed">Mas isso raramente acontece. Em 98% dos casos, o detetive consegue estabelecer contato e coletar evidências valiosas.</p>
            </div>
          </div>
        </Card>

        <Card className="bg-white border-0 shadow-md p-5 mb-3">
          <h3 className="text-base font-bold text-gray-900 mb-4 text-center">💬 O Que Nossos Clientes Dizem</h3>
          <div className="space-y-3">
            {[{
              quote: "Descobri que meu marido tinha perfil no Tinder e estava conversando com várias mulheres. O detetive conseguiu todas as provas que eu precisava. Valeu cada centavo.",
              author: "— Ana, 34 anos"
            }, {
              quote: "Eu suspeitava há meses mas não tinha certeza. O detetive confirmou tudo em 10 dias. Agora posso seguir em frente com a verdade.",
              author: "— Carlos, 41 anos"
            }, {
              quote: "O detetive foi extremamente profissional e discreto. Recebi relatório completo com prints das conversas. Recomendo 100%.",
              author: "— Juliana, 29 anos"
            }].map((item, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-xs text-gray-700 italic mb-2">"{item.quote}"</p>
                <p className="text-xs text-gray-500">{item.author}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-gray-700 to-gray-800 border-0 shadow-2xl p-6 text-white sticky bottom-3">
          <div className="text-center mb-4">
            <div className="text-5xl mb-3">🕵️</div>
            <h3 className="text-xl font-bold mb-2">Descubra a Verdade Agora</h3>
            <p className="text-sm opacity-90 mb-3">Investigação profissional com detetive real</p>
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-xl px-5 py-2 mb-4">
              <Zap className="w-5 h-5 text-yellow-300" />
              <span className="text-2xl font-black">1000</span>
              <span className="text-sm opacity-90">créditos</span>
            </div>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 mb-4">
            {["Detetive real e profissional", "Início imediato da investigação", "WhatsApp direto com o detetive", "Relatório completo em PDF", "Garantia de satisfação"].map((item) => (
              <div key={item} className="flex items-center gap-2 text-xs mb-2 last:mb-0">
                <CheckCircle2 className="w-4 h-4" />
                <span>{item}</span>
              </div>
            ))}
          </div>
          <Button onClick={handleHire} className="w-full h-14 bg-white text-gray-900 hover:bg-gray-100 font-bold text-base rounded-xl shadow-lg">
            🔒 CONTRATAR DETETIVE
          </Button>
          <div className="text-center mt-3 space-y-1">
            <p className="text-xs opacity-90">🔒 100% seguro e discreto</p>
            <p className="text-xs opacity-90">⚡ Investigação começa imediatamente</p>
          </div>
        </Card>
      </div>
      {sharedModals}
    </div>
  );
}
