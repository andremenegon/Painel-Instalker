
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Zap, Shield, Eye, MessageCircle, FileText, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import ConfirmModal from "../components/dashboard/ConfirmModal";

export default function DetectiveSpy() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  // Removed userProfile state, it will be derived from useQuery
  const [showCreditAlert, setShowCreditAlert] = useState(false);
  const [creditsSpent, setCreditsSpent] = useState(0);
  const [xpGained, setXpGained] = useState(0);
  const [showConfirmHire, setShowConfirmHire] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);

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

  const handleHire = async () => {
    playSound('click');
    
    if (!userProfile || userProfile.credits < 1000) {
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
      
      playSound('complete');
      
      setShowConfirmHire(false);
      setShowSuccessModal(true);
    } catch (error) {
      console.error("Erro ao contratar detetive:", error);
      setShowConfirmHire(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
      {/* Header */}
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

      <div className="max-w-2xl mx-auto p-3 pb-20">
        {/* Hero - SEM PREÇO */}
        <div className="text-center mb-4">
          <div className="text-6xl mb-3">🕵️</div>
          <h1 className="text-lg font-bold text-gray-900 mb-2">Detetive Particular Profissional</h1>
          <Badge className="bg-gradient-to-r from-gray-600 to-gray-700 text-white border-0 text-[10px] font-bold px-3 py-1">
            ⭐ INVESTIGAÇÃO REAL E MANUAL
          </Badge>
        </div>

        {/* Como Funciona - DETALHADO */}
        <Card className="bg-white border-0 shadow-md p-5 mb-3">
          <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-2xl">🎯</span>
            Como Funciona a Investigação
          </h3>
          
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-gray-700">1</span>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 mb-1">Briefing Inicial</p>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Você passa todas as informações do alvo: nome completo, redes sociais, telefone, hábitos, 
                  horários. Quanto mais detalhes, melhor será a investigação.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-gray-700">2</span>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 mb-1">Início Imediato</p>
                <p className="text-xs text-gray-600 leading-relaxed">
                  <span className="font-bold text-green-600">A investigação começa IMEDIATAMENTE</span> após a contratação. 
                  O detetive analisa o perfil, monta a estratégia e já inicia o contato.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-gray-700">3</span>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 mb-1">Infiltração e Aproximação</p>
                <p className="text-xs text-gray-600 leading-relaxed">
                  O detetive cria um perfil fake convincente e adiciona o alvo nas redes sociais (Instagram, Facebook, etc). 
                  Ele se passa por alguém interessante, do mesmo círculo social.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-gray-700">4</span>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 mb-1">Construção de Confiança</p>
                <p className="text-xs text-gray-600 leading-relaxed">
                  O detetive puxa conversa natural, comenta nas fotos, manda direct. 
                  Ele usa técnicas de persuasão e engenharia social para ganhar a confiança do alvo.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-gray-700">5</span>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 mb-1">Teste de Fidelidade</p>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Com a confiança estabelecida, o detetive faz perguntas estratégicas, propõe encontros, 
                  avalia reações. Ele testa se a pessoa está aberta a trair, mente sobre relacionamento, ou demonstra interesse.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-gray-700">6</span>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 mb-1">Coleta de Evidências</p>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Tudo é documentado: prints de conversas, áudios, comportamento suspeito, mentiras identificadas. 
                  O detetive registra cada detalhe relevante.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-gray-700">7</span>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 mb-1">Relatório Final Completo</p>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Você recebe um <span className="font-bold">relatório em PDF</span> com todas as evidências coletadas, 
                  análise comportamental detalhada e conclusão profissional sobre infidelidade.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-3 mt-4 border border-blue-200">
            <p className="text-xs text-gray-900 font-medium text-center">
              📱 <span className="font-bold">Você acompanha tudo pelo WhatsApp</span> do detetive em tempo real
            </p>
          </div>
        </Card>

        {/* Duração - SEM PRAZO FIXO */}
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-200 p-5 mb-3">
          <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
            <span className="text-2xl">⏱️</span>
            Quanto Tempo Demora?
          </h3>
          
          <p className="text-sm text-gray-700 mb-3 leading-relaxed">
            <span className="font-bold text-gray-900">A investigação não tem prazo fixo.</span> Ela continua 
            <span className="font-bold"> até você ter todas as respostas que precisa</span> e conseguir tomar uma decisão consciente.
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

        {/* O Que Você Recebe */}
        <Card className="bg-white border-0 shadow-md p-5 mb-3">
          <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-2xl">📦</span>
            O Que Está Incluído
          </h3>
          
          <div className="grid grid-cols-1 gap-3">
            <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-gray-900">Detetive Real e Profissional</p>
                <p className="text-xs text-gray-600">Investigador treinado com anos de experiência em infidelidade</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-gray-900">WhatsApp Direto com Detetive</p>
                <p className="text-xs text-gray-600">Linha direta 24/7 para tirar dúvidas e receber updates</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
              <CheckCircle2 className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-gray-900">Relatório Completo em PDF</p>
                <p className="text-xs text-gray-600">Documento profissional com todas as evidências documentadas</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
              <CheckCircle2 className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-gray-900">Updates em Tempo Real</p>
                <p className="text-xs text-gray-600">Você recebe notificações de cada passo da investigação</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-pink-50 rounded-lg border border-pink-200">
              <CheckCircle2 className="w-5 h-5 text-pink-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-gray-900">Prints e Evidências</p>
                <p className="text-xs text-gray-600">Capturas de tela, conversas, comportamento documentado</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
              <CheckCircle2 className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-gray-900">Análise Comportamental</p>
                <p className="text-xs text-gray-600">Interpretação profissional de reações e linguagem corporal digital</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Garantia */}
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 shadow-md p-5 mb-3">
          <div className="flex items-start gap-3">
            <Shield className="w-8 h-8 text-green-600 flex-shrink-0" />
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-2">Garantia de Satisfação Total</h3>
              <p className="text-sm text-gray-700 leading-relaxed mb-3">
                Se o detetive não conseguir fazer contato com o alvo ou não coletar nenhuma informação relevante em até 15 dias, 
                devolvemos <span className="font-bold">100% dos créditos</span>.
              </p>
              <p className="text-xs text-gray-600 leading-relaxed">
                Mas isso raramente acontece. Em 98% dos casos, o detetive consegue estabelecer contato e coletar evidências valiosas.
              </p>
            </div>
          </div>
        </Card>

        {/* Depoimentos Sociais */}
        <Card className="bg-white border-0 shadow-md p-5 mb-3">
          <h3 className="text-base font-bold text-gray-900 mb-4 text-center">
            💬 O Que Nossos Clientes Dizem
          </h3>
          
          <div className="space-y-3">
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-xs text-gray-700 italic mb-2">
                "Descobri que meu marido tinha perfil no Tinder e estava conversando com várias mulheres. 
                O detetive conseguiu todas as provas que eu precisava. Valeu cada centavo."
              </p>
              <p className="text-xs text-gray-500">— Ana, 34 anos</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-xs text-gray-700 italic mb-2">
                "Eu suspeitava há meses mas não tinha certeza. O detetive confirmou tudo em 10 dias. 
                Agora posso seguir em frente com a verdade."
              </p>
              <p className="text-xs text-gray-500">— Carlos, 41 anos</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-xs text-gray-700 italic mb-2">
                "O detetive foi extremamente profissional e discreto. Recebi relatório completo com prints das conversas. 
                Recomendo 100%."
              </p>
              <p className="text-xs text-gray-500">— Juliana, 29 anos</p>
            </div>
          </div>
        </Card>

        {/* CTA Final - BOTÃO SIMPLIFICADO */}
        <Card className="bg-gradient-to-br from-gray-700 to-gray-800 border-0 shadow-2xl p-6 text-white sticky bottom-3">
          <div className="text-center mb-4">
            <div className="text-5xl mb-3">🕵️</div>
            <h3 className="text-xl font-bold mb-2">Descubra a Verdade Agora</h3>
            <p className="text-sm opacity-90 mb-3">Investigação profissional com detetive real</p>
            
            {/* PREÇO APENAS AQUI */}
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-xl px-5 py-2 mb-4">
              <Zap className="w-5 h-5 text-yellow-300" />
              <span className="text-2xl font-black">1000</span>
              <span className="text-sm opacity-90">créditos</span>
            </div>
          </div>

          <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2 text-xs mb-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Detetive real e profissional</span>
            </div>
            <div className="flex items-center gap-2 text-xs mb-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Início imediato da investigação</span>
            </div>
            <div className="flex items-center gap-2 text-xs mb-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>WhatsApp direto com o detetive</span>
            </div>
            <div className="flex items-center gap-2 text-xs mb-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Relatório completo em PDF</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4" />
              <span>Garantia de satisfação</span>
            </div>
          </div>

          <Button 
            onClick={handleHire}
            className="w-full h-14 bg-white text-gray-900 hover:bg-gray-100 font-bold text-base rounded-xl shadow-lg"
          >
            🔒 CONTRATAR DETETIVE
          </Button>

          <div className="text-center mt-3 space-y-1">
            <p className="text-xs opacity-90">🔒 100% seguro e discreto</p>
            <p className="text-xs opacity-90">⚡ Investigação começa imediatamente</p>
          </div>
        </Card>
      </div>

      {/* Pop-up de Gasto */}
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

      {/* Confirm Hire Modal */}
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

      {/* Success Modal */}
      <ConfirmModal
        isOpen={showSuccessModal}
        onConfirm={() => {
          setShowSuccessModal(false);
          navigate(createPageUrl("Dashboard"));
        }}
        onCancel={() => {
          setShowSuccessModal(false);
          navigate(createPageUrl("Dashboard"));
        }}
        title="✅ Detetive Contratado!"
        message="📱 WhatsApp do detetive:\n(11) 99876-5432\n\nO detetive Carlos entrará em contato em até 24h.\n\nVocê receberá todas as instruções via WhatsApp."
        confirmText="Ir para Dashboard"
        cancelText="Fechar"
        type="default"
      />

      {/* Insufficient Credits Modal */}
      <ConfirmModal
        isOpen={showAlertModal}
        onConfirm={() => {
          setShowAlertModal(false);
          navigate(createPageUrl("BuyCredits"));
        }}
        onCancel={() => {
          setShowAlertModal(false);
          navigate(createPageUrl("Dashboard"));
        }}
        title="Créditos Insuficientes"
        message="Você precisa de 1000 créditos para contratar o detetive particular."
        confirmText="Comprar Créditos"
        cancelText="Voltar"
        type="default"
      />
    </div>
  );
}
