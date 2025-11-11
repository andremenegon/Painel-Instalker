
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Zap, Sparkles, Check, TrendingUp } from "lucide-react";
import ConfirmModal from "../components/dashboard/ConfirmModal";
import Toast from "../components/effects/Toast";

export default function BuyCredits() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [purchaseDetails, setPurchaseDetails] = useState({});

  // ✅ Estados para efeitos
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // ✅ FUNÇÃO DE SOM UNIVERSAL
  const playSound = (type) => {
    if (typeof window === 'undefined') return;
    if (!window.AudioContext && !window.webkitAudioContext) return;

    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();

      if (type === 'coins') {
        // Som de moedas caindo - múltiplos sons em sequência
        const times = [0, 0.05, 0.1, 0.15, 0.2];
        const freqs = [800, 1000, 1200, 900, 1100];

        times.forEach((time, i) => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();

          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);

          oscillator.frequency.setValueAtTime(freqs[i], audioContext.currentTime + time);
          gainNode.gain.setValueAtTime(0.2, audioContext.currentTime + time);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + time + 0.15);

          oscillator.start(audioContext.currentTime + time);
          oscillator.stop(audioContext.currentTime + time + 0.15);
        });
        return;
      } else if (type === 'click') {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

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

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: Infinity,
    cacheTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
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

  const packages = [
    {
      id: 1,
      credits: 100,
      price: 29.9,
      badge: null,
      color: "from-orange-400 to-orange-500"
    },
    {
      id: 2,
      credits: 300,
      price: 79.9,
      bonus: 50,
      badge: "POPULAR",
      color: "from-orange-500 to-pink-500",
      glow: true
    },
    {
      id: 3,
      credits: 600,
      price: 149.9,
      bonus: 150,
      badge: "+150 BÔNUS",
      color: "from-pink-500 to-red-500"
    },
    {
      id: 4,
      credits: 1500,
      price: 299.9,
      bonus: 500,
      badge: "MELHOR VALOR",
      color: "from-red-500 to-orange-600"
    }
  ];

  const playPurchaseSound = () => {
    playSound('coins');
  };

  const handleBuy = async (pkg) => {
    playSound('click');
    setLoading(pkg.id);

    await new Promise(resolve => setTimeout(resolve, 1500));

    if (userProfile) {
      const totalCredits = pkg.credits + (pkg.bonus || 0);

      playPurchaseSound();

      await base44.entities.UserProfile.update(userProfile.id, {
        credits: userProfile.credits + totalCredits
      });

      // ✅ INVALIDAR O CACHE CORRETO DO LAYOUT E FORÇAR ATUALIZAÇÃO IMEDIATA
      await queryClient.invalidateQueries({ queryKey: ['layoutUserProfile', user?.email] });
      await queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      
      // ✅ FORÇAR REFETCH IMEDIATO
      await queryClient.refetchQueries({ queryKey: ['layoutUserProfile', user?.email] });

      setPurchaseDetails({
        credits: totalCredits,
        message: `✅ Compra confirmada!\n\n+${totalCredits} créditos adicionados à sua conta`
      });
      setShowSuccessModal(true);
    }
    setLoading(""); // Ensure loading state is always cleared
  };

  return (
    <>
      <Toast show={showToast} message={toastMessage} type="credits" onComplete={() => setShowToast(false)} />

      <div className="min-h-screen bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          {[...Array(15)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-float-slow"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`
              }}
            >
              <Zap
                className="text-orange-200"
                size={20 + Math.random() * 20}
                style={{ opacity: 0.3 }}
              />
            </div>
          ))}
        </div>

        <div className="bg-white/80 backdrop-blur-md border-b border-orange-100 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => { playSound('click'); navigate(createPageUrl("Dashboard")); }}
              className="h-9 px-3 text-gray-900 hover:bg-orange-50"
              size="sm"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Voltar
            </Button>

            {userProfile && (
              <div className="flex items-center gap-2 bg-orange-50 rounded-full px-4 py-2 border border-orange-200">
                <Zap className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-bold text-gray-900">{userProfile.credits}</span>
              </div>
            )}
          </div>
        </div>

        <div className="max-w-4xl mx-auto p-4 pt-8 relative z-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-100 to-pink-100 border border-orange-200 rounded-full px-4 py-1.5 mb-4">
              <Sparkles className="w-4 h-4 text-orange-500" />
              <span className="text-xs font-medium text-orange-700">Recarregue seus créditos</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-2 tracking-tight">
              Escolha seu pacote
            </h1>
            <p className="text-sm text-gray-600">Quanto mais você compra, mais você economiza</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {packages.map((pkg) => (
              <Card
                key={pkg.id}
                className={`relative overflow-hidden bg-white border-2 transition-all duration-300 hover:scale-105 hover:shadow-2xl ${
                  pkg.glow
                    ? 'border-orange-400 shadow-lg shadow-orange-200 animate-pulse-glow'
                    : 'border-orange-100 hover:border-orange-200'
                }`}
                style={{ borderRadius: '16px' }}
              >
                {pkg.glow && (
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-50 to-pink-50" />
                )}

                <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/50 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none shine-effect" />

                <div className="relative p-5">
                  {pkg.badge && (
                    <div className={`absolute top-3 right-3 bg-gradient-to-r ${pkg.color} text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm`}>
                      {pkg.badge}
                    </div>
                  )}

                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${pkg.color} flex items-center justify-center mb-3 shadow-md`}>
                    <Zap className="w-6 h-6 text-white" />
                  </div>

                  <div className="mb-4">
                    <div className="flex items-baseline gap-2 mb-1">
                      <p className="text-2xl font-black text-gray-900">{pkg.credits}</p>
                      <p className="text-xs text-gray-500">créditos</p>
                    </div>

                    {pkg.bonus && (
                      <div className="flex items-center gap-1 text-green-600">
                        <TrendingUp className="w-3 h-3" />
                        <p className="text-xs font-bold">+{pkg.bonus} bônus</p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-xs text-gray-500">R$</span>
                    <span className="text-3xl font-black text-gray-900">
                      {pkg.price.toFixed(2).replace('.', ',')}
                    </span>
                  </div>

                  <div className="space-y-1.5 mb-4">
                    <div className="flex items-center gap-2 text-xs text-gray-700">
                      <Check className="w-3 h-3 text-green-500" />
                      <span>Créditos nunca expiram</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-700">
                      <Check className="w-3 h-3 text-green-500" />
                      <span>Acesso a todos serviços</span>
                    </div>
                    {pkg.bonus && (
                      <div className="flex items-center gap-2 text-xs text-green-600 font-medium">
                        <Check className="w-3 h-3" />
                        <span>+{pkg.bonus} créditos de bônus</span>
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={() => handleBuy(pkg)}
                    disabled={loading === pkg.id}
                    className={`w-full h-10 font-bold text-xs transition-all duration-200 ${
                      pkg.glow
                        ? `bg-gradient-to-r ${pkg.color} hover:shadow-lg text-white`
                        : 'bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white'
                    }`}
                    style={{ borderRadius: '10px' }}
                  >
                    {loading === pkg.id ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Processando...</span>
                      </div>
                    ) : (
                      'Comprar Agora'
                    )}
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-orange-100 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-gray-900 mb-1">🔒</p>
              <p className="text-[10px] text-gray-600 font-medium">Pagamento Seguro</p>
            </div>
            <div className="bg-white border border-orange-100 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-gray-900 mb-1">⚡</p>
              <p className="text-[10px] text-gray-600 font-medium">Créditos Instantâneos</p>
            </div>
            <div className="bg-white border border-orange-100 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-gray-900 mb-1">♾️</p>
              <p className="text-[10px] text-gray-600 font-medium">Nunca Expiram</p>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes float-slow {
            0%, 100% {
              transform: translateY(0px) rotate(0deg);
            }
            50% {
              transform: translateY(-30px) rotate(180deg);
            }
          }
          @keyframes pulse-glow {
            0%, 100% {
              box-shadow: 0 0 20px rgba(255, 107, 74, 0.3);
            }
            50% {
              box-shadow: 0 0 40px rgba(255, 107, 74, 0.6);
            }
          }
          .animate-float-slow {
            animation: float-slow 8s ease-in-out infinite;
          }
          .animate-pulse-glow {
            animation: pulse-glow 2s ease-in-out infinite;
          }
          .shine-effect {
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent);
            animation: shine 3s infinite;
          }
          @keyframes shine {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}</style>

        <ConfirmModal
          isOpen={showSuccessModal}
          onConfirm={() => {
            playSound('click');
            setShowSuccessModal(false);
            navigate(createPageUrl("Dashboard"));
          }}
          onCancel={() => {
            playSound('click');
            setShowSuccessModal(false);
            navigate(createPageUrl("Dashboard"));
          }}
          title="Compra Realizada!"
          message={purchaseDetails.message}
          confirmText="Ir para Dashboard"
          cancelText="Fechar"
          type="default"
        />
      </div>
    </>
  );
}
