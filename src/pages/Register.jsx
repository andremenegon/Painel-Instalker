import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Mail, Lock, Sparkles, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import logoFull from "@/assets/branding/instalker-logo-full.png";
import { setLastEmail } from "@/utils/lastEmail";
import { Toast } from "@/components/Toast";

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    confirm_email: "",
    password: ""
  });
  const [loading, setLoading] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const meetsPasswordRules = (password) => {
    if (!password) return false;
    const hasMinLength = password.length >= 8;
    const hasSpecialCharacter = /[^A-Za-z0-9]/.test(password);
    return hasMinLength && hasSpecialCharacter;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validar confirmação de email
    if (formData.email !== formData.confirm_email) {
      setEmailError("Os emails não coincidem");
      return;
    }
    
    // Validar regras da senha
    if (!meetsPasswordRules(formData.password)) {
      setPasswordError("A senha deve ter no mínimo 8 caracteres e pelo menos 1 caractere especial.");
      return;
    }

    setEmailError("");
    setPasswordError("");
    setLoading(true);
    
    try {
      // Registrar usuário
      if (formData.email && formData.full_name && formData.password) {
        await base44.auth.register({
          email: formData.email,
          full_name: formData.full_name,
          password: formData.password
        });
      }
      await new Promise(resolve => setTimeout(resolve, 1500));
      setLastEmail(formData.email);
      navigate(createPageUrl("Dashboard"));
    } catch (error) {
      console.error("Erro ao registrar:", error);
      
      // Se o email já existe, redirecionar para login com os dados preenchidos
      if (error.message && error.message.includes('já cadastrado')) {
        // Salvar email e senha para preencher no login
        setLastEmail(formData.email);
        localStorage.setItem('pending_login_password', formData.password);
        
        // Redirecionar para login com mensagem
        navigate(createPageUrl("Login"), {
          state: {
            message: 'Você já tem uma conta criada! Entre com suas credenciais.',
            email: formData.email,
            password: formData.password
          }
        });
      } else {
        // Outros erros
        setPasswordError(`Erro ao criar conta: ${error.message || 'Tente novamente'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Verificar se o email já existe no banco
  const checkEmailExists = async (email) => {
    if (!email || email.length < 5) return;
    
    try {
      // Buscar no banco se o email já existe
      const users = await base44.entities.User.filter({ email });
      
        if (users && users.length > 0) {
          const user = users[0];
          
          // Email já existe - mostrar toast e redirecionar
          setToastMessage("Você já é um usuário In'Stalker!");
          setShowToast(true);
          setLastEmail(email);
          
          // Salvar senha para preencher no login
          localStorage.setItem('temp_login_password', user.password || '');
        
          // Redirecionar após 2.5 segundos
          setTimeout(() => {
            navigate(createPageUrl("Login"), {
              state: {
                email: email,
                password: user.password || '',
                userName: user.full_name || 'usuário',
                fromRegister: true,
                showToast: true
              }
            });
          }, 2500);
      }
    } catch (error) {
      // Ignorar erros de verificação
      console.error('Erro ao verificar email:', error);
    }
  };

  const handleEmailChange = (e) => {
    setFormData({...formData, email: e.target.value});
    if (emailError && formData.confirm_email) {
      if (e.target.value !== formData.confirm_email) {
        setEmailError("Os emails não coincidem");
      } else {
        setEmailError("");
      }
    }
  };

  const handleConfirmEmailChange = async (e) => {
    const confirmEmail = e.target.value;
    setFormData({...formData, confirm_email: confirmEmail});
    
    if (confirmEmail !== formData.email) {
      setEmailError("Os emails não coincidem");
    } else {
      setEmailError("");
      // Verificar se o email já existe quando os emails coincidem
      await checkEmailExists(formData.email);
    }
  };

  const handlePasswordChange = (value) => {
    setFormData({ ...formData, password: value });
    if (passwordError && meetsPasswordRules(value)) {
      setPasswordError("");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo - fora do Card com animação */}
        <div className="flex justify-center mb-[70px]">
          <img src={logoFull} alt="In'Stalker" className="h-[29px] w-auto" />
        </div>
        

        {/* Card de Registro */}
        <Card className="gradient-card border-0 shadow-soft">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-bold text-center">
              Criar Conta
            </CardTitle>
            <CardDescription className="text-center text-xs">
              Preencha seus dados para começar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="full_name" className="text-sm text-gray-700 font-medium">
                  Nome Completo
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <Input
                    id="full_name"
                    type="text"
                    placeholder="Seu nome completo"
                    value={formData.full_name}
                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                    className="pl-9 h-10 text-sm border-orange-200 focus:border-orange-400 focus:ring-orange-400"
                    required
                  />
                </div>
              </div>

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
                    onChange={handleEmailChange}
                    className={`pl-9 h-10 text-sm border-orange-200 focus:border-orange-400 focus:ring-orange-400 ${emailError ? 'border-red-300' : ''}`}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm_email" className="text-sm text-gray-700 font-medium">
                  Confirmar E-mail
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <Input
                    id="confirm_email"
                    type="email"
                    placeholder="confirmeseu@email.com"
                    value={formData.confirm_email}
                    onChange={handleConfirmEmailChange}
                    className={`pl-9 h-10 text-sm border-orange-200 focus:border-orange-400 focus:ring-orange-400 ${emailError ? 'border-red-300' : ''}`}
                    required
                  />
                </div>
                {emailError && (
                  <p className="text-xs text-red-500 mt-1">{emailError}</p>
                )}
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
                    placeholder="Crie uma senha forte"
                    value={formData.password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    className={`pl-9 pr-10 h-10 text-sm focus:border-orange-400 focus:ring-orange-400 ${passwordError ? 'border-red-300' : 'border-orange-200'}`}
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
              

              {passwordError && (
                <p className="text-xs text-red-500 mt-1">{passwordError}</p>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-10 gradient-primary text-white font-semibold text-sm rounded-xl shadow-soft hover:shadow-lg transition-all duration-300 mt-4"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Criando conta...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Criar Conta
                  </div>
                )}
              </Button>
            </form>
            
            {/* Info adicional - dentro do Card */}
            <div className="mt-6 pt-4 border-t border-gray-200 text-center space-y-2">
              <p className="text-[0.6rem] text-gray-500">
                Ao criar uma conta, você concorda com nossos{" "}
                <button 
                  onClick={() => setShowTerms(true)} 
                  className="text-[#FF6B4A] hover:underline font-medium"
                >
                  Termos de Uso
                </button>
              </p>
              <p className="text-xs text-gray-600">
                Já tem uma conta?{" "}
                <Link to={createPageUrl("Login")} className="text-[#FF6B4A] hover:underline font-medium">
                  Entrar
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal Termos de Uso */}
      {showTerms && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowTerms(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Termos de Uso</h3>
              <button onClick={() => setShowTerms(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>
            <div className="p-6 text-[10px] text-gray-600 leading-relaxed space-y-3">
              <p><strong>1. ACEITAÇÃO DOS TERMOS:</strong> Ao utilizar a plataforma In'Stalker, você concorda integralmente com estes Termos de Uso. Se você não concorda com qualquer parte destes termos, não deve utilizar o serviço.</p>
              
              <p><strong>2. DESCRIÇÃO DO SERVIÇO:</strong> O In'Stalker é uma plataforma de investigação digital que permite aos usuários acessar informações públicas e privadas de perfis em redes sociais e outras plataformas digitais. Os serviços incluem, mas não se limitam a: análise de Instagram, WhatsApp, Facebook, localização GPS, acesso remoto à câmera, histórico de SMS e chamadas telefônicas.</p>
              
              <p><strong>3. USO LEGAL E RESPONSABILIDADE:</strong> O usuário declara que utilizará os serviços da plataforma EXCLUSIVAMENTE para fins legais e éticos. O In'Stalker não se responsabiliza pelo uso indevido, ilegal ou antiético dos dados obtidos através da plataforma. É de responsabilidade exclusiva do usuário garantir que suas ações estejam em conformidade com as leis locais, estaduais e federais aplicáveis.</p>
              
              <p><strong>4. SISTEMA DE CRÉDITOS:</strong> A plataforma opera com um sistema de créditos pré-pagos. Os créditos são utilizados para acessar diferentes serviços e funcionalidades. Os valores em créditos são claramente informados antes de cada transação. Créditos gastos NÃO são reembolsáveis, exceto em casos de falha técnica comprovada da plataforma.</p>
              
              <p><strong>5. PRIVACIDADE E CONFIDENCIALIDADE:</strong> Todas as investigações realizadas na plataforma são tratadas com total confidencialidade. O In'Stalker não compartilha informações sobre as investigações com terceiros, exceto quando exigido por lei ou ordem judicial.</p>
              
              <p><strong>6. LIMITAÇÃO DE RESPONSABILIDADE:</strong> O In'Stalker não garante 100% de precisão nas informações coletadas, pois depende da disponibilidade de dados públicos e das configurações de privacidade dos alvos. A plataforma não se responsabiliza por decisões tomadas com base nas informações obtidas.</p>
              
              <p><strong>7. CANCELAMENTO E EXCLUSÃO:</strong> O usuário pode cancelar investigações em andamento a qualquer momento através do dashboard. Investigações canceladas não geram reembolso de créditos já gastos. A exclusão de uma investigação remove todos os dados associados permanentemente.</p>
              
              <p><strong>8. MODIFICAÇÕES DOS TERMOS:</strong> O In'Stalker reserva-se o direito de modificar estes Termos de Uso a qualquer momento. Mudanças significativas serão notificadas aos usuários via e-mail ou através da plataforma.</p>
              
              <p><strong>9. RESCISÃO:</strong> O In'Stalker pode suspender ou encerrar o acesso do usuário à plataforma caso identifique violação destes Termos ou uso indevido do serviço.</p>
              
              <p className="text-gray-500 italic mt-4">Última atualização: 06 de novembro de 2025</p>
            </div>
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4">
              <Button onClick={() => setShowTerms(false)} className="w-full gradient-primary text-white">
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Toast de notificação */}
      {showToast && (
        <Toast
          message={toastMessage}
          type="info"
          onClose={() => setShowToast(false)}
        />
      )}

    </div>
  );
}