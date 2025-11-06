
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, User, Zap, TrendingUp, Target, Award, Mail, Shield, LogOut } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Profile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(async (userData) => {
      setUser(userData);
      const profiles = await base44.entities.UserProfile.filter({ created_by: userData.email });
      if (profiles.length > 0) setUserProfile(profiles[0]);
      setLoading(false);
    });
  }, []);

  const handleLogout = async () => {
    await base44.auth.logout();
    // Limpar cache ao fazer logout
    queryClient.removeQueries({ queryKey: ['currentUser'] });
    queryClient.removeQueries({ queryKey: ['userProfile'] });
    queryClient.removeQueries({ queryKey: ['investigations'] });
    navigate(createPageUrl("Login"));
  };

  const xpToNextLevel = userProfile ? userProfile.level * 100 : 100;
  const xpProgress = userProfile ? (userProfile.xp / xpToNextLevel) * 100 : 0;

  const achievements = [
    { id: 1, name: "Primeiro Spy", icon: "🎯", unlocked: userProfile?.total_investigations >= 1 },
    { id: 2, name: "Investigador", icon: "🔍", unlocked: userProfile?.total_investigations >= 5 },
    { id: 3, name: "Detetive", icon: "🕵️", unlocked: userProfile?.total_investigations >= 10 },
    { id: 4, name: "Mestre Spy", icon: "👑", unlocked: userProfile?.total_investigations >= 25 },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
          
          <h1 className="text-base font-bold text-gray-900">Meu Perfil</h1>
          
          {userProfile && (
            <div className="flex items-center gap-1 bg-orange-50 rounded-full px-3 py-1 border border-orange-200">
              <Zap className="w-3 h-3 text-orange-500" />
              <span className="text-sm font-bold text-gray-900">{userProfile.credits}</span>
            </div>
          )}
        </div>
      </div>

      <div className="w-full max-w-2xl mx-auto p-3">
        {/* Header Card */}
        <Card className="gradient-primary border-0 shadow-soft text-white p-6 mb-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
          
          <div className="relative z-10 text-center">
            <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-3">
              <User className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold mb-1">{user?.full_name}</h1>
            <p className="text-white/80 text-sm mb-4">{user?.email}</p>
            
            <div className="flex items-center justify-center gap-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4" />
                  <p className="text-sm font-medium">Level</p>
                </div>
                <p className="text-2xl font-bold">{userProfile?.level}</p>
              </div>
              
              <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-4 h-4" />
                  <p className="text-sm font-medium">Créditos</p>
                </div>
                <p className="text-2xl font-bold">{userProfile?.credits}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* XP Progress */}
        <Card className="gradient-card border-0 shadow-soft p-4 mb-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-gray-900">Progresso para Level {(userProfile?.level || 0) + 1}</h3>
            <p className="text-xs text-gray-600">{userProfile?.xp}/{xpToNextLevel} XP</p>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="gradient-primary h-2 rounded-full transition-all duration-500"
              style={{ width: `${xpProgress}%` }}
            />
          </div>
        </Card>

        {/* Stats */}
        <Card className="gradient-card border-0 shadow-soft p-4 mb-3">
          <h3 className="text-base font-bold text-gray-900 mb-3">📊 Estatísticas</h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-orange-600" />
                <p className="text-sm font-medium text-gray-900">Total de Investigações</p>
              </div>
              <Badge className="bg-orange-500 text-white border-0 font-bold">
                {userProfile?.total_investigations || 0}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-purple-600" />
                <p className="text-sm font-medium text-gray-900">XP Total</p>
              </div>
              <Badge className="bg-purple-500 text-white border-0 font-bold">
                {userProfile?.xp || 0}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-green-600" />
                <p className="text-sm font-medium text-gray-900">Nível Atual</p>
              </div>
              <Badge className="bg-green-500 text-white border-0 font-bold">
                Level {userProfile?.level || 1}
              </Badge>
            </div>
          </div>
        </Card>

        {/* Conquistas */}
        <Card className="gradient-card border-0 shadow-soft p-4 mb-3">
          <h3 className="text-base font-bold text-gray-900 mb-3">🏆 Conquistas</h3>
          
          <div className="grid grid-cols-2 gap-2">
            {achievements.map((achievement) => (
              <div
                key={achievement.id}
                className={`p-3 rounded-lg border-2 text-center ${
                  achievement.unlocked
                    ? 'bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-300'
                    : 'bg-gray-50 border-gray-200 opacity-50'
                }`}
              >
                <p className="text-2xl mb-1">{achievement.icon}</p>
                <p className="text-xs font-bold text-gray-900">{achievement.name}</p>
                {achievement.unlocked && (
                  <p className="text-[10px] text-green-600 font-medium mt-1">✓ Desbloqueada</p>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Ações */}
        <Card className="gradient-card border-0 shadow-soft p-4 mb-3">
          <h3 className="text-base font-bold text-gray-900 mb-3">⚙️ Ações</h3>
          
          <div className="space-y-2">
            <Button
              onClick={() => navigate(createPageUrl("BuyCredits"))}
              className="w-full h-12 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold"
            >
              <Zap className="w-5 h-5 mr-2" />
              Comprar Créditos
            </Button>

            <Button
              onClick={() => navigate(createPageUrl("Dashboard"))}
              className="w-full h-12 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-bold"
            >
              <Target className="w-5 h-5 mr-2" />
              Minhas Investigações
            </Button>

            <Button
              onClick={handleLogout}
              variant="outline"
              className="w-full h-12 border-2 border-red-200 text-red-600 font-bold hover:bg-red-50"
            >
              <LogOut className="w-5 h-5 mr-2" />
              Sair da Conta
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
