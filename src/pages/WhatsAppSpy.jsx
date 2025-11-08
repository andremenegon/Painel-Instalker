
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, Zap, Lock, AlertTriangle, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import WhatsAppIcon from "../components/icons/WhatsAppIcon";
import ConfirmModal from "../components/dashboard/ConfirmModal";
import Particles from "../components/effects/Particles";
import Toast from "../components/effects/Toast";
import ScreenShake from "../components/effects/ScreenShake";
import { useInvestigationTimer } from "@/hooks/useInvestigationTimer";
import { ensureTimer, getDurationForInvestigation, resetTimer, markCompleted } from "@/lib/progressManager";

const accentColor = "#139352";

const BRAZIL_PREFIX = "+55";

const getBrazilDigits = (input = "") => {
  const digits = (input || "").replace(/\D/g, "");
  return digits.startsWith("55") ? digits.slice(2) : digits;
};

const getTargetDdd = (input = "") => {
  const digits = (input || "").replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 4) return digits.slice(2, 4);
  if (digits.length >= 2) return digits.slice(0, 2);
  return "11";
};

const formatPhoneLabel = (ddd, sequence) => {
  const clean = sequence.replace(/\D/g, "").padStart(8, "0");
  const first = clean.slice(0, 4);
  const second = clean.slice(4, 8);
  return `(${ddd}) 9${first}-${second}`;
};

const formatRelativeTimestamp = (minutesAgo) => {
  const now = new Date();
  const target = new Date(now.getTime() - minutesAgo * 60 * 1000);
  const formatter = target.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const isToday = target.toDateString() === now.toDateString();
  const isYesterday = target.toDateString() === yesterday.toDateString();

  if (isToday) return `Hoje às ${formatter}`;
  if (isYesterday) return `Ontem às ${formatter}`;
  return `${target.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${formatter}`;
};

function WhatsAppCardModal({
  isOpen,
  title,
  message,
  confirmText = "Ok",
  cancelText = "Voltar",
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null;

  const renderMessage = () => {
    if (typeof message !== "string") {
      return message;
    }

    const lines = message.split("\n");
    return lines.map((line, idx) => (
      <React.Fragment key={idx}>
        {line.length === 0 ? <span>&nbsp;</span> : line}
        {idx < lines.length - 1 && <br />}
      </React.Fragment>
    ));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-200">
      <div className="w-full max-w-md animate-in zoom-in duration-200">
        <div className="relative rounded-3xl border border-[#CBEFD8] bg-gradient-to-br from-white via-[#F9FFFB] to-white shadow-2xl overflow-hidden">
          <div className="absolute -top-24 -right-28 w-56 h-56 rounded-full bg-[#E7FBF0] opacity-70" aria-hidden="true" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 rounded-full bg-[#F3FFF8] opacity-80" aria-hidden="true" />

          <div className="relative p-6 space-y-5">
              <div className="flex items-center gap-3">
                <WhatsAppIcon size={52} />
              <div>
                <h3 className="text-lg font-bold text-gray-900">{title}</h3>
                <p className="text-xs text-gray-500">WhatsApp Spy</p>
              </div>
            </div>

            <div className="bg-[#F3FFF8] border border-[#C7F0D8] rounded-2xl p-4 text-sm text-[#1C512F]">
              {renderMessage()}
            </div>

            <div className="flex flex-col gap-2">
              <Button
                onClick={onConfirm}
                className="h-11 rounded-2xl bg-gradient-to-r from-[#159A53] to-[#1FBF61] hover:from-[#118449] hover:to-[#18A956] text-white font-semibold shadow-md"
              >
                {confirmText}
              </Button>
              <Button
                variant="ghost"
                onClick={onCancel}
                className="h-10 rounded-2xl text-gray-600 font-semibold hover:bg-gray-100"
              >
                {cancelText}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WhatsApp () {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [phoneDigits, setPhoneDigits] = useState("");
  const [showCreditAlert, setShowCreditAlert] = useState(false);
  const [creditsSpent, setCreditsSpent] = useState(0);
  const [xpGained, setXpGained] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [accelerating, setAccelerating] = useState(false);
  const [unlockedSections, setUnlockedSections] = useState({});
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertConfig, setAlertConfig] = useState({});
  const autoStarted = useRef(false); // New: autoStarted useRef
  const completionNotifiedRef = useRef(false);
  
  // ✅ Estados para efeitos
  const [showParticles, setShowParticles] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [shakeScreen, setShakeScreen] = useState(0);
  const [expandedChatId, setExpandedChatId] = useState(null);
  const [downloadTask, setDownloadTask] = useState(null);
  const [loadingHistoryFor, setLoadingHistoryFor] = useState(null);

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

  const {
    progress: timerProgress,
    canAccelerate,
    accelerate: accelerateTimer,
  } = useInvestigationTimer({ service: "WhatsApp", investigation: activeWhatsAppInvestigation });

  useEffect(() => {
    if (activeWhatsAppInvestigation) {
      setLoadingProgress(timerProgress);
    } else {
      setLoadingProgress(0);
    }
  }, [timerProgress, activeWhatsAppInvestigation?.id]);

  useEffect(() => {
    completionNotifiedRef.current = false;
  }, [activeWhatsAppInvestigation?.id]);

  useEffect(() => {
    if (!activeWhatsAppInvestigation) {
      return;
    }

    if (timerProgress >= 100 && !completionNotifiedRef.current) {
      completionNotifiedRef.current = true;

      (async () => {
        try {
          await base44.entities.Investigation.update(activeWhatsAppInvestigation.id, {
            progress: 100,
            status: "completed",
          });

          markCompleted({ service: "WhatsApp", id: activeWhatsAppInvestigation.id });
          setLoadingProgress(100);
          queryClient.invalidateQueries({ queryKey: ['investigations', user?.email] });
          await refetch();
        } catch (error) {
          console.error("Erro ao finalizar investigação do WhatsApp:", error);
          completionNotifiedRef.current = false;
        }
      })();
    }
  }, [timerProgress, activeWhatsAppInvestigation?.id, queryClient, refetch, user?.email]);
 
  // ✅ RESET autoStarted QUANDO COMPONENTE É MONTADO
  useEffect(() => {
    autoStarted.current = false;
    return () => {
      autoStarted.current = false;
    };
  }, []);

  const showAccelerateButton = canAccelerate && !accelerating && loadingProgress > 0 && loadingProgress < 100;

  const remainingDays = (() => {
    if (loadingProgress >= 100) return 0;
    const maxDays = 5;
    const minDays = 0.5;
    const remaining = maxDays * (1 - loadingProgress / 100);
    const clamped = Math.max(minDays, remaining);
    if (clamped <= minDays) return 'menos de 1';
    if (clamped >= 1) return Math.round(clamped).toString();
    return clamped.toFixed(1).replace('.0', '');
  })();

  const targetDigits = useMemo(() => {
    if (activeWhatsAppInvestigation?.target_username) {
      return getBrazilDigits(activeWhatsAppInvestigation.target_username);
    }
    if (phoneDigits) return getBrazilDigits(phoneDigits);
    return "";
  }, [activeWhatsAppInvestigation?.target_username, phoneDigits]);

  const targetDdd = useMemo(() => {
    if (targetDigits?.length >= 2) return targetDigits.slice(0, 2);
    return getTargetDdd(phoneDigits);
  }, [targetDigits, phoneDigits]);

  const maskContactNumber = useCallback((suffix) => {
    const sanitized = suffix.replace(/[^0-9*]/g, '').padEnd(4, '*');
    return `(${targetDdd}) 9883-${sanitized}`;
  }, [targetDdd]);

  const quickActions = useMemo(() => ([
    {
      key: 'fullReport',
      label: 'Extrair PDF Completo',
      icon: '📄',
      unlockKey: 'quick_fullReport',
      cost: 80,
      description: 'Consolidamos conversas, anexos e evidências em um PDF com sumário investigativo.'
    },
    {
      key: 'audioPack',
      label: 'Baixar Áudios',
      icon: '🎧',
      unlockKey: 'quick_audioPack',
      cost: 55,
      description: 'Organizamos todos os áudios e notas de voz em um pacote único, pronto para download.'
    },
    {
      key: 'contactsExport',
      label: 'Exportar Contatos',
      icon: '📇',
      unlockKey: 'quick_contactsExport',
      cost: 40,
      description: 'Geramos uma planilha com todos os contatos relevantes, marcando vínculos e tags suspeitas.'
    },
    {
      key: 'suspiciousCalls',
      label: 'Ver Chamadas Suspeitas',
      icon: '📞',
      unlockKey: 'quick_suspiciousCalls',
      cost: 45,
      description: 'Destacamos as ligações que fogem do padrão, com duração, recorrência e horários críticos.'
    }
  ]), []);

  const conversationInsights = useMemo(() => ([
    {
      id: 'highlight-1',
      contact: maskContactNumber('53**'),
      summary: 'Pediu sigilo logo após apagar anexos íntimos que haviam sido enviados minutos antes.',
      label: 'Prioridade alta',
      badgeClass: 'bg-red-100 text-red-700',
      minutesAgo: 37,
    },
    {
      id: 'highlight-2',
      contact: maskContactNumber('78**'),
      summary: 'Retomou a conversa às 05h22 cobrando o encontro que ficou combinado durante a madrugada.',
      label: 'Acompanhar',
      badgeClass: 'bg-yellow-100 text-yellow-700',
      minutesAgo: 312,
    },
    {
      id: 'highlight-3',
      contact: maskContactNumber('94**'),
      summary: 'Disparou sequência de áudios e anexos criptografados solicitando sigilo total.',
      label: 'Risco moderado',
      badgeClass: 'bg-emerald-100 text-emerald-700',
      minutesAgo: 18,
    }
  ]), [maskContactNumber]);

  const conversationThreads = useMemo(() => ([
    {
      id: 'thread-01',
      unlockKey: 'chat_thread_01',
      cost: 40,
      contact: maskContactNumber('53**'),
      preview: 'Então me espera com a luz baixa e sem nada por baixo.',
      lastActivityMinutes: 32,
      messages: [
        { from: 'contact', text: 'Abre a porta lateral às 22h, tô levando o vinho que você gosta.' },
        { from: 'target', text: 'Tô dizendo que é reunião... entra em silêncio.' },
        { from: 'contact', text: 'Se enrolar de novo, mando aquele vídeo pro seu e-mail corporativo.' },
        { from: 'target', text: 'Então me espera com a luz baixa e sem nada por baixo.' }
      ]
    },
    {
      id: 'thread-02',
      unlockKey: 'chat_thread_02',
      cost: 40,
      contact: maskContactNumber('78**'),
      preview: 'Te espero na garagem com a taça e sem nada além dela.',
      lastActivityMinutes: 190,
      messages: [
        { from: 'target', text: 'A desculpa do happy hour colou de novo. Tô a caminho.' },
        { from: 'contact', text: 'Quero você com a camisa azul desabotoada, igual ontem.' },
        { from: 'target', text: 'Você sabe provocar. Já tô estacionando.' },
        { from: 'contact', text: 'Te espero na garagem com a taça e sem nada além dela.' }
      ]
    },
    {
      id: 'thread-03',
      unlockKey: 'chat_thread_03',
      cost: 40,
      contact: maskContactNumber('94**'),
      preview: 'Tá enviando agora... guarda a chave com você.',
      lastActivityMinutes: 8,
      messages: [
        { from: 'contact', text: 'Já reservei o quarto 405 de novo. Check-in no seu nome.' },
        { from: 'target', text: 'Apaga o chat depois disso, tô paranoico.' },
        { from: 'contact', text: 'Sem comprovante não tem surpresa. Quero foto no espelho.' },
        { from: 'target', text: 'Tá enviando agora... guarda a chave com você.' }
      ]
    }
  ]), [maskContactNumber]);

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
      return false;
    }

    try {
      
      await base44.entities.UserProfile.update(userProfile.id, {
        credits: userProfile.credits - credits,
        xp: userProfile.xp + (credits / 2) // Half credits as XP
      });
      
      queryClient.setQueryData(['userProfile', user?.email], (oldData) => {
        if (!oldData) return oldData;
        return oldData.map((profile) =>
          profile.id === userProfile.id
            ? { ...profile, credits: userProfile.credits - credits, xp: userProfile.xp + credits / 2 }
            : profile
        );
      });
      queryClient.setQueryData(['layoutUserProfile', user?.email], (oldProfile) => {
        if (!oldProfile) return oldProfile;
        return { ...oldProfile, credits: userProfile.credits - credits, xp: userProfile.xp + credits / 2 };
      });
      queryClient.invalidateQueries({ queryKey: ['userProfile', user?.email] });
      queryClient.invalidateQueries({ queryKey: ['layoutUserProfile', user?.email] });
      
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
      const sectionMessages = {
        messages: 'Relatório liberado! ✨',
        photos: 'Pacote de mídias destravado! ✨',
        quick_fullReport: 'PDF completo reservado! ✨',
        quick_audioPack: 'Pacote de áudios em preparação! ✨',
        quick_contactsExport: 'Agenda exportada! ✨',
        quick_suspiciousCalls: 'Chamadas destacadas foram liberadas! ✨',
        chat_thread_01: 'Conversa liberada com sucesso! ✨',
        chat_thread_02: 'Conversa liberada com sucesso! ✨',
        chat_thread_03: 'Conversa liberada com sucesso! ✨',
        chat_thread_01_history: 'Estamos puxando mensagens antigas desse contato... ✨',
        chat_thread_02_history: 'Estamos puxando mensagens antigas desse contato... ✨',
        chat_thread_03_history: 'Estamos puxando mensagens antigas desse contato... ✨',
        more_conversations: 'Novas conversas serão carregadas em instantes! ✨'
      };
      setToastMessage(sectionMessages[sectionKey] || 'Conteúdo Desbloqueado! ✨');
      setToastType('success');
      setShowToast(true);
      return true;
    } catch (error) {
      console.error("Erro ao desbloquear seção:", error);
      playSound('error');
      setAlertConfig({
        title: "Erro ao Desbloquear",
        message: `Ocorreu um erro ao desbloquear esta seção: ${error.message}`,
        confirmText: "Ok",
        onConfirm: () => {
          playSound('click');
          setShowAlertModal(false);
        }
      });
      setShowAlertModal(true);
      return false;
    }
  };

  const handleQuickAction = useCallback((action) => {
    const triggerDownload = () => {
      setDownloadTask({ key: action.key, label: action.label, startedAt: Date.now() });
    };

    if (unlockedSections[action.unlockKey]) {
      triggerDownload();
      return;
    }

    playSound('click');
    setAlertConfig({
      title: 'Preparar arquivos confidenciais?',
      message: `Esta ação rápida tem custo de ${action.cost} créditos. ${action.description}\n\nAssim que confirmarmos o pagamento, iniciamos a preparação segura dos arquivos e o download começa automaticamente quando estiver pronto.`,
      confirmText: 'Preparar arquivos',
      cancelText: 'Agora não',
      onConfirm: async () => {
        playSound('click');
        setShowAlertModal(false);
        const success = await handleUnlockSection(action.unlockKey, action.cost);
        if (success) {
          triggerDownload();
        }
      }
    });
    setShowAlertModal(true);
  }, [handleUnlockSection, unlockedSections]);

  const handleConversationTap = useCallback((thread) => {
    if (unlockedSections[thread.unlockKey]) {
      playSound('click');
      setExpandedChatId((current) => {
        const next = current === thread.id ? null : thread.id;
        if (next === null) {
          setLoadingHistoryFor(null);
        }
        return next;
      });
      return;
    }

    playSound('click');
    setAlertConfig({
      title: 'Desbloquear conversa confidencial?',
      message: `Esta conversa detalhada custa ${thread.cost} créditos. O conteúdo inclui mensagens e anexos sensíveis do contato ${thread.contact}.\n\nAo confirmar, os créditos serão debitados e a conversa ficará liberada definitivamente.`,
      confirmText: 'Desbloquear conversa',
      cancelText: 'Agora não',
      onConfirm: async () => {
        playSound('click');
        setShowAlertModal(false);
        const success = await handleUnlockSection(thread.unlockKey, thread.cost);
        if (success) {
          setExpandedChatId(thread.id);
          setLoadingHistoryFor(null);
        }
      }
    });
    setShowAlertModal(true);
  }, [handleUnlockSection, unlockedSections]);

  const handleLoadMoreHistory = useCallback((thread) => {
    const historyKey = `${thread.unlockKey}_history`;

    if (loadingHistoryFor === thread.id || unlockedSections[historyKey]) {
      setLoadingHistoryFor(thread.id);
      return;
    }

    playSound('click');
    setAlertConfig({
      title: 'Carregar mais histórico?',
      message: `Podemos buscar mensagens antigas desse contato por 30 créditos. O processo é sigiloso e pode levar alguns minutos.`,
      confirmText: 'Buscar histórico',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        playSound('click');
        setShowAlertModal(false);
        const success = await handleUnlockSection(historyKey, 30);
        if (success) {
          setLoadingHistoryFor(thread.id);
        }
      }
    });
    setShowAlertModal(true);
  }, [handleUnlockSection, loadingHistoryFor, unlockedSections]);

  const startInvestigation = useCallback(async (phoneArg) => {
    playSound('click');
    const digits = phoneArg
      ? phoneArg.replace(/\D/g, "")
      : phoneDigits;
    const cleanedDigits = digits.startsWith("55") ? digits.slice(2) : digits;

    if (cleanedDigits.length < 10) {
      playSound('error');
      setPhoneDigits("");
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

    setPhoneDigits(cleanedDigits);

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
      queryClient.setQueryData(['userProfile', user?.email], (oldData) => {
        if (!oldData) return oldData;
        return oldData.map((profile) =>
          profile.id === userProfile.id
            ? { ...profile, credits: updatedCredits, xp: updatedXp }
            : profile
        );
      });
      queryClient.setQueryData(['layoutUserProfile', user?.email], (oldProfile) => {
        if (!oldProfile) return oldProfile;
        return { ...oldProfile, credits: updatedCredits, xp: updatedXp };
      });
      queryClient.invalidateQueries({ queryKey: ['userProfile', user?.email] });
      queryClient.invalidateQueries({ queryKey: ['layoutUserProfile', user?.email] });
      
      const newInvestigation = await base44.entities.Investigation.create({
        service_name: "WhatsApp",
        target_username: `${BRAZIL_PREFIX}${cleanedDigits}`,
        status: "processing",
        progress: 1,
        estimated_days: 7,
        is_accelerated: false,
        created_by: user.email,
      });

      ensureTimer({
        service: "WhatsApp",
        id: newInvestigation.id,
        durationMs: getDurationForInvestigation(newInvestigation),
        startAt: Date.now(),
      });
      
      queryClient.invalidateQueries({ queryKey: ['investigations', user?.email] }); // ✅ INVALIDAR PARA ATUALIZAR
      queryClient.invalidateQueries({ queryKey: ['layoutUserProfile', user?.email] });
      setPhoneDigits(cleanedDigits);

      setCreditsSpent(40);
      setXpGained(25);
      setShowCreditAlert(true);
      setTimeout(() => setShowCreditAlert(false), 1500);
      
      await refetch();
    } catch (error) {
      console.error("Erro ao criar investigação:", error);
      playSound('error');
    }
  }, [phoneDigits, activeWhatsAppInvestigation, userProfile, navigate, refetch, user?.email, queryClient]);

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
        const formatted = `${BRAZIL_PREFIX}${getBrazilDigits(phone)}`;
        setPhoneDigits(formatted);
        // ✅ SMALL DELAY PARA GARANTIR QUE NÃO DUPLICA
        setTimeout(() => {
          startInvestigation(formatted); // Pass formatted phone for auto-start
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
      setAccelerating(true);
      const updatedCredits = userProfile.credits - 30;
      const updatedXp = userProfile.xp + 30;

      await base44.entities.UserProfile.update(userProfile.id, {
        credits: updatedCredits,
        xp: updatedXp
      });
      queryClient.setQueryData(['userProfile', user?.email], (oldData) => {
        if (!oldData) return oldData;
        return oldData.map((profile) =>
          profile.id === userProfile.id
            ? { ...profile, credits: updatedCredits, xp: updatedXp }
            : profile
        );
      });
      queryClient.setQueryData(['layoutUserProfile', user?.email], (oldProfile) => {
        if (!oldProfile) return oldProfile;
        return { ...oldProfile, credits: updatedCredits, xp: updatedXp };
      });
      queryClient.invalidateQueries({ queryKey: ['userProfile', user?.email] });
      queryClient.invalidateQueries({ queryKey: ['layoutUserProfile', user?.email] });

      const newProgress = accelerateTimer();
      setLoadingProgress(newProgress);

      const newStatus = newProgress >= 100 ? "completed" : "processing";

      await base44.entities.Investigation.update(activeWhatsAppInvestigation.id, {
        progress: newProgress,
        status: newStatus
      });
      
      queryClient.setQueryData(['investigations', user?.email], (oldData) => {
        if (!oldData) return oldData;
        return oldData.map(inv => 
          inv.id === activeWhatsAppInvestigation.id ? { ...inv, progress: newProgress, status: newStatus } : inv
        );
      });

      queryClient.invalidateQueries({ queryKey: ['layoutUserProfile', user?.email] });

      setCreditsSpent(30);
      setXpGained(30);
      setShowCreditAlert(true);
      setTimeout(() => setShowCreditAlert(false), 3000);
      
      // ✅ NÃO MOSTRAR TOAST/PARTÍCULAS SE MOSTRAR ALERT DE CRÉDITOS
      if (newProgress >= 100) {
        markCompleted({ service: "WhatsApp", id: activeWhatsAppInvestigation.id });
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
    setAccelerating(false);
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
      resetTimer({ service: "WhatsApp", id: activeWhatsAppInvestigation.id });
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
          <div className="w-full max-w-2xl mx-auto p-3">
            <Card className="relative overflow-hidden border border-[#CDEFD9] shadow-lg">
              <div className="absolute -top-16 -right-20 w-48 h-48 rounded-full bg-[#E9FBF0] opacity-70" aria-hidden="true" />
              <div className="absolute -bottom-14 -left-14 w-40 h-40 rounded-full bg-[#F4FFF9] opacity-80" aria-hidden="true" />
              <div className="relative p-6 space-y-6">
                <div className="flex items-center gap-3">
                  <WhatsAppIcon size={60} />
                  <div>
                    <h2 className="text-[16px] font-bold text-gray-700">Espionagem Completa  </h2>
                    <p className="text-xs text-gray-500">Monitore conversas, mídias e ligações com atualização constante.</p>
                  </div>
                </div>

                <div className="bg-[#F3FFF8] border border-[#C7F0D8] rounded-xl p-3 text-xs text-[#1C512F]">
                  <span className="font-semibold text-[#1DA955]">Dica:</span> Digite o número com o DDD. Exemplo: <strong>(11) 98765-4321</strong>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700" htmlFor="phoneNumber">
                    Número de telefone alvo
                  </label>
                  <div className="flex items-center bg-white border-2 border-[#BEEFD2] focus-within:border-[#1DA955] rounded-xl px-3 py-2 transition-colors gap-2">
                    <span className="text-sm font-semibold text-gray-600 select-none">+55</span>
                    <input
                      id="phoneNumber"
                      type="tel"
                      placeholder="11987654321"
                      value={phoneDigits}
                      onChange={(e) => {
                        const digitsOnly = e.target.value.replace(/\D/g, "");
                        if (digitsOnly.length > 11) return;
                        setPhoneDigits(digitsOnly);
                      }}
                      onBlur={() => {
                        if (!phoneDigits) {
                          setPhoneDigits("");
                        }
                      }}
                      onKeyPress={(e) => e.key === 'Enter' && startInvestigation(phoneDigits)}
                      className="flex-1 border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm h-9 outline-none"
                      style={{ border: 'none', boxShadow: 'none' }}
                      maxLength={11}
                      autoComplete="off"
                    />
                  </div>
                </div>

                <Button
                  onClick={() => startInvestigation(phoneDigits)}
                  disabled={phoneDigits.length < 10}
                  className="w-full h-12 bg-gradient-to-r from-[#1DA955] to-[#21C269] hover:from-[#189349] hover:to-[#1BBF61] text-white font-bold text-base rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Iniciar Investigação
                </Button>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="bg-[#F6FFF9] border border-[#D5F5E1] rounded-lg p-3">
                    <p className="text-[11px] text-gray-500 uppercase font-semibold mb-1">Conversas</p>
                    <p className="text-xs text-gray-700">Histórico completo, inclusive mensagens apagadas.</p>
                  </div>
                  <div className="bg-[#F6FFF9] border border-[#D5F5E1] rounded-lg p-3">
                    <p className="text-[11px] text-gray-500 uppercase font-semibold mb-1">Mídias</p>
                    <p className="text-xs text-gray-700">Fotos, vídeos, áudios e documentos compartilhados.</p>
                  </div>
                  <div className="bg-[#F6FFF9] border border-[#D5F5E1] rounded-lg p-3">
                    <p className="text-[11px] text-gray-500 uppercase font-semibold mb-1">Chamadas</p>
                    <p className="text-xs text-gray-700">Ligações de voz e vídeo com horário e duração.</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <WhatsAppCardModal
            isOpen={showAlertModal}
            title={alertConfig.title}
            message={alertConfig.message}
            confirmText={alertConfig.confirmText || "Ok"}
            cancelText={alertConfig.cancelText || "Voltar"}
            onConfirm={alertConfig.onConfirm || (() => { playSound('click'); setShowAlertModal(false); })}
            onCancel={() => { playSound('click'); setShowAlertModal(false); }}
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
        <ScreenShake trigger={shakeScreen} />
        <Toast show={showToast} message={toastMessage} type={toastType} onClose={() => setShowToast(false)} />
        <Particles show={showParticles} />
        
        <div className="min-h-screen bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
          <div className="w-full max-w-2xl mx-auto p-3">
            <Card className="bg-white border-0 shadow-lg p-4 mb-3">
              <div className="flex items-center gap-3 mb-4">
                <WhatsAppIcon size={44} />
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

                {loadingProgress < 100 && (
                <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded mt-3">
                  <p className="text-xs text-blue-900">
                    <span className="font-bold">⏳ Investigação em andamento</span><br/>
                    Monitoramento ativo, com extração contínua e validações manuais.<br/>
                    Tempo estimado: {remainingDays} {remainingDays === '1' ? 'dia' : 'dias'}
                  </p>
                </div>
                )}
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

          <WhatsAppCardModal
            isOpen={showAlertModal}
            title={alertConfig.title}
            message={alertConfig.message}
            confirmText={alertConfig.confirmText || "Ok"}
            cancelText={alertConfig.cancelText || "Voltar"}
            onConfirm={alertConfig.onConfirm || (() => { playSound('click'); setShowAlertModal(false); })}
            onCancel={() => { playSound('click'); setShowAlertModal(false); }}
          />
        </div>
      </>
    );
  }

  // ✅ TELA DE RESULTADOS COM EFEITOS
  if (activeWhatsAppInvestigation && loadingProgress >= 100) {
    return (
      <>
        <ScreenShake trigger={shakeScreen} />
        <Toast show={showToast} message={toastMessage} type={toastType} onClose={() => setShowToast(false)} />
        <Particles show={showParticles} />
        
        <div className="min-h-screen bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
          <div className="w-full max-w-3xl mx-auto p-3 space-y-4">
            <Card className="bg-white border border-emerald-100 shadow-md rounded-2xl p-5">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <span className="text-[11px] uppercase tracking-[0.22em] text-emerald-600 font-semibold">WhatsApp concluído</span>
                  <h2 className="mt-2 text-xl font-extrabold text-gray-900">Varredura finalizada com evidências classificadas</h2>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                    Organizamos todas as conversas, anexos e chamadas com foco no que realmente importa. Abaixo estão os pontos que sugerimos acompanhar com atenção.
                  </p>
                </div>
              {userProfile && (
                  <div className="sm:self-start">
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                      <Zap className="w-3 h-3" /> Saldo atual: {userProfile.credits} créditos
                    </span>
                </div>
              )}
          </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
                  <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wide">Conversas críticas</p>
                  <p className="text-lg font-bold text-emerald-900 mt-1">3 conversas</p>
                </div>
                <div className="rounded-xl bg-orange-50 border border-orange-100 p-3">
                  <p className="text-[10px] font-semibold text-orange-600 uppercase tracking-wide">Chamadas fora de horário</p>
                  <p className="text-lg font-bold text-orange-700 mt-1">7 registros</p>
                  </div>
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                  <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide">Áudios aguardando análise</p>
                  <p className="text-lg font-bold text-slate-900 mt-1">18 arquivos</p>
                  </div>
                  </div>

              <div className="mt-4 space-y-2 text-sm text-gray-700">
                {conversationInsights.map((insight) => (
                  <div key={insight.id} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-[13px] font-semibold text-gray-900">{insight.contact}</p>
                        <p className="text-[12px] text-gray-600 leading-snug mt-1">{insight.summary}</p>
                </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge className={`text-[10px] font-semibold ${insight.badgeClass}`}>{insight.label}</Badge>
                        <span className="text-[11px] text-gray-500 whitespace-nowrap">{formatRelativeTimestamp(insight.minutesAgo)}</span>
              </div>
                    </div>
                  </div>
                ))}
            </div>

              <div className="mt-4 border-l-2 border-orange-300 bg-orange-50/60 px-3 py-2 rounded-r-xl">
                <p className="text-[11px] text-orange-700 font-semibold">
                  Aviso de cobrança: a liberação completa das conversas e das ações rápidas envolve processamento manual e consome créditos adicionais.
                </p>
                  </div>
            </Card>

            <Card className="bg-white border-0 shadow-lg p-5">
                  <h3 className="font-bold text-gray-900 text-sm mb-3">📱 Conversas suspeitas monitoradas</h3>
                    <div className="space-y-3">
                {conversationThreads.map((thread) => {
                  const unlocked = !!unlockedSections[thread.unlockKey];
                  const expanded = unlocked && expandedChatId === thread.id;
                  const historyKey = `${thread.unlockKey}_history`;
                  const historyRequested = loadingHistoryFor === thread.id || !!unlockedSections[historyKey];
                  const lastMessage = thread.messages[thread.messages.length - 1].text;
                  return (
                    <div
                      key={thread.id}
                      className={`rounded-2xl border ${unlocked ? 'border-emerald-200 bg-emerald-50/60' : 'border-gray-200 bg-gray-50'} p-3`}
                    >
                      <button
                        type="button"
                        onClick={() => handleConversationTap(thread)}
                        className="w-full text-left"
                      >
                          <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[13px] font-semibold text-gray-900">{thread.contact}</p>
                            <p className="text-[11px] text-gray-500">Atualizado {formatRelativeTimestamp(thread.lastActivityMinutes)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={`text-[10px] ${unlocked ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-600'}`}>
                              {unlocked ? 'Liberado' : `Desbloquear - ${thread.cost} créditos`}
                            </Badge>
                            <span className="text-gray-400 text-lg">›</span>
                          </div>
                        </div>

                        <div className="mt-2">
                          {unlocked ? (
                            expanded ? (
                              <>
                                <div className="space-y-2">
                                  {thread.messages.map((message, idx) => (
                                    <div key={idx} className={`flex ${message.from === 'target' ? 'justify-end' : 'justify-start'}`}>
                                      <span className={`${message.from === 'target' ? 'bg-emerald-600 text-white rounded-t-2xl rounded-bl-2xl' : 'bg-white text-gray-800 border border-emerald-100 rounded-t-2xl rounded-br-2xl'} px-3 py-2 text-[13px] leading-snug max-w-[80%] shadow-sm`}>
                                        {message.text}
                                      </span>
                        </div>
                      ))}
                    </div>
                                <div className="mt-3">
                                  {historyRequested ? (
                                    <div className="flex items-center gap-2 text-[11px] text-emerald-600">
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                      Processando histórico adicional...
                    </div>
                                  ) : (
                                    <Button
                                      variant="outline"
                                      className="h-8 px-3 text-[11px] border border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleLoadMoreHistory(thread);
                                      }}
                                    >
                                      Carregar mais histórico - 30 créditos
                                    </Button>
                  )}
                </div>
                              </>
                            ) : (
                              <p className="text-[12px] text-emerald-700 font-medium">Toque para abrir a conversa completa.</p>
                            )
                          ) : (
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[12px] text-gray-600 italic max-w-[70%]">{lastMessage}</p>
                      <Button
                        size="sm"
                                className="h-8 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleConversationTap(thread);
                                }}
                              >
                                Ver conversa - {thread.cost} créditos
                      </Button>
                            </div>
                    )}
                  </div>
                      </button>
                        </div>
                  );
                })}
                    </div>

              <div className="mt-4">
                {unlockedSections.more_conversations ? (
                  <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 px-3 py-3 text-[12px] text-emerald-700">
                    Processando novas conversas confidenciais... volte em alguns minutos para atualizar.
                    </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full h-10 border border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-sm font-semibold"
                    onClick={() => handleUnlockSection('more_conversations', 35)}
                  >
                    Carregar mais conversas - 35 créditos
                  </Button>
                  )}
                </div>
              </Card>

              <Card className="bg-white border-0 shadow-lg p-5">
                <h3 className="font-bold text-gray-900 text-sm mb-2">⚡ Ações Rápidas</h3>
              <p className="text-[11px] text-gray-600 mb-3">
                Cada ação gera um pacote dedicado e consome créditos para cobrir a extração manual. Assim que confirmamos o pagamento, iniciamos a preparação segura e o download dispara automaticamente quando o arquivo estiver pronto.
              </p>
                <div className="grid gap-2 sm:grid-cols-2">
                {quickActions.map((action) => {
                  const isUnlocked = !!unlockedSections[action.unlockKey];
                  const isActive = downloadTask?.key === action.key;
                  const costLabel = isUnlocked ? 'Adquirido' : `${action.cost} créditos`;
                  const costClass = isUnlocked ? 'text-emerald-600' : 'text-gray-500';
                  const statusNote = isUnlocked ? 'Cobrança confirmada. Pode gerar um novo pacote quando quiser.' : 'Cobrança única e sigilosa.';
                  return (
                    <button
                      key={action.key}
                      onClick={() => handleQuickAction(action)}
                      className={`rounded-xl border px-3 py-3 text-left transition ${isUnlocked ? 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-lg" aria-hidden>{action.icon}</span>
                        <span className={`text-[11px] font-semibold ${costClass}`}>{costLabel}</span>
                      </div>
                      <p className="text-[13px] font-semibold text-gray-800 mt-1 leading-snug">{action.label}</p>
                      <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                        {action.description}
                      </p>
                      <p className={`text-[10px] font-semibold mt-2 ${isUnlocked ? 'text-emerald-600' : 'text-orange-500'}`}>
                        {statusNote}
                      </p>
                      {isActive && (
                        <p className="text-[10px] text-emerald-600 mt-1">Preparando agora mesmo...</p>
                      )}
                    </button>
                  );
                })}
                </div>
              </Card>

            <Button
              onClick={handleCancelInvestigation}
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

          <WhatsAppCardModal
            isOpen={showAlertModal}
            title={alertConfig.title}
            message={alertConfig.message}
            confirmText={alertConfig.confirmText || "Ok"}
            cancelText={alertConfig.cancelText || "Voltar"}
            onConfirm={alertConfig.onConfirm || (() => { playSound('click'); setShowAlertModal(false); })}
            onCancel={() => { playSound('click'); setShowAlertModal(false); }}
          />
        </div>

        {downloadTask && (
          <div className="fixed bottom-5 right-5 left-5 sm:left-auto sm:w-80 z-[90]">
            <div className="bg-white border border-emerald-200 shadow-xl rounded-2xl px-4 py-3 flex items-center gap-3 animate-in slide-in-from-bottom-4">
              <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-gray-800">Preparando {downloadTask.label}</p>
                <p className="text-[11px] text-gray-500 leading-snug">Arquivos sigilosos em processamento...</p>
                <p className="text-[10px] text-emerald-600 mt-0.5">Assim que finalizar, o download inicia automaticamente.</p>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }
  
  return null;
}
