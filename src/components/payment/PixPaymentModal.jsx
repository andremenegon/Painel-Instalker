import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Loader2, QrCode, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function PixPaymentModal({ 
  isOpen, 
  onClose, 
  pixData,
  onPaymentConfirmed 
}) {
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [timeLeft, setTimeLeft] = useState(1800); // 30 minutos

  // Countdown timer
  useEffect(() => {
    if (!isOpen || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, timeLeft]);

  // Formatar tempo restante
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const copyPixCode = async () => {
    try {
      await navigator.clipboard.writeText(pixData.pixCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Erro ao copiar:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in-0">
      <Card className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 p-5 text-white">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold">Pagamento PIX</h3>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm opacity-90">Escaneie o QR Code ou copie o código PIX</p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Timer */}
          <div className="flex items-center justify-center gap-2 p-3 bg-orange-50 rounded-lg border border-orange-200">
            <Clock className="w-4 h-4 text-orange-600" />
            <span className="text-sm font-bold text-orange-600">
              Expira em {formatTime(timeLeft)}
            </span>
          </div>

          {/* Valor */}
          <div className="text-center py-4">
            <p className="text-sm text-gray-600 mb-1">Valor a pagar</p>
            <p className="text-3xl font-black text-gray-900">
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              }).format(pixData.amount / 100)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              +{pixData.credits} créditos
            </p>
          </div>

          {/* QR Code */}
          <div className="flex justify-center p-4 bg-gray-50 rounded-xl">
            {pixData.qrCode ? (
              <img
                src={pixData.qrCode}
                alt="QR Code PIX"
                className="w-64 h-64 rounded-lg"
              />
            ) : (
              <div className="w-64 h-64 flex items-center justify-center bg-white rounded-lg border-2 border-dashed border-gray-300">
                <div className="text-center">
                  <QrCode className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Gerando QR Code...</p>
                </div>
              </div>
            )}
          </div>

          {/* Código PIX Copia e Cola */}
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-2">
              Ou copie o código PIX:
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={pixData.pixCode}
                readOnly
                className="flex-1 px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg font-mono"
              />
              <Button
                onClick={copyPixCode}
                className="flex-shrink-0 px-4"
                variant={copied ? 'outline' : 'default'}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" />
                    Copiar
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center justify-center gap-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
            <span className="text-sm font-medium text-blue-700">
              Aguardando pagamento...
            </span>
          </div>

          {/* Instruções */}
          <div className="space-y-2 text-xs text-gray-600">
            <p className="font-semibold text-gray-900">Como pagar:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Abra o app do seu banco</li>
              <li>Escolha pagar com PIX</li>
              <li>Escaneie o QR Code ou cole o código</li>
              <li>Confirme o pagamento</li>
            </ol>
            <p className="text-[10px] text-gray-500 italic mt-3">
              * Os créditos serão adicionados automaticamente após a confirmação do pagamento
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

