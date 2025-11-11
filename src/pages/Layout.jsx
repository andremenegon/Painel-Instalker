

import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { LogOut, Zap, Plus, User, Target, Lock, ArrowLeft } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import Logo from "@/components/dashboard/Logo";
import logoFull from "@/assets/branding/instalker-logo-full.png";
import fivecon from "@/assets/branding/fivecon.png";
import { setLastEmail } from "@/utils/lastEmail";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showLGPD, setShowLGPD] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // ✅ APENAS BUSCAR USER - SEM QUERIES PESADAS
  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  // ✅ Verificar se usuário tem email inválido e redirecionar para cadastro
  useEffect(() => {
    const showHeader = currentPageName !== "Login" && currentPageName !== "Register";
    
    if (user?.email === 'usuario@local.com' && showHeader) {
      // Usuário mock/inválido - redirecionar para cadastro
      navigate(createPageUrl("Register"));
    }
  }, [user, currentPageName, navigate]);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [location.pathname]);

  const handleLogout = async () => {
    if (user?.email) {
      setLastEmail(user.email);
    }
    
    // ✅ LIMPAR TODO O CACHE ANTES DE DESLOGAR
    queryClient.clear(); // Limpa TUDO
    
    await base44.auth.logout();
    setIsMenuOpen(false);
    navigate(createPageUrl("Login"));
  };

  const showHeader = currentPageName !== "Login" && currentPageName !== "Register";
  const showFooter = currentPageName === "Dashboard";
  const isInvestigationPage = showHeader && currentPageName !== "SMSSpyChat" && ((currentPageName || "").toLowerCase().includes("spy") || (currentPageName || "").toLowerCase().includes("investigation"));

  const { data: layoutUserProfile, refetch: refetchLayoutProfile } = useQuery({
    queryKey: ["layoutUserProfile", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const profiles = await base44.entities.UserProfile.filter({ created_by: user.email });
      return Array.isArray(profiles) && profiles.length > 0 ? profiles[0] : null;
    },
    enabled: showHeader && !!user?.email,
    staleTime: 0, // ✅ SEMPRE considerar dados como stale
    refetchOnMount: 'always', // ✅ SEMPRE refetch ao montar
    refetchOnWindowFocus: true, // ✅ SEMPRE atualizar ao focar na janela
    refetchInterval: 5000, // ✅ Atualizar a cada 5 segundos
  });

  // ✅ Forçar refetch quando user carregar
  useEffect(() => {
    if (user?.email && showHeader) {
      refetchLayoutProfile();
    }
  }, [user?.email, showHeader, refetchLayoutProfile]);

  const credits = layoutUserProfile?.credits ?? 0;

  const formattedTitle = (() => {
    if (!currentPageName) return "";
    const PAGE_TITLES = {
      WhatsAppSpy: "WhatsApp",
      WhatsAppSpyResults: "WhatsApp",
      InstagramSpy: "Instagram",
      InstagramSpyResults: "Instagram",
      FacebookSpy: "Facebook",
      FacebookSpyResults: "Facebook",
      LocationSpy: "Localização GPS",
      CameraSpy: "Câmera Remota",
      OtherNetworksSpy: "Outras Redes",
      DetectiveSpy: "Detetive Particular",
      SMSSpy: "SMS",
      SMSSpyChat: "SMS - Conversa",
      CallsSpy: "Chamadas",
      CallsSpyResults: "Chamadas",
    };
    if (PAGE_TITLES[currentPageName]) return PAGE_TITLES[currentPageName];
    return currentPageName.replace(/([A-Z])/g, " $1").trim();
  })();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0] flex flex-col">
      <style>{`
        :root {
          --color-primary: #FF6B4A;
          --color-secondary: #FF8F6B;
          --color-accent: #FFB399;
          --color-light: #FFF8F3;
          --color-dark: #2D2D2D;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
        }

        .gradient-primary {
          background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
        }

        .gradient-card {
          background: linear-gradient(145deg, #FFFFFF 0%, #FFF9F5 100%);
        }

        .shadow-soft {
          box-shadow: 0 8px 32px rgba(255, 107, 74, 0.12);
        }

        .shadow-hover {
          transition: all 0.3s ease;
        }

        .shadow-hover:hover {
          box-shadow: 0 12px 48px rgba(255, 107, 74, 0.2);
          transform: translateY(-4px);
        }

        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(255, 107, 74, 0.4);
          }
          50% {
            box-shadow: 0 0 40px rgba(255, 107, 74, 0.6);
          }
        }

        .pulse-glow {
          animation: pulse-glow 2s infinite;
        }
      `}</style>
      
      {currentPageName !== "SMSSpyChat" && (
        <style>{`
          .bg-white.border-b.border-gray-200.sticky.top-0.z-10 {
            display: none;
          }
        `}</style>
      )}

      {showHeader && currentPageName !== "SMSSpyChat" && (
        <header
          className="fixed top-0 inset-x-0 z-40"
          style={{ height: '60px', backgroundColor: '#FFFFFF', borderBottom: '1.3px solid rgb(210, 210, 215)' }}
        >
          <div
            className="max-w-6xl mx-auto flex items-center justify-between"
            style={{ height: '60px', paddingLeft: '24px', paddingRight: '24px' }}
          >
            {isInvestigationPage ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    navigate(createPageUrl("Dashboard"));
                  }}
                  aria-label="Voltar"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10
                  }}
                >
                  <ArrowLeft className="w-5 h-5 text-gray-700" />
                </button>

                {/* ✅ CENTRALIZADO NA TELA TODA */}
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    pointerEvents: 'none'
                  }}
                >
                  <img src={fivecon} alt="Serviço" style={{ height: '24px', width: '24px', borderRadius: '5px' }} />
                  <h1
                    style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      color: '#111827'
                    }}
                  >
                    {formattedTitle}
                  </h1>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#FFF8F0',
                    border: '1px solid rgba(255, 153, 102, 0.35)',
                    borderRadius: '999px',
                    padding: '6px 10px',
                    minWidth: '68px',
                    justifyContent: 'center',
                    fontFamily: 'Montserrat, sans-serif'
                  }}
                >
                  <Zap className="w-4 h-4 text-orange-500" />
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#EA580C' }}>{credits}</span>
                </div>
              </>
            ) : (
              <>
                <img src={logoFull} alt="In'Stalker" style={{ height: '25px', width: 'auto' }} />
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(true)}
                  aria-label="Abrir menu"
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    padding: 0,
                    height: '14px',
                    width: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '3px'
                  }}
                >
                  {[0, 1, 2].map((index) => (
                    <span
                      key={index}
                      style={{ width: '20px', height: '2px', backgroundColor: '#4B5563', borderRadius: '999px' }}
                    ></span>
                  ))}
                </button>
              </>
            )}
          </div>
        </header>
      )}

      <main className="flex-1" style={{ paddingTop: showHeader && currentPageName !== "SMSSpyChat" ? '60px' : '0' }}>
        {children}
      </main>

      {isMenuOpen && (
        <div
          className="fixed inset-0 z-50"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
          onClick={() => setIsMenuOpen(false)}
        >
          <div
            className="h-full ml-auto flex flex-col"
            style={{ width: '260px', maxWidth: '85vw', backgroundColor: '#FFFFFF', boxShadow: '-12px 0 30px rgba(17, 24, 39, 0.15)', borderTopLeftRadius: '16px', borderBottomLeftRadius: '16px', overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Navegação</p>
              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                aria-label="Fechar menu"
                style={{ background: 'transparent', border: 'none', fontSize: '20px', color: '#6B7280', cursor: 'pointer', lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            <nav style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <Link
                to={createPageUrl("BuyCredits")}
                className="text-sm font-semibold text-gray-700 hover:text-orange-500 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Comprar créditos
              </Link>
              <Link
                to={createPageUrl("Profile")}
                className="text-sm font-semibold text-gray-700 hover:text-orange-500 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Ver perfil
              </Link>
              <Link
                to={createPageUrl("Levels")}
                className="text-sm font-semibold text-gray-700 hover:text-orange-500 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Recompensas
              </Link>
            </nav>

            <div style={{ marginTop: 'auto', padding: '20px' }}>
              <Button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      )}

      {showFooter && (
        <footer className="bg-white/60 backdrop-blur-sm border-t border-orange-100 mt-auto">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
              <div>
                <div className="mb-3">
                  <Logo size="small" />
                </div>
                <p className="text-xs text-gray-600 leading-relaxed mb-3">
                  Plataforma líder em investigação digital. Tecnologia avançada para rastrear e descobrir informações.
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center">
                    <Lock className="w-4 h-4 text-gray-700" />
                  </div>
                  <div className="text-[10px] text-gray-500">
                    <p className="font-semibold text-gray-700">Certificado SSL</p>
                    <p>100% Seguro</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-gray-900 mb-3 text-sm">Serviços</h4>
                <ul className="space-y-2 text-xs text-gray-600">
                  <li>
                    <Link to={createPageUrl("Investigation") + "?service=Instagram"} className="hover:text-orange-600 cursor-pointer transition-colors">
                      • Instagram Spy
                    </Link>
                  </li>
                  <li>
                    <Link to={createPageUrl("Investigation") + "?service=WhatsApp"} className="hover:text-orange-600 cursor-pointer transition-colors">
                      • WhatsApp Spy
                    </Link>
                  </li>
                  <li>
                    <Link to={createPageUrl("Investigation") + "?service=Facebook"} className="hover:text-orange-600 cursor-pointer transition-colors">
                      • Facebook Spy
                    </Link>
                  </li>
                  <li>
                    <Link to={createPageUrl("Investigation") + "?service=Localização"} className="hover:text-orange-600 cursor-pointer transition-colors">
                      • Localização GPS
                    </Link>
                  </li>
                  <li>
                    <Link to={createPageUrl("Investigation") + "?service=Câmera"} className="hover:text-orange-600 cursor-pointer transition-colors">
                      • Câmera Remota
                    </Link>
                  </li>
                  <li>
                    <Link to={createPageUrl("Investigation") + "?service=Detetive Particular"} className="hover:text-orange-600 cursor-pointer transition-colors">
                      • Detetive Particular
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-gray-900 mb-3 text-sm">Informações</h4>
                <ul className="space-y-2 text-xs text-gray-600">
                  <li>
                    <Link to={createPageUrl("HelpCenter")} className="hover:text-orange-600 cursor-pointer transition-colors">
                      • Central de Ajuda
                    </Link>
                  </li>
                  <li>
                    <button onClick={() => setShowTerms(true)} className="hover:text-orange-600 transition-colors text-left">
                      • Termos de Uso
                    </button>
                  </li>
                  <li>
                    <button onClick={() => setShowPrivacy(true)} className="hover:text-orange-600 transition-colors text-left">
                      • Política de Privacidade e Cookies
                    </button>
                  </li>
                  <li>
                    <button onClick={() => setShowLGPD(true)} className="hover:text-orange-600 transition-colors text-left">
                      • LGPD
                    </button>
                  </li>
                </ul>
              </div>
            </div>

            <div className="border-t border-orange-100 pt-4">
              <div className="text-center">
                <p className="text-xs text-gray-500">
                  © 2025 In'Stalker. Todos os direitos reservados.
                </p>
              </div>
            </div>
          </div>
        </footer>
      )}

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

      {showPrivacy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowPrivacy(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Política de Privacidade e Cookies</h3>
              <button onClick={() => setShowPrivacy(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>
            <div className="p-6 text-[10px] text-gray-600 leading-relaxed space-y-3">
              <p><strong>1. COLETA DE DADOS:</strong> O In'Stalker coleta e processa dados fornecidos voluntariamente pelos usuários, incluindo: nome, e-mail, dados de pagamento, informações de investigações (usernames, números de telefone, etc.). Também coletamos dados de uso da plataforma através de cookies e tecnologias similares.</p>
              
              <p><strong>2. USO DOS DADOS:</strong> Os dados coletados são utilizados para: (a) Fornecer e melhorar nossos serviços; (b) Processar transações e gerenciar créditos; (c) Comunicação com usuários sobre atualizações e suporte; (d) Análise de uso para melhorias técnicas; (e) Cumprimento de obrigações legais.</p>
              
              <p><strong>3. COOKIES E TECNOLOGIAS SIMILARES:</strong> Utilizamos cookies essenciais para o funcionamento da plataforma, cookies de desempenho para melhorar a experiência, e cookies de preferências para lembrar suas configurações. Você pode configurar seu navegador para recusar cookies, mas isso pode afetar a funcionalidade da plataforma.</p>
              
              <p><strong>4. COMPARTILHAMENTO DE DADOS:</strong> NÃO vendemos, alugamos ou compartilhamos seus dados pessoais com terceiros para fins de marketing. Podemos compartilhar dados apenas com: (a) Provedores de serviço essenciais (processamento de pagamentos, hospedagem); (b) Autoridades legais quando exigido por lei; (c) Parceiros de integração necessários para funcionalidade da plataforma.</p>
              
              <p><strong>5. SEGURANÇA DOS DADOS:</strong> Implementamos medidas de segurança técnicas e administrativas para proteger seus dados contra acesso não autorizado, alteração, divulgação ou destruição. Isso inclui: criptografia SSL/TLS, armazenamento seguro em servidores protegidos, controle de acesso restrito, auditorias regulares de segurança.</p>
              
              <p><strong>6. RETENÇÃO DE DADOS:</strong> Mantemos seus dados pessoais apenas pelo tempo necessário para fornecer os serviços e cumprir obrigações legais. Dados de investigações podem ser retidos por até 12 meses após exclusão da conta, conforme exigências legais.</p>
              
              <p><strong>7. SEUS DIREITOS:</strong> Você tem direito a: (a) Acessar seus dados pessoais armazenados; (b) Corrigir dados incorretos ou incompletos; (c) Solicitar exclusão de dados (sujeito a limitações legais); (d) Exportar seus dados em formato legível; (e) Revogar consentimentos anteriormente fornecidos.</p>
              
              <p><strong>8. COOKIES ESPECÍFICOS UTILIZADOS:</strong> Cookie de sessão (essencial), Cookie de preferências (lembrar configurações), Cookie de autenticação (manter login), Cookie de análise (Google Analytics), Cookie de desempenho (otimização).</p>
              
              <p><strong>9. TRANSFERÊNCIA INTERNACIONAL:</strong> Seus dados podem ser transferidos e processados em servidores localizados em diferentes países. Garantimos que todas as transferências internacionais atendem aos padrões de proteção de dados aplicáveis.</p>
              
              <p><strong>10. CONTATO:</strong> Para questões sobre privacidade, proteção de dados ou exercício de seus direitos, entre em contato através do e-mail: privacidade@instalker.com</p>
              
              <p className="text-gray-500 italic mt-4">Última atualização: 06 de novembro de 2025</p>
            </div>
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4">
              <Button onClick={() => setShowPrivacy(false)} className="w-full gradient-primary text-white">
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      {showLGPD && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowLGPD(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">LGPD - Lei Geral de Proteção de Dados</h3>
              <button onClick={() => setShowLGPD(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>
            <div className="p-6 text-[10px] text-gray-600 leading-relaxed space-y-3">
              <p><strong>CONFORMIDADE COM A LGPD:</strong> O In'Stalker está em total conformidade com a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais - LGPD). Esta política explica como tratamos dados pessoais em conformidade com a legislação brasileira.</p>
              
              <p><strong>1. BASE LEGAL PARA TRATAMENTO:</strong> Tratamos seus dados pessoais com base nas seguintes bases legais previstas na LGPD: (a) Consentimento do titular; (b) Execução de contrato ou procedimentos preliminares; (c) Exercício regular de direitos em processo judicial, administrativo ou arbitral; (d) Legítimo interesse do controlador ou de terceiro.</p>
              
              <p><strong>2. DADOS PESSOAIS TRATADOS:</strong> Dados cadastrais (nome completo, e-mail, telefone), Dados de autenticação (credenciais de acesso), Dados financeiros (informações de pagamento), Dados de uso (histórico de navegação, investigações realizadas), Dados técnicos (endereço IP, tipo de dispositivo, navegador).</p>
              
              <p><strong>3. DIREITOS DO TITULAR (Art. 18 da LGPD):</strong> Confirmação da existência de tratamento; Acesso aos dados; Correção de dados incompletos, inexatos ou desatualizados; Anonimização, bloqueio ou eliminação de dados desnecessários; Portabilidade dos dados a outro fornecedor; Eliminação dos dados pessoais tratados com consentimento; Informação sobre compartilhamento de dados; Revogação do consentimento.</p>
              
              <p><strong>4. ENCARREGADO DE DADOS (DPO):</strong> Designamos um Encarregado de Proteção de Dados para servir como canal de comunicação entre você, a plataforma e a Autoridade Nacional de Proteção de Dados (ANPD). Contato: dpo@instalker.com</p>
              
              <p><strong>5. COMPARTILHAMENTO E TRANSFERÊNCIA:</strong> Seus dados pessoais podem ser compartilhados com: Prestadores de serviço que atuam em nosso nome (processadores), Autoridades governamentais quando exigido por lei, Terceiros em caso de fusão, aquisição ou venda de ativos (com notificação prévia).</p>
              
              <p><strong>6. MEDIDAS DE SEGURANÇA:</strong> Conforme Art. 46 da LGPD, adotamos medidas técnicas e administrativas para proteger dados pessoais: Criptografia de dados em trânsito e em repouso, Controle de acesso baseado em função (RBAC), Auditorias regulares de segurança, Backup e recuperação de desastres, Treinamento de equipe em proteção de dados.</p>
              
              <p><strong>7. INCIDENTES DE SEGURANÇA:</strong> Em conformidade com Art. 48 da LGPD, caso ocorra qualquer incidente de segurança que possa gerar risco aos seus direitos e liberdades, você será notificado em tempo razoável, juntamente com a ANPD.</p>
              
              <p><strong>8. RETENÇÃO E ELIMINAÇÃO:</strong> Manteremos seus dados pelo tempo necessário para: Cumprir finalidades para as quais foram coletados, Cumprir obrigações legais e regulatórias, Resolver disputas e fazer cumprir acordos. Após o período de retenção, os dados serão eliminados de forma segura e irreversível.</p>
              
              <p><strong>9. TRATAMENTO DE DADOS DE TERCEIROS:</strong> Ao realizar investigações, você pode fornecer dados pessoais de terceiros (alvos). Você declara ter base legal para o tratamento desses dados e assume total responsabilidade por qualquer uso indevido ou ilegal.</p>
              
              <p><strong>10. EXERCÍCIO DE DIREITOS:</strong> Para exercer qualquer dos seus direitos previstos na LGPD, entre em contato através do e-mail: lgpd@instalker.com. Responderemos sua solicitação em até 15 dias conforme estabelecido pela lei.</p>
              
              <p><strong>11. RECLAMAÇÕES:</strong> Caso não esteja satisfeito com o tratamento de seus dados pessoais, você tem o direito de apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD).</p>
              
              <p className="text-gray-500 italic mt-4">Última atualização: 06 de novembro de 2025</p>
            </div>
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4">
              <Button onClick={() => setShowLGPD(false)} className="w-full gradient-primary text-white">
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

