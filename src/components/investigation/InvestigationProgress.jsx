import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, Clock, Target, Zap } from "lucide-react";
import { motion } from "framer-motion";

const investigationSteps = {
  Instagram: [
    "Usuário encontrado",
    "Bypass de segurança",
    "Recuperação de mensagens",
    "Análise de atividades",
    "Gerando relatório"
  ],
  WhatsApp: [
    "Número localizado",
    "Bypass E2E",
    "Conversas recuperadas",
    "Análise de grupos",
    "Relatório completo"
  ],
  Facebook: [
    "Perfil encontrado",
    "Bypass privacidade",
    "Posts recuperados",
    "Análise de conexões",
    "Relatório final"
  ],
  Gmail: [
    "Conta localizada",
    "Bypass 2FA",
    "E-mails recuperados",
    "Análise de anexos",
    "Gerando relatório"
  ],
  default: [
    "Iniciando",
    "Coletando dados",
    "Processando",
    "Analisando",
    "Finalizando"
  ]
};

export default function InvestigationProgress({ investigation }) {
  const steps = investigationSteps[investigation.service_name] || investigationSteps.default;
  const currentStepIndex = Math.floor((investigation.progress / 100) * steps.length);

  return (
    <div className="space-y-3">
      <Card className="gradient-card border-0 shadow-soft p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 gradient-primary rounded-lg flex items-center justify-center">
              <Target className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                @{investigation.target_username}
              </h3>
              <p className="text-xs text-gray-600">{investigation.service_name}</p>
            </div>
          </div>
          
          <Badge className="bg-orange-100 text-orange-700 border-0 text-xs">
            {investigation.progress}%
          </Badge>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <motion.div
              className="gradient-primary h-2 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${investigation.progress}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Steps Compactos */}
        <div className="space-y-2">
          {steps.map((step, index) => {
            const isCompleted = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;

            return (
              <div
                key={index}
                className={`flex items-center gap-2 p-2 rounded-lg transition-all ${
                  isCompleted ? 'bg-green-50' :
                  isCurrent ? 'bg-orange-50' :
                  'bg-gray-50'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isCompleted ? 'bg-green-500' :
                  isCurrent ? 'bg-orange-500' :
                  'bg-gray-300'
                }`}>
                  {isCompleted ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                  ) : isCurrent ? (
                    <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                  ) : (
                    <span className="text-white text-xs font-bold">{index + 1}</span>
                  )}
                </div>
                
                <p className={`text-xs font-medium flex-1 ${
                  isCompleted ? 'text-green-900' :
                  isCurrent ? 'text-orange-900' :
                  'text-gray-500'
                }`}>
                  {step}
                </p>

                {isCompleted && (
                  <span className="text-[10px] text-green-600">✓</span>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Tempo Estimado */}
      {!investigation.is_accelerated && investigation.estimated_days > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-3 flex items-start gap-3">
          <Clock className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-gray-900 mb-0.5">
              ⏳ Análise em andamento
            </p>
            <p className="text-[11px] text-gray-700 leading-tight">
              Processo pode levar até <span className="font-bold text-purple-700">{investigation.estimated_days} dias</span>
            </p>
          </div>
        </div>
      )}

      {investigation.is_accelerated && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-3 flex items-center gap-2">
          <Zap className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-xs text-green-800 font-medium">
            🚀 Investigação acelerada!
          </p>
        </div>
      )}
    </div>
  );
}