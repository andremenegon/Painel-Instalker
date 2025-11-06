import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Instagram, Lock, Zap, Shield, AlertTriangle, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ConfirmModal from "../components/dashboard/ConfirmModal";

export default function InstagramSpyResults() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreditAlert, setShowCreditAlert] = useState(false);
  const [creditsSpent, setCreditsSpent] = useState(0);
  const [xpGained, setXpGained] = useState(0);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertConfig, setAlertConfig] = useState({});
  const [unlockedPassword, setUnlockedPassword] = useState(false);

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

  const completedInstagramInvestigation = investigations.find(
    inv => inv.service_name === "Instagram" && (inv.status === "completed" || inv.status === "accelerated")
  );

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
      } else if (type === 'trash') {
        oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
      } else if (type === 'error') {
        oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
      }
    } catch (error) {
      // Silently fail
    }
  };

  const handleUnlockPassword = async () => {
    playSound('click');
    
    if (!userProfile || userProfile.credits < 50) {
      playSound('error');
      setAlertConfig({
        title: "Créditos Insuficientes",
        message: "Você precisa de 50 créditos para tentar descriptografar a senha.",
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
      credits: userProfile.credits - 50,
      xp: userProfile.xp + 30
    });
    queryClient.invalidateQueries(['userProfile', user?.email]);

    setCreditsSpent(50);
    setXpGained(30);
    setShowCreditAlert(true);
    setTimeout(() => setShowCreditAlert(false), 3000);

    setUnlockedPassword(true);
  };

  const handleDeleteInvestigation = () => {
    playSound('trash');
    if (!completedInstagramInvestigation) return;
    setShowConfirmDelete(true);
  };

  const confirmDelete = async () => {
    playSound('trash');
    if (!completedInstagramInvestigation) return;

    try {
      localStorage.removeItem(`instagram_start_${completedInstagramInvestigation.id}`);
      localStorage.removeItem(`accelerate_shown_${completedInstagramInvestigation.id}`);

      await base44.entities.Investigation.delete(completedInstagramInvestigation.id);
      
      queryClient.setQueryData(['investigations', user?.email], (oldData) => {
        if (!oldData) return [];
        return oldData.filter(inv => inv.id !== completedInstagramInvestigation.id);
      });
      
      await queryClient.invalidateQueries(['investigations', user?.email]);
      
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

  if (!completedInstagramInvestigation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
        <Card className="bg-white border-0 shadow-lg p-6 max-w-md mx-4 text-center">
          <AlertTriangle className="w-12 h-12 text-orange-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-900 mb-2">Investigação não encontrada</h3>
          <p className="text-sm text-gray-600 mb-4">Não há nenhuma investigação completa do Instagram.</p>
          <Button onClick={() => navigate(createPageUrl("Dashboard"))} className="w-full gradient-primary text-white">
            Voltar ao Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-3 py-3 flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate(createPageUrl("Dashboard"))} className="h-9 px-3 hover:bg-gray-100" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Voltar
            </Button>
            <h1 className="text-base font-bold text-gray-900">Instagram</h1>
            {userProfile && (
              <div className="flex items-center gap-1 bg-orange-50 rounded-full px-3 py-1 border border-orange-200">
                <Zap className="w-3 h-3 text-orange-500" />
                <span className="text-sm font-bold text-gray-900">{userProfile.credits}</span>
              </div>
            )}
          </div>
        </div>

        <div className="w-full max-w-2xl mx-auto p-3">
          {/* ALERTA DE SENHA CRIPTOGRAFADA */}
          <Card className="bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-200 p-5 mb-3">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-red-500 flex items-center justify-center flex-shrink-0">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-gray-900 mb-1">🔐 Senha Criptografada</h3>
                <p className="text-xs text-gray-700 leading-relaxed">
                  Detectamos que a conta <span className="font-bold">@{completedInstagramInvestigation.target_username}</span> possui <span className="font-bold text-red-600">criptografia de nível militar</span> ativada. Não foi possível acessar a senha diretamente.
                </p>
              </div>
            </div>

            {!unlockedPassword ? (
              <>
                <div className="bg-white rounded-lg p-3 mb-3">
                  <p className="text-xs text-gray-700 mb-2">
                    💡 <span className="font-bold">Solução Disponível:</span>
                  </p>
                  <ul className="text-xs text-gray-600 space-y-1 ml-4">
                    <li>• Quebra de criptografia AES-256</li>
                    <li>• Tentativa de descriptografar senha</li>
                    <li>• Processo pode levar até 48h</li>
                  </ul>
                </div>
                
                <Button
                  onClick={handleUnlockPassword}
                  className="w-full h-12 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-bold text-sm rounded-xl shadow-lg"
                >
                  <Lock className="w-4 h-4 mr-2" />
                  Tentar Descriptografar - 50 créditos
                </Button>
              </>
            ) : (
              <div className="bg-red-100 border border-red-300 rounded-lg p-4">
                <div className="flex items-start gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-red-900 mb-1">Descriptografia Falhou</p>
                    <p className="text-xs text-red-700 leading-relaxed">
                      Após 48 horas de tentativas, não conseguimos quebrar a criptografia desta conta. O Instagram utiliza proteção de última geração.
                    </p>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg p-3">
                  <p className="text-xs font-bold text-gray-900 mb-1">📋 Alternativas disponíveis:</p>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• Tente recuperar a senha através do e-mail</li>
                    <li>• Use o serviço de Detetive Particular</li>
                    <li>• Monitore outras redes sociais</li>
                  </ul>
                </div>
              </div>
            )}
          </Card>

          {/* INFORMAÇÕES BÁSICAS DISPONÍVEIS */}
          <Card className="bg-white border-0 shadow-md p-4 mb-3">
            <h3 className="text-sm font-bold text-gray-900 mb-3">📊 Informações Básicas</h3>
            
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Nome de usuário</p>
                <p className="text-sm font-bold text-gray-900">@{completedInstagramInvestigation.target_username}</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Status da Conta</p>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <p className="text-sm font-bold text-gray-900">Ativa</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Nível de Privacidade</p>
                <Badge className="bg-red-100 text-red-700 border-0 text-xs">
                  Alto • Criptografia Ativada
                </Badge>
              </div>
            </div>
          </Card>

          {/* SUGESTÕES DE OUTROS SERVIÇOS */}
          <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 p-5 mb-3">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center flex-shrink-0">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-gray-900 mb-1">💡 Sugestão</h3>
                <p className="text-xs text-gray-700">
                  Como não conseguimos acessar o Instagram, recomendamos tentar outros serviços disponíveis:
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Button
                onClick={() => navigate(createPageUrl("Investigation") + "?service=WhatsApp")}
                variant="outline"
                className="w-full h-10 border-2 border-green-300 bg-green-50 hover:bg-green-100 text-green-700 font-semibold text-xs"
              >
                📱 WhatsApp Spy - 45 créditos
              </Button>

              <Button
                onClick={() => navigate(createPageUrl("Investigation") + "?service=SMS")}
                variant="outline"
                className="w-full h-10 border-2 border-orange-300 bg-orange-50 hover:bg-orange-100 text-orange-700 font-semibold text-xs"
              >
                💬 SMS Spy - 30 créditos
              </Button>

              <Button
                onClick={() => navigate(createPageUrl("Investigation") + "?service=Detetive Particular")}
                variant="outline"
                className="w-full h-10 border-2 border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-700 font-semibold text-xs"
              >
                🕵️ Detetive Particular - 150 créditos
              </Button>
            </div>
          </Card>

          <Button
            onClick={handleDeleteInvestigation}
            variant="outline"
            className="w-full h-10 border border-red-200 text-red-600 hover:bg-red-50 font-medium text-sm rounded-xl mb-3"
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