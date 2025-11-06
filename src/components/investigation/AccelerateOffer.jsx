import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, Clock, Star, AlertCircle, TrendingUp } from "lucide-react";

export default function AccelerateOffer({ investigation, onAccelerate }) {
  const [loading, setLoading] = useState(false);
  const acceleratePrice = 29.90;

  const handleAccelerate = async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await onAccelerate();
    } catch (error) {
      console.error("Erro ao acelerar:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-0 overflow-hidden shadow-soft mt-3">
      {/* Header */}
      <div className="gradient-primary p-4 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
        
        <div className="relative z-10">
          <Badge className="bg-yellow-400 text-yellow-900 border-0 mb-2 text-xs">
            ⚡ OFERTA EXCLUSIVA
          </Badge>
          <h3 className="text-lg font-bold mb-1">
            Não quer esperar {investigation.estimated_days} dias?
          </h3>
          <p className="text-white/90 text-xs">
            Acelere e receba em minutos!
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        {/* Comparação */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <Clock className="w-4 h-4 text-gray-500 mb-1" />
            <p className="text-xs text-gray-500">Normal</p>
            <p className="text-xl font-bold text-gray-900">{investigation.estimated_days}d</p>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-pink-50 rounded-lg p-3 border-2 border-orange-300">
            <Zap className="w-4 h-4 text-orange-600 mb-1 animate-pulse" />
            <p className="text-xs text-orange-600 font-medium">Turbo</p>
            <p className="text-xl font-bold text-orange-600">2min</p>
          </div>
        </div>

        {/* Benefícios */}
        <div className="space-y-2 mb-4">
          {[
            { icon: Zap, text: "Resultados em 2 minutos" },
            { icon: Star, text: "Dados mais completos" },
            { icon: TrendingUp, text: "Prioridade máxima" },
          ].map((benefit, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center">
                <benefit.icon className="w-3 h-3 text-orange-600" />
              </div>
              <p className="text-xs text-gray-700">{benefit.text}</p>
            </div>
          ))}
        </div>

        {/* Urgência */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded p-3 mb-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-yellow-800 leading-tight">
              <span className="font-bold">⏰ Oferta temporária!</span> Válida apenas nesta página
            </p>
          </div>
        </div>

        {/* Preço */}
        <div className="bg-gradient-to-br from-orange-50 to-pink-50 rounded-xl p-4 mb-4 text-center">
          <p className="text-xs text-gray-600 mb-1">Acelere por apenas:</p>
          <div className="flex items-center justify-center gap-2 mb-1">
            <p className="text-3xl font-bold text-[#FF6B4A]">
              R$ {acceleratePrice.toFixed(2)}
            </p>
            <Badge className="bg-red-500 text-white border-0 text-xs">
              50% OFF
            </Badge>
          </div>
          <p className="text-[10px] text-gray-500">
            <span className="line-through">R$ 59,90</span>
          </p>
        </div>

        {/* Social Proof */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="flex -space-x-2">
            {[1,2,3,4].map(i => (
              <div key={i} className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-pink-400 border-2 border-white" />
            ))}
          </div>
          <p className="text-[10px] text-gray-600">
            <span className="font-bold">1.234</span> aceleraram hoje
          </p>
        </div>

        {/* CTA */}
        <Button
          onClick={handleAccelerate}
          disabled={loading}
          className="w-full h-11 gradient-primary text-white font-bold text-sm rounded-xl shadow-lg"
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Processando...
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Acelerar Agora
            </div>
          )}
        </Button>

        <p className="text-[10px] text-center text-gray-500 mt-2">
          🔒 Pagamento seguro
        </p>
      </div>
    </Card>
  );
}