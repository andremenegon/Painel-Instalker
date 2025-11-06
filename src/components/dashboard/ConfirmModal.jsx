import React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Trash2 } from "lucide-react";

export default function ConfirmModal({ 
  isOpen,
  onConfirm, 
  onCancel,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  type = "default" // "default" | "danger"
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[340px] p-5 animate-in fade-in zoom-in duration-200">
        <div className="text-center mb-4">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 ${
            type === "danger" ? "bg-red-100" : "bg-orange-100"
          }`}>
            {type === "danger" ? (
              <Trash2 className="w-7 h-7 text-red-600" />
            ) : (
              <AlertTriangle className="w-7 h-7 text-orange-600" />
            )}
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-3">
            {title}
          </h3>
          <p className="text-xs text-gray-600 leading-relaxed">
            {message}
          </p>
        </div>

        <div className="space-y-2">
          <Button
            onClick={onConfirm}
            className={`w-full h-11 font-bold text-sm rounded-xl shadow-lg ${
              type === "danger" 
                ? "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white"
                : "gradient-primary text-white"
            }`}
          >
            {confirmText}
          </Button>
          <Button
            onClick={onCancel}
            variant="ghost"
            className="w-full h-10 text-gray-600 font-medium text-sm hover:bg-gray-100 rounded-xl"
          >
            {cancelText}
          </Button>
        </div>
      </div>
    </div>
  );
}