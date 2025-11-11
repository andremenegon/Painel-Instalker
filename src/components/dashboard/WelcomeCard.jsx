
import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Zap, TrendingUp, Plus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";

export default function WelcomeCard({ user, activeInvestigations, userProfile }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const levelUpProcessed = useRef(false); // ✅ PREVENIR MÚLTIPLOS LEVEL UPS
  const firstName = user?.full_name?.split(" ")[0] || "Usuário";
  const level = userProfile?.level || 1;
  const credits = userProfile?.credits || 0;
  const xp = userProfile?.xp || 0;
  const xpToNextLevel = level * 100;
  const xpProgress = (xp / xpToNextLevel) * 100;

  // ✅ Sistema de Level Up automático - COM PROTEÇÃO ANTI-LOOP
  useEffect(() => {
    if (levelUpProcessed.current) return; // ✅ JÁ PROCESSADO
    if (!userProfile || !userProfile.id) return;
    if (xp < xpToNextLevel) return;

    levelUpProcessed.current = true; // ✅ MARCAR COMO PROCESSADO

    const processLevelUp = async () => {
      try {
        const newLevel = level + 1;
        const bonusCredits = newLevel * 10;

        // ✅ NÃO ADICIONAR CRÉDITOS AQUI - apenas atualizar level e XP
        await base44.entities.UserProfile.update(userProfile.id, {
          level: newLevel,
          xp: xp - xpToNextLevel,
          // credits: NÃO TOCAR - será adicionado quando mostrar modal
        });

        queryClient.invalidateQueries({ queryKey: ['userProfile'] });

        // Salvar dados para modal + ID do perfil + créditos atuais
        localStorage.setItem('pending_level_up', JSON.stringify({
          newLevel,
          bonusCredits,
          timestamp: Date.now(),
          profileId: userProfile.id,
          currentCredits: userProfile.credits
        }));
      } catch (error) {
        console.error("Erro ao fazer level up:", error);
        levelUpProcessed.current = false; // ✅ RESETAR EM CASO DE ERRO
      }
    };

    processLevelUp();
  }, []); // ✅ EXECUTAR APENAS UMA VEZ

  const playSound = (type) => {
    if (!window.AudioContext && !window.webkitAudioContext) {
      return;
    }

    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      if (type === 'levelup') {
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
      }
    } catch (error) {
      // Silently fail
    }
  };

  return (
    <Card className="gradient-primary border-0 shadow-soft text-white px-3 py-3 overflow-hidden relative mb-3 rounded-2xl">
      {/* Partículas flutuantes animadas */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-white/20 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${3 + Math.random() * 2}s`
            }}
          />
        ))}
      </div>

      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16" />

      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles className="w-[18px] h-[18px]" />
              <span className="text-[15px] font-medium opacity-90">Bem-vindo!</span>
            </div>
            <h1 
              className="text-[25px] sm:text-[27px] font-bold mb-1.5 cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => navigate(createPageUrl("Profile"))}
            >
              Olá, {firstName}! 👋
            </h1>
            <p className="text-white/80 text-[15px] max-w-md leading-tight">
              Escolha um serviço e comece sua investigação
            </p>
          </div>

          <div
            onClick={() => navigate(createPageUrl("Levels"))}
            className="bg-white/20 backdrop-blur-sm rounded-xl px-3 py-2 cursor-pointer hover:bg-white/30 transition-all flex items-center gap-2 self-start"
          >
            <TrendingUp className="w-4 h-4" />
            <div className="text-left">
              <p className="text-lg font-bold leading-tight">Nv.{level}</p>
              <p className="text-[8px] opacity-80 leading-tight">Level</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 relative">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1">
                <Zap className="w-3 h-3" />
                <p className="text-[10px] opacity-80">Créditos</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(createPageUrl("BuyCredits"));
                }}
                className="w-5 h-5 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
            <p className="text-xl font-bold">{credits}</p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2">
            <div className="flex items-center gap-1 mb-1">
              <Sparkles className="w-3 h-3" />
              <p className="text-[10px] opacity-80">XP</p>
            </div>
            <p className="text-sm font-bold mb-1">{xp}/{xpToNextLevel}</p>
            <div className="w-full bg-white/20 rounded-full h-1">
              <div
                className="bg-white h-1 rounded-full transition-all duration-500"
                style={{ width: `${xpProgress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
            opacity: 0.2;
          }
          50% {
            transform: translateY(-20px) rotate(180deg);
            opacity: 0.5;
          }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
      `}</style>
    </Card>
  );
}
