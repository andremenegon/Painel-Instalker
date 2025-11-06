import React from "react";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";

export default function ConfirmCreditModal({ service, onConfirm, onCancel }) {
  if (!service) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[320px] p-4 animate-in fade-in zoom-in duration-200">
        <div className="text-center mb-4">
          <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center mx-auto mb-3">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-2">
            Confirmar uso de créditos
          </h3>
          <p className="text-sm text-gray-600 leading-snug">
            Você está prestes a usar{" "}
            <span className="font-bold text-orange-600">{service.credits_cost} créditos</span>
            {" "}para acessar: <span className="font-bold text-gray-900">{service.name}</span>
          </p>
        </div>

        <div className="space-y-2">
          <Button
            onClick={onConfirm}
            className="w-full h-11 gradient-primary text-white font-bold text-sm rounded-xl shadow-lg"
          >
            Confirmar e continuar
          </Button>
          <Button
            onClick={onCancel}
            variant="ghost"
            className="w-full h-9 text-gray-600 font-medium text-sm hover:bg-gray-100 rounded-xl"
          >
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}