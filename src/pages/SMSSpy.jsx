import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MessageCircle, Phone, CheckCircle2, Zap, Loader2, Search, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ConfirmModal from "../components/dashboard/ConfirmModal";

export default function SMSSpy() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [currentScreen, setCurrentScreen] = useState("input");
  const [loadingProgress, setLoadingProgress] = useState(0);
  // Removed: const [userProfile, setUserProfile] = useState(null);
  const [showCreditAlert, setShowCreditAlert] = useState(false);
  const [creditsSpent, setCreditsSpent] = useState(0);
  const [xpGained, setXpGained] = useState(0);
  const [messages, setMessages] = useState([]);
  const [visibleMessages, setVisibleMessages] = useState(6);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChat, setSelectedChat] = useState(null);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockedChats, setUnlockedChats] = useState([]);
  const [showAccelerateButton, setShowAccelerateButton] = useState(false);
  const autoStarted = useRef(false);
  const progressTimerRef = useRef(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertConfig, setAlertConfig] = useState({});

  // ✅ RESET autoStarted QUANDO COMPONENTE É MONTADO
  useEffect(() => {
    autoStarted.current = false;
    return () => {
      autoStarted.current = false;
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    };
  }, []);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: Infinity,
    cacheTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 0,
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
    refetchOnReconnect: false,
    retry: 0,
  });

  const activeSMSInvestigation = investigations.find(
    inv => inv.service_name === "SMS" && inv.status === "processing"
  );

  const completedSMSInvestigation = investigations.find(
    inv => inv.service_name === "SMS" && (inv.status === "completed" || inv.status === "accelerated")
  );

  // ✅ 3. REDIRECIONAR PARA RESULTS SE JÁ ESTÁ COMPLETED
  useEffect(() => {
    if (completedSMSInvestigation && (currentScreen === "input" || currentScreen === "loading")) {
      const phone = completedSMSInvestigation.target_username;
      if (!messages || messages.length === 0) {
        generateMessages(phone);
      }
      setCurrentScreen("results");
    }
  }, [completedSMSInvestigation?.id, currentScreen, messages?.length]);


  // CARREGAR CHATS DESBLOQUEADOS E MENSAGENS VISÍVEIS DO LOCALSTORAGE
  useEffect(() => {
    if (phoneNumber) {
      const savedUnlocked = localStorage.getItem(`sms_unlocked_${phoneNumber}`);
      if (savedUnlocked) {
        try {
          setUnlockedChats(JSON.parse(savedUnlocked));
        } catch (error) {
          console.error("Erro ao carregar chats desbloqueados:", error);
        }
      }

      const savedVisibleMessages = localStorage.getItem(`sms_visible_${phoneNumber}`);
      if (savedVisibleMessages) {
        try {
          const visible = parseInt(savedVisibleMessages);
          if (!isNaN(visible) && visible > 6) {
            setVisibleMessages(visible);
          }
        } catch (error) {
          console.error("Erro ao carregar mensagens visíveis:", error);
        }
      }
    }
  }, [phoneNumber]);

  // ✅ AUTO-START - UMA VEZ SÓ
  useEffect(() => {
    if (autoStarted.current) return;
    if (!user || !userProfile || investigations.length === 0) return;

    // The logic below relies on investigations being up-to-date
    // So, if an active investigation completes, refetch() is called,
    // which triggers this useEffect again, and this time completedSMSInvestigation will be found.

    if (completedSMSInvestigation) {
      const phone = completedSMSInvestigation.target_username;
      setPhoneNumber(phone);
      localStorage.setItem('saved_phone_sms', phone);

      const savedMessages = localStorage.getItem(`sms_messages_${phone}`);
      if (savedMessages) {
        try {
          setMessages(JSON.parse(savedMessages));
          setCurrentScreen("results");
          autoStarted.current = true; // Mark as started after setting everything up
          return;
        } catch (e) {
          console.error("Erro ao carregar mensagens:", e);
        }
      }

      generateMessages(phone);
      setCurrentScreen("results");
      autoStarted.current = true; // Mark as started after setting everything up
      return;
    }

    if (activeSMSInvestigation) {
      const phone = activeSMSInvestigation.target_username;
      setPhoneNumber(phone);
      localStorage.setItem('saved_phone_sms', phone);
      setCurrentScreen("loading");
      setLoadingProgress(activeSMSInvestigation.progress); // Initialize with DB progress
      autoStarted.current = true; // Mark as started after setting everything up
      return;
    }

    const whatsappInvestigation = investigations
      .filter(inv => inv.service_name === "WhatsApp" && inv.target_username)
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];

    const callsInvestigation = investigations
      .filter(inv => inv.service_name === "Chamadas" && inv.target_username)
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];

    if (whatsappInvestigation || callsInvestigation) {
      const phone = whatsappInvestigation?.target_username || callsInvestigation?.target_username;
      setPhoneNumber(phone);
      startInvestigation(phone);
      autoStarted.current = true; // Mark as started after setting everything up
      return;
    }
    
    autoStarted.current = true; // If no investigations found, ensure it doesn't re-run
    setCurrentScreen("input");
  }, [user?.email, userProfile?.id, investigations.length, completedSMSInvestigation, activeSMSInvestigation]);

  useEffect(() => {
    if (currentScreen !== "loading") return;
    if (loadingProgress < 1 || loadingProgress >= 100) {
      setShowAccelerateButton(false);
      return;
    }
    setShowAccelerateButton(true);
  }, [currentScreen, loadingProgress]);

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
      // Silently fail if AudioContext is not supported or there's an issue
    }
  };

  const formatPhone = (value) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const getDDD = (phone) => {
    const numbers = phone.replace(/\D/g, '');
    return numbers.slice(0, 2);
  };

  const maskPhonePartial = (phone) => {
    const numbers = phone.replace(/\D/g, '');
    const ddd = numbers.slice(0, 2);
    return `(${ddd}) *****-****`;
  };

  // ✅ MENSAGENS FIXAS - SÓ MUDA O DDD
  const generateMessages = (targetPhone) => {
    const savedMessages = localStorage.getItem(`sms_messages_${targetPhone}`);
    if (savedMessages) {
      try {
        setMessages(JSON.parse(savedMessages));
        return;
      } catch (error) {
        console.error("Erro ao carregar mensagens:", error);
      }
    }

    const targetDDD = getDDD(targetPhone);
    const now = new Date();
    
    // ✅ MENSAGENS FIXAS - SEMPRE AS MESMAS
    const fixedMessages = [
      // PRIMEIRA MENSAGEM SEMPRE
      { text: "Não posso falar com vc no whatsapp", sameDDD: true, isSpam: false, hoursAgo: 2 },
      
      // MESMO DDD (14 mensagens)
      { text: "Tá sem net??", sameDDD: true, isSpam: false, hoursAgo: 3 },
      { text: "To aqui ja, cade vc?", sameDDD: true, isSpam: false, hoursAgo: 5 },
      { text: "Oi amor", sameDDD: true, isSpam: false, hoursAgo: 8 },
      { text: "To te esperando aqui", sameDDD: true, isSpam: false, hoursAgo: 12 },
      { text: "Me desbloqueia no wpp por favor 😢", sameDDD: true, isSpam: false, hoursAgo: 18 },
      { text: "Consegue sair hj a noite?", sameDDD: true, isSpam: false, hoursAgo: 24 },
      { text: "Oii", sameDDD: true, isSpam: false, hoursAgo: 30 },
      { text: "Sumiu??", sameDDD: true, isSpam: false, hoursAgo: 36 },
      { text: "Você vem ou não?", sameDDD: true, isSpam: false, hoursAgo: 42 },
      { text: "Bom diaaa ❤️", sameDDD: true, isSpam: false, hoursAgo: 48 },
      { text: "Liga pra mim qnd puder", sameDDD: true, isSpam: false, hoursAgo: 54 },
      { text: "Chegou bem?", sameDDD: true, isSpam: false, hoursAgo: 60 },
      { text: "Me avisa", sameDDD: true, isSpam: false, hoursAgo: 66 },
      { text: "Oi sumido", sameDDD: true, isSpam: false, hoursAgo: 72 },
      
      // OUTROS DDDs (15 mensagens)
      { text: "TINDER: Você tem 3 novos matches!", sameDDD: false, isSpam: true, hoursAgo: 4 },
      { text: "Badoo: Você tem 5 visualizações no seu perfil hoje", sameDDD: false, isSpam: true, hoursAgo: 6 },
      { text: "Código de verificação Telegram: 456789", sameDDD: false, isSpam: true, hoursAgo: 10 },
      { text: "Nubank: Transferência recebida de R$350,00", sameDDD: false, isSpam: true, hoursAgo: 14 },
      { text: "To com saudade", sameDDD: false, isSpam: false, hoursAgo: 20 },
      { text: "Qnd vc vem?", sameDDD: false, isSpam: false, hoursAgo: 26 },
      { text: "Netflix: Seu código de verificação é 456789", sameDDD: false, isSpam: true, hoursAgo: 32 },
      { text: "iFood: Pedido #34521 saiu para entrega", sameDDD: false, isSpam: true, hoursAgo: 38 },
      { text: "Não vai responder não? 😔", sameDDD: false, isSpam: false, hoursAgo: 44 },
      { text: "PicPay: Compra aprovada no valor de R$127,50", sameDDD: false, isSpam: true, hoursAgo: 50 },
      { text: "Acabou", sameDDD: false, isSpam: false, hoursAgo: 56 },
      { text: "Vc ta bem?", sameDDD: false, isSpam: false, hoursAgo: 62 },
      { text: "Rappi: Código de confirmação 673291", sameDDD: false, isSpam: true, hoursAgo: 68 },
      { text: "Preciso falar com vc", sameDDD: false, isSpam: false, hoursAgo: 74 },
      { text: "Magalu: OFERTA RELÂMPAGO! 70% desconto", sameDDD: false, isSpam: true, hoursAgo: 80 }
    ];

    const generatedMessages = fixedMessages.map((msg, index) => {
      const messageDate = new Date(now.getTime() - msg.hoursAgo * 60 * 60 * 1000);
      const ddd = msg.sameDDD ? targetDDD : (msg.isSpam && Math.random() < 0.5 ? '0800' : '11');
      
      let fullPhone;
      if (ddd === '0800') {
        const randomNumber = Math.floor(10000000 + Math.random() * 90000000).toString().slice(0, 7);
        fullPhone = `${ddd} ${randomNumber.slice(0, 3)} ${randomNumber.slice(3)}`;
      } else {
        fullPhone = `(${ddd}) *****-****`;
      }

      let timeText;
      if (msg.hoursAgo < 24) {
        timeText = `Hoje, ${messageDate.getHours().toString().padStart(2, '0')}:${messageDate.getMinutes().toString().padStart(2, '0')}`;
      } else if (msg.hoursAgo < 48) {
        timeText = `Ontem, ${messageDate.getHours().toString().padStart(2, '0')}:${messageDate.getMinutes().toString().padStart(2, '0')}`;
      } else {
        const days = Math.floor(msg.hoursAgo / 24);
        timeText = `${days} dias atrás, ${messageDate.getHours().toString().padStart(2, '0')}:${messageDate.getMinutes().toString().padStart(2, '0')}`;
      }

      return {
        id: `msg-${index}`,
        phone: fullPhone,
        ddd: ddd,
        sameDDD: msg.sameDDD,
        time: timeText,
        preview: msg.text,
        timestamp: messageDate.getTime(),
        isSpam: msg.isSpam,
        page: Math.floor(index / 6)
      };
    });

    generatedMessages.sort((a, b) => b.timestamp - a.timestamp);
    localStorage.setItem(`sms_messages_${targetPhone}`, JSON.stringify(generatedMessages));
    setMessages(generatedMessages);
  };

  const generateChatMessages = (contactPhone, previewMessage, previewTime) => {
    // Verificar cache
    const savedChat = localStorage.getItem(`sms_chat_${contactPhone}_${previewMessage}`);
    if (savedChat) {
      try {
        return JSON.parse(savedChat);
      } catch (error) {
        console.error("Erro ao carregar chat:", error);
      }
    }

    const now = new Date();

    const spamTextsList = [
      "TINDER:", "Match.com:", "Happn:", "Badoo:", "Bumble:", "Par Perfeito:",
      "Codigo", "WhatsApp Business:", "Confirme", "Nubank:", "PicPay:",
      "Banco Inter:", "C6 Bank:", "Confirmacao", "PROMOCAO!", "Netflix:",
      "iFood:", "Mercado Livre:", "Rappi:", "99:", "Magalu:", "Americanas:"
    ];

    const isSpamMessage = spamTextsList.some(spamText =>
      previewMessage.includes(spamText)
    );

    if (contactPhone.startsWith('0800') || contactPhone.includes('0800') || isSpamMessage) {
      const spamCount = Math.floor(Math.random() * 3) + 2;
      const allSpamTexts = [
        "TINDER: Codigo de verificacao 749382",
        "Match.com: Alguem curtiu seu perfil",
        "Happn: Nova mensagem de um match",
        "Badoo: 3 novas curtidas no seu perfil",
        "Bumble: Alguem esta esperando sua resposta",
        "Par Perfeito: 2 pessoas combinam com vc",
        "Nubank: Compra aprovada R$89,90",
        "PicPay: Transferencia recebida R$50,00",
        "Banco Inter: Saque de R$200 realizado",
        "C6 Bank: Seu limite foi aumentado",
        "Pedido #78945 confirmado - Mercado Livre",
        "PROMOCAO 50% OFF ate meia-noite",
        "Entrega prevista para hoje 14h-18h",
        "Fatura vencendo em 3 dias - pague agora",
        "Netflix codigo de acesso: 456789",
        "iFood: Seu pedido saiu para entrega",
        "Rappi: Codigo de confirmacao 673291",
        "99: Corrida agendada para 15h30",
        "Magalu: OFERTA RELAMPAGO 70% desconto",
        "Americanas: Pedido entregue hoje",
        "Uber: Codigo de verificacao 892456",
        "Telegram: Use o codigo 234567",
        "WhatsApp Business: Confirme codigo 789012",
        "Hotmart: Nova compra realizada",
        "PayPal: Pagamento recebido USD 25.00"
      ];

      const spamMessages = [];
      const previewTimeMatch = previewTime.match(/(\d{2}):(\d{2})/);
      let baseTime = new Date();

      if (previewTimeMatch) {
        const previewHour = parseInt(previewTimeMatch[1]);
        const previewMinute = parseInt(previewTimeMatch[2]);
        baseTime.setHours(previewHour, previewMinute, 0, 0);

        if (previewTime.includes('Ontem')) {
          baseTime.setDate(baseTime.getDate() - 1);
        } else if (previewTime.includes('dias atrás')) {
          const daysMatch = previewTime.match(/(\d+) dias/);
          if (daysMatch) {
            baseTime.setDate(baseTime.getDate() - parseInt(daysMatch[1]));
          }
        } else if (previewTime.includes('Anteontem')) {
          baseTime.setDate(baseTime.getDate() - 2);
        }
      }

      if (baseTime.getTime() > now.getTime()) {
        baseTime = new Date(now.getTime() - 60 * 60 * 1000);
      }

      // Adicionar mensagens ANTERIORES (mais antigas) PRIMEIRO
      for (let i = 1; i < spamCount; i++) {
        const availableSpam = allSpamTexts.filter(t =>
          t !== previewMessage && !spamMessages.some(m => m.text === t)
        );

        if (availableSpam.length === 0) break;

        const spamText = availableSpam[Math.floor(Math.random() * availableSpam.length)];
        const minutesBefore = 30 + Math.floor(Math.random() * 120);
        const msgTime = new Date(baseTime.getTime() - (spamCount - i) * minutesBefore * 60 * 1000);

        spamMessages.push({
          text: spamText,
          sent: false,
          time: `${msgTime.getHours().toString().padStart(2, '0')}:${msgTime.getMinutes().toString().padStart(2, '0')}`
        });
      }

      // ✅ PREVIEW MESSAGE É SEMPRE A ÚLTIMA (mais recente)
      spamMessages.push({
        text: previewMessage,
        sent: false,
        time: `${baseTime.getHours().toString().padStart(2, '0')}:${baseTime.getMinutes().toString().padStart(2, '0')}`
      });

      localStorage.setItem(`sms_chat_${contactPhone}_${previewMessage}`, JSON.stringify(spamMessages));
      return spamMessages;
    }

    // Conversas PICANTES - SEM GÊNERO, APIMENTADAS
    const conversationTemplates = {
      "chifre": [
        { text: "Pq", sent: false, delay: -8 },
        { text: "A pessoa ta desconfiando", sent: true, delay: -6 },
        { text: "Serio", sent: false, delay: -4 },
        { text: "Acho q ela viu a gnt", sent: true, delay: -2 },
        { text: "Nao posso falar no wpp", sent: true }
      ],
      "aqui": [
        { text: "Vai demorar mt", sent: false, delay: -30 },
        { text: "Saindo agora 10 min", sent: true, delay: -20 },
        { text: "Ok to esperando", sent: false, delay: -10 },
        { text: "To aqui ja cade vc", sent: false }
      ],
      "amor": [
        { text: "Oi delicia", sent: false, delay: -8 },
        { text: "Oi td bem", sent: true, delay: -5 },
        { text: "To com saudade", sent: false, delay: -3 },
        { text: "Tb to", sent: true, delay: -1 },
        { text: "Oi amor", sent: false }
      ],
      "wpp": [
        { text: "Me desbloqueia no wpp", sent: false, delay: -5 },
        { text: "Nao te bloqueei", sent: true, delay: -3 },
        { text: "Ta falando q nao existe", sent: false, delay: -1 },
        { text: "Meu zap ta bugado me manda msg aqui", sent: true }
      ],
      "sair": [
        { text: "Consegue sair hj a noite", sent: false, delay: -15 },
        { text: "Acho q sim q horas", sent: true, delay: -10 },
        { text: "Umas 21h no lugar de sempre", sent: false, delay: -5 },
        { text: "E ai vai dar hj", sent: true }
      ],
      "Sumiu": [
        { text: "Oii", sent: false, delay: -10 },
        { text: "Oi desculpa demora", sent: true, delay: -5 },
        { text: "Ta tudo bem", sent: false, delay: -2 },
        { text: "Sumiu", sent: false }
      ],
      "vem": [
        { text: "Bora se encontrar hj", sent: false, delay: -8 },
        { text: "Onde seria", sent: true, delay: -5 },
        { text: "Perto da sua casa", sent: false, delay: -2 },
        { text: "Vc vem ou nao", sent: false }
      ],
      "Bom dia": [
        { text: "Bom diaaa", sent: false, delay: -20 },
        { text: "Bom dia dormiu bem", sent: true, delay: -15 },
        { text: "Q horas dormiu", sent: false, delay: -10 },
        { text: "Tarde demais umas 4h", sent: true, delay: -5 },
        { text: "To com tesao em vc", sent: false }
      ],
      "sumido": [
        { text: "Oi sumido", sent: false, delay: -20 },
        { text: "Oi desculpa nao responder", sent: true, delay: -15 },
        { text: "Ta ocupado demais pra mim", sent: false, delay: -10 },
        { text: "Nao e isso tava sem tempo", sent: true, delay: -5 },
        { text: "Qnd a gnt se ve", sent: false }
      ],
      "responder": [
        { text: "Oi", sent: false, delay: -15 },
        { text: "Me responde", sent: false, delay: -10 },
        { text: "Por favor", sent: false, delay: -5 },
        { text: "Nao vai responder nao", sent: false }
      ],
      "Acabou": [
        { text: "Preciso falar com vc", sent: false, delay: -10 },
        { text: "Fala", sent: true, delay: -8 },
        { text: "Nao da mais", sent: false, delay: -5 },
        { text: "Nao da mais pra continuar", sent: false, delay: -2 },
        { text: "Acabou", sent: false }
      ],
      "bem": [
        { text: "Vc ta bem", sent: false, delay: -8 },
        { text: "To sim e vc", sent: true, delay: -5 },
        { text: "Preocupado com vc", sent: false, delay: -2 },
        { text: "Vc sumiu de repente", sent: false }
      ],
      "Preciso": [
        { text: "Preciso falar com vc", sent: true, delay: -5 },
        { text: "Oi", sent: false, delay: -2 },
        { text: "E serio", sent: false }
      ],
      "Deu": [
        { text: "Deu pra sair hj", sent: false, delay: -10 },
        { text: "Acho q sim deixa eu ver", sent: true, delay: -5 },
        { text: "Me avisa depois", sent: false, delay: -2 },
        { text: "Preciso mt te ver", sent: false }
      ],
      "Acordou": [
        { text: "Acordou", sent: false, delay: -30 },
        { text: "To acordando agora", sent: true, delay: -20 },
        { text: "Q horas dormiu", sent: false, delay: -15 },
        { text: "Tarde demais umas 4h", sent: true, delay: -5 },
        { text: "Fazendo oq ate essa hora", sent: false }
      ],
      "fazendo": [
        { text: "Ta fazendo oq", sent: false, delay: -3 },
        { text: "Nada de mais e vc", sent: true, delay: -1 },
        { text: "Pensando em vc", sent: false }
      ],
      "Cade": [
        { text: "Cade vc", sent: false, delay: -8 },
        { text: "To chegando", sent: true, delay: -5 },
        { text: "Faz 20min q to esperando", sent: false, delay: -2 },
        { text: "To esperando aqui", sent: false }
      ],
      "livre": [
        { text: "Vc livre hj", sent: false, delay: -5 },
        { text: "Depende pra que", sent: true, delay: -2 },
        { text: "Quero te ver", sent: false }
      ],
      "parar": [
        { text: "Oi delicia", sent: false, delay: -10 },
        { text: "Oi td bem", sent: true, delay: -5 },
        { text: "Nao consigo parar de pensar em vc", sent: false }
      ],
      "some": [
        { text: "Nao some assim", sent: false, delay: -20 },
        { text: "Desculpa tava corrido aqui", sent: true, delay: -15 },
        { text: "Sempre a mesma desculpa", sent: false, delay: -5 },
        { text: "Qnd a gnt se ve de verdade", sent: false }
      ],
      "Saudade": [
        { text: "Saudade de vc", sent: true, delay: -5 },
        { text: "Tb to com saudade", sent: false, delay: -2 },
        { text: "Qnd vc vem", sent: true }
      ],
      "saudade": [
        { text: "To com saudade", sent: false, delay: -15 },
        { text: "Eu tb", sent: true, delay: -10 },
        { text: "Qnd vc vem", sent: false, delay: -5 },
        { text: "Essa semana nao vai dar", sent: true, delay: -2 },
        { text: "Ta estranho cmg", sent: false }
      ],
      "contar": [
        { text: "Preciso te contar uma coisa", sent: true, delay: -5 },
        { text: "Fala to preocupado", sent: false, delay: -2 },
        { text: "E complicado falar por aqui", sent: true }
      ],
      "net": [
        { text: "Ta sem net", sent: true, delay: -5 },
        { text: "Ta ruim mesmo hj", sent: false, delay: -2 },
        { text: "Atende o telefone", sent: true }
      ],
      "desbloqueia": [
        { text: "Me desbloqueia no wpp", sent: true, delay: -10 },
        { text: "Eu nao te bloqueei", sent: false, delay: -5 },
        { text: "Ta falando q o numero nao existe", sent: true, delay: -2 },
        { text: "Estranho deve ser bug", sent: false }
      ],
      "bloqueou": [
        { text: "Me bloqueou pq", sent: true, delay: -8 },
        { text: "Descobri q vc namora", sent: false, delay: -5 },
        { text: "Eu te falei q era complicado", sent: true, delay: -2 },
        { text: "Nao gosto de ser enganado", sent: false }
      ],
      "não posso": [
        { text: "Nao posso falar no wpp", sent: true, delay: -10 },
        { text: "Pq nao", sent: false, delay: -5 },
        { text: "A pessoa ta desconfiando", sent: true, delay: -2 },
        { text: "De novo isso", sent: false }
      ],
      "tesão": [
        { text: "To com tesao em vc", sent: false, delay: -10 },
        { text: "Tb to pensando nisso", sent: true, delay: -5 },
        { text: "Vem logo entao", sent: false, delay: -2 },
        { text: "To saindo", sent: true }
      ],
      "delicia": [
        { text: "Oi delicia", sent: false, delay: -8 },
        { text: "Oii", sent: true, delay: -5 },
        { text: "Q saudade de vc", sent: false, delay: -2 },
        { text: "Tb to com saudade", sent: true }
      ],
      "vontade": [
        { text: "To com vontade de vc", sent: false, delay: -10 },
        { text: "Tb to", sent: true, delay: -5 },
        { text: "Bora se ver hj", sent: false, delay: -2 },
        { text: "Vou ver se consigo", sent: true }
      ]
    };

    let selectedTemplate = null;
    for (const [keyword, template] of Object.entries(conversationTemplates)) {
      if (previewMessage.toLowerCase().includes(keyword.toLowerCase())) {
        selectedTemplate = template;
        break;
      }
    }

    // ✅ GARANTIR QUE A PREVIEW É SEMPRE A ÚLTIMA MENSAGEM
    if (!selectedTemplate) {
      selectedTemplate = [{ text: previewMessage, sent: false }];
    }

    const hasSuspiciousContent = previewMessage.includes('saudade') ||
                                 previewMessage.includes('sair') ||
                                 previewMessage.includes('vem') ||
                                 previewMessage.includes('ver') ||
                                 previewMessage.includes('tesão') ||
                                 previewMessage.includes('delicia') ||
                                 previewMessage.includes('vontade') ||
                                 previewMessage.includes('chifre') ||
                                 previewMessage.includes('namora') ||
                                 previewMessage.includes('bloqueou');

    const hasDeletedMessages = hasSuspiciousContent && Math.random() < 0.3;

    let chatTexts = [...selectedTemplate];

    if (hasDeletedMessages) {
      const deletePosition = Math.floor(Math.random() * Math.max(1, chatTexts.length - 1));
      chatTexts.splice(deletePosition, 0, {
        text: "[Mensagem deletada]",
        sent: Math.random() < 0.5,
        isDeleted: true,
        delay: -(chatTexts.length - deletePosition) * 2
      });
    }

    const previewTimeMatch = previewTime.match(/(\d{2}):(\d{2})/);
    let baseTime = new Date();

    if (previewTimeMatch) {
      const previewHour = parseInt(previewTimeMatch[1]);
      const previewMinute = parseInt(previewTimeMatch[2]);
      baseTime.setHours(previewHour, previewMinute, 0, 0);

      if (previewTime.includes('Ontem')) {
        baseTime.setDate(baseTime.getDate() - 1);
      } else if (previewTime.includes('dias atrás')) {
        const daysMatch = previewTime.match(/(\d+) dias/);
        if (daysMatch) {
          baseTime.setDate(baseTime.getDate() - parseInt(daysMatch[1]));
          }
      } else if (previewTime.includes('Anteontem')) {
        baseTime.setDate(baseTime.getDate() - 2);
      }
    }

    if (baseTime.getTime() > now.getTime()) {
      baseTime = new Date(now.getTime() - 60 * 60 * 1000);
    }

    // ✅ CALCULAR HORÁRIOS CORRETAMENTE
    // A última mensagem (preview) sempre tem o horário base
    // Mensagens anteriores têm horários progressivamente mais antigos
    const result = chatTexts.map((msg, i) => {
      let msgTime;
      
      if (i === chatTexts.length - 1) {
        // Última mensagem = horário da preview (baseTime)
        msgTime = new Date(baseTime.getTime());
      } else if (msg.delay !== undefined) {
        // Usar delay definido (em minutos)
        const minutesBefore = Math.abs(msg.delay);
        msgTime = new Date(baseTime.getTime() - minutesBefore * 60 * 1000);
      } else {
        // Distribuir uniformemente as mensagens anteriores
        const totalMessages = chatTexts.length - 1;
        const positionFromEnd = totalMessages - i;
        const minutesBefore = positionFromEnd * (3 + Math.floor(Math.random() * 5));
        msgTime = new Date(baseTime.getTime() - minutesBefore * 60 * 1000);
      }

      return {
        ...msg,
        time: `${msgTime.getHours().toString().padStart(2, '0')}:${msgTime.getMinutes().toString().padStart(2, '0')}`
      };
    });

    localStorage.setItem(`sms_chat_${contactPhone}_${previewMessage}`, JSON.stringify(result));

    return result;
  };

  const startInvestigation = async (phone = phoneNumber) => {
    playSound('click');

    try {
      if (!userProfile || userProfile.credits < 30) {
        playSound('error');
        setAlertConfig({
          title: "Créditos Insuficientes",
          message: "Você precisa de 30 créditos para iniciar a análise de SMS.",
          confirmText: "Comprar Créditos",
          onConfirm: () => {
            setShowAlertModal(false);
            navigate(createPageUrl("BuyCredits"));
          }
        });
        setShowAlertModal(true);
        return;
      }

      localStorage.setItem('saved_phone_sms', phone);

      await base44.entities.UserProfile.update(userProfile.id, {
        credits: userProfile.credits - 30,
        xp: userProfile.xp + 15
      });
      queryClient.invalidateQueries(['userProfile', user?.email]); // Replaced setUserProfile with query invalidation

      const newInvestigation = await base44.entities.Investigation.create({
        service_name: "SMS",
        target_username: phone,
        status: "processing",
        progress: 1,
        estimated_days: 0,
        created_by: user?.email || ''
      });

      setCreditsSpent(30);
      setXpGained(15);
      setShowCreditAlert(true);
      setTimeout(() => setShowCreditAlert(false), 3000);

      // ✅ Update the cache directly instead of refetching for immediate UI consistency
      queryClient.setQueryData(['investigations', user?.email], (oldData) => {
        if (!oldData) return [newInvestigation];
        // Evitar duplicatas caso já exista uma investigação ativa para este serviço
        const withoutSms = oldData.filter(inv => inv.id !== newInvestigation.id);
        return [...withoutSms, newInvestigation];
      });

      setCurrentScreen("loading");
      setLoadingProgress(1);
    } catch (error) {
      console.error("Erro ao iniciar:", error);
      setAlertConfig({
        title: "Erro ao iniciar investigação",
        message: "Ocorreu um erro ao tentar iniciar a investigação. Por favor, tente novamente.",
        confirmText: "Ok",
        onConfirm: () => setShowAlertModal(false)
      });
      setShowAlertModal(true);
      setCurrentScreen("input");
    }
  };

  // ✅ PROGRESSO COM TIMESTAMP - SEM ATUALIZAR CACHE A CADA SEGUNDO
  useEffect(() => {
    if (!activeSMSInvestigation || activeSMSInvestigation.status === "completed" || activeSMSInvestigation.status === "accelerated") {
      setLoadingProgress(0);
      return;
    }

    const investigationId = activeSMSInvestigation.id;
    const startTimeKey = `sms_start_${investigationId}`;
    
    if (!localStorage.getItem(startTimeKey)) {
      localStorage.setItem(startTimeKey, Date.now().toString());
    }

    const startTime = parseInt(localStorage.getItem(startTimeKey));
    const targetDuration = 180000; // 3 minutos em ms
    
    let lastSavedProgress = activeSMSInvestigation.progress;
    
    const updateProgress = async () => {
      const elapsed = Date.now() - startTime;
      let calculatedProgress = Math.min(100, Math.floor((elapsed / targetDuration) * 100));
      
      calculatedProgress = Math.max(calculatedProgress, activeSMSInvestigation.progress);
      
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
        const phone = activeSMSInvestigation.target_username;
        
        if (currentScreen !== "results") {
          if (!messages || messages.length === 0) {
            generateMessages(phone);
          }
          setCurrentScreen("results");
        }
        
        if (activeSMSInvestigation.status !== "completed" && activeSMSInvestigation.status !== "accelerated") {
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
          } catch (error) {
            console.error("Erro ao completar investigação:", error);
          }
        }
      }
    };

    updateProgress();
    const timer = setInterval(updateProgress, 1000);
    
    return () => clearInterval(timer);
  }, [activeSMSInvestigation?.id, activeSMSInvestigation?.status, activeSMSInvestigation?.progress, activeSMSInvestigation?.target_username, currentScreen, messages?.length, queryClient, user?.email]);


  const handleAccelerate = async () => {
    try {
      if (!userProfile || userProfile.credits < 30) {
        playSound('error');
        setAlertConfig({
          title: "Créditos Insuficientes",
          message: "Você precisa de 30 créditos para acelerar a investigação de SMS.",
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
        xp: userProfile.xp + 20
      });
      queryClient.invalidateQueries(['userProfile', user?.email]); // Replaced setUserProfile with query invalidation

      setLoadingProgress(100);

      setCreditsSpent(30);
      setXpGained(20);
      setShowCreditAlert(true);
      setTimeout(() => setShowCreditAlert(false), 3000);

      if (activeSMSInvestigation) {
        await base44.entities.Investigation.update(activeSMSInvestigation.id, {
          status: "accelerated", // Use "accelerated" status to differentiate
          progress: 100
        });
        queryClient.setQueryData(['investigations', user?.email], (oldData) => {
          if (!oldData) return oldData;
          return oldData.map(inv => 
            inv.id === activeSMSInvestigation.id ? { ...inv, progress: 100, status: "accelerated" } : inv
          );
        });
        localStorage.removeItem(`sms_start_${activeSMSInvestigation.id}`);
      }

      // The autoStarted useEffect will pick up the 'accelerated' status and transition to results.
      // No direct setCurrentScreen("results") here.

    } catch (error) {
      console.error("Erro ao acelerar:", error);
      setAlertConfig({
        title: "Erro ao acelerar",
        message: "Ocorreu um erro ao tentar acelerar a investigação. Por favor, tente novamente.",
        confirmText: "Ok",
        onConfirm: () => setShowAlertModal(false)
      });
      setShowAlertModal(true);
    }
  };

  const handleLoadMore = async () => {
    playSound('click');

    try {
      if (!userProfile || userProfile.credits < 25) {
        playSound('error');
        setAlertConfig({
          title: "Créditos Insuficientes",
          message: "Você precisa de 25 créditos para carregar mais mensagens.",
          confirmText: "Comprar Créditos",
          onConfirm: () => {
            setShowAlertModal(false);
            navigate(createPageUrl("BuyCredits"));
          }
        });
        setShowAlertModal(true);
        return;
      }

      await base44.entities.UserProfile.update(userProfile.id, {
        credits: userProfile.credits - 25,
        xp: userProfile.xp + 10
      });
      queryClient.invalidateQueries(['userProfile', user?.email]); // Replaced setUserProfile with query invalidation

      const newVisibleMessages = Math.min(messages.length, visibleMessages + 6);
      setVisibleMessages(newVisibleMessages);
      localStorage.setItem(`sms_visible_${phoneNumber}`, newVisibleMessages.toString());

      setCreditsSpent(25);
      setXpGained(10);
      setShowCreditAlert(true);
      setTimeout(() => setShowCreditAlert(false), 3000);
    } catch (error) {
      console.error("Erro ao carregar mais:", error);
      setAlertConfig({
        title: "Erro ao carregar mensagens",
        message: "Ocorreu um erro ao tentar carregar mais mensagens. Por favor, tente novamente.",
        confirmText: "Ok",
        onConfirm: () => setShowAlertModal(false)
      });
      setShowAlertModal(true);
    }
  };

  const handleMessageClick = (message) => {
    playSound('click');

    if (unlockedChats.includes(message.phone)) {
      // ✅ NAVEGAR PARA PÁGINA DE CHAT
      const chatMessages = generateChatMessages(message.phone, message.preview, message.time);
      navigate(createPageUrl("SMSSpyChat"), {
        state: {
          selectedChat: {
        ...message,
        messages: chatMessages
          },
          phoneNumber: phoneNumber
        }
      });
    } else {
      setSelectedChat(message);
      setShowUnlockModal(true);
    }
  };

  const handleUnlockChat = async () => {
    try {
      if (!userProfile || userProfile.credits < 20) {
        playSound('error');
        setAlertConfig({
          title: "Créditos Insuficientes",
          message: "Você precisa de 20 créditos para desbloquear esta conversa.",
          confirmText: "Comprar Créditos",
          onConfirm: () => {
            setShowAlertModal(false);
            navigate(createPageUrl("BuyCredits"));
          }
        });
        setShowAlertModal(true);
        setShowUnlockModal(false); // ✅ FECHAR MODAL DE UNLOCK
        return;
      }

      playSound('unlock');
      await base44.entities.UserProfile.update(userProfile.id, {
        credits: userProfile.credits - 20,
        xp: userProfile.xp + 10
      });
      queryClient.invalidateQueries(['userProfile', user?.email]);

      const newUnlockedChats = [...unlockedChats, selectedChat.phone];
      setUnlockedChats(newUnlockedChats);
      localStorage.setItem(`sms_unlocked_${phoneNumber}`, JSON.stringify(newUnlockedChats));

      setCreditsSpent(20);
      setXpGained(10);
      setShowCreditAlert(true);
      setTimeout(() => setShowCreditAlert(false), 3000);

      // ✅ GERAR MENSAGENS E NAVEGAR PARA PÁGINA DE CHAT
      const chatMessages = generateChatMessages(selectedChat.phone, selectedChat.preview, selectedChat.time);
      setShowUnlockModal(false);
      
      navigate(createPageUrl("SMSSpyChat"), {
        state: {
          selectedChat: {
        ...selectedChat,
        messages: chatMessages
          },
          phoneNumber: phoneNumber
        }
      });
    } catch (error) {
      console.error("Erro ao desbloquear chat:", error);
      setAlertConfig({
        title: "Erro ao desbloquear conversa",
        message: "Ocorreu um erro ao tentar desbloquear a conversa. Por favor, tente novamente.",
        confirmText: "Ok",
        onConfirm: () => setShowAlertModal(false)
      });
      setShowAlertModal(true);
      setShowUnlockModal(false);
    }
  };

  const handleDeleteInvestigation = () => {
    playSound('trash');
    
    // ✅ BUSCAR INVESTIGATION CORRETAMENTE (QUALQUER STATUS)
    const investigationToDelete = investigations.find(
      inv => inv.service_name === "SMS"
    );
    
    if (!investigationToDelete) {
      console.error("Nenhuma investigação SMS encontrada");
      return;
    }

    setShowConfirmDelete(true);
  };

  const confirmDelete = async () => {
    playSound('trash');
    const investigationToDelete = completedSMSInvestigation || activeSMSInvestigation;
    if (!investigationToDelete) return;

    try {
      localStorage.removeItem('saved_phone_sms');
      localStorage.removeItem(`sms_messages_${phoneNumber}`);
      localStorage.removeItem(`sms_unlocked_${phoneNumber}`);
      localStorage.removeItem(`sms_visible_${phoneNumber}`);
      if (investigationToDelete.id) {
        localStorage.removeItem(`sms_start_${investigationToDelete.id}`);
      }

      await base44.entities.Investigation.delete(investigationToDelete.id);
      
      // ✅ INVALIDAR QUERIES
      await queryClient.invalidateQueries(['investigations', user?.email]);

      setPhoneNumber("");
      setMessages([]);
      setVisibleMessages(6);
      setSearchQuery("");
      setSelectedChat(null);
      setShowUnlockModal(false);
      setUnlockedChats([]);
      setShowAccelerateButton(false);
      setCurrentScreen("input");
      setLoadingProgress(0);
      autoStarted.current = false;
      setShowConfirmDelete(false);

      navigate(createPageUrl("Dashboard"));
    } catch (error) {
      console.error("Erro ao deletar:", error);
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

  const getSteps = (progress) => {
    const steps = [
      { id: 1, text: "Número verificado", threshold: 0 },
      { id: 2, text: "Acessando histórico de SMS...", threshold: 1 },
      { id: 3, text: "Recuperando mensagens deletadas...", threshold: 25 },
      { id: 4, text: "Analisando códigos de verificação...", threshold: 50 },
      { id: 5, text: "Mapeando contatos bloqueados...", threshold: 70 },
      { id: 6, text: "Compilando histórico completo...", threshold: 90 }
    ];

    return steps.map(step => ({
      ...step,
      completed: progress > step.threshold + 5,
      active: progress >= step.threshold && progress <= step.threshold + 10
    }));
  };

  const filteredMessages = messages.filter(msg =>
    msg.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
    msg.preview.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: messages.length,
    received: messages.length - Math.floor(messages.length * 0.3), // This is a static calculation, consider dynamic if needed
    sameDDD: messages.filter(m => m.sameDDD).length
  };

  if (currentScreen === "input") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
        <div className="w-full max-w-2xl mx-auto p-3">
          <Card className="bg-white border-0 shadow-md p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-8 h-8 text-orange-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">💬 Informe o número de telefone</h2>
              <p className="text-sm text-gray-600">Digite o número para acessar o histórico de SMS</p>
            </div>

            <div className="relative mb-4">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                type="tel"
                placeholder="(11) 99999-9999"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(formatPhone(e.target.value))}
                onKeyPress={(e) => e.key === 'Enter' && phoneNumber.replace(/\D/g, '').length === 11 && startInvestigation()}
                className="pl-10 h-12 text-base border-2 border-orange-200 focus:border-orange-400 focus:ring-orange-400"
                maxLength={15}
              />
              {phoneNumber.replace(/\D/g, '').length === 11 && (
                <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
              )}
            </div>

            <Button
              onClick={() => startInvestigation()}
              disabled={phoneNumber.replace(/\D/g, '').length !== 11}
              className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-bold text-base rounded-xl"
            >
              Iniciar Análise - 30 Créditos
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
      </div>
    );
  }

  if (currentScreen === "loading") {
    const steps = getSteps(loadingProgress);

    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
        <div className="w-full max-w-2xl mx-auto p-3">
          <Card className="bg-white border-0 shadow-md p-4 mb-3">
            <div className="flex flex-col items-center justify-center py-4">
              <div className="relative mb-4">
                <div className="absolute inset-0 w-16 h-16 rounded-full bg-orange-200 animate-ping opacity-75"></div>
                <div className="absolute inset-2 w-12 h-12 rounded-full bg-orange-300 animate-pulse"></div>
                <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                  <MessageCircle className="w-8 h-8 text-white animate-bounce" />
                </div>
              </div>

              <h3 className="text-base font-bold text-gray-900 mb-1">🔍 Analisando SMS</h3>
              <p className="text-sm text-gray-600 text-center">
                {phoneNumber}
              </p>
              <p className="text-xs text-gray-500 mb-3">
                Tempo estimado: 3 minutos
              </p>

              <div className="w-full mb-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full transition-all duration-500"
                    style={{ width: `${loadingProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-600 text-center mt-1 font-semibold">{loadingProgress}%</p>
              </div>

              <div className="space-y-1.5 w-full">
                {steps.map(step => (
                  <div
                    key={step.id}
                    className={`flex items-center gap-2 p-2 rounded-lg ${
                      step.completed ? 'bg-green-50 border-l-2 border-green-500' :
                      step.active ? 'bg-orange-50 border-l-3 border-orange-500' :
                      'opacity-40'
                    }`}
                  >
                    {step.completed ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                    ) : step.active ? (
                      <Loader2 className="w-3.5 h-3.5 text-orange-600 flex-shrink-0 animate-spin" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 flex-shrink-0" />
                    )}
                    <p className={`text-[11px] font-medium leading-tight ${
                      step.completed ? 'text-green-900' :
                      step.active ? 'text-gray-900' :
                      'text-gray-500'
                    }`}>
                      {step.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {showAccelerateButton && loadingProgress < 100 && (
              <Button
                onClick={handleAccelerate}
              className="w-full h-10 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm rounded-xl mb-3"
              >
                <Zap className="w-4 h-4 mr-2" />
              Acelerar Agora - 30 créditos
              </Button>
          )}

          <Button
            onClick={handleDeleteInvestigation}
            variant="outline"
            className="w-full h-10 border border-red-200 text-red-600 hover:bg-red-50 font-medium text-sm rounded-xl"
          >
            Cancelar Investigação
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

  if (currentScreen === "results") {
    const remainingMessages = filteredMessages.length - visibleMessages;
    const unlockedCount = unlockedChats.length;
    const spamCount = messages.filter(m => m.isSpam).length;

    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
        <div className="w-full max-w-2xl mx-auto p-3">
          {/* Card de informações do número */}
          <Card className="bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200 shadow-sm p-4 mb-3">
            <div>
              <p className="text-xs text-orange-600 font-semibold mb-1">NÚMERO RASTREADO</p>
              <p className="text-lg font-bold text-gray-900">{phoneNumber}</p>
            </div>
          </Card>

          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar SMS..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 border-0 focus:ring-0 focus:border-0 rounded-xl text-sm shadow-sm"
              style={{ backgroundColor: '#FFFFFF' }}
            />
          </div>

          <div className="grid grid-cols-4 gap-2 mb-4">
            <Card className="bg-white border-0 shadow-sm p-3 text-center">
              <p className="text-xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-[10px] text-gray-600">Total</p>
            </Card>
            <Card className="bg-white border-0 shadow-sm p-3 text-center">
              <p className="text-xl font-bold text-gray-900">{stats.received}</p>
              <p className="text-[10px] text-gray-600">Recebidas</p>
            </Card>
            <Card className="bg-white border-0 shadow-sm p-3 text-center">
              <p className="text-xl font-bold text-orange-600">{stats.sameDDD}</p>
              <p className="text-[10px] text-gray-600">DDD {getDDD(phoneNumber)}</p>
            </Card>
            <Card className="bg-white border-0 shadow-sm p-3 text-center">
              <p className="text-xl font-bold text-red-600">{spamCount}</p>
              <p className="text-[10px] text-gray-600">Spam</p>
            </Card>
          </div>

          <div className="mb-2">
            <h3 className="text-sm font-bold text-gray-900">Mensagens ({filteredMessages.length} total)</h3>
          </div>

          <div className="space-y-2 mb-3">
            {filteredMessages.slice(0, visibleMessages).map((msg) => {
              const isUnlocked = unlockedChats.includes(msg.phone);
              const isSpam = msg.isSpam;
              
              return (
              <Card
                key={msg.id}
                onClick={() => handleMessageClick(msg)}
                  className={`border-0 shadow-sm p-3 cursor-pointer hover:shadow-md transition-all hover:scale-[1.01] ${
                    isUnlocked ? 'bg-green-50 border-l-4 border-green-500' : 
                    isSpam ? 'bg-gray-50' : 
                    'bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar/Icon */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isUnlocked ? 'bg-green-200' : 
                      isSpam ? 'bg-gray-300' : 
                      msg.sameDDD ? 'bg-orange-200' : 'bg-blue-200'
                    }`}>
                      <span className="text-lg">
                        {isUnlocked ? '✓' : 
                         isSpam ? '⚠️' : 
                         msg.sameDDD ? '📱' : '💬'}
                      </span>
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="text-sm font-bold text-gray-900">{msg.phone}</p>
                      {msg.sameDDD && (
                        <Badge className="bg-orange-100 text-orange-700 border-0 text-[10px]">MESMO DDD</Badge>
                      )}
                            {isSpam && (
                              <Badge className="bg-red-100 text-red-700 border-0 text-[10px]">SPAM</Badge>
                            )}
                    </div>
                          <p className="text-[11px] text-gray-500">{msg.time}</p>
                  </div>
                        {isUnlocked && (
                          <Badge className="bg-green-600 text-white border-0 text-[10px] ml-2">✓ ABERTO</Badge>
                  )}
                </div>
                      <p className={`text-xs ${isSpam ? 'text-gray-500' : 'text-gray-700'} line-clamp-2`}>
                        {msg.preview}
                      </p>
                    </div>
                  </div>
              </Card>
              );
            })}
          </div>

          {remainingMessages > 0 && (
            <Card className="bg-white border-0 shadow-sm p-4 mb-3">
              <div className="text-center mb-3">
                <p className="text-sm font-bold text-gray-900 mb-1">📥 Mostrar Mais Mensagens</p>
                <p className="text-xs text-gray-600">{remainingMessages} mensagens restantes</p>
              </div>
              <Button
                onClick={handleLoadMore}
                className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-white font-bold"
              >
                Ver Mais por 25 créditos
              </Button>
            </Card>
          )}

          <Button
            onClick={handleDeleteInvestigation}
            variant="outline"
            className="w-full h-10 border border-red-200 text-red-600 hover:bg-red-50 font-medium text-sm rounded-xl mb-3"
          >
            <div className="flex items-center gap-2 justify-center">
              <span className="text-xs">✕</span>
              Apagar essa espionagem
            </div>
          </Button>
        </div>

        {showUnlockModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <Card className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <div className="text-center mb-4">
                <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-3">
                  <MessageCircle className="w-8 h-8 text-orange-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">🔒 Conversa Bloqueada</h3>
                <p className="text-sm text-gray-600 mb-4">Desbloqueie para ver:</p>
                <div className="text-left space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-xs text-gray-700">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span>Histórico completo de conversas</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-700">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span>Mensagens enviadas e recebidas</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-700">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span>Horários detalhados</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Button onClick={handleUnlockChat} className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-white font-bold">
                  Ver Conversa Completa - 20 créditos
                </Button>
                <Button onClick={() => setShowUnlockModal(false)} variant="outline" className="w-full h-10">
                  Cancelar
                </Button>
              </div>
            </Card>
          </div>
        )}

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

  // ✅ Tela de chat foi movida para SMSSpyChat.jsx

  return (
    <>
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
