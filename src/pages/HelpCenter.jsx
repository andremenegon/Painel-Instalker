import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, HelpCircle, ChevronDown, ChevronUp } from "lucide-react";

export default function HelpCenter() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState(null);

  const faqs = [
    {
      question: "Como funciona o sistema de créditos?",
      answer: "Cada serviço tem um custo em créditos. Você compra créditos uma vez e usa em qualquer investigação. Créditos não expiram e você pode acumular quanto quiser."
    },
    {
      question: "Quanto tempo demora uma investigação?",
      answer: "Depende do serviço: Instagram (5-7 dias), WhatsApp (3-5 dias), Facebook (7 dias), Localização (imediato), SMS (minutos), Chamadas (minutos), Câmera (11 horas), Detetive Particular (variável)."
    },
    {
      question: "Posso acelerar as investigações?",
      answer: "Sim! A maioria dos serviços oferece a opção de acelerar por 30 créditos. O progresso aumenta significativamente quando você acelera."
    },
    {
      question: "Os créditos são reembolsáveis?",
      answer: "Não. Uma vez gastos, os créditos não podem ser reembolsados. Mas garantimos que todas as investigações serão concluídas com sucesso."
    },
    {
      question: "É legal usar esses serviços?",
      answer: "Você é responsável por usar os serviços dentro da lei. Recomendamos usar apenas para investigar pessoas com as quais você tem relacionamento legítimo (cônjuges, parceiros, filhos menores sob sua responsabilidade)."
    },
    {
      question: "Como funciona o Instagram grátis?",
      answer: "O serviço básico de Instagram não custa créditos para iniciar. Porém, demora alguns dias para completar. Você pode acelerar usando créditos se quiser resultados mais rápidos."
    },
    {
      question: "Posso cancelar uma investigação?",
      answer: "Sim, você pode cancelar a qualquer momento pelo Dashboard. Porém, os créditos já gastos não serão devolvidos."
    },
    {
      question: "O que acontece quando completo uma investigação?",
      answer: "Você ganha XP (experiência) e pode visualizar todos os resultados. Algumas investigações (como Localização, SMS, Chamadas, Câmera) ficam salvas no Dashboard para consulta posterior."
    },
    {
      question: "Como funciona o sistema de níveis e XP?",
      answer: "A cada investigação você ganha XP. Quando acumula XP suficiente, sobe de nível e ganha créditos bônus! Quanto maior seu nível, mais créditos de bônus você recebe."
    },
    {
      question: "Posso ter múltiplas investigações ao mesmo tempo?",
      answer: "Sim! Você pode ter várias investigações rodando simultaneamente em diferentes serviços."
    },
    {
      question: "Como funciona o Detetive Particular?",
      answer: "É um serviço premium onde um detetive REAL e profissional faz uma investigação manual completa. Ele cria perfis fake, se aproxima do alvo, testa fidelidade e gera um relatório completo. Custa 1000 créditos mas é o serviço mais eficaz."
    },
    {
      question: "Os dados são seguros e privados?",
      answer: "Sim! Utilizamos criptografia SSL, servidores seguros e nunca compartilhamos suas investigações com terceiros. Tudo é 100% confidencial."
    },
    {
      question: "Posso comprar mais créditos a qualquer momento?",
      answer: "Sim! Acesse 'Comprar Créditos' no seu perfil ou no Dashboard a qualquer momento. Oferecemos pacotes de 100, 500, 1000 e 2000 créditos."
    },
    {
      question: "O que fazer se uma investigação falhar?",
      answer: "Isso é extremamente raro. Mas se acontecer, entre em contato com nosso suporte e analisaremos seu caso individualmente."
    },
    {
      question: "Posso apagar uma investigação completada?",
      answer: "Sim, você pode apagar investigações do Dashboard a qualquer momento. Os dados serão removidos permanentemente."
    }
  ];

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-3 py-3 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(createPageUrl("Dashboard"))} className="h-9 px-3 hover:bg-gray-100" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Voltar
          </Button>
          <h1 className="text-base font-bold text-gray-900">Central de Ajuda</h1>
          <div className="w-20"></div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4">
        <div className="text-center mb-6">
          <HelpCircle className="w-16 h-16 mx-auto mb-3 text-orange-500" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Como podemos ajudar?</h2>
          <p className="text-sm text-gray-600">Perguntas frequentes sobre a plataforma</p>
        </div>

        <div className="space-y-2">
          {faqs.map((faq, index) => (
            <Card key={index} className="bg-white border-0 shadow-sm overflow-hidden">
              <button
                onClick={() => toggleFaq(index)}
                className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <h3 className="text-sm font-bold text-gray-900 pr-4">{faq.question}</h3>
                {openFaq === index ? (
                  <ChevronUp className="w-5 h-5 text-orange-500 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                )}
              </button>
              {openFaq === index && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  <p className="text-xs text-gray-600 leading-relaxed pt-3">{faq.answer}</p>
                </div>
              )}
            </Card>
          ))}
        </div>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-200 p-5 mt-6">
          <h3 className="text-base font-bold text-gray-900 mb-2">Ainda tem dúvidas?</h3>
          <p className="text-sm text-gray-700 mb-4">Entre em contato com nosso suporte via WhatsApp</p>
          <Button className="w-full gradient-primary text-white h-11">
            💬 Falar com Suporte
          </Button>
        </Card>
      </div>
    </div>
  );
}