
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Phone, Clock, PhoneIncoming, PhoneOutgoing, Zap, Lock, Trash2, AudioLines } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ConfirmModal from "../components/dashboard/ConfirmModal";

export default function CallsSpyResults() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [visibleCalls, setVisibleCalls] = useState(10);
  const [unlockedTranscripts, setUnlockedTranscripts] = useState([]);
  const [showCreditAlert, setShowCreditAlert] = useState(false);
  const [creditsSpent, setCreditsSpent] = useState(0);
  const [calls, setCalls] = useState([]);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertConfig, setAlertConfig] = useState({});

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

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: Infinity,
    cacheTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 0,
  });

  const { data: userProfiles = [] } = useQuery({
    queryKey: ['userProfile', user?.email],
    queryFn: () => base44.entities.UserProfile.filter({ created_by: user.email }),
    enabled: !!user,
    staleTime: Infinity, // ✅ NUNCA ATUALIZA AUTOMATICAMENTE
    cacheTime: Infinity,
    refetchOnWindowFocus: false, // ✅ DESATIVADO
    refetchOnMount: false, // ✅ DESATIVADO
    retry: 0,
  });

  const userProfile = userProfiles[0];

  const { data: investigations = [] } = useQuery({
    queryKey: ['investigations', user?.email],
    queryFn: () => base44.entities.Investigation.filter({ created_by: user?.email }),
    enabled: !!user,
    staleTime: Infinity, // ✅ NUNCA ATUALIZA AUTOMATICAMENTE
    refetchOnWindowFocus: false, // ✅ DESATIVADO
    refetchOnMount: false, // ✅ DESATIVADO
    retry: 0,
  });

  const completedCallsInvestigation = investigations.find(
    inv => inv.service_name === "Chamadas" && (inv.status === "completed" || inv.status === "accelerated")
  );

  const targetPhone = completedCallsInvestigation?.target_username || "";
  const targetDDD = targetPhone.replace(/\D/g, '').slice(0, 2);

  useEffect(() => {
    if (!targetPhone || !targetDDD || calls.length > 0) return;

    const savedCalls = localStorage.getItem(`calls_data_${targetPhone}`);
    if (savedCalls) {
      try {
        const parsed = JSON.parse(savedCalls);
        setCalls(parsed);
        return;
      } catch (error) {
        console.error("Erro ao carregar chamadas salvas:", error);
      }
    }

    const types = ["incoming", "outgoing"];
    const newCalls = [];
    
    const empresas = [
      "0800 777 2345",
      "0800 123 4567",
      "0800 555 8888",
      "0800 999 0001",
      "4003 2345",
      "4004 5678",
      "3003 9999"
    ];

    const suspiciousTranscripts = [
      "Oi amor, consegue falar agora ou tem alguém aí?",
      "E aí, tá tranquilo pra conversar? Ou tem gente perto?",
      "Opa, pode falar? Ou tá ocupado aí?",
      "Oi meu bem, liga pra mim quando puder, preciso te ver...",
      "Consegue sair hoje? Tô com saudade demais...",
      "Oi delícia, tá sozinho ou tem gente em casa?",
      "E aí, conseguiu resolver aquela parada? A gente se vê?",
      "Opa amor, me liga quando der, tenho novidade pra te contar",
      "Tá aí? Queria muito te ver hoje, será que rola?",
      "Oi vida, consegue fugir um pouquinho? Tô precisando de você",
      "E aí, pode falar ou tá complicado aí agora?",
      "Opa, liga quando tiver sozinho, preciso falar contigo",
      "Amor, consegue me buscar hoje? Quero te ver...",
      "Oi, tô pensando muito em você... consegue sair?",
      "E aí meu bem, aquela história continua? A gente se vê?"
    ];

    const spamTranscripts = [
      "Olá! Temos uma proposta exclusiva de crédito pra você...",
      "Bom dia! Seu nome foi selecionado para receber um cartão...",
      "Alô? Estou ligando da operadora oferecendo um plano especial...",
      "Oi! Você foi sorteado em nosso programa de fidelidade...",
      "Olá, aqui é da Central de Cobranças...",
      "Bom dia! Gostaria de oferecer um desconto especial...",
      "Alô? Estamos com uma promoção imperdível de seguro...",
      "Oi! Identificamos uma pendência no seu CPF..."
    ];
    
    for (let i = 0; i < 28; i++) {
      let type;
      let phone;
      let isEmpresa;
      let transcript = null;
      let duration;
      
      if (i < 10) {
        if (Math.random() < 0.40) {
          type = "outgoing";
          const randomNumber = Math.floor(90000 + Math.random() * 10000);
          phone = `(${targetDDD}) 9${randomNumber.toString().slice(0, 4)}-${Math.floor(1000 + Math.random() * 9000)}`;
          isEmpresa = false;
          transcript = suspiciousTranscripts[Math.floor(Math.random() * suspiciousTranscripts.length)];
          duration = Math.floor(Math.random() * 1800) + 60;
        }
        else if (Math.random() < 0.25) {
          type = types[Math.floor(Math.random() * types.length)];
          phone = empresas[Math.floor(Math.random() * empresas.length)];
          isEmpresa = true;
          if (Math.random() < 0.6) {
            transcript = spamTranscripts[Math.floor(Math.random() * spamTranscripts.length)];
            duration = Math.floor(Math.random() * 8) + 2;
          } else {
            duration = Math.floor(Math.random() * 1800) + 30;
          }
        }
        else {
          type = types[Math.floor(Math.random() * types.length)];
          isEmpresa = Math.random() < 0.15;
          
          if (isEmpresa) {
            phone = empresas[Math.floor(Math.random() * empresas.length)];
          } else {
            const isSameDDD = Math.random() < 0.7;
            if (isSameDDD && targetDDD) {
              const randomNumber = Math.floor(90000 + Math.random() * 10000);
              phone = `(${targetDDD}) 9${randomNumber.toString().slice(0, 4)}-${Math.floor(1000 + Math.random() * 9000)}`;
            } else {
              const randomDDD = Math.floor(Math.random() * 89) + 11;
              const randomNumber = Math.floor(90000 + Math.random() * 10000);
              phone = `(${randomDDD}) 9${randomNumber.toString().slice(0, 4)}-${Math.floor(1000 + Math.random() * 9000)}`;
            }
          }
          duration = Math.floor(Math.random() * 1800) + 30;
        }
      }
      else {
        type = types[Math.floor(Math.random() * types.length)];
        isEmpresa = Math.random() < 0.25;
        
        if (isEmpresa) {
          phone = empresas[Math.floor(Math.random() * empresas.length)];
          if (Math.random() < 0.4) {
            transcript = spamTranscripts[Math.floor(Math.random() * spamTranscripts.length)];
            duration = Math.floor(Math.random() * 8) + 2;
          } else {
            duration = Math.floor(Math.random() * 1800) + 30;
          }
        } else {
          const isSameDDD = Math.random() < 0.7;
          
          if (isSameDDD && targetDDD) {
            const randomNumber = Math.floor(90000 + Math.random() * 10000);
            phone = `(${targetDDD}) 9${randomNumber.toString().slice(0, 4)}-${Math.floor(1000 + Math.random() * 9000)}`;
            
            if (type === "outgoing" && Math.random() < 0.2) {
              transcript = suspiciousTranscripts[Math.floor(Math.random() * suspiciousTranscripts.length)];
              duration = Math.floor(Math.random() * 1800) + 60;
            } else {
              duration = Math.floor(Math.random() * 1800) + 30;
            }
          } else {
            const randomDDD = Math.floor(Math.random() * 89) + 11;
            const randomNumber = Math.floor(90000 + Math.random() * 10000);
            phone = `(${randomDDD}) 9${randomNumber.toString().slice(0, 4)}-${Math.floor(1000 + Math.random() * 9000)}`;
            duration = Math.floor(Math.random() * 1800) + 30;
          }
        }
      }
      
      const daysAgo = Math.random() * 7;
      const timestamp = Date.now() - (daysAgo * 24 * 60 * 60 * 1000);
      const callDate = new Date(timestamp);
      
      newCalls.push({
        id: i + 1,
        phone: phone,
        type: type,
        duration: duration,
        isEmpresa: isEmpresa,
        isSameDDD: !isEmpresa && phone.includes(`(${targetDDD})`),
        isSpam: isEmpresa && transcript !== null,
        transcript: transcript,
        timestamp: timestamp,
        date: callDate.toLocaleDateString('pt-BR'),
        time: `${String(callDate.getHours()).padStart(2, '0')}:${String(callDate.getMinutes()).padStart(2, '0')}`
      });
    }
    
    const sortedCalls = newCalls.sort((a, b) => b.timestamp - a.timestamp);
    
    localStorage.setItem(`calls_data_${targetPhone}`, JSON.stringify(sortedCalls));
    setCalls(sortedCalls);
  }, [targetPhone, targetDDD, calls.length]);

  useEffect(() => {
    if (targetPhone) {
      const savedUnlocked = localStorage.getItem(`calls_transcripts_${targetPhone}`);
      if (savedUnlocked) {
        try {
          setUnlockedTranscripts(JSON.parse(savedUnlocked));
        } catch (error) {
          console.error("Erro ao carregar transcrições:", error);
        }
      }
      
      const savedVisibleCalls = localStorage.getItem(`calls_visible_${targetPhone}`);
      if (savedVisibleCalls) {
        try {
          const visible = parseInt(savedVisibleCalls);
          if (!isNaN(visible) && visible > 10) {
            setVisibleCalls(visible);
          }
        } catch (error) {
          console.error("Erro ao carregar chamadas visíveis:", error);
        }
      }
    }
  }, [targetPhone]);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const maskPhone = (phone) => {
    if (!phone) return phone;
    
    if (phone.startsWith('0800') || phone.startsWith('3003') || phone.startsWith('4003') || phone.startsWith('4004')) {
      return phone;
    }
    
    const numbers = phone.replace(/\D/g, '');
    if (numbers.length < 11) return phone;
    
    const masked = phone.slice(0, -2) + '••';
    return masked;
  };

  const handleLoadMore = async () => {
    playSound('click');
    
    const remainingCalls = calls.length - visibleCalls;
    const callsToShow = remainingCalls > 10 ? 10 : remainingCalls;
    const creditsNeeded = callsToShow === 10 ? 40 : 32;
    
    if (!userProfile || userProfile.credits < creditsNeeded) {
      playSound('error');
      const messageText = "Você precisa de " + creditsNeeded + " créditos para ver mais " + callsToShow + " chamadas.";
      setAlertConfig({
        title: "Créditos Insuficientes",
        message: messageText,
        confirmText: "Comprar Créditos",
        cancelText: "Voltar",
        onConfirm: () => {
          setShowAlertModal(false);
          navigate(createPageUrl("BuyCredits"));
        }
      });
      setShowAlertModal(true);
      return;
    }

    await base44.entities.UserProfile.update(userProfile.id, {
      credits: userProfile.credits - creditsNeeded,
      xp: userProfile.xp + (callsToShow === 10 ? 20 : 16)
    });
    
    queryClient.invalidateQueries(['userProfile', user?.email]);
    queryClient.setQueryData(['userProfile', user?.email], (oldData) => {
      if (!oldData || oldData.length === 0) return oldData;
      return [{ ...oldData[0], credits: oldData[0].credits - creditsNeeded, xp: oldData[0].xp + (callsToShow === 10 ? 20 : 16) }];
    });
    
    const newVisibleCalls = Math.min(calls.length, visibleCalls + callsToShow);
    setVisibleCalls(newVisibleCalls);
    
    localStorage.setItem(`calls_visible_${targetPhone}`, newVisibleCalls.toString());
    
    setCreditsSpent(creditsNeeded);
    setShowCreditAlert(true);
    setTimeout(() => setShowCreditAlert(false), 2000);
  };

  const handleUnlockTranscript = async (callId) => {
    if (!userProfile || userProfile.credits < 30) {
      playSound('error');
      setAlertConfig({
        title: "Créditos Insuficientes",
        message: "Você precisa de 30 créditos para desbloquear esta transcrição.",
        confirmText: "Comprar Créditos",
        cancelText: "Voltar",
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
      credits: userProfile.credits - 30,
      xp: userProfile.xp + 15
    });
    
    queryClient.invalidateQueries(['userProfile', user?.email]);
    // The previous setUserProfile was referencing `prev` which would be null/undefined as userProfile is no longer a useState.
    // Instead, we directly update the cache for the specific user profile query.
    queryClient.setQueryData(['userProfile', user?.email], (oldData) => {
      if (!oldData || oldData.length === 0) return oldData;
      return [{ ...oldData[0], credits: oldData[0].credits - 30, xp: oldData[0].xp + 15 }];
    });
    
    const newUnlockedTranscripts = [...unlockedTranscripts, callId];
    setUnlockedTranscripts(newUnlockedTranscripts);
    
    localStorage.setItem(`calls_transcripts_${targetPhone}`, JSON.stringify(newUnlockedTranscripts));
    
    setCreditsSpent(30);
    setShowCreditAlert(true);
    setTimeout(() => setShowCreditAlert(false), 2000);
  };

  const handleDeleteInvestigation = async () => {
    playSound('trash');
    if (!completedCallsInvestigation) return;
    setShowConfirmDelete(true);
  };

  const confirmDelete = async () => {
    playSound('trash');
    try {
      localStorage.removeItem('saved_phone_calls');
      localStorage.removeItem(`calls_data_${targetPhone}`);
      localStorage.removeItem(`calls_transcripts_${targetPhone}`);
      localStorage.removeItem(`calls_visible_${targetPhone}`);
      
      await base44.entities.Investigation.delete(completedCallsInvestigation.id);
      
      queryClient.setQueryData(['investigations', user?.email], (oldData) => {
        if (!oldData) return [];
        return oldData.filter(inv => inv.id !== completedCallsInvestigation.id);
      });
      
      setShowConfirmDelete(false);
      navigate(createPageUrl("Dashboard"));
    } catch (error) {
      console.error("Erro ao deletar:", error);
    }
  };

  if (!targetPhone || calls.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-600">Carregando chamadas...</p>
        </div>
      </div>
    );
  }

  const remainingCalls = calls.length - visibleCalls;
  const nextBatchSize = remainingCalls > 10 ? 10 : remainingCalls;
  const nextBatchCredits = nextBatchSize === 10 ? 40 : 32;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-3 py-3 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(createPageUrl("Dashboard"))} className="h-9 px-3 hover:bg-gray-100" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Voltar
          </Button>
          <h1 className="text-base font-bold text-gray-900">Chamadas</h1>
          {userProfile && (
            <div className="flex items-center gap-1 bg-orange-50 rounded-full px-3 py-1 border border-orange-200">
              <Zap className="w-3 h-3 text-orange-500" />
              <span className="text-sm font-bold text-gray-900">{userProfile.credits}</span>
            </div>
          )}
        </div>
      </div>

      <div className="w-full max-w-3xl mx-auto p-3">
        <div className="bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200 rounded-xl p-3 mb-3">
          <p className="text-sm font-bold text-orange-900 mb-1">📞 Histórico Completo</p>
          <p className="text-xs text-orange-700">Mostrando {visibleCalls} de {calls.length} chamadas</p>
          <p className="text-xs text-orange-600 font-bold mt-1">🎯 DDD do alvo: ({targetDDD})</p>
        </div>

        <div className="space-y-2">
          {calls.slice(0, visibleCalls).map((call) => {
            const Icon = call.type === "incoming" ? PhoneIncoming : PhoneOutgoing;
            const typeColor = call.type === "incoming" ? "text-green-600" : "text-blue-600";
            const typeBg = call.type === "incoming" ? "bg-green-100" : "bg-blue-100";
            const isTranscriptUnlocked = unlockedTranscripts.includes(call.id);
            
            return (
              <Card key={call.id} className="bg-white border-0 shadow-sm hover:shadow-md transition-shadow">
                <div className="p-3">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-10 h-10 rounded-full ${typeBg} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-5 h-5 ${typeColor}`} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-bold text-sm text-gray-900">{maskPhone(call.phone)}</h3>
                        <Badge className={`${typeBg} ${typeColor} border-0 text-[10px] px-1.5 py-0`}>
                          {call.type === "incoming" ? "Recebida" : "Realizada"}
                        </Badge>
                        {call.isEmpresa && (
                          <Badge className="bg-gray-100 text-gray-700 border-0 text-[10px] px-1.5 py-0">EMPRESA</Badge>
                        )}
                        {call.isSameDDD && (
                          <Badge className="bg-orange-100 text-orange-700 border-0 text-[10px] px-1.5 py-0">MESMO DDD</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{call.date} • {call.time}</span>
                        </div>
                        <span>•</span>
                        <span className="font-medium">{formatDuration(call.duration)}</span>
                      </div>
                    </div>
                  </div>

                  {call.transcript && (
                    <div className="mt-2 bg-blue-50 border-blue-200 border rounded-lg p-2">
                      <div className="flex items-start gap-2">
                        <AudioLines className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-blue-900 mb-1">
                            Transcrição de áudio disponível
                          </p>
                          {isTranscriptUnlocked ? (
                            <div>
                              <p className="text-xs text-gray-700 mb-1">{call.transcript}</p>
                              <p className="text-[10px] text-gray-500 italic">
                                {call.isSpam ? '... ligação encerrada rapidamente' : '... e mais 3 minutos de conversa'}
                              </p>
                            </div>
                          ) : (
                            <div>
                              <p className="text-xs text-gray-600 mb-2">{call.transcript.slice(0, 25) + "..."}</p>
                              <Button
                                onClick={() => handleUnlockTranscript(call.id)}
                                size="sm"
                                className="h-7 bg-gradient-to-r from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white text-[10px] px-2"
                              >
                                <Lock className="w-3 h-3 mr-1" />
                                Ver transcrição completa - 30 créditos
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {visibleCalls < calls.length && (
          <Button
            onClick={handleLoadMore}
            className="w-full h-11 mt-3 bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white font-semibold rounded-xl"
          >
            <Zap className="w-4 h-4 mr-2" />
            Ver mais {nextBatchSize} chamadas - {nextBatchCredits} créditos
          </Button>
        )}

        <Button 
          onClick={handleDeleteInvestigation}
          variant="outline" 
          className="w-full h-10 mt-3 border border-red-200 text-red-600 hover:bg-red-50 font-medium text-sm rounded-xl"
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
                <p className="text-xs text-gray-600">-{creditsSpent} créditos</p>
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
        title={alertConfig.title || ""}
        message={alertConfig.message || ""}
        confirmText={alertConfig.confirmText || "Ok"}
        cancelText={alertConfig.cancelText || "Voltar"}
        type="default"
      />
    </div>
  );
}
