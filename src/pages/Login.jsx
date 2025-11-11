import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, LogIn, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQueryClient } from "@tanstack/react-query";
import logoFull from "@/assets/branding/instalker-logo-full.png";
import { getLastEmail, setLastEmail } from "@/utils/lastEmail";
import { Toast } from "@/components/Toast";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  
  // Buscar dados do state (quando vem do registro)
  const stateEmail = location.state?.email;
  const statePassword = location.state?.password;
  const userName = location.state?.userName;
  const fromRegister = location.state?.fromRegister;
  const showToastFromRegister = location.state?.showToast;
  
  const [formData, setFormData] = useState(() => ({
    email: stateEmail || getLastEmail() || "",
    password: statePassword || localStorage.getItem('temp_login_password') || ""
  }));
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  
  // Mostrar toast e limpar senha temporária
  useEffect(() => {
    // Mostrar toast se vier do registro
    if (showToastFromRegister && fromRegister) {
      const firstName = userName ? userName.split(' ')[0] : 'usuário';
      setToastMessage(`Bem-vindo de volta, ${firstName}!`);
      setShowToast(true);
      
      // Fechar toast após 4 segundos
      const timer = setTimeout(() => {
        setShowToast(false);
      }, 4000);
      
      return () => clearTimeout(timer);
    }
    
    // Limpar senha temporária
    if (localStorage.getItem('temp_login_password')) {
      setTimeout(() => {
        localStorage.removeItem('temp_login_password');
      }, 1000);
    }
  }, [showToastFromRegister, fromRegister]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password
      });
      
      if (loginError) throw loginError;
      
      // Limpar cache do usuário anterior e forçar refetch
      queryClient.removeQueries({ queryKey: ['currentUser'] });
      queryClient.removeQueries({ queryKey: ['userProfile'] });
      queryClient.removeQueries({ queryKey: ['layoutUserProfile'] }); // ✅ LIMPAR CACHE DO CABEÇALHO
      queryClient.removeQueries({ queryKey: ['investigations'] });
      
      // Aguardar um pouco para garantir que o logout foi processado
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Redirecionar para dashboard (não temos mais role de admin no Supabase)
      navigate(createPageUrl("Dashboard"));

      setLastEmail(formData.email);
    } catch (error) {
      console.error("Erro ao fazer login:", error);
      setError("Email ou senha incorretos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-[70px]">
          <img src={logoFull} alt="In'Stalker" className="h-[29px] w-auto" />
        </div>

        {/* Card de Login */}
        <Card className="gradient-card border-0 shadow-soft">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-bold text-center">
              Entrar
            </CardTitle>
            <CardDescription className="text-center text-xs">
              Entre com sua conta para continuar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm text-gray-700 font-medium">
                  E-mail
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="pl-9 h-10 text-sm border-orange-200 focus:border-orange-400 focus:ring-orange-400"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm text-gray-700 font-medium">
                  Senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Sua senha"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="pl-9 pr-10 h-10 text-sm border-orange-200 focus:border-orange-400 focus:ring-orange-400"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 transition-colors"
                    title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-xs text-red-500 text-center mt-2">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-10 gradient-primary text-white font-semibold text-sm rounded-xl shadow-soft hover:shadow-lg transition-all duration-300 mt-4"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Entrando...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <LogIn className="w-4 h-4" />
                    Entrar
                  </div>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Link para registro */}
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-600">
            Não tem uma conta?{" "}
            <Link to={createPageUrl("Register")} className="text-[#FF6B4A] hover:underline font-medium">
              Criar conta
            </Link>
          </p>
        </div>
      </div>

      {/* Toast de notificação */}
      {showToast && (
        <Toast
          message={toastMessage}
          type="success"
          onClose={() => setShowToast(false)}
        />
      )}

    </div>
  );
}

