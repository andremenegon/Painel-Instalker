
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
import { resetTimer, markCompleted } from "@/lib/progressManager";

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
  const [visiblePhotos, setVisiblePhotos] = useState(6);
  const completionHandledRef = useRef(false);
  const unlockLoadedRef = useRef(false);
  
  // ✅ ESTADOS DE DESBLOQUEIO
  const [unlockProgress, setUnlockProgress] = useState(0);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showUnlockAccelerate, setShowUnlockAccelerate] = useState(false);
  
  // ✅ ESTADOS DE CÂMERA AO VIVO
  const [isCameraActivating, setIsCameraActivating] = useState(false);
  const [cameraProgress, setCameraProgress] = useState(0);
  const [cameraRetryTime, setCameraRetryTime] = useState(null);
  const [isCameraActivated, setIsCameraActivated] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertConfig, setAlertConfig] = useState({});
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

  // ✅ GALERIA COMPLETA - 24 FOTOS VARIADAS
  const [localPhotos, setLocalPhotos] = useState([]);
  const [userCity, setUserCity] = useState('');
  
  // ✅ FUNÇÃO PARA BUSCAR LOCAIS REAIS COM GOOGLE PLACES API
  const fetchRealLocalPhotos = async (city, state) => {
    try {
      const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || 'AIzaSyDaTUSC06HzzZotxxojwT8ck6MhIVQmL54';
      
      // Buscar 3 tipos de estabelecimentos populares
      const searchQueries = [
        `motel em ${city}`,
        `bar noturno ${city}`,
        `restaurante ${city}`
      ];
      
      const photos = [];
      
      for (let i = 0; i < searchQueries.length; i++) {
        const query = searchQueries[i];
        const response = await fetch(
          `https://cors-anywhere.herokuapp.com/https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}`
        );
        
        if (!response.ok) continue;
        
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          const place = data.results[0];
          
          // Buscar foto do estabelecimento
          let photoUrl = `https://via.placeholder.com/400x300?text=${encodeURIComponent(place.name)}`;
          if (place.photos && place.photos.length > 0) {
            const photoReference = place.photos[0].photo_reference;
            photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=500&photoreference=${photoReference}&key=${GOOGLE_API_KEY}`;
          }
          
          photos.push({
            url: photoUrl,
            badge: '📍 LOCAL',
            date: i === 0 ? 'Hoje, 21:30' : i === 1 ? 'Ontem, 22:15' : '2 dias atrás, 20:45',
            size: i === 0 ? 'large' : 'normal',
            type: 'normal',
            unlocked: false,
            category: 'local',
            local: place.name,
            address: place.formatted_address
          });
        }
      }
      
      return photos.length > 0 ? photos : getDefaultLocalPhotos(city);
    } catch (error) {
      console.error('Erro ao buscar locais:', error);
      return getDefaultLocalPhotos(city);
    }
  };
  
  // ✅ FOTOS DE LOCAIS PADRÃO (fallback) - AGORA BLOQUEADAS
  const getDefaultLocalPhotos = (city) => [
    { url: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=500", badge: '📍 LOCAL', date: 'Hoje, 21:30', size: 'large', type: 'normal', unlocked: false, category: 'local', local: `Bar em ${city}` },
    { url: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400", badge: '📍 LOCAL', date: 'Ontem, 22:15', size: 'normal', type: 'normal', unlocked: false, category: 'local', local: `Restaurante em ${city}` },
    { url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400", badge: '📍 LOCAL', date: '2 dias atrás, 20:45', size: 'normal', type: 'normal', unlocked: false, category: 'local', local: `Hotel em ${city}` },
  ];
  
  const FIXED_PHOTOS = [
    // GRID 4 COLUNAS: 1ª FOTO GRANDE (ESQUERDA)
    { url: "https://images.unsplash.com/photo-1583338096644-324c88c9d41e?w=600", date: 'Hoje, 23:45', size: 'large', type: 'sugestiva', category: 'sugestiva' },
    // 2 FOTOS PEQUENAS (DIREITA)
    { url: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400", date: 'Ontem, 01:23', size: 'normal', type: 'sugestiva', category: 'sugestiva' },
    { url: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=400", date: 'Hoje, 02:15', size: 'normal', type: 'sugestiva', category: 'sugestiva' },
    { url: "https://images.unsplash.com/photo-1516726817505-f5ed825624d8?w=400", date: '1 dia atrás, 23:30', size: 'normal', type: 'sugestiva', category: 'sugestiva' },
    { url: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400", date: 'Ontem, 19:45', size: 'normal', type: 'sugestiva', category: 'sugestiva' },
    // 2ª FOTO GRANDE (DIREITA)
    { url: "https://images.unsplash.com/photo-1591154669695-5f2a8d20c089?w=600", date: '2 dias atrás, 22:10', size: 'large', type: 'sugestiva', category: 'explicita' },
    // 2 FOTOS PEQUENAS (ESQUERDA)
    { url: "https://images.unsplash.com/photo-1583338088891-ba9dd9c14906?w=400", date: '3 dias atrás, 01:20', size: 'normal', type: 'sugestiva', category: 'explicita' },
    { url: "https://images.unsplash.com/photo-1591085686350-798c0f9faa7f?w=400", date: 'Hoje, 20:30', size: 'normal', type: 'sugestiva', category: 'explicita' },
    // 3ª FOTO GRANDE (ESQUERDA)
    { url: "https://images.unsplash.com/photo-1587614382346-4ec70e388b28?w=600", date: '1 dia atrás, 23:15', size: 'large', type: 'sugestiva', category: 'explicita' },
    // 2 FOTOS PEQUENAS (DIREITA)
    { url: "https://images.unsplash.com/photo-1516726817505-f5ed825624d8?w=400", date: 'Ontem, 22:00', size: 'normal', type: 'sugestiva', category: 'sugestiva' },
    { url: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400", date: 'Hoje, 01:45', size: 'normal', type: 'sugestiva', category: 'sugestiva' },
    { url: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=400", date: '2 dias atrás, 23:30', size: 'normal', type: 'sugestiva', category: 'sugestiva' },
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
  
  const locationInvestigation = investigations.find(
    inv => inv.service_name === "Localização" && inv.status === "completed"
  );
  
  // ✅ BUSCAR LOCAIS REAIS QUANDO TIVERMOS A CIDADE DO USUÁRIO
  useEffect(() => {
    const loadLocalPhotos = async () => {
      if (localPhotos.length > 0) return;
      
      // Tentar pegar a cidade da investigação de localização
      let city = 'São Paulo'; // fallback
      
      if (userProfile?.investigation_history?.Localização?.city) {
        city = userProfile.investigation_history.Localização.city;
      } else if (userProfile?.investigation_history?.Localizacao?.city) {
        city = userProfile.investigation_history.Localizacao.city;
      }
      
      setUserCity(city);
      const photos = await fetchRealLocalPhotos(city, '');
      setLocalPhotos(photos);
    };
    
    if (userProfile) {
      loadLocalPhotos();
    }
  }, [userProfile]);

  const {
    progress: timerProgress,
    canAccelerate,
    accelerate: accelerateTimer,
  } = useInvestigationTimer({ service: "Câmera", investigation: activeCameraInvestigation });

  const loadingProgress = timerProgress;
  const showAccelerateButton = canAccelerate && !accelerating && loadingProgress > 0 && loadingProgress < 100;
  
  // 🔥 CRIAR MODAL DIRETO NO BODY COM JAVASCRIPT PURO
  useEffect(() => {
    if (!showConfirmDelete) return;
    
    // Criar modal direto no body
    const modalDiv = document.createElement('div');
    modalDiv.id = 'force-modal-camera';
    modalDiv.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      background-color: rgba(0, 0, 0, 0.9) !important;
      z-index: 2147483647 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 20px !important;
    `;
    
    modalDiv.innerHTML = `
      <div style="
        background-color: white;
        border-radius: 16px;
        padding: 20px;
        max-width: 340px;
        width: 100%;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        animation: fadeInZoom 0.2s ease-out;
      ">
        <div style="text-align: center; margin-bottom: 16px;">
          <div style="
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background-color: #fee2e2;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 12px;
          ">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </div>
          <h3 style="font-size: 18px; font-weight: bold; color: #111827; margin-bottom: 12px;">
            Apagar Investigação?
          </h3>
          <p style="font-size: 12px; color: #6b7280; line-height: 1.5;">
            ⚠️ Todos os dados desta investigação serão perdidos permanentemente, e os créditos gastos não serão reembolsados.
          </p>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <button id="confirm-delete-btn" style="
            width: 100%;
            height: 44px;
            background: linear-gradient(to right, #dc2626, #b91c1c);
            color: white;
            font-weight: bold;
            font-size: 14px;
            border: none;
            border-radius: 12px;
            cursor: pointer;
            box-shadow: 0 4px 6px -1px rgba(220, 38, 38, 0.3);
            transition: all 0.2s;
          " onmouseover="this.style.background='linear-gradient(to right, #b91c1c, #991b1b)'" onmouseout="this.style.background='linear-gradient(to right, #dc2626, #b91c1c)'">
            Sim, apagar
          </button>
          
          <button id="cancel-delete-btn" style="
            width: 100%;
            height: 40px;
            background-color: transparent;
            color: #6b7280;
            font-weight: 500;
            font-size: 14px;
            border: none;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s;
          " onmouseover="this.style.backgroundColor='#f3f4f6'" onmouseout="this.style.backgroundColor='transparent'">
            Cancelar
          </button>
        </div>
      </div>
      
      <style>
        @keyframes fadeInZoom {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      </style>
    `;
    
    document.body.appendChild(modalDiv);
    
    // Event listeners
    const confirmBtn = document.getElementById('confirm-delete-btn');
    const cancelBtn = document.getElementById('cancel-delete-btn');
    
    const handleConfirm = () => {
      confirmDelete();
      setShowConfirmDelete(false);
      document.body.removeChild(modalDiv);
    };
    
    const handleCancel = () => {
      playSound('click');
      setShowConfirmDelete(false);
      document.body.removeChild(modalDiv);
    };
    
    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
    modalDiv.addEventListener('click', (e) => {
      if (e.target === modalDiv) handleCancel();
    });
    
    // Cleanup
    return () => {
      const existingModal = document.getElementById('force-modal-camera');
      if (existingModal) {
        document.body.removeChild(existingModal);
      }
    };
  }, [showConfirmDelete]);

  // ✅ GARANTIR que investigações completas sejam marcadas como completas no progressManager
  useEffect(() => {
    if (!activeCameraInvestigation) return;
    
    // Se o status é "completed" OU o progresso já chegou a 100%, marcar como completo
    if (activeCameraInvestigation.status === "completed" || timerProgress >= 100) {
      markCompleted({ service: "Câmera", id: activeCameraInvestigation.id });
    }
  }, [activeCameraInvestigation?.id, activeCameraInvestigation?.status, timerProgress]);

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
    if (!activeCameraInvestigation) {
      unlockLoadedRef.current = false;
      return;
    }
    
    // Evitar carregar múltiplas vezes para a mesma investigação
    if (unlockLoadedRef.current) return;
    
    const storageKey = `camera_unlock_${activeCameraInvestigation.id}`;
    const savedUnlock = localStorage.getItem(storageKey);
    
    if (savedUnlock) {
      try {
        const data = JSON.parse(savedUnlock);
        if (data.unlocked) {
          setIsUnlocked(true);
          setIsUnlocking(false);
          setUnlockProgress(100);
        } else if (data.unlocking && data.progress > 0) {
          setIsUnlocking(true);
          setIsUnlocked(false);
          setUnlockProgress(data.progress);
        }
        unlockLoadedRef.current = true;
      } catch (error) {
        console.error("Erro ao carregar estado de desbloqueio:", error);
      }
    } else {
      // Resetar estados apenas se não houver dados salvos
      setIsUnlocking(false);
      setIsUnlocked(false);
      setUnlockProgress(0);
      unlockLoadedRef.current = true;
    }
    
    const cameraKey = `camera_live_${activeCameraInvestigation.id}`;
    const savedCamera = localStorage.getItem(cameraKey);
    
    if (savedCamera) {
      try {
        const data = JSON.parse(savedCamera);
        if (data.activated) {
          setIsCameraActivated(true);
          setCameraProgress(100);
          if (data.retryTime) {
            setCameraRetryTime(new Date(data.retryTime));
          }
        } else if (data.activating && data.progress > 0) {
          setIsCameraActivating(true);
          setCameraProgress(data.progress);
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

  // ✅ PROGRESSO DE DESBLOQUEIO (36 HORAS)
  useEffect(() => {
    if (!isUnlocking || unlockProgress >= 100 || !activeCameraInvestigation) return;

    const interval = 129600000 / 100; // 36 horas dividido por 100 (36 * 60 * 60 * 1000 / 100)
    
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

  // ✅ PROGRESSO DA CÂMERA AO VIVO (36 HORAS)
  useEffect(() => {
    if (!isCameraActivating || cameraProgress >= 100 || !activeCameraInvestigation) return;

    const interval = 129600000 / 100; // 36 horas dividido por 100 (36 * 60 * 60 * 1000 / 100)
    
    const timer = setInterval(() => {
      setCameraProgress(prev => {
        const newProgress = Math.min(100, prev + 1);
        
        // ✅ SALVAR PROGRESSO
        const storageKey = `camera_live_${activeCameraInvestigation.id}`;
        localStorage.setItem(storageKey, JSON.stringify({
          activating: newProgress < 100,
          activated: newProgress >= 100,
          progress: newProgress
        }));
        
        if (newProgress >= 100) {
          setIsCameraActivated(true);
          setIsCameraActivating(false);
          
          // ✅ DEFINIR TEMPO DE RETENTATIVA (3 horas)
          const retryTime = new Date(Date.now() + 3 * 60 * 60 * 1000);
          setCameraRetryTime(retryTime);
          
          localStorage.setItem(storageKey, JSON.stringify({
            activating: false,
            activated: true,
            progress: 100,
            retryTime: retryTime.toISOString()
          }));
        }
        
        return newProgress;
      });
    }, interval);
    
    return () => clearInterval(timer);
  }, [isCameraActivating, cameraProgress, activeCameraInvestigation?.id]);

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
        estimated_days: 3,
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

    await base44.entities.Investigation.create({
      service_name: "Câmera",
      target_username: "Dispositivo Alvo",
      status: "processing",
      progress: 1,
      estimated_days: 3,
      is_accelerated: false,
      created_by: user.email,
    });
    
    // ✅ O timer será criado automaticamente pelo hook useInvestigationTimer

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

  const handleDeleteInvestigation = () => {
    playSound('trash');
    
    // ✅ BUSCAR INVESTIGATION CORRETAMENTE (QUALQUER STATUS)
    const investigationToDelete = investigations.find(
      inv => inv.service_name === "Câmera"
    );
    
    if (!investigationToDelete) {
      return;
    }

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
      setCameraProgress(0);
      setIsCameraActivating(false);
      setCameraRetryTime(null);
      setIsCameraActivated(false);
      unlockLoadedRef.current = false;
      completionHandledRef.current = false;
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
    
    await queryClient.invalidateQueries(['userProfile', user?.email]);
    
    setCreditsSpent(70);
    setXpGained(35);
    setShowCreditAlert(true);
    setTimeout(() => setShowCreditAlert(false), 2000);
    
    // ✅ INICIAR DESBLOQUEIO (36 HORAS) - O useEffect vai gerenciar o progresso
    setIsUnlocking(true);
    setUnlockProgress(1);
    
    // ✅ SALVAR ESTADO INICIAL NO LOCALSTORAGE
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
    
    // ✅ INICIAR ATIVAÇÃO (36 HORAS)
    setIsCameraActivating(true);
    setCameraProgress(1);
    
    // ✅ SALVAR ESTADO INICIAL
    if (activeCameraInvestigation) {
      const cameraKey = `camera_live_${activeCameraInvestigation.id}`;
      localStorage.setItem(cameraKey, JSON.stringify({
        activating: true,
        activated: false,
        progress: 1
      }));
    }
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

  const getSteps = (progress) => {
    const steps = [
      { id: 1, text: "Conectando ao dispositivo...", threshold: 0 },
      { id: 2, text: "Ativando câmera frontal...", threshold: 20 },
      { id: 3, text: "Configurando transmissão...", threshold: 40 },
      { id: 4, text: "Capturando vídeo ao vivo...", threshold: 60 },
      { id: 5, text: "Salvando gravações...", threshold: 80 }
    ];

    return steps.map((step, index) => {
      // Primeiro step sempre completo
      if (index === 0) {
        return { ...step, completed: true, active: false };
      }
      
      // Último step só completa quando progresso >= 100
      if (index === steps.length - 1) {
        return {
      ...step,
          completed: progress >= 100,
          active: progress >= step.threshold && progress < 100
        };
      }
      
      // Steps intermediários
      return {
        ...step,
        completed: progress > step.threshold + 20,
        active: progress >= step.threshold && progress <= step.threshold + 20
      };
    });
  };


  // ✅ SE COMPLETOU, MOSTRAR RESULTADOS
  if (activeCameraInvestigation && loadingProgress >= 100) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
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

          {/* GALERIA DE FOTOS */}
          <Card className="bg-white border-0 shadow-md p-2.5 mb-3">
            <div className="mb-3">
              <h3 className="text-sm font-bold text-gray-900">📸 Prévia da Galeria</h3>
            </div>
            
            {/* GRID MOSAICO - fotos large ocupam 2 colunas */}
            <div className="grid grid-cols-4 gap-0.5">
              {photos.slice(0, 12).map((photo, index) => (
                <div 
                  key={index} 
                  className={`relative rounded-md overflow-hidden group cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-lg animate-in fade-in-0 slide-in-from-bottom-2 ${
                    photo.size === 'large' ? 'col-span-2 row-span-2' : 'col-span-1'
                  }`}
                  style={{ 
                    aspectRatio: '1/1',
                    animationDelay: `${index * 50}ms`,
                  }}
                >
                  <img 
                    src={photo.url} 
                    alt="" 
                    className="absolute inset-0 w-full h-full object-cover transition-all duration-500 group-hover:scale-105"
                    style={{ 
                      filter: photo.type === 'sugestiva' ? 'blur(20px)' : 'blur(12px)',
                      transition: 'filter 0.5s ease'
                    }}
                  />
                  
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm">
                    <div className="text-center">
                      <Lock className="w-3 h-3 text-white drop-shadow-lg mx-auto" />
                    </div>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                    <p className="text-[7px] text-white font-medium">{photo.date}</p>
                  </div>
                </div>
              ))}
            </div>
            
            {/* AVISO DE MAIS FOTOS */}
            <div className="mt-3 bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-3">
              <p className="text-xs text-orange-900 text-center">
                ⚠️ <span className="font-bold">Carregamento Parcial</span> - Apenas 12 fotos foram carregadas, desbloqueie a galeria para ver as fotos e vídeos restantes.
              </p>
            </div>
          </Card>


          {/* ✅ AVISO DE ARQUIVOS CORROMPIDOS (quando desbloqueado) */}
          {isUnlocked && (
            <Card className="bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-200 p-5 mb-3">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-400 to-red-500 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-gray-900 mb-1">⚠️ Arquivos Corrompidos</h3>
                  <p className="text-xs text-gray-700">
                    As fotos e vídeos foram parcialmente danificados durante a recuperação. Nossa equipe está trabalhando para restaurar os arquivos originais.
                  </p>
                </div>
              </div>
              <div className="bg-red-100 border border-red-300 rounded-lg p-3">
                <p className="text-xs text-red-900">
                  <span className="font-bold">Status:</span> Restauração em andamento...<br/>
                  <span className="font-bold">Previsão:</span> 24-48 horas<br/>
                </p>
              </div>
            </Card>
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
                    {isUnlocking ? 'Desbloqueando Galeria...' : '🔓 Desbloquear todas as fotos e vídeos sem censura'}
                  </h3>
                  <p className="text-xs text-gray-700">
                    {isUnlocking 
                      ? 'Descriptografando arquivos e recuperando fotos deletadas...' 
                      : 'Acesse a galeria completa com fotos íntimas, selfies, screenshots e conteúdo deletado recuperado'
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
                  🔓 Desbloquear Galeria - 70 Créditos
                </Button>
              ) : showUnlockAccelerate && (
                <Button 
                  onClick={handleAccelerateUnlock}
                  className="w-full h-9 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white text-xs rounded-lg"
                >
                  ⚡ Acelerar Desbloqueio - 30 Créditos
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
                  <h3 className="text-base font-bold text-gray-900 mb-1">🎥 Acesso Remoto: Câmera + Microfone</h3>
                  <p className="text-xs text-gray-700 mb-2">
                    Ative o acesso remoto para ligar a câmera do celular alvo e ver ao vivo o que está acontecendo
                  </p>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mt-2">
                    <p className="text-[10px] text-blue-900 leading-relaxed">
                      • 📹 <span className="font-semibold">Liga a câmera frontal remotamente</span><br/>
                      • 🎧 <span className="font-semibold">Acessa o áudio ao vivo</span><br/>
                      • 👁️ <span className="font-semibold">Veja e ouça tudo em tempo real</span>
                    </p>
                  </div>
                </div>
              </div>
              
              
              {isCameraActivating && (
                <div className="bg-blue-100 border border-blue-300 rounded-lg p-3 mb-3">
                  <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                      <p className="text-xs text-blue-900 font-semibold">Ativando acesso remoto...</p>
                    </div>
                    <Badge className="bg-blue-600 text-white border-0 text-[10px]">{cameraProgress}%</Badge>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-1.5">
                      <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-1000" style={{ width: `${cameraProgress}%` }}></div>
                    </div>
                    <p className="text-[10px] text-blue-700">⚡ Aguarde... Pode demorar até 36 horas</p>
                  </div>
                </div>
              )}
              
              {!isCameraActivating && (
                <Button
                  onClick={handleActivateLive}
                  className="w-full h-12 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold text-sm rounded-xl shadow-lg"
                >
                  🎥 Ativar Acesso Remoto - 50 Créditos
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
                    Tempo estimado: {(() => {
                      if (loadingProgress >= 100) return 'Concluído!';
                      if (loadingProgress >= 95) {
                        const minutes = Math.ceil((100 - loadingProgress) * 2); // 2 min por %
                        return `${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
                      }
                      if (loadingProgress >= 80) {
                        const hours = Math.ceil((100 - loadingProgress) / 4); // ~5 horas para 20%
                        return `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
                      }
                      if (loadingProgress >= 50) return '1 dia';
                      if (loadingProgress >= 20) return '2 dias';
                      return '3 dias';
                    })()}
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
                  <X className="w-4 h-4 mr-2" />
                  Cancelar Investigação
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

      {/* Animação de Sucesso */}
      {showSuccessAnimation && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
          {/* Confete animado */}
          <div className="absolute inset-0">
            {[...Array(50)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 rounded-full animate-bounce"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: '-10%',
                  backgroundColor: ['#f97316', '#3b82f6', '#8b5cf6', '#ec4899', '#10b981'][Math.floor(Math.random() * 5)],
                  animationDelay: `${Math.random() * 0.5}s`,
                  animationDuration: `${1 + Math.random()}s`
                }}
              />
            ))}
          </div>
          
          {/* Card de sucesso */}
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm mx-4 animate-in zoom-in-50 duration-500">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">🎉 Galeria Desbloqueada!</h3>
              <p className="text-sm text-gray-600 mb-3">24 fotos e 18 vídeos foram revelados</p>
              <Badge className="bg-green-100 text-green-700 border-0 text-xs px-3 py-1">
                +35 XP ganho!
              </Badge>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SUPER SIMPLES - TESTE */}
      {showConfirmDelete && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowConfirmDelete(false);
            }
          }}
        >
          <div 
            style={{
              backgroundColor: 'white',
              borderRadius: '20px',
              padding: '30px',
              maxWidth: '400px',
              width: '100%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                backgroundColor: '#fee',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 15px'
              }}>
                <Trash2 style={{ width: '30px', height: '30px', color: '#dc2626' }} />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#111', marginBottom: '10px' }}>
                Cancelar Investigação?
              </h3>
              <p style={{ fontSize: '14px', color: '#666' }}>
                Todos os dados desta investigação serão perdidos permanentemente, e os créditos gastos não serão reembolsados.
              </p>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => {
                  confirmDelete();
                  setShowConfirmDelete(false);
                }}
                style={{
                  width: '100%',
                  height: '45px',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer'
                }}
              >
                Sim, cancelar
              </button>
              <button
                onClick={() => {
                  playSound('click');
                  setShowConfirmDelete(false);
                }}
                style={{
                  width: '100%',
                  height: '40px',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  fontWeight: '500',
                  fontSize: '14px',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer'
                }}
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}

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
