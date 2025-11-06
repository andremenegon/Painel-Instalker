
import React from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, TrendingUp, Star, Zap, Crown, Sparkles, Award, Check } from "lucide-react";
import { useQuery } from '@tanstack/react-query'; // Added useQuery import

export default function Levels() {
  const navigate = useNavigate();

  // ✅ ÚNICA CHAMADA DE USER - COM CACHE
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
    staleTime: Infinity, // ✅ NUNCA ATUALIZA AUTOMATICAMENTE
    cacheTime: Infinity,
    refetchOnWindowFocus: false, // ✅ DESATIVADO
    refetchOnMount: false, // ✅ DESATIVADO
  });

  const userProfile = userProfiles[0];

  const levels = [
    {
      level: 1,
      name: "Iniciante",
      icon: Star,
      color: "from-gray-400 to-gray-600",
      xpRequired: 0,
      benefits: [
        "Acesso a todos serviços",
        "Suporte básico"
      ]
    },
    {
      level: 2,
      name: "Investigador",
      icon: Award,
      color: "from-blue-400 to-blue-600",
      xpRequired: 100,
      benefits: [
        "10% de desconto em créditos",
        "Bônus de 10 créditos",
        "Suporte prioritário"
      ]
    },
    {
      level: 3,
      name: "Detetive",
      icon: Sparkles,
      color: "from-purple-400 to-purple-600",
      xpRequired: 300,
      benefits: [
        "15% de desconto em créditos",
        "Bônus de 25 créditos",
        "5% de cashback em investigações",
        "Suporte VIP"
      ]
    },
    {
      level: 4,
      name: "Especialista",
      icon: Zap,
      color: "from-orange-400 to-orange-600",
      xpRequired: 600,
      benefits: [
        "20% de desconto em créditos",
        "Bônus de 50 créditos",
        "10% de cashback em investigações",
        "Aceleração grátis 1x por semana"
      ]
    },
    {
      level: 5,
      name: "Mestre Spy",
      icon: Crown,
      color: "from-yellow-400 to-yellow-600",
      xpRequired: 1000,
      benefits: [
        "30% de desconto em créditos",
        "Bônus de 100 créditos",
        "15% de cashback em investigações",
        "Aceleração grátis ilimitada",
        "Badge exclusivo de Mestre",
        "Acesso antecipado a novos serviços"
      ]
    }
  ];

  const currentLevel = userProfile?.level || 1;
  const currentXP = userProfile?.xp || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-3 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate(createPageUrl("Dashboard"))}
            className="h-9 px-3 hover:bg-gray-100"
            size="sm"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Voltar
          </Button>
          
          <h1 className="text-base font-bold text-gray-900">Níveis</h1>
          
          {userProfile && (
            <div className="flex items-center gap-1 bg-orange-50 rounded-full px-3 py-1 border border-orange-200">
              <Zap className="w-3 h-3 text-orange-500" />
              <span className="text-sm font-bold text-gray-900">{userProfile.credits}</span>
            </div>
          )}
        </div>
      </div>

      <div className="w-full max-w-3xl mx-auto p-3">
        {/* Níveis */}
        <div className="space-y-2 mb-3">
          {levels.map((lvl) => {
            const Icon = lvl.icon;
            const isUnlocked = currentLevel >= lvl.level;
            const isCurrent = currentLevel === lvl.level;
            
            return (
              <Card
                key={lvl.level}
                className={`border-0 shadow-soft p-3 relative overflow-hidden ${
                  isCurrent ? 'ring-2 ring-orange-400' : ''
                }`}
              >
                {isCurrent && (
                  <Badge className="absolute top-2 right-2 bg-orange-500 text-white border-0 text-[10px]">
                    Nível Atual
                  </Badge>
                )}
                
                <div className="flex items-start gap-3">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${lvl.color} flex items-center justify-center flex-shrink-0 shadow-lg ${
                    !isUnlocked ? 'opacity-40' : ''
                  }`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-gray-900">
                        Nível {lvl.level} - {lvl.name}
                      </h3>
                      {isUnlocked && (
                        <Check className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                    
                    <p className="text-[10px] text-gray-600 mb-2">
                      {lvl.xpRequired === 0 ? 'Desbloqueado desde o início' : `Requer ${lvl.xpRequired} XP`}
                    </p>
                    
                    <div className="space-y-1">
                      {lvl.benefits.map((benefit, index) => (
                        <div key={index} className="flex items-start gap-1.5">
                          <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            isUnlocked ? 'bg-green-100' : 'bg-gray-100'
                          }`}>
                            {isUnlocked ? (
                              <Check className="w-2.5 h-2.5 text-green-600" />
                            ) : (
                              <span className="text-[7px] text-gray-400">✕</span>
                            )}
                          </div>
                          <p className={`text-[11px] ${isUnlocked ? 'text-gray-900' : 'text-gray-400'}`}>
                            {benefit}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {!isUnlocked && (
                  <div className="absolute inset-0 bg-gray-100/50 backdrop-blur-[1px] rounded-xl" />
                )}
              </Card>
            );
          })}
        </div>

        {/* Como Ganhar XP */}
        <Card className="gradient-card border-0 shadow-soft p-3">
          <h3 className="text-sm font-bold text-gray-900 mb-2">🎯 Como ganhar XP</h3>
          
          <div className="space-y-1.5">
            <div className="flex items-center justify-between p-2 bg-orange-50 rounded-lg">
              <p className="text-xs text-gray-900">Iniciar uma investigação</p>
              <Badge className="bg-orange-500 text-white border-0 text-[10px]">+10-30 XP</Badge>
            </div>
            <div className="flex items-center justify-between p-2 bg-purple-50 rounded-lg">
              <p className="text-xs text-gray-900">Acelerar investigação</p>
              <Badge className="bg-purple-500 text-white border-0 text-[10px]">+20-30 XP</Badge>
            </div>
            <div className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
              <p className="text-xs text-gray-900">Completar investigação</p>
              <Badge className="bg-green-500 text-white border-0 text-[10px]">+50 XP</Badge>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
