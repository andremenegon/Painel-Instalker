
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Zap, Eye, AlertTriangle, Loader2, CheckCircle2, Navigation } from "lucide-react";
import { MapContainer, TileLayer, CircleMarker, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ConfirmModal from "../components/dashboard/ConfirmModal";

function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 12);
  }, [center, map]);
  return null;
}

export default function LocationSpy() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  // Removed [userProfile, setUserProfile] = useState(null); as it's now derived from useQuery
  const [showCreditAlert, setShowCreditAlert] = useState(false);
  const [creditsSpent, setCreditsSpent] = useState(0);
  const [xpGained, setXpGained] = useState(0);
  const [detectedLocation, setDetectedLocation] = useState(null);
  const [motels, setMotels] = useState([]); // Renamed to `allLocations` conceptually
  const [realLocations, setRealLocations] = useState([]); // Initial locations to display
  const [showAccelerateButton, setShowAccelerateButton] = useState(false);
  const [accelerating, setAccelerating] = useState(false);
  const [showMoreLocations, setShowMoreLocations] = useState(false);
  const [realTimeTracking, setRealTimeTracking] = useState(false);
  const [realTimeProgress, setRealTimeProgress] = useState(0);
  const [showAccelerateRealTime, setShowAccelerateRealTime] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  // Removed [progressUpdating, setProgressUpdating] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState({});
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const hasPlayedComplete = useRef(false); // Ref to track if completion sound has played

  // ✅ NEW STATE VARIABLE FOR LOCAL PROGRESS
  const [locationProgress, setLocationProgress] = useState(0);

  // ✅ FUNÇÃO DE SOM UNIVERSAL
  const playSound = (type) => {
    if (typeof window === 'undefined') return;
    if (!window.AudioContext && !window.webkitAudioContext) return;

    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      if (type === 'click') {
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.05);
      } else if (type === 'complete') {
        const times = [0, 0.1, 0.2];
        const freqs = [523.25, 659.25, 783.99];
        times.forEach((time, i) => {
          const osc = audioContext.createOscillator();
          const gain = audioContext.createGain();
          osc.connect(gain);
          gain.connect(audioContext.destination);
          osc.frequency.setValueAtTime(freqs[i], audioContext.currentTime + time);
          gain.gain.setValueAtTime(0.2, audioContext.currentTime + time);
          gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3 + time);
          osc.start(audioContext.currentTime + time);
          osc.stop(audioContext.currentTime + 0.3 + time);
        });
        return;
      } else if (type === 'error') {
        oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
      } else if (type === 'trash') {
        oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
      } else if (type === 'turbo') { // ✅ ADICIONADO SOM TURBO
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
        oscillator.frequency.linearRampToValueAtTime(1200, audioContext.currentTime + 0.15);
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
      }
    } catch (error) {
      // Silently fail
    }
  };

  useEffect(() => {
    base44.auth.me().then(async (userData) => {
      setUser(userData);
      // userProfile is now handled by useQuery, so we remove direct setting here.
      // const profiles = await base44.entities.UserProfile.filter({ created_by: userData.email });
      // if (profiles.length > 0) setUserProfile(profiles[0]);
    }).catch(console.error);
  }, []);

  const { data: userProfiles = [] } = useQuery({
    queryKey: ['userProfile', user?.email],
    queryFn: () => base44.entities.UserProfile.filter({ created_by: user.email }),
    enabled: !!user,
    staleTime: Infinity, // ✅ CACHE INFINITO
    cacheTime: Infinity,
    refetchOnWindowFocus: false, // ✅ DESATIVADO
    refetchOnMount: false, // ✅ DESATIVADO
  });

  const userProfile = userProfiles[0];

  const { data: investigations = [], refetch } = useQuery({
    queryKey: ['investigations', user?.email],
    queryFn: () => base44.entities.Investigation.filter({ created_by: user?.email }),
    initialData: [],
    enabled: !!user,
    staleTime: Infinity, // ✅ CACHE INFINITO
    refetchOnWindowFocus: false, // ✅ DESATIVADO
    refetchOnMount: false, // ✅ DESATIVADO
  });

  const activeLocationInvestigation = investigations.find(
    inv => inv.service_name === "Localização" && inv.status === "processing"
  );

  const completedLocationInvestigation = investigations.find(
    inv => inv.service_name === "Localização" && (inv.status === "completed" || inv.status === "accelerated")
  );

  // Helper to update userProfile in react-query cache
  const updateUserProfileCache = (changes) => {
    queryClient.setQueryData(['userProfile', user?.email], (oldProfiles) => {
      if (!oldProfiles || oldProfiles.length === 0) return oldProfiles;
      const oldProfile = oldProfiles[0];
      const newProfile = { ...oldProfile, ...changes };
      return [newProfile];
    });
  };

  // CARREGAR DADOS COMPLETADOS - SEM REFETCH
  useEffect(() => {
    if (dataLoaded || !completedLocationInvestigation || !user || !userProfile) return; // Ensure userProfile is loaded

    const loadData = async () => {
      // userProfile is now derived from useQuery, no need to refetch it here
      // const profiles = await base44.entities.UserProfile.filter({ created_by: user.email });
      // if (profiles.length === 0) return;
      // const profile = profiles[0];
      // setUserProfile(profile); // Removed direct state update

      const history = userProfile.investigation_history || {}; // Use the query-derived userProfile
      const savedResults = history['Localização'];
      
      if (savedResults && savedResults.detectedLocation) {
        setDetectedLocation(savedResults.detectedLocation);
        setMotels(savedResults.motels || []);
        setRealLocations(savedResults.realLocations || []);
      } else {
        // If completed, but no saved data, something is wrong, force a re-detection
        detectLocation();
      }
      
      setDataLoaded(true);
    };
    
    loadData();
  }, [completedLocationInvestigation?.id, user?.email, userProfile, dataLoaded]); // Added userProfile to dependencies

  // BOTÃO DE ACELERAR - SEM DEPENDÊNCIAS DESNECESSÁRIAS
  useEffect(() => {
    if (!activeLocationInvestigation) {
      setShowAccelerateButton(false);
      return;
    }
    
    const progress = locationProgress; // Use local progress for this check
    if (progress < 1 || progress >= 100) {
      setShowAccelerateButton(false);
      return;
    }
    
    const storageKey = `accelerate_shown_${activeLocationInvestigation.id}`;
    const alreadyShown = localStorage.getItem(storageKey) === 'true';
    
    if (alreadyShown) {
      setShowAccelerateButton(true);
    } else {
      const timer = setTimeout(() => {
        setShowAccelerateButton(true);
        localStorage.setItem(storageKey, 'true');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [activeLocationInvestigation?.id, locationProgress]); // Use locationProgress here

  // ✅ PROGRESSO - 5 MIN (SALVA APENAS LOCALMENTE)
  useEffect(() => {
    if (!activeLocationInvestigation) {
      setLocationProgress(0);
      hasPlayedComplete.current = false; // Reset on new/no investigation
      return;
    }
    
    const localStorageKey = `location_progress_${activeLocationInvestigation.id}`;
    const storedProgress = localStorage.getItem(localStorageKey);
    
    let currentProgress = activeLocationInvestigation.progress;
    if (storedProgress !== null) {
      const parsedStoredProgress = parseInt(storedProgress, 10);
      // Ensure local progress never goes backwards from DB or stored value
      currentProgress = Math.min(100, Math.max(currentProgress, parsedStoredProgress));
    }
    
    setLocationProgress(currentProgress);

    if (currentProgress >= 100) {
      if (activeLocationInvestigation.status !== "completed") {
        base44.entities.Investigation.update(activeLocationInvestigation.id, {
          progress: 100,
          status: "completed"
        }).then(() => {
          queryClient.invalidateQueries(['investigations', user?.email]);
          if (!hasPlayedComplete.current) {
            playSound('complete');
            hasPlayedComplete.current = true;
          }
        });
      }
      return;
    }

    const interval = 3000; // 3 seconds per progress point

    const timer = setInterval(() => {
      setLocationProgress(prev => {
        const newProgress = Math.min(100, prev + 1);
        
        // ✅ SALVAR APENAS NO LOCALSTORAGE
        localStorage.setItem(localStorageKey, newProgress.toString());
        
        // ✅ SALVAR NO BANCO APENAS AO COMPLETAR
        if (newProgress >= 100) {
          base44.entities.Investigation.update(activeLocationInvestigation.id, {
            progress: 100,
            status: "completed"
          }).then(() => {
            queryClient.invalidateQueries(['investigations', user?.email]);
            if (!hasPlayedComplete.current) {
                playSound('complete');
                hasPlayedComplete.current = true;
            }
          });
          clearInterval(timer);
        }
        
        return newProgress;
      });
    }, interval);
    
    return () => clearInterval(timer);
  }, [activeLocationInvestigation?.id, activeLocationInvestigation?.progress, activeLocationInvestigation?.status, queryClient, user?.email]);

  useEffect(() => {
    if (!realTimeTracking || realTimeProgress >= 100) return;
    
    const interval = 2592000; // Original interval
    
    const timer = setInterval(() => {
      setRealTimeProgress(prev => Math.min(100, prev + 1));
    }, interval);
    
    return () => clearInterval(timer);
  }, [realTimeTracking, realTimeProgress]);

  useEffect(() => {
    if (!realTimeTracking || realTimeProgress >= 100) return;
    
    const timer = setTimeout(() => {
      setShowAccelerateRealTime(true);
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [realTimeTracking, realTimeProgress]);

  const detectLocation = async () => {
    console.log("🌍 DETECTANDO LOCALIZAÇÃO...");
    setLoadingLocations(true);
    
    const apis = [
      {
        name: 'geojs.io',
        url: 'https://get.geojs.io/v1/ip/geo.json',
        parse: (data) => ({
          cidade: data.city,
          estado: data.region,
          lat: parseFloat(data.latitude),
          lon: parseFloat(data.longitude)
        })
      },
      {
        name: 'ipwhois.app',
        url: 'https://ipwhois.app/json/',
        parse: (data) => ({
          cidade: data.city,
          estado: data.region_code || data.region,
          lat: parseFloat(data.latitude),
          lon: parseFloat(data.longitude)
        })
      },
      {
        name: 'freegeoip.app',
        url: 'https://freegeoip.app/json/',
        parse: (data) => ({
          cidade: data.city,
          estado: data.region_code,
          lat: data.latitude,
          lon: data.longitude
        })
      }
    ];

    for (const api of apis) {
      try {
        console.log(`Tentando API: ${api.name}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        const response = await fetch(api.url, { 
          signal: controller.signal,
          headers: {
            'Accept': 'application/json'
          }
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          console.error(`${api.name} retornou status ${response.status}`);
          continue;
        }
        
        const data = await response.json();
        console.log(`Dados recebidos de ${api.name}:`, data);
        
        const location = api.parse(data);
        
        if (location.cidade && location.lat && location.lon && !isNaN(location.lat) && !isNaN(location.lon)) {
          console.log(`✅ Localização detectada: ${location.cidade}, ${location.estado}`);
          setDetectedLocation(location);
          await fetchNearbyLocations(location.lat, location.lon, location.cidade, location);
          return;
        } else {
          console.warn(`${api.name} retornou dados incompletos`);
        }
      } catch (error) {
        console.error(`Erro na API ${api.name}:`, error.message);
        continue;
      }
    }
    
    console.log("⚠️ Todas as APIs falharam, usando São Paulo como fallback");
    const fallback = { 
      cidade: 'São Paulo', 
      estado: 'SP', 
      lat: -23.5505, 
      lon: -46.6333 
    };
    setDetectedLocation(fallback);
    await fetchNearbyLocations(fallback.lat, fallback.lon, fallback.cidade, fallback);
  };

  const fetchNearbyLocations = async (lat, lon, cidade, locationData) => {
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      console.log(`🔍 Tentando buscar lugares reais em ${cidade}...`);
      
      const radius = 20000;
      const queries = [
        `node["amenity"="restaurant"]["name"](around:${radius},${lat},${lon});`,
        `node["amenity"="cafe"]["name"](around:${radius},${lat},${lon});`,
        `node["shop"="supermarket"]["name"](around:${radius},${lat},${lon});`,
        `node["leisure"="park"]["name"](around:${radius},${lat},${lon});`,
        `node["shop"="mall"]["name"](around:${radius},${lat},${lon});`,
        `node["amenity"="bar"]["name"](around:${radius},${lat},${lon});`,
        `node["amenity"="fuel"]["name"](around:${radius},${lat},${lon});`
      ];

      const overpassQuery = `[out:json][timeout:15];(${queries.join('')});out body 50;`;
      const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 18000);
      
      const response = await fetch(overpassUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.warn(`⚠️ Overpass API retornou status ${response.status}, usando fallback`);
        throw new Error(`API Error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`📦 Resposta recebida: ${data.elements?.length || 0} elementos`);

      if (data.elements && data.elements.length > 0) {
        let realPlaces = data.elements
          .filter(place => {
            const hasName = place.tags && place.tags.name && place.tags.name.length > 2;
            const hasCoords = place.lat && place.lon;
            return hasName && hasCoords;
          })
          .map(place => ({
            nome: place.tags.name,
            lat: place.lat,
            lon: place.lon,
            tipo: place.tags.amenity || place.tags.shop || place.tags.leisure || "local",
            suspicious: false,
            needsGeocode: false
          }));

        const uniquePlaces = [];
        const seenNames = new Set();
        realPlaces.forEach(place => {
          const nameLower = place.nome.toLowerCase().trim();
          if (!seenNames.has(nameLower) && nameLower.length > 2) {
            seenNames.add(nameLower);
            uniquePlaces.push(place);
          }
        });

        console.log(`🎯 ${uniquePlaces.length} lugares únicos encontrados`);

        if (uniquePlaces.length >= 5) {
          const shuffled = uniquePlaces.sort(() => 0.5 - Math.random());
          const initialLocations = shuffled.slice(0, 5);
          const extraLocations = shuffled.slice(5, 25); 
          const finalLocations = [...initialLocations, ...extraLocations].slice(0, 24);
          
          console.log(`✅ SUCESSO! Total: ${finalLocations.length} lugares REAIS`);
          console.log(`📊 Iniciais: ${initialLocations.length} | Extras: ${extraLocations.length}`);
          
          setMotels(finalLocations);
          setRealLocations(initialLocations);
          setLoadingLocations(false);
          
          await saveToUserHistory(finalLocations, initialLocations, locationData);
          return;
        }
      }
    } catch (error) {
      console.warn(`⚠️ Não foi possível buscar lugares reais: ${error.message}`);
    }
    
    console.log("📍 Gerando coordenadas aleatórias e buscando endereços reais");
    const allLocations = await createFallbackLocationsWithAddresses(lat, lon, cidade);
    
    const shuffled = allLocations.sort(() => 0.5 - Math.random());
    const initialLocations = shuffled.slice(0, 5);
    const extraLocations = shuffled.slice(5, 25); 
    const finalLocations = [...initialLocations, ...extraLocations].slice(0, 24);
    
    console.log(`✅ Usando ${finalLocations.length} coordenadas com endereços reais`);
    setRealLocations(initialLocations);
    setMotels(finalLocations);
    setLoadingLocations(false);
    
    await saveToUserHistory(finalLocations, initialLocations, locationData);
  };

  const saveToUserHistory = async (finalLocations, initialLocations, locationData) => {
    if (!userProfile || !user) {
      console.warn("⚠️ UserProfile não encontrado");
      return;
    }
    
    console.log("💾 Salvando NO HISTÓRICO...");
    console.log("📍 Location data:", locationData);
    
    const resultsData = {
      detectedLocation: locationData,
      motels: finalLocations,
      realLocations: initialLocations,
      savedAt: new Date().toISOString()
    };
    
    const updatedHistory = { ...(userProfile.investigation_history || {}), 'Localização': resultsData };
    
    await base44.entities.UserProfile.update(userProfile.id, {
      investigation_history: updatedHistory
    });
    
    // Invalidate and refetch user profile to get updated history
    queryClient.invalidateQueries(['userProfile', user?.email]);
    // The component will re-render with the new userProfile from the cache/refetch
    
    console.log("✅ SALVO NO HISTÓRICO!");
  };

  const createFallbackLocationsWithAddresses = async (lat, lon, cidade) => {
    const locations = [];
    const totalLocations = 24; 
    
    for (let i = 0; i < totalLocations; i++) {
      const randomLat = lat + (Math.random() - 0.5) * 0.08;
      const randomLon = lon + (Math.random() - 0.5) * 0.08;
      
      locations.push({
        lat: randomLat,
        lon: randomLon,
        tipo: "local",
        suspicious: false,
        needsGeocode: true,
        nome: "Carregando endereço..."
      });
    }
    
    for (let i = 0; i < locations.length; i++) {
      const loc = locations[i];
      
      if (i > 0) await new Promise(resolve => setTimeout(resolve, 500));
      
      const address = await getAddressFromCoords(loc.lat, loc.lon);
      loc.nome = address;
    }
    
    return locations;
  };

  const getAddressFromCoords = async (lat, lon) => {
    try {
      // ✅ AUMENTAR DELAY PARA 2.5 SEGUNDOS (EVITAR RATE LIMIT 429)
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'pt-BR,pt;q=0.9',
          }
        }
      );
      
      if (!response.ok) throw new Error('Geocoding failed');
      
      const data = await response.json();
      
      const address = data.address || {};
      const road = address.road || address.pedestrian || address.path || '';
      const houseNumber = address.house_number || '';
      const suburb = address.suburb || address.neighbourhood || '';
      const city = address.city || address.town || data.address.city_district || data.address.state || data.address.country || ''; // Added more fallbacks for city
      
      if (road) {
        return houseNumber ? `${road}, ${houseNumber}` : road;
      } else if (suburb) {
        return suburb;
      } else if (city) {
        return city;
      } else {
        // FALLBACK COM ENDEREÇO GENÉRICO
        const streetNames = ["Rua Principal", "Avenida Central", "Rua das Flores"];
        const randomStreet = streetNames[Math.floor(Math.random() * streetNames.length)];
        return `${randomStreet}, ${Math.floor(Math.random() * 1000)}`;
      }
    } catch (error) {
      console.warn('Erro ao buscar endereço:', error);
      // FALLBACK COM ENDEREÇO GENÉRICO
      const streetNames = ["Rua Principal", "Avenida Central", "Rua das Flores"];
      const randomStreet = streetNames[Math.floor(Math.random() * streetNames.length)];
      return `${randomStreet}, ${Math.floor(Math.random() * 1000)}`;
    }
  };

  const openDirections = (location) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lon}`;
    window.open(url, '_blank');
  };

  const handleStartInvestigation = async () => {
    playSound('click'); // Play click sound
    if (!userProfile || userProfile.credits < 60) {
      setAlertMessage("Créditos insuficientes! Você precisa de 60 créditos.");
      setShowAlertModal(true);
      return;
    }

    setLoading(true);

    const updatedCredits = userProfile.credits - 60;
    const updatedXp = userProfile.xp + 30;

    await base44.entities.UserProfile.update(userProfile.id, {
      credits: updatedCredits,
      xp: updatedXp
    });
    // Update cache directly
    updateUserProfileCache({ credits: updatedCredits, xp: updatedXp });

    const newInvestigation = await base44.entities.Investigation.create({
      service_name: "Localização",
      target_username: "Rastreamento GPS",
      status: "processing",
      progress: 1,
      estimated_days: 0,
      is_accelerated: false
    });
    
    // Set initial location progress and store in local storage
    setLocationProgress(1);
    localStorage.setItem(`location_progress_${newInvestigation.id}`, '1');

    setCreditsSpent(60);
    setXpGained(30);
    setShowCreditAlert(true);
    setTimeout(() => setShowCreditAlert(false), 3000);
    setLoading(false);
    
    await refetch(); // Refetch investigations to show the new one
  };

  const handleCancelInvestigation = async () => {
    playSound('trash'); // ✅ SOM ADICIONADO AQUI
    if (!activeLocationInvestigation) return;
    
    setConfirmModalConfig({
      title: "Cancelar Investigação?",
      message: "⚠️ Todos os dados desta investigação serão perdidos permanentemente, e os créditos gastos não serão reembolsados.",
      confirmText: "Sim, cancelar",
      cancelText: "Não, continuar",
      type: "danger",
      onConfirm: async () => {
        playSound('trash'); // ✅ SOM AO CONFIRMAR
        await base44.entities.Investigation.delete(activeLocationInvestigation.id);
        localStorage.removeItem(`location_progress_${activeLocationInvestigation.id}`);
        localStorage.removeItem(`accelerate_shown_${activeLocationInvestigation.id}`); // ✅ LIMPAR FLAG
        await queryClient.invalidateQueries(['investigations', user?.email]);
        setShowConfirmModal(false);
        hasPlayedComplete.current = false;
        navigate(createPageUrl("Dashboard"));
      }
    });
    setShowConfirmModal(true);
  };

  const handleDeleteInvestigation = async () => {
    playSound('trash'); // ✅ SOM ADICIONADO AQUI
    if (!completedLocationInvestigation) return;
    
    setConfirmModalConfig({
      title: "Apagar Espionagem?",
      message: "⚠️ Todos os dados desta investigação serão perdidos permanentemente, e os créditos gastos não serão reembolsados.",
      confirmText: "Sim, apagar",
      cancelText: "Cancelar",
      type: "danger",
      onConfirm: async () => {
        playSound('trash'); // ✅ SOM AO CONFIRMAR
        await base44.entities.Investigation.delete(completedLocationInvestigation.id);
        localStorage.removeItem(`location_progress_${completedLocationInvestigation.id}`);
        localStorage.removeItem(`accelerate_shown_${completedLocationInvestigation.id}`); // ✅ LIMPAR FLAG
        await queryClient.invalidateQueries(['investigations', user?.email]);
        
        setDetectedLocation(null);
        setMotels([]);
        setRealLocations([]);
        setShowMoreLocations(false);
        setRealTimeTracking(false);
        setRealTimeProgress(0);
        setDataLoaded(false);
        hasPlayedComplete.current = false;
        
        setShowConfirmModal(false);
        navigate(createPageUrl("Dashboard"));
      }
    });
    setShowConfirmModal(true);
  };

  const handleAccelerate = async () => {
    playSound('turbo');
    
    if (!activeLocationInvestigation || !userProfile || userProfile.credits < 30) {
      playSound('error');
      setAlertMessage("Créditos insuficientes! Você precisa de 30 créditos.");
      setShowAlertModal(true);
      return;
    }

    setAccelerating(true);
    setShowAccelerateButton(false);

    const updatedCredits = userProfile.credits - 30;
    const updatedXp = userProfile.xp + 20;

    await base44.entities.UserProfile.update(userProfile.id, {
      credits: updatedCredits,
      xp: updatedXp
    });
    updateUserProfileCache({ credits: updatedCredits, xp: updatedXp });

    // ✅ ACELERAR 55% (NÃO 17%)
    const boost = 55;
    const newLocalProgress = Math.min(100, locationProgress + boost);

    const localStorageKey = `location_progress_${activeLocationInvestigation.id}`;
    localStorage.setItem(localStorageKey, newLocalProgress.toString());
    setLocationProgress(newLocalProgress);

    await base44.entities.Investigation.update(activeLocationInvestigation.id, {
      progress: Math.min(100, activeLocationInvestigation.progress + boost),
      status: newLocalProgress >= 100 ? "completed" : "processing"
    });

    queryClient.setQueryData(['investigations', user?.email], (oldData) => {
      if (!oldData) return oldData;
      return oldData.map(inv => 
        inv.id === activeLocationInvestigation.id 
          ? { ...inv, progress: Math.min(100, inv.progress + boost), status: newLocalProgress >= 100 ? "completed" : "processing" }
          : inv
      );
    });
    
    setCreditsSpent(30);
    setXpGained(20);
    setShowCreditAlert(true);
    setTimeout(() => setShowCreditAlert(false), 3000);

    setAccelerating(false);
    
    if (newLocalProgress < 100) {
      setTimeout(() => setShowAccelerateButton(true), 5000);
    }
  };

  const handleBuyMoreLocations = async () => {
    if (!userProfile || userProfile.credits < 40) {
      setAlertMessage("Créditos insuficientes! Você precisa de 40 créditos.");
      setShowAlertModal(true);
      return;
    }

    const updatedCredits = userProfile.credits - 40;
    const updatedXp = userProfile.xp + 25;

    await base44.entities.UserProfile.update(userProfile.id, {
      credits: updatedCredits,
      xp: updatedXp
    });
    // Update cache directly
    updateUserProfileCache({ credits: updatedCredits, xp: updatedXp });
    
    setCreditsSpent(40);
    setXpGained(25);
    setShowCreditAlert(true);
    setTimeout(() => setShowCreditAlert(false), 3000);
    
    setShowMoreLocations(true);
  };

  const handleBuyRealTime = async () => {
    if (!userProfile || userProfile.credits < 40) {
      setAlertMessage("Créditos insuficientes! Você precisa de 40 créditos.");
      setShowAlertModal(true);
      return;
    }

    const updatedCredits = userProfile.credits - 40;
    const updatedXp = userProfile.xp + 30;

    await base44.entities.UserProfile.update(userProfile.id, {
      credits: updatedCredits,
      xp: updatedXp
    });
    // Update cache directly
    updateUserProfileCache({ credits: updatedCredits, xp: updatedXp });
    
    setCreditsSpent(40);
    setXpGained(30);
    setShowCreditAlert(true);
    setTimeout(() => setShowCreditAlert(false), 3000);
    
    setRealTimeTracking(true);
    setRealTimeProgress(1);
    setShowAccelerateRealTime(false);
  };

  const handleAccelerateRealTime = async () => {
    if (!userProfile || userProfile.credits < 25) {
      setAlertMessage("Créditos insuficientes! Você precisa de 25 créditos.");
      setShowAlertModal(true);
      return;
    }

    const updatedCredits = userProfile.credits - 25;
    const updatedXp = userProfile.xp + 20;

    await base44.entities.UserProfile.update(userProfile.id, {
      credits: updatedCredits,
      xp: updatedXp
    });
    // Update cache directly
    updateUserProfileCache({ credits: updatedCredits, xp: updatedXp });
    
    const newProgress = Math.min(100, realTimeProgress + 17);
    setRealTimeProgress(newProgress);
    
    setCreditsSpent(25);
    setXpGained(20);
    setShowCreditAlert(true);
    setTimeout(() => setShowCreditAlert(false), 3000);

    setShowAccelerateRealTime(false);
  };

  const getSteps = (progress) => {
    const steps = [
      { id: 1, text: "Iniciando rastreamento...", threshold: 0 },
      { id: 2, text: "Conectando ao celular alvo...", threshold: 1 },
      { id: 3, text: "Triangulando posição GPS...", threshold: 20 },
      { id: 4, text: "Mapeando locais frequentes...", threshold: 40 },
      { id: 5, text: "Identificando pontos suspeitos...", threshold: 60 },
      { id: 6, text: "Analisando padrões de movimento...", threshold: 80 },
      { id: 7, text: "Gerando relatório de localização...", threshold: 95 }
    ];

    return steps.map(step => ({
      ...step,
      completed: step.id === 1 ? progress >= 1 : progress > step.threshold + 10,
      active: step.id === 1 ? false : (progress >= step.threshold && progress <= step.threshold + 15)
    }));
  };

  const getEstimatedTime = (progress) => {
    if (progress >= 95) return "menos de 1 minuto";
    if (progress >= 80) return "2 minutos";
    if (progress >= 60) return "5 minutos";
    if (progress >= 30) return "10 minutos";
    return "20 minutos";
  };

  if (!user || userProfile === undefined) { // Check for undefined to ensure userProfile query has run
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF6B55]" />
      </div>
    );
  }

  if (activeLocationInvestigation) {
    // Use locationProgress for rendering the active investigation UI
    const progress = locationProgress;
    const showAccelerate = progress >= 1 && progress < 100 && showAccelerateButton;
    const steps = getSteps(progress);
    const estimatedTime = getEstimatedTime(progress);

    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-3 py-3 flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate(createPageUrl("Dashboard"))} className="h-9 px-3 hover:bg-gray-100" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Voltar
            </Button>
            <h1 className="text-base font-bold text-gray-900">Localização</h1>
            {userProfile && (
              <div className="flex items-center gap-1 bg-orange-50 rounded-full px-3 py-1 border border-orange-200">
                <Zap className="w-3 h-3 text-orange-500" />
                <span className="text-sm font-bold text-gray-900">{userProfile.credits}</span>
              </div>
            )}
          </div>
        </div>

        <div className="w-full max-w-2xl mx-auto p-3">
          <Card className="bg-white border-0 shadow-lg p-4 mb-3">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FF6B55] to-[#FF8F7A] flex items-center justify-center">
                <MapPin className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900">Rastreamento Ativo</h3>
                <p className="text-xs text-gray-600">Detectando localização...</p>
              </div>
              <Badge className="bg-orange-100 text-orange-700 border-0 flex-shrink-0">
                {progress}%
              </Badge>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div className="h-2 rounded-full transition-all duration-1000 bg-gradient-to-r from-[#FF6B55] to-[#FF8F7A]" style={{ width: `${progress}%` }}></div>
            </div>

            <div className="space-y-2">
              {steps.map(step => (
                <div key={step.id} className={`flex items-center gap-2 p-2 rounded-lg ${step.completed ? 'bg-green-50 border-l-2 border-green-500' : step.active ? 'bg-orange-50 border-l-4 border-orange-500' : 'opacity-40'}`}>
                  {step.completed ? <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" /> : step.active ? <Loader2 className="w-4 h-4 text-orange-600 flex-shrink-0 animate-spin" /> : <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />}
                  <p className={`text-xs font-medium ${step.completed ? 'text-green-900' : step.active ? 'text-gray-900' : 'text-gray-500'}`}>{step.text}</p>
                </div>
              ))}

              {progress < 100 && (
                <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded mt-3">
                  <p className="text-xs text-blue-900">
                    <span className="font-bold text-blue-900">⏳ Análise em andamento</span><br/>
                    Progresso: {progress}% • Tempo estimado: {estimatedTime}
                  </p>
                </div>
              )}

              {progress === 100 && (
                <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded mt-3">
                  <p className="text-xs text-green-900 font-bold">✓ Rastreamento concluído!</p>
                </div>
              )}
            </div>
            
            {progress < 100 && ( // Hide if investigation is completed
              <Button onClick={handleCancelInvestigation} variant="outline" className="w-full h-9 mt-3 text-red-600 border-red-300 hover:bg-red-50">
                Cancelar Investigação
              </Button>
            )}
          </Card>

          {showAccelerate && (
            <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-3 shadow-sm border border-orange-200 mt-3">
              <p className="text-center text-gray-600 text-xs mb-2">A análise está demorando...</p>
              <Button onClick={handleAccelerate} disabled={accelerating} className="w-full h-10 bg-gradient-to-r from-[#FF6B55] to-[#FF8F7A] hover:from-[#FF5544] hover:to-[#FF7E69] text-white font-semibold text-sm rounded-lg shadow-sm">
                {accelerating ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Acelerando...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Acelerar por 30 créditos
                  </div>
                )}
              </Button>
            </div>
          )}
        </div>

        {showCreditAlert && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-5 duration-300">
            <div className="bg-white rounded-xl shadow-2xl p-3 flex items-center gap-3 border border-gray-200 min-w-[280px]">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-2xl">💸</span>
                <div>
                  <p className="text-sm font-bold text-gray-900">Créditos gastos</p>
                  <p className="text-xs text-gray-600">-{creditsSpent} créditos | +{xpGained} XP</p>
                </div>
              </div>
              <button onClick={() => setShowCreditAlert(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (completedLocationInvestigation && detectedLocation) {
    const coordinates = [detectedLocation.lat, detectedLocation.lon];
    const potentialLocationsToReveal = motels.slice(realLocations.length);
    const extraLocations = showMoreLocations ? motels.slice(realLocations.length) : [];

    if (loadingLocations) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
          <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
            <div className="max-w-3xl mx-auto px-3 py-3 flex items-center justify-between">
              <Button variant="ghost" onClick={() => navigate(createPageUrl("Dashboard"))} className="h-9 px-3 hover:bg-gray-100" size="sm">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Voltar
              </Button>
              <h1 className="text-base font-bold text-gray-900">Localização</h1>
              {userProfile && (
                <div className="flex items-center gap-1 bg-orange-50 rounded-full px-3 py-1 border border-orange-200">
                  <Zap className="w-3 h-3 text-orange-500" />
                  <span className="text-sm font-bold text-gray-900">{userProfile.credits}</span>
                </div>
              )}
            </div>
          </div>

          <div className="w-full max-w-2xl mx-auto p-3">
            <div className="text-center mb-4">
              <h1 className="text-2xl font-bold text-[#2D3748] mb-1">📍 Rastreamento GPS</h1>
            </div>

            <Card className="bg-white border-0 shadow-md p-6 mb-3">
              <div className="flex flex-col items-center justify-center py-8">
                <div className="relative mb-6">
                  <div className="absolute inset-0 w-20 h-20 rounded-full bg-orange-200 animate-ping opacity-75"></div>
                  <div className="absolute inset-2 w-16 h-16 rounded-full bg-orange-300 animate-pulse"></div>
                  <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-[#FF6B55] to-[#FF8F7A] flex items-center justify-center">
                    <MapPin className="w-10 h-10 text-white animate-bounce" />
                  </div>
                </div>

                <h3 className="text-lg font-bold text-gray-900 mb-2">🔍 Analisando Região</h3>
                <p className="text-sm text-gray-600 text-center mb-4">
                  Mapeando locais frequentes próximos a {detectedLocation.cidade}...
                </p>

                <div className="w-full max-w-xs">
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div className="h-2 bg-gradient-to-r from-[#FF6B55] to-[#FF8F7A] rounded-full animate-loading-bar"></div>
                  </div>
                </div>

                <div className="mt-6 space-y-2 w-full">
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Loader2 className="w-4 h-4 text-orange-500 animate-spin" />
                    <span>Triangulando posição GPS...</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Loader2 className="w-4 h-4 text-orange-500 animate-spin" />
                    <span>Identificando estabelecimentos próximos...</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Loader2 className="w-4 h-4 text-orange-500 animate-spin" />
                    <span>Analisando padrões de frequência...</span>
                  </div>
                </div>
              </div>
            </Card>

            <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded">
              <p className="text-xs text-blue-900">
                ⏱️ <span className="font-bold">Aguarde alguns instantes</span><br/>
                Estamos buscando os locais mais relevantes na região
              </p>
            </div>
          </div>

          <style>{`
            @keyframes loading-bar {
              0% { width: 0%; }
              50% { width: 70%; }
              100% { width: 100%; }
            }
            .animate-loading-bar {
              animation: loading-bar 2s ease-in-out infinite;
            }
          `}</style>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-3 py-3 flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate(createPageUrl("Dashboard"))} className="h-9 px-3 hover:bg-gray-100" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Voltar
            </Button>
            <h1 className="text-base font-bold text-gray-900">Localização</h1>
            {userProfile && (
              <div className="flex items-center gap-1 bg-orange-50 rounded-full px-3 py-1 border border-orange-200">
                <Zap className="w-3 h-3 text-orange-500" />
                <span className="text-sm font-bold text-gray-900">{userProfile.credits}</span>
              </div>
            )}
          </div>
        </div>

        <div className="w-full max-w-2xl mx-auto p-3">
          <div className="text-center mb-4">
            <h1 className="text-2xl font-bold text-[#2D3748] mb-1">📍 Rastreamento GPS</h1>
          </div>

          <Card className="bg-white border-0 shadow-md p-4 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF6B55] to-[#FF8F7A] flex items-center justify-center">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Localização Detectada</p>
                <p className="text-base font-bold text-gray-900">
                  📍 {detectedLocation.cidade}{detectedLocation.estado ? `, ${detectedLocation.estado}` : ''}
                </p>
              </div>
            </div>
          </Card>

          <Card className="bg-white border-0 shadow-md overflow-hidden mb-3 relative">
            <div className="h-64 relative">
              <MapContainer center={coordinates} zoom={12} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                <MapUpdater center={coordinates} />
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
                {(showMoreLocations ? motels : realLocations).map((loc, idx) => (
                  <CircleMarker key={idx} center={[loc.lat, loc.lon]} radius={8} fillColor="#FF9800" fillOpacity={0.8} color="white" weight={2} />
                ))}
              </MapContainer>

              <div className="absolute top-3 left-3 right-3 z-[1000]">
                <div className="bg-white/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-[#FF6B55]/30">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-[#FF6B55] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-gray-900">⚠️ 24 localizações frequentes detectadas</p>
                      <p className="text-[10px] text-gray-600 mt-0.5">🔒 Alguns detalhes ocultos</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {!realTimeTracking ? (
            <Card className="bg-gradient-to-br from-[#FF6B55] to-[#FF8F7A] border-0 shadow-lg p-5 text-white mb-3">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Eye className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold mb-0.5">Rastrear em Tempo Real</h3>
                  <p className="text-xs text-white/90">Veja a localização ao vivo do celular</p>
                </div>
              </div>
              <Button onClick={handleBuyRealTime} className="w-full h-11 bg-white text-[#FF6B55] hover:bg-gray-50 font-bold text-sm rounded-xl shadow-md">
                Ativar Rastreamento - 40 créditos
              </Button>
            </Card>
          ) : (
            <Card className="bg-white border-0 shadow-md p-4 mb-3 relative overflow-hidden">
              <div className="absolute top-3 right-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <p className="text-xs text-green-600 font-medium">ONLINE</p>
              </div>

              <div className="mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="w-5 h-5 text-green-600" />
                  <h3 className="text-sm font-bold text-gray-900">Rastreamento em Tempo Real</h3>
                </div>
                <p className="text-xs text-gray-600">Localizando GPS em tempo real, isso pode demorar um pouco...</p>
              </div>

              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div className="h-2 rounded-full transition-all duration-1000 bg-gradient-to-r from-green-500 to-emerald-500" style={{ width: `${realTimeProgress}%` }} />
              </div>

              <p className="text-xs text-gray-600 mb-3">
                Progresso: {realTimeProgress}% • Tempo estimado: {realTimeProgress >= 90 ? '< 1 dia' : realTimeProgress >= 70 ? '1 dia' : realTimeProgress >= 50 ? '2 dias' : '3 dias'}
              </p>

              {showAccelerateRealTime && realTimeProgress < 100 && (
                <Button onClick={handleAccelerateRealTime} className="w-full h-10 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold text-sm rounded-lg">
                  <Zap className="w-4 h-4 mr-2" />
                  Acelerar por 25 créditos
                </Button>
              )}

              {realTimeProgress >= 100 && (
                <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded">
                  <p className="text-xs text-green-900 font-bold">✓ Rastreamento concluído! Localização atual disponível.</p>
                </div>
              )}
            </Card>
          )}

          {realLocations.length > 0 && (
            <Card className="bg-white border-0 shadow-md p-4 mb-3">
              <h3 className="text-sm font-bold text-gray-900 mb-3">📍 Locais Frequentes ({realLocations.length})</h3>
              
              <div className="space-y-2 mb-3">
                {realLocations.map((loc, index) => (
                  <div key={index} className="rounded-lg border-2 bg-white border-gray-200 p-3">
                    <p className="text-sm font-bold text-gray-900 mb-1">{loc.nome}</p>
                    <p className="text-xs text-gray-600">📍 Local frequente</p>
                  </div>
                ))}

                {showMoreLocations && extraLocations.map((loc, idx) => (
                  <div key={`extra-${idx}`} className="rounded-lg border-2 bg-white border-gray-200 p-3">
                    <p className="text-sm font-bold text-gray-900 mb-1">{loc.nome}</p>
                    <p className="text-xs text-gray-600">📍 Local frequente</p>
                  </div>
                ))}
              </div>

              {!showMoreLocations && potentialLocationsToReveal.length > 0 && (
                <Button onClick={handleBuyMoreLocations} variant="outline" className="w-full h-auto border-2 border-orange-300 hover:bg-orange-50 font-semibold text-sm rounded-xl p-4">
                  <div className="text-center w-full">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="text-lg">🔒</span>
                      <p className="text-sm font-bold text-gray-900">{potentialLocationsToReveal.length} locais ocultos</p>
                    </div>
                    <p className="text-xs text-gray-600 mb-3">Mais endereços frequentes detectados</p>
                    <div className="flex items-center justify-center gap-2 text-orange-600">
                      <span className="text-base font-bold">Revelar {potentialLocationsToReveal.length} lugares - 40 créditos</span>
                    </div>
                  </div>
                </Button>
              )}
            </Card>
          )}

          <Button onClick={handleDeleteInvestigation} variant="outline" className="w-full h-10 border border-red-200 text-red-600 hover:bg-red-50 font-medium text-sm rounded-xl">
            <div className="flex items-center gap-2">
              <span className="text-xs">✕</span>
              Apagar essa espionagem
            </div>
          </Button>
        </div>

        {showCreditAlert && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-5 duration-300">
            <div className="bg-white rounded-xl shadow-2xl p-3 flex items-center gap-3 border border-gray-200 min-w-[280px]">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-2xl">💸</span>
                <div>
                  <p className="text-sm font-bold text-gray-900">Créditos gastos</p>
                  <p className="text-xs text-gray-600">-{creditsSpent} créditos | +{xpGained} XP</p>
                </div>
              </div>
            <button onClick={() => setShowCreditAlert(false)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
        </div>
      )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-3 py-3 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(createPageUrl("Dashboard"))} className="h-9 px-3 hover:bg-gray-100" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Voltar
          </Button>
          <h1 className="text-base font-bold text-gray-900">Localização</h1>
          {userProfile && (
            <div className="flex items-center gap-1 bg-orange-50 rounded-full px-3 py-1 border border-orange-200">
              <Zap className="w-3 h-3 text-orange-500" />
              <span className="text-sm font-bold text-gray-900">{userProfile.credits}</span>
            </div>
          )}
        </div>
      </div>

      <div className="w-full max-w-2xl mx-auto p-3">
        <Card className="bg-white border-0 shadow-lg p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center mx-auto mb-4 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FF6B55] to-[#FF8F7A] flex items-center justify-center">
                <MapPin className="w-6 h-6 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">📍 Rastreamento GPS</h1>
            <p className="text-sm text-gray-600">Localize o celular do alvo em tempo real</p>
          </div>

          <div className="bg-orange-50 border-l-4 border-[#FF6B55] p-4 rounded-r mb-6">
            <p className="text-xs text-gray-700 leading-relaxed">
              <span className="font-bold text-[#FF6B55]">🔍 Como funciona:</span><br/>
              Nossa tecnologia rastreia o celular do alvo e mapeia locais frequentes, pontos suspeitos e padrões de movimento.
            </p>
          </div>

          <Button onClick={handleStartInvestigation} disabled={loading} className="w-full h-14 bg-gradient-to-r from-[#FF6B55] to-[#FF8F7A] hover:from-[#FF5544] hover:to-[#FF7E69] text-white font-bold text-base rounded-xl shadow-lg">
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Iniciando...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Iniciar Rastreamento - 60 Créditos
              </div>
            )}
          </Button>

          {userProfile && (
            <p className="text-xs text-center text-gray-600 mt-4">
              Você tem <span className="font-bold text-[#FF6B55]">{userProfile.credits}</span> créditos disponíveis
            </p>
          )}
        </Card>
      </div>

      {showCreditAlert && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-5 duration-300">
          <div className="bg-white rounded-xl shadow-2xl p-3 flex items-center gap-3 border border-gray-200 min-w-[280px]">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-2xl">💸</span>
              <div>
                <p className="text-sm font-bold text-gray-900">Créditos gastos</p>
                <p className="text-xs text-gray-600">-{creditsSpent} créditos | +{xpGained} XP</p>
                </div>
              </div>
            <button onClick={() => setShowCreditAlert(false)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showConfirmModal}
        onConfirm={confirmModalConfig.onConfirm}
        onCancel={() => setShowConfirmModal(false)}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
        confirmText={confirmModalConfig.confirmText}
        cancelText={confirmModalConfig.cancelText}
        type={confirmModalConfig.type}
      />

      <ConfirmModal
        isOpen={showAlertModal}
        onConfirm={() => {
          setShowAlertModal(false);
          navigate(createPageUrl("BuyCredits"));
        }}
        onCancel={() => setShowAlertModal(false)}
        title="Créditos Insuficientes"
        message={alertMessage}
        confirmText="Comprar Créditos"
        cancelText="Voltar"
        type="default"
      />
    </div>
  );
}
