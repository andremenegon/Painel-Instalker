
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
  const [chatMessages, setChatMessages] = useState([]);
  const [showingChat, setShowingChat] = useState(false);
  const [isTyping, setIsTyping] = useState({ show: false, sender: null });
  const [chatStarted, setChatStarted] = useState(false);
  const [demoMessages, setDemoMessages] = useState([]);
  const [demoTyping, setDemoTyping] = useState({ show: false, sender: null });
  const chatContainerRef = React.useRef(null);
  const demoContainerRef = React.useRef(null);
  const demoTimersRef = React.useRef([]);
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

  // ✅ USAR O MESMO CACHE DO LAYOUT
  const { data: userProfile, refetch: refetchUserProfile } = useQuery({
    queryKey: ['layoutUserProfile', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const profiles = await base44.entities.UserProfile.filter({ created_by: user.email });
      return Array.isArray(profiles) && profiles.length > 0 ? profiles[0] : null;
    },
    enabled: !!user?.email,
    staleTime: 60 * 1000, // ✅ 60 segundos (igual ao Layout)
  });

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

  // 💬 MENSAGENS DO CHAT - Detetive em ação (sem gênero)
  const CHAT_SEQUENCE = [
    { id: 1, type: "typing", sender: "detective", delay: 500, duration: 1500 },
    { id: 2, type: "message", sender: "detective", text: "Oi! Vi que você curtiu minha foto 😊", time: "23:42", delay: 2000 },
    { id: 3, type: "message", sender: "detective", text: "Achei seu perfil bem interessante", time: "23:42", delay: 3500 },
    
    { id: 4, type: "typing", sender: "target", delay: 5000, duration: 2000 },
    { id: 5, type: "message", sender: "target", text: "Oi! Valeu 😄", time: "23:44", delay: 7000 },
    { id: 6, type: "message", sender: "target", text: "Nossa, você é incrível!", time: "23:44", delay: 8500 },
    
    { id: 7, type: "typing", sender: "detective", delay: 10000, duration: 1800 },
    { id: 8, type: "message", sender: "detective", text: "Valeu 🥰", time: "23:45", delay: 11800 },
    { id: 9, type: "message", sender: "detective", text: "A gente podia se conhecer melhor...", time: "23:45", delay: 13300 },
    
    { id: 10, type: "typing", sender: "target", delay: 14800, duration: 2500 },
    { id: 11, type: "message", sender: "target", text: "Adoraria! 😍", time: "23:46", delay: 17300 },
    { id: 12, type: "message", sender: "target", text: "Que tal a gente sair?", time: "23:46", delay: 18800 },
    { id: 13, type: "message", sender: "target", text: "Você é incrível!", time: "23:46", delay: 20300 },
    
    { id: 14, type: "typing", sender: "detective", delay: 21800, duration: 2000 },
    { id: 15, type: "message", sender: "detective", text: "Vamos sim, adoraria...", time: "23:47", delay: 23800 },
    { id: 16, type: "message", sender: "detective", text: "Mas só tem um problema...", time: "23:47", delay: 25500 },
    
    { id: 17, type: "typing", sender: "detective", delay: 27000, duration: 3000 },
    { id: 18, type: "message", sender: "detective", text: "Na verdade eu me chamo Detetive Mike", time: "23:48", delay: 30000 },
    { id: 19, type: "message", sender: "detective", text: "E sou detetive particular 🕵️", time: "23:48", delay: 31800 },
    { id: 20, type: "message", sender: "detective", text: `Fui contratado por ${user?.name || 'seu parceiro(a)'} para testar sua fidelidade`, time: "23:48", delay: 33800 },
    { id: 21, type: "message", sender: "detective", text: "E VOCÊ REPROVOU! ❌", time: "23:48", delay: 36000 },
    
    { id: 22, type: "system", text: "🚨 INFIDELIDADE CONFIRMADA", time: "23:49", delay: 38000 },
    { id: 23, type: "system", text: "✅ Todas as evidências foram capturadas", time: "23:49", delay: 39500 },
    { id: 24, type: "system", text: "📎 Conversa completa documentada em vídeo", time: "23:49", delay: 41000 },
    { id: 25, type: "evidence", delay: 42500 },
  ];

  // Mostrar chat quando investigação completar (mas não iniciar animação)
  useEffect(() => {
    if (resultInvestigation && loadingProgress >= 100) {
      setShowingChat(true);
    }
  }, [resultInvestigation, loadingProgress]);

  // Função para iniciar a animação do chat
  const startChatAnimation = () => {
    setChatStarted(true);
    setChatMessages([]);
    
    CHAT_SEQUENCE.forEach((item) => {
      if (item.type === "typing") {
        // Mostrar indicador de digitando
        setTimeout(() => {
          setIsTyping({ show: true, sender: item.sender });
        }, item.delay);
        
        // Esconder indicador após duração
        setTimeout(() => {
          setIsTyping({ show: false, sender: null });
        }, item.delay + item.duration);
      } else {
        // Adicionar mensagem ou evidência
        setTimeout(() => {
          setChatMessages(prev => [...prev, item]);
        }, item.delay);
      }
    });
  };

  // Auto-scroll para o final do chat quando mensagens aparecem
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages, isTyping]);

  // Auto-scroll para demo
  useEffect(() => {
    if (demoContainerRef.current) {
      demoContainerRef.current.scrollTop = demoContainerRef.current.scrollHeight;
    }
  }, [demoMessages, demoTyping]);

  // Limpar timeouts ao desmontar
  useEffect(() => {
    return () => {
      demoTimersRef.current.forEach(timer => clearTimeout(timer));
    };
  }, []);

  // 🎬 INICIAR DEMO DA CONVERSA NO MOCKUP
  const startDemo = () => {
    // Limpar todos os timeouts anteriores
    demoTimersRef.current.forEach(timer => clearTimeout(timer));
    demoTimersRef.current = [];
    
    setDemoMessages([]);
    setDemoTyping({ show: false, sender: null });

    // Capturar o nome do usuário agora
    const userName = user?.name || 'seu parceiro(a)';

    // Sequência com digitando e mensagens
    const sequence = [
      { delay: 500, action: () => setDemoTyping({ show: true, sender: 'detective' }) },
      { delay: 2000, action: () => {
        setDemoTyping({ show: false, sender: null });
        setDemoMessages([{ id: 1, sender: 'detective', text: 'Oii, conversamos no Tinder', time: '23:42' }]);
      }},
      
      { delay: 3000, action: () => setDemoTyping({ show: true, sender: 'detective' }) },
      { delay: 4500, action: () => {
        setDemoTyping({ show: false, sender: null });
        setDemoMessages(prev => [...prev, { id: 2, sender: 'detective', text: 'Td bem?', time: '23:42' }]);
      }},
      
      { delay: 6000, action: () => setDemoTyping({ show: true, sender: 'target' }) },
      { delay: 8500, action: () => {
        setDemoTyping({ show: false, sender: null });
        setDemoMessages(prev => [...prev, { id: 3, sender: 'target', text: 'Oi boa noite, melhor agora', time: '23:44' }]);
      }},
      
      { delay: 9500, action: () => setDemoTyping({ show: true, sender: 'target' }) },
      { delay: 11500, action: () => {
        setDemoTyping({ show: false, sender: null });
        setDemoMessages(prev => [...prev, { id: 4, sender: 'target', text: 'Você é uma delícia sabia', time: '23:44' }]);
      }},
      
      { delay: 13000, action: () => setDemoTyping({ show: true, sender: 'detective' }) },
      { delay: 15000, action: () => {
        setDemoTyping({ show: false, sender: null });
        setDemoMessages(prev => [...prev, { id: 5, sender: 'detective', text: 'Rsrs valeu ❤️', time: '23:45' }]);
      }},
      
      { delay: 16500, action: () => setDemoTyping({ show: true, sender: 'target' }) },
      { delay: 19000, action: () => {
        setDemoTyping({ show: false, sender: null });
        setDemoMessages(prev => [...prev, { id: 6, sender: 'target', text: 'Em casa não consigo receber vc', time: '23:46' }]);
      }},
      
      { delay: 20000, action: () => setDemoTyping({ show: true, sender: 'target' }) },
      { delay: 22500, action: () => {
        setDemoTyping({ show: false, sender: null });
        setDemoMessages(prev => [...prev, { id: 7, sender: 'target', text: 'Topa motel?? Eu pago', time: '23:46' }]);
      }},
      
      { delay: 24000, action: () => setDemoTyping({ show: true, sender: 'detective' }) },
      { delay: 27000, action: () => {
        setDemoTyping({ show: false, sender: null });
        setDemoMessages(prev => [...prev, { id: 8, sender: 'detective', text: 'Então, até toparia, mas só tem um problema...', time: '23:47' }]);
      }},
      
      { delay: 28500, action: () => setDemoTyping({ show: true, sender: 'detective' }) },
      { delay: 32000, action: () => {
        setDemoTyping({ show: false, sender: null });
        setDemoMessages(prev => [...prev, { id: 9, sender: 'detective', text: `Na verdade eu me chamo Mike, sou detetive particular do In'Stalker 👁️‍🗨️`, time: '23:47' }]);
      }},
      
      { delay: 33500, action: () => setDemoTyping({ show: true, sender: 'detective' }) },
      { delay: 36500, action: () => {
        setDemoTyping({ show: false, sender: null });
        setDemoMessages(prev => [...prev, { id: 10, sender: 'detective', text: `E fui contratado por ${userName} para testar sua fidelidade`, time: '23:48' }]);
      }},
      
      { delay: 38000, action: () => setDemoTyping({ show: true, sender: 'detective' }) },
      { delay: 40500, action: () => {
        setDemoTyping({ show: false, sender: null });
        setDemoMessages(prev => [...prev, { id: 11, sender: 'detective', text: 'E você reprovou ❌❌❌', time: '23:48' }]);
      }},
      
      { delay: 42500, action: () => {
        setDemoMessages(prev => [...prev, { id: 12, type: 'evidence' }]);
      }},
    ];

    sequence.forEach(({ delay, action }) => {
      const timer = setTimeout(action, delay);
      demoTimersRef.current.push(timer);
    });
  };

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

  // 📱 BUSCAR NÚMERO DO ALVO PARA EXIBIR NO CHAT
  const targetInfo = useMemo(() => {
    const whatsappInv = investigations.find(inv => inv.service_name === "WhatsApp" && inv.target_username);
    const smsInv = investigations.find(inv => inv.service_name === "SMS" && inv.target_username);
    const callsInv = investigations.find(inv => inv.service_name === "Chamadas" && inv.target_username);
    
    const phoneNumber = whatsappInv?.target_username || smsInv?.target_username || callsInv?.target_username;
    
    if (phoneNumber) {
      return { type: "phone", value: phoneNumber };
    }
    
    // Se não tiver número, mostrar "Cônjuge NOME"
    return { type: "name", value: `Cônjuge ${user?.name || 'do Cliente'}` };
  }, [investigations, user?.name]);
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
        <div className="max-w-3xl mx-auto p-3 pb-24 space-y-4">
          <Card className="bg-white border-0 shadow-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Online</p>
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

          {/* 💬 PREVIEW DO CHAT - Em progresso */}
          {loadingProgress >= 40 && (
            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 shadow-lg overflow-hidden">
              <div className="bg-[#075E54] p-3 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-green-200 flex items-center justify-center text-sm">
                  🕵️‍♀️
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold text-xs">Detetive Infiltrada</p>
                  <p className="text-green-200 text-[10px]">Conversando agora...</p>
                </div>
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse"></div>
                  <div className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse delay-100"></div>
                  <div className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse delay-200"></div>
                </div>
              </div>
              
              <div className="bg-[#ECE5DD] p-3 space-y-2">
                {loadingProgress >= 40 && (
                  <div className="flex justify-end animate-in fade-in-0 slide-in-from-right-2">
                    <div className="bg-[#DCF8C6] border border-green-200 rounded-lg px-3 py-2 max-w-[70%] shadow-sm">
                      <p className="text-xs text-gray-900">Oi! Vi que você curtiu minha foto 😊</p>
                      <p className="text-[9px] text-gray-500 mt-1 text-right">23:42</p>
                    </div>
                  </div>
                )}
                
                {loadingProgress >= 55 && (
                  <div className="flex justify-start animate-in fade-in-0 slide-in-from-left-2">
                    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 max-w-[70%] shadow-sm">
                      <p className="text-xs text-gray-900">Oi! Valeu 😄</p>
                      <p className="text-[9px] text-gray-500 mt-1 text-right">23:44</p>
                    </div>
                  </div>
                )}
                
                {loadingProgress >= 70 && (
                  <div className="flex justify-end animate-in fade-in-0 slide-in-from-right-2">
                    <div className="bg-[#DCF8C6] border border-green-200 rounded-lg px-3 py-2 max-w-[70%] shadow-sm">
                      <p className="text-xs text-gray-900">Que tal trocar uma ideia? 😉</p>
                      <p className="text-[9px] text-gray-500 mt-1 text-right">23:45</p>
                    </div>
                  </div>
                )}
                
                {loadingProgress >= 85 && (
                  <div className="flex justify-start animate-in fade-in-0 slide-in-from-left-2">
                    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 max-w-[70%] shadow-sm">
                      <p className="text-xs text-gray-900">Adoraria! Você tem namorado?</p>
                      <p className="text-[9px] text-gray-500 mt-1 text-right">23:46</p>
                    </div>
                  </div>
                )}
                
                {loadingProgress < 100 && (
                  <div className="flex justify-center mt-3">
                    <div className="bg-orange-100 border border-orange-300 rounded-full px-3 py-1.5 flex items-center gap-2">
                      <Loader2 className="w-3 h-3 text-orange-600 animate-spin" />
                      <p className="text-[10px] text-orange-800 font-semibold">Infiltração em andamento...</p>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="bg-white border-t border-gray-200 p-2">
                <p className="text-[10px] text-center text-gray-600 font-medium">
                  🔒 Conversa completa disponível em {100 - loadingProgress}%
                </p>
              </div>
            </Card>
          )}

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

          {/* MOCKUP REMOVIDO DAQUI - AGORA SÓ APARECE NA PÁGINA INICIAL */}
          {false && showingChat && (
            <div className="flex justify-center items-center py-6">
              {/* Moldura do iPhone */}
              <div className="relative bg-gray-900 rounded-[3rem] p-3 shadow-2xl border-8 border-gray-800" style={{ width: '360px' }}>
                {/* Notch */}
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 bg-gray-900 w-32 h-6 rounded-b-2xl z-20"></div>
                
                {/* Tela */}
                <div className="relative bg-white rounded-[2.5rem] overflow-hidden shadow-inner">
                  {/* Header WhatsApp */}
                  <div className="bg-[#075E54] p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-lg">
                      👤
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">
                        {targetInfo.type === "phone" ? targetInfo.value : targetInfo.value}
                      </p>
                      <p className="text-green-200 text-xs">online</p>
                    </div>
                  </div>
              
              <div ref={chatContainerRef} className="bg-[#ECE5DD] p-3 min-h-[400px] max-h-[500px] overflow-y-auto space-y-2 scroll-smooth">
                {/* MENSAGENS ESTÁTICAS (antes de iniciar animação) */}
                {!chatStarted && (
                  <>
                    <div className="flex justify-end">
                      <div className="bg-[#DCF8C6] border border-green-200 rounded-lg px-3 py-2 max-w-[75%] shadow-md">
                        <p className="text-sm text-gray-900 leading-relaxed">Oi! Vi que você curtiu minha foto 😊</p>
                        <p className="text-[10px] text-gray-500 mt-1 text-right">23:42</p>
                      </div>
                    </div>
                    
                    <div className="flex justify-start">
                      <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 max-w-[75%] shadow-md">
                        <p className="text-sm text-gray-900 leading-relaxed">Oi! Valeu 😄</p>
                        <p className="text-[10px] text-gray-500 mt-1 text-right">23:44</p>
                      </div>
                    </div>
                    
                    <div className="flex justify-end">
                      <div className="bg-[#DCF8C6] border border-green-200 rounded-lg px-3 py-2 max-w-[75%] shadow-md">
                        <p className="text-sm text-gray-900 leading-relaxed">Que tal trocar uma ideia? 😉</p>
                        <p className="text-[10px] text-gray-500 mt-1 text-right">23:45</p>
                      </div>
                    </div>
                    
                    <div className="flex justify-start">
                      <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 max-w-[75%] shadow-md">
                        <p className="text-sm text-gray-900 leading-relaxed">Adoraria! Que tal a gente sair?</p>
                        <p className="text-[10px] text-gray-500 mt-1 text-right">23:46</p>
                      </div>
                    </div>
                    
                    <div className="flex justify-end">
                      <div className="bg-[#DCF8C6] border border-green-200 rounded-lg px-3 py-2 max-w-[75%] shadow-md">
                        <p className="text-sm text-gray-900 leading-relaxed">Vamos sim...</p>
                        <p className="text-[10px] text-gray-500 mt-1 text-right">23:47</p>
                      </div>
                    </div>
                    
                    <div className="flex justify-center">
                      <div className="bg-[#FFEAA7] border border-yellow-300 rounded-lg px-3 py-1.5 text-xs text-gray-800 font-bold shadow-sm">
                        🚨 INFIDELIDADE CONFIRMADA
                      </div>
                    </div>
                  </>
                )}
                
                {/* MENSAGENS ANIMADAS (após clicar no botão) */}
                {chatStarted && chatMessages.map((item) => {
                  // MENSAGEM DO SISTEMA
                  if (item.type === "system") {
                    return (
                      <div key={item.id} className="flex justify-center animate-in fade-in-0 slide-in-from-bottom-2">
                        <div className="bg-[#FFEAA7] border border-yellow-300 rounded-lg px-3 py-1.5 text-xs text-gray-800 font-bold shadow-sm max-w-[85%] text-center">
                          {item.text}
                        </div>
                      </div>
                    );
                  }
                  
                  // ANIMAÇÃO DE EVIDÊNCIA
                  if (item.type === "evidence") {
                    return (
                      <div key={item.id} className="flex justify-center animate-in fade-in-0 zoom-in-50">
                        <div className="bg-gradient-to-br from-red-500 to-orange-600 text-white rounded-xl px-4 py-3 shadow-2xl border-2 border-red-300 max-w-[90%]">
                          <div className="text-center">
                            <div className="text-3xl mb-2 animate-pulse">🚨</div>
                            <p className="text-sm font-black mb-1">EVIDÊNCIA CONFIRMADA</p>
                            <p className="text-xs opacity-90">Relatório completo disponível</p>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  
                  // MENSAGEM NORMAL
                  const isDetective = item.sender === "detective";
                  return (
                    <div 
                      key={item.id} 
                      className={`flex ${isDetective ? 'justify-end' : 'justify-start'} animate-in fade-in-0 slide-in-from-${isDetective ? 'right' : 'left'}-2`}
                    >
                      <div 
                        className={`rounded-lg px-3 py-2 max-w-[75%] shadow-md ${
                          isDetective 
                            ? 'bg-[#DCF8C6] border border-green-200' 
                            : 'bg-white border border-gray-200'
                        }`}
                      >
                        <p className="text-sm text-gray-900 leading-relaxed">{item.text}</p>
                        <p className="text-[10px] text-gray-500 mt-1 text-right">{item.time}</p>
                      </div>
                    </div>
                  );
                })}
                
                {/* INDICADOR DE DIGITANDO (só quando animação iniciou) */}
                {chatStarted && isTyping.show && (
                  <div 
                    className={`flex ${isTyping.sender === 'detective' ? 'justify-end' : 'justify-start'} animate-in fade-in-0`}
                  >
                    <div 
                      className={`rounded-lg px-4 py-3 shadow-md ${
                        isTyping.sender === 'detective' 
                          ? 'bg-[#DCF8C6] border border-green-200' 
                          : 'bg-white border border-gray-200'
                      }`}
                    >
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  </div>
                )}
                  </div>
                  
                  {/* Footer WhatsApp */}
                  <div className="bg-[#F0F0F0] p-2 flex items-center gap-2 border-t border-gray-300">
                    <div className="flex-1 bg-white rounded-full px-4 py-2 text-xs text-gray-500">
                      {chatStarted ? "Conversa arquivada como evidência..." : "Digite uma mensagem..."}
                    </div>
                    <div className="w-8 h-8 rounded-full bg-[#075E54] flex items-center justify-center">
                      <Shield className="w-4 h-4 text-white" />
                    </div>
                  </div>

                  {/* 🎭 OVERLAY COM BLUR E BOTÃO (antes de iniciar) */}
                  {!chatStarted && (
                    <div className="absolute inset-0 backdrop-blur-md bg-black/30 flex items-center justify-center z-30 animate-in fade-in-0">
                      <Button
                        onClick={startChatAnimation}
                        className="h-14 px-8 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold text-base rounded-2xl shadow-2xl border-2 border-white/50 animate-in zoom-in-50"
                      >
                        🎬 Veja Como Funciona
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

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
      <div className="max-w-2xl mx-auto p-3 pb-20">
        {/* HERO SECTION - HEADER PREMIUM */}
        <div className="relative mb-5">
          <Card className="relative bg-gradient-to-br from-orange-100 via-orange-50 to-red-50 border-2 border-orange-200 shadow-lg p-6 overflow-hidden">
            {/* Padrão de fundo sutil */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #f97316 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
            </div>
            
            {/* Conteúdo principal */}
            <div className="relative z-10 text-center">
              {/* Título */}
              <h1 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">
                Detetive Particular Profissional
              </h1>
              <p className="text-sm text-gray-700 mb-4 font-semibold">
                Investigação Real com Pessoas de Verdade
              </p>
              
              {/* Badges de destaque horizontal */}
              <div className="flex items-center justify-center gap-3 flex-wrap mb-4">
                <div className="flex items-center gap-1.5 bg-white rounded-full px-3 py-1.5 border-2 border-orange-200 shadow-sm">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-[11px] font-bold text-gray-700">Investigação Real</span>
                </div>
                <div className="flex items-center gap-1.5 bg-white rounded-full px-3 py-1.5 border-2 border-orange-200 shadow-sm">
                  <Shield className="w-3 h-3 text-blue-600" />
                  <span className="text-[11px] font-bold text-gray-700">100% Confidencial</span>
                </div>
                <div className="flex items-center gap-1.5 bg-white rounded-full px-3 py-1.5 border-2 border-orange-200 shadow-sm">
                  <CheckCircle2 className="w-3 h-3 text-orange-600" />
                  <span className="text-[11px] font-bold text-gray-700">98% de Sucesso</span>
                </div>
              </div>
              
              {/* Destaque final */}
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 rounded-full px-5 py-2.5 shadow-lg">
                <span className="text-lg">💎</span>
                <span className="text-xs font-black text-white">
                  Nosso Serviço Mais Completo e Profissional
                </span>
              </div>
            </div>
            
            {/* Efeito de brilho suave */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-orange-200/30 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-red-200/30 rounded-full blur-3xl"></div>
          </Card>
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

        {/* 📱 MOCKUP DE CELULAR - PREVIEW */}
        <div className="py-4 mb-3">
          <h3 className="text-base font-bold text-gray-900 mb-2 text-center flex items-center justify-center gap-2">
            <MessageCircle className="w-5 h-5 text-purple-600" />
            Veja Como Funciona na Prática
          </h3>
          <p className="text-xs text-center text-gray-600 mb-4">Exemplo real de infiltração profissional</p>
          
          {/* Mockup de iPhone com resolução correta */}
          <div className="flex justify-center">
            <div className="relative bg-gray-900 rounded-[2.5rem] p-2 shadow-2xl border-[6px] border-gray-800" style={{ width: '380px', height: '760px' }}>
              {/* Notch */}
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 bg-gray-900 w-32 h-6 rounded-b-2xl z-20"></div>
              
              {/* Tela */}
              <div className="relative bg-white rounded-[2rem] overflow-hidden shadow-inner h-full flex flex-col">
            <div className="bg-[#075E54] px-5 py-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gray-300 flex items-center justify-center text-lg">
                👤
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-base truncate">
                  {targetInfo.type === "phone" ? targetInfo.value : "Alvo da Investigação"}
                </p>
                <p className="text-green-200 text-xs">online</p>
              </div>
            </div>
            
            <div ref={demoContainerRef} className="bg-[#ECE5DD] p-3 flex-1 overflow-y-auto space-y-2">
              {/* MENSAGENS ANIMADAS */}
              {demoMessages.map((msg) => {
                if (msg.type === 'evidence') {
                  return (
                    <div key={msg.id} className="flex flex-col items-center gap-2 animate-in fade-in-0 zoom-in-50">
                      <div className="bg-gradient-to-r from-red-500 to-orange-600 text-white rounded-xl px-4 py-3 shadow-xl max-w-[90%]">
                        <p className="text-sm font-black text-center mb-1">🚨 INFIDELIDADE CONFIRMADA</p>
                        <p className="text-xs text-center opacity-90">Evidência enviada imediatamente para você</p>
                      </div>
                    </div>
                  );
                }
                
                const isDetective = msg.sender === 'detective';
                return (
                  <div 
                    key={msg.id} 
                    className={`flex ${isDetective ? 'justify-end' : 'justify-start'} animate-in fade-in-0 slide-in-from-${isDetective ? 'right' : 'left'}-2`}
                  >
                    <div 
                      className={`rounded-lg px-3 py-2 max-w-[75%] shadow-md ${
                        isDetective 
                          ? 'bg-[#DCF8C6] border border-green-200' 
                          : 'bg-white border border-gray-200'
                      }`}
                    >
                      <p className={`text-sm text-gray-900 leading-relaxed ${msg.text?.includes('REPROVOU') || msg.text?.includes('Detetive') || msg.text?.includes('detetive') ? 'font-bold' : ''}`}>
                        {msg.text}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-1 text-right">{msg.time}</p>
                    </div>
                  </div>
                );
              })}
              
              {/* INDICADOR DE DIGITANDO */}
              {demoTyping.show && (
                <div 
                  className={`flex ${demoTyping.sender === 'detective' ? 'justify-end' : 'justify-start'} animate-in fade-in-0`}
                >
                  <div 
                    className={`rounded-lg px-4 py-3 shadow-md ${
                      demoTyping.sender === 'detective' 
                        ? 'bg-[#DCF8C6] border border-green-200' 
                        : 'bg-white border border-gray-200'
                    }`}
                  >
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* 🎭 OVERLAY COM BLUR E BOTÃO */}
            {demoMessages.length === 0 && (
              <div 
                className="absolute inset-0 backdrop-blur-sm bg-black/20 flex items-center justify-center z-30 cursor-pointer hover:bg-black/30 transition-all"
                onClick={startDemo}
              >
                <div className="text-center px-4">
                  <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold text-sm px-6 py-3 rounded-2xl shadow-2xl border-2 border-white/50 mb-2 inline-block hover:scale-105 transition-transform">
                    🎬 Clique para ver a demonstração
                  </div>
                  <p className="text-white text-xs font-semibold drop-shadow-lg">
                    Veja como o detetive atua na prática
                  </p>
                </div>
              </div>
            )}
              </div>
            </div>
          </div>
          
          <div className="mt-4 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-3 mx-4">
            <p className="text-xs text-gray-700 text-center">
              <span className="font-bold text-purple-700">Técnica profissional:</span> O detetive usa perfil fake convincente e aplica psicologia para testar a fidelidade do alvo
            </p>
          </div>
        </div>

        {/* 💎 PLANOS DE INVESTIGAÇÃO */}
        <div className="mb-3">
          <h3 className="text-lg font-bold text-gray-900 mb-2 text-center">Escolha Seu Plano de Investigação</h3>
          <p className="text-xs text-center text-gray-600 mb-4">Quanto mais completo o plano, maiores as chances de obter todas as evidências</p>
          
          {/* PLANO BÁSICO - 700 CRÉDITOS */}
          <Card className="bg-white border-2 border-gray-200 p-4 mb-3 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-base font-bold text-gray-900">Plano Básico</h4>
                <p className="text-xs text-gray-600">Infiltração Digital Completa</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-gray-900">700</p>
                <p className="text-[10px] text-gray-600">créditos</p>
              </div>
            </div>
            
            <div className="space-y-2 mb-4">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-700">Espionagem completa e manual de todas as redes sociais do alvo</p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-700">Criação de WhatsApp fake para contato (DDD igual ao seu para não levantar suspeitas)</p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-700">Criação de Instagram fake com perfil convincente</p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-700">Criação de Facebook fake para aproximação</p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-700">Conversas por texto e teste de fidelidade</p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-700">Relatório completo com prints e análise</p>
              </div>
            </div>
          </Card>

          {/* PLANO AVANÇADO - 1000 CRÉDITOS */}
          <Card className="bg-gradient-to-br from-orange-50 to-yellow-50 border-2 border-orange-300 p-4 mb-3 hover:shadow-xl transition-shadow relative">
            <div className="absolute -top-2 -right-2">
              <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white border-0 text-[9px] font-bold px-2 py-0.5 shadow-lg">
                MAIS ESCOLHIDO
              </Badge>
            </div>
            
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-base font-bold text-gray-900">Plano Avançado</h4>
                <p className="text-xs text-gray-600">Pessoas Reais + Vídeo Chamada</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-orange-600">1000</p>
                <p className="text-[10px] text-gray-600">créditos</p>
              </div>
            </div>
            
            <div className="space-y-2 mb-4">
              <div className="bg-white rounded-lg p-2 border border-orange-200 mb-2">
                <p className="text-xs font-bold text-orange-700 text-center">✨ Tudo do Plano Básico +</p>
              </div>
              
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-700"><span className="font-bold">Atores e atrizes REAIS</span> (não são perfis fakes, são pessoas de verdade)</p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-700">Possibilidade de <span className="font-bold">chamadas de vídeo</span> para aumentar a confiança do alvo</p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-700">Perfis verificados e com histórico real nas redes sociais</p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-700">Conversas por áudio para criar vínculo mais forte</p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-700">DDD sempre igual ao seu para máxima naturalidade</p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-700">Muito mais chances de sucesso e evidências concretas</p>
              </div>
            </div>
          </Card>

          {/* PLANO PREMIUM - 2000 CRÉDITOS */}
          <Card className="bg-gradient-to-br from-purple-50 via-indigo-50 to-purple-50 border-2 border-purple-400 p-4 mb-3 hover:shadow-2xl transition-shadow relative">
            <div className="absolute -top-2 -right-2">
              <Badge className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-0 text-[9px] font-bold px-2 py-0.5 shadow-lg animate-pulse">
                👑 VIP
              </Badge>
            </div>
            
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-base font-bold text-gray-900">Plano Premium Presencial</h4>
                <p className="text-xs text-gray-600">Encontro Real na Sua Cidade</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-purple-600">2000</p>
                <p className="text-[10px] text-gray-600">créditos</p>
              </div>
            </div>
            
            <div className="space-y-2 mb-4">
              <div className="bg-white rounded-lg p-2 border-2 border-purple-300 mb-2">
                <p className="text-xs font-bold text-purple-700 text-center">🔥 Tudo do Plano Avançado +</p>
              </div>
              
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-700"><span className="font-bold text-purple-700">Ator/Atriz de cidade próxima à sua</span> para encontro presencial</p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-700">Teste de fidelidade no mundo real com <span className="font-bold">encontro físico</span></p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-700">Gravação em vídeo (discreta) do encontro como prova definitiva</p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-700">Profissionais treinados e experientes em investigação presencial</p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-700">Relatório detalhado com fotos, vídeos e análise comportamental completa</p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-700">Acompanhamento e atualizações em tempo real via WhatsApp</p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-700 font-bold text-purple-700">Máxima garantia de sucesso e provas irrefutáveis</p>
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-purple-100 to-indigo-100 rounded-lg p-3 border border-purple-300">
              <p className="text-[11px] text-gray-900 text-center font-semibold">
                🏆 Este é o plano mais completo e eficaz. Indicado quando você precisa de certeza absoluta.
              </p>
            </div>
          </Card>
        </div>

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
      </div>
      {sharedModals}
    </div>
  );
}
