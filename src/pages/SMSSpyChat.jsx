import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export default function SMSSpyChat() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  
  // Receber dados da conversa via location.state
  const { selectedChat, phoneNumber } = location.state || {};
  
  const [showCreditAlert, setShowCreditAlert] = useState(false);
  const [creditsSpent, setCreditsSpent] = useState(0);
  const [xpGained, setXpGained] = useState(0);
  const [chatMessages, setChatMessages] = useState(selectedChat?.messages || []);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: Infinity,
    cacheTime: Infinity,
  });

  const { data: userProfile } = useQuery({
    queryKey: ['layoutUserProfile', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const profiles = await base44.entities.UserProfile.filter({ created_by: user.email });
      return Array.isArray(profiles) && profiles.length > 0 ? profiles[0] : null;
    },
    enabled: !!user?.email,
    staleTime: 60 * 1000,
  });

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
      }
    } catch (error) {
      // Silently fail
    }
  };

  const handleRecoverDeleted = async () => {
    try {
      if (!userProfile || userProfile.credits < 20) {
        playSound('error');
        alert("Você precisa de 20 créditos para recuperar as mensagens deletadas.");
        return;
      }

      await base44.entities.UserProfile.update(userProfile.id, {
        credits: userProfile.credits - 20,
        xp: userProfile.xp + 10
      });
      queryClient.invalidateQueries(['layoutUserProfile', user?.email]);

      setCreditsSpent(20);
      setXpGained(10);
      setShowCreditAlert(true);
      setTimeout(() => setShowCreditAlert(false), 3000);

      const revealedMessages = chatMessages.map(m => {
        if (m.isDeleted) {
          const suspiciousTexts = [
            "vem aqui, to sozinho",
            "sdd de vc s2",
            "to pensando em vc",
            "queria te ver agora",
            "❤️❤️❤️❤️"
          ];
          return {
            ...m,
            text: suspiciousTexts[Math.floor(Math.random() * suspiciousTexts.length)],
            sent: Math.random() < 0.5,
            isDeleted: false
          };
        }
        return m;
      });

      setChatMessages(revealedMessages);
    } catch (error) {
      console.error("Erro ao recuperar mensagens:", error);
    }
  };

  if (!selectedChat) {
    navigate(createPageUrl("SMSSpy"));
    return null;
  }

  const hasDeletedMessages = chatMessages.some(m => m.isDeleted);

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col">
      {/* Header simples estilo SMS */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button 
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              playSound('click');
              navigate("/SMSSpy", { replace: true });
            }} 
            className="w-8 h-8 hover:bg-gray-100 rounded-full flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div>
            <p className="text-sm font-semibold text-gray-900">{selectedChat.phone}</p>
            {selectedChat.sameDDD && (
              <p className="text-xs text-orange-600">Mesmo DDD</p>
            )}
          </div>
        </div>
      </div>

      {/* Área de mensagens - estilo SMS simples */}
      <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full space-y-3">
        {chatMessages.map((msg, idx) => (
          <div key={idx}>
            {msg.isDeleted ? (
              <div className="flex justify-center my-2">
                <div className="bg-gray-200 rounded px-3 py-1.5 border border-gray-300">
                  <p className="text-xs text-gray-700 italic">🔒 Mensagem apagada</p>
                </div>
              </div>
            ) : (
              <div className={`flex ${msg.sent ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 ${
                  msg.sent
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-900 border border-gray-200 shadow-sm'
                }`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  <p className={`text-[10px] mt-1 ${msg.sent ? 'text-blue-100' : 'text-gray-500'}`}>
                    {msg.time}
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {hasDeletedMessages && (
        <div className="bg-gradient-to-r from-orange-50 to-orange-100 border-t border-orange-200 shadow-lg p-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-200 flex items-center justify-center">
                  <span className="text-lg">🔓</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Mensagens Deletadas Detectadas</p>
                  <p className="text-xs text-gray-600">Recupere o conteúdo apagado</p>
                </div>
              </div>
            </div>
            <Button
              onClick={handleRecoverDeleted}
              className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-md"
            >
              🔓 Recuperar por 20 créditos
            </Button>
          </div>
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
    </div>
  );
}

