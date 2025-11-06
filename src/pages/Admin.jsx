import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, LogOut, Plus, Eye, EyeOff, Search } from "lucide-react";
import Logo from "../components/dashboard/Logo";

export default function Admin() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [creditsToAdd, setCreditsToAdd] = useState("");
  const [showPasswords, setShowPasswords] = useState({});

  // Verificar se é admin
  const { data: user, isLoading: userLoading, error: userError } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      try {
        return await base44.auth.me();
      } catch (error) {
        console.error('Erro ao buscar usuário:', error);
        return null;
      }
    },
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: false,
  });

  // Listar todos os usuários
  const { data: users = [], refetch: refetchUsers, isLoading: usersLoading } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: async () => {
      try {
        if (base44.auth && base44.auth.getAllUsers) {
          const allUsers = await base44.auth.getAllUsers();
          // Garantir que sempre retorna um array
          const usersArray = Array.isArray(allUsers) ? allUsers : [];
          // Filtrar apenas usuários (não incluir o admin)
          return usersArray.filter(u => u.email !== 'andremenegonqtg@gmail.com');
        }
      } catch (error) {
        console.error('Erro ao buscar usuários:', error);
      }
      return [];
    },
    enabled: !!user && user.role === 'admin',
    refetchOnWindowFocus: true,
    refetchOnMount: true, // Sempre buscar ao montar
    initialData: [],
  });

  // Buscar perfis de todos os usuários
  const { data: userProfiles = [] } = useQuery({
    queryKey: ['adminUserProfiles'],
    queryFn: async () => {
      const profiles = await base44.entities.UserProfile.list();
      return profiles || [];
    },
    enabled: !!user && user.role === 'admin',
  });

  // ✅ TODOS OS HOOKS DEVEM VIR ANTES DE QUALQUER RETURN CONDICIONAL
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate(createPageUrl("Dashboard"));
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!userLoading && (userError || !user)) {
      navigate(createPageUrl("Login"));
    }
  }, [userLoading, userError, user, navigate]);

  // Forçar refetch quando o usuário admin estiver disponível
  useEffect(() => {
    if (user && user.role === 'admin') {
      refetchUsers();
    }
  }, [user, refetchUsers]);

  const handleLogout = async () => {
    await base44.auth.logout();
    // Limpar cache ao fazer logout
    queryClient.removeQueries({ queryKey: ['currentUser'] });
    queryClient.removeQueries({ queryKey: ['userProfile'] });
    queryClient.removeQueries({ queryKey: ['investigations'] });
    queryClient.removeQueries({ queryKey: ['adminUsers'] });
    queryClient.removeQueries({ queryKey: ['adminUserProfiles'] });
    navigate(createPageUrl("Login"));
  };

  const handleAddCredits = async (userEmail) => {
    if (!creditsToAdd || isNaN(creditsToAdd) || parseInt(creditsToAdd) <= 0) {
      alert("Por favor, insira um valor válido de créditos");
      return;
    }

    try {
      const profiles = await base44.entities.UserProfile.filter({ created_by: userEmail });
      const profile = profiles[0];
      
      if (profile) {
        await base44.entities.UserProfile.update(profile.id, {
          credits: (profile.credits || 0) + parseInt(creditsToAdd)
        });
      } else {
        // Criar perfil se não existir
        await base44.entities.UserProfile.create({
          created_by: userEmail,
          credits: parseInt(creditsToAdd),
          level: 1,
          xp: 0,
          total_investigations: 0
        });
      }
      
      await queryClient.invalidateQueries(['adminUserProfiles']);
      refetchUsers();
      setCreditsToAdd("");
      setSelectedUser(null);
      alert(`Créditos adicionados com sucesso!`);
    } catch (error) {
      console.error("Erro ao adicionar créditos:", error);
      alert("Erro ao adicionar créditos");
    }
  };

  const togglePasswordVisibility = (userId) => {
    setShowPasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  // Garantir que users é sempre um array
  const usersArray = Array.isArray(users) ? users : [];
  const filteredUsers = usersArray.filter(u => 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ✅ AGORA PODEMOS FAZER RETURNS CONDICIONAIS (após todos os hooks)
  // Mostrar loading enquanto verifica o usuário
  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  // Se não há usuário ou erro, redirecionar para login
  if (!userLoading && (userError || !user)) {
    return null;
  }

  // Verificar se é admin
  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Acesso Negado</h2>
          <p className="text-sm text-gray-600 mb-4">Você não tem permissão para acessar esta página.</p>
          <Button onClick={() => navigate(createPageUrl("Dashboard"))} variant="outline">
            Voltar ao Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0] p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Logo size="normal" />
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">Admin: {user.email}</span>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </Button>
          </div>
        </div>

        {/* Título */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Painel de Administração
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  onClick={async () => {
                    await queryClient.invalidateQueries(['adminUsers']);
                    await queryClient.invalidateQueries(['adminUserProfiles']);
                    await refetchUsers();
                  }}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  Atualizar
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Busca */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar por email ou nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        {/* Lista de Usuários */}
        <div className="grid gap-4">
          {usersLoading ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-gray-500">Carregando usuários...</p>
              </CardContent>
            </Card>
          ) : filteredUsers.length === 0 && usersArray.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p className="font-medium mb-1">Nenhum usuário cadastrado ainda</p>
                <p className="text-xs">Os usuários aparecerão aqui quando se registrarem no app.</p>
                <p className="text-xs mt-2 text-gray-400">Para testar, crie uma conta na página de registro.</p>
              </CardContent>
            </Card>
          ) : filteredUsers.length === 0 && usersArray.length > 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-gray-500">
                <Search className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p className="font-medium mb-1">Nenhum usuário encontrado na busca</p>
                <p className="text-xs">Tente buscar com outros termos.</p>
                <p className="text-xs mt-2">Total de usuários: {users.length}</p>
              </CardContent>
            </Card>
          ) : (
            filteredUsers.map((userItem) => {
              const profile = userProfiles.find(p => p.created_by === userItem.email);
              const credits = profile?.credits || 0;
              const isSelected = selectedUser === userItem.email;
              const showPassword = showPasswords[userItem.id];

              return (
                <Card key={userItem.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-bold text-lg text-gray-900">
                            {userItem.full_name || 'Sem nome'}
                          </h3>
                        </div>
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600">Email:</span>
                            <span className="font-medium">{userItem.email}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600">Senha:</span>
                            <span className="font-mono font-medium">
                              {showPassword ? userItem.password || 'N/A' : '••••••••'}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => togglePasswordVisibility(userItem.id)}
                              className="h-6 px-2"
                            >
                              {showPassword ? (
                                <EyeOff className="w-3 h-3" />
                              ) : (
                                <Eye className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600">Créditos:</span>
                            <span className="font-bold text-[#FF6B4A]">{credits}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600">Cadastrado em:</span>
                            <span className="text-gray-500">
                              {userItem.created_at ? new Date(userItem.created_at).toLocaleDateString('pt-BR') : 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Adicionar Créditos */}
                      <div className="flex flex-col gap-2 min-w-[200px]">
                        {isSelected ? (
                          <div className="space-y-2">
                            <Label className="text-xs">Quantidade de créditos</Label>
                            <Input
                              type="number"
                              placeholder="Ex: 100"
                              value={creditsToAdd}
                              onChange={(e) => setCreditsToAdd(e.target.value)}
                              className="h-8 text-sm"
                            />
                            <div className="flex gap-2">
                              <Button
                                onClick={() => handleAddCredits(userItem.email)}
                                size="sm"
                                className="gradient-primary text-white text-xs h-8"
                              >
                                <Plus className="w-3 h-3 mr-1" />
                                Adicionar
                              </Button>
                              <Button
                                onClick={() => {
                                  setSelectedUser(null);
                                  setCreditsToAdd("");
                                }}
                                variant="outline"
                                size="sm"
                                className="text-xs h-8"
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            onClick={() => setSelectedUser(userItem.email)}
                            size="sm"
                            className="gradient-primary text-white text-xs"
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Adicionar Créditos
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Estatísticas */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Estatísticas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-[#FF6B4A]">{usersArray.length}</div>
                <div className="text-sm text-gray-600">Total de Usuários</div>
                {searchTerm && (
                  <div className="text-xs text-gray-500 mt-1">
                    ({filteredUsers.length} encontrados)
                  </div>
                )}
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-[#FF6B4A]">
                  {userProfiles.reduce((sum, p) => sum + (p.credits || 0), 0)}
                </div>
                <div className="text-sm text-gray-600">Total de Créditos</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-[#FF6B4A]">
                  {userProfiles.reduce((sum, p) => sum + (p.total_investigations || 0), 0)}
                </div>
                <div className="text-sm text-gray-600">Total de Investigações</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

