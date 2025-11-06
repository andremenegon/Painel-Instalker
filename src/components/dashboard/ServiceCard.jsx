
import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Instagram, Facebook, MessageCircle, Camera, MapPin, Share2, Mail, Phone, Wifi, Zap, Clock, Loader2, UserSearch } from "lucide-react";
import WhatsAppIcon from "../icons/WhatsAppIcon";

const iconMap = {
  Instagram: Instagram,
  Facebook: Facebook,
  WhatsApp: "whatsapp",
  Câmera: Camera,
  Camera: Camera,
  Localização: MapPin,
  "Outras Redes": Share2,
  "Redes Sociais": Share2,
  Gmail: Mail,
  SMS: MessageCircle,
  Chamadas: Phone,
  Wifi: Wifi,
  "Detetive Particular": UserSearch
};

// Função auxiliar para converter hex para rgba
const hexToRgba = (hex, alpha = 0.12) => {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export default function ServiceCard({ service, onClick, isInvestigating, progress, isCompleted }) {
  const iconName = iconMap[service.name] || Instagram;
  const isFree = (service.credits_cost === 0 || service.credits_cost === null) || service.name === "Instagram";

  const getIconColor = () => {
    // Usar cor do serviço se disponível, senão usar cores padrão
    if (service.color) return service.color;
    
    // Fallback para cores padrão por nome
    if (service.name === "WhatsApp") return "#25D366";
    if (service.name === "Instagram") return "#E4405F";
    if (service.name === "Facebook") return "#1877F2";
    if (service.name === "Localização") return "#FF6B4A";
    if (service.name === "SMS") return "#FFC107";
    if (service.name === "Chamadas") return "#4CAF50";
    if (service.name === "Câmera") return "#9C27B0";
    if (service.name === "Outras Redes") return "#F44336";
    if (service.name === "Detetive Particular") return "#2D3748";
    
    return '#FF6B4A';
  };

  const getBackgroundColor = () => {
    // Usar cor do serviço com opacidade se disponível
    if (service.color) {
      return hexToRgba(service.color, 0.12);
    }
    
    // Fallback para cores padrão por nome
    if (service.name === "WhatsApp") return "#E8F5E9";
    if (service.name === "Instagram") return "#FCE4EC";
    if (service.name === "Facebook") return "#E3F2FD";
    if (service.name === "Localização") return "#FFF3E0";
    if (service.name === "SMS") return "#FFF9C4";
    if (service.name === "Chamadas") return "#E8F5E9";
    if (service.name === "Câmera") return "#F3E5F5";
    if (service.name === "Outras Redes") return "#FFEBEE";
    if (service.name === "Detetive Particular") return "#E2E8F0";
    
    return '#FF6B4A20';
  };

  return (
    <Card
      onClick={onClick}
      className="gradient-card border-0 shadow-soft cursor-pointer p-3 relative overflow-hidden group active:scale-95 transition-transform duration-150"
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-2 transition-all duration-300 group-hover:scale-110 relative`}
        style={{ backgroundColor: getBackgroundColor() }}
      >
        {iconName === "whatsapp" ? (
          <WhatsAppIcon className="w-6 h-6" color={getIconColor()} />
        ) : (
          React.createElement(iconName, {
            className: "w-6 h-6",
            style: { color: getIconColor() }
          })
        )}
        {isInvestigating && (
          <Loader2
            className="w-3 h-3 animate-spin absolute top-0.5 right-0.5"
            style={{ color: getIconColor() }}
          />
        )}
      </div>

      <div className="mb-2">
        <h3 className="text-base font-bold text-gray-900 mb-1">{service.name}</h3>
        <p className="text-xs text-gray-600 leading-snug min-h-[32px]">
          {service.description}
        </p>
      </div>

      {isInvestigating ? (
        <div className="mt-2 inline-block">
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-lg border"
            style={{
              backgroundColor: '#FF6B4A10',
              borderColor: '#FF6B4A30'
            }}
          >
            <Clock className="w-3 h-3 text-orange-500" />
            <span className="text-sm font-bold text-orange-600">{progress}%</span>
          </div>
        </div>
      ) : isCompleted ? (
        <Badge className="bg-green-100 text-green-700 border-0 text-xs font-semibold px-2 py-1">
          ✓ Completa
        </Badge>
      ) : (
        <div className="flex items-center justify-between mt-2">
          {isFree ? (
            <Badge className="bg-blue-500 text-white border-0 text-xs font-bold px-2">
              GRÁTIS
            </Badge>
          ) : (
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-lg border"
              style={{
                backgroundColor: service.color ? hexToRgba(service.color, 0.1) : '#FF6B4A10',
                borderColor: service.color ? hexToRgba(service.color, 0.3) : '#FF6B4A30'
              }}
            >
              <Zap
                className="w-3 h-3"
                style={{ color: getIconColor() }}
              />
              <p
                className="text-sm font-bold"
                style={{ color: getIconColor() }}
              >
                {service.credits_cost}
              </p>
              <p className="text-[10px] font-medium" style={{ color: '#666' }}>
                créditos
              </p>
            </div>
          )}
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-orange-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
    </Card>
  );
}
