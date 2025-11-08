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
import { useInvestigationTimer } from "@/hooks/useInvestigationTimer";
import { ensureTimer, getDurationForInvestigation, resetTimer, markCompleted } from "@/lib/progressManager";

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
  const [accelerating, setAccelerating] = useState(false);
  const [showMoreLocations, setShowMoreLocations] = useState(false);
  const [realTimeTracking, setRealTimeTracking] = useState(false);
  const [realTimeProgress, setRealTimeProgress] = useState(0);
  const [acceleratingRealTime, setAcceleratingRealTime] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  // Removed [progressUpdating, setProgressUpdating] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState({});
  const pendingDeleteIdRef = useRef(null);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const hasPlayedComplete = useRef(false); // Ref to track if completion sound has played
  const completionHandledRef = useRef(false);
  const realTimeIntervalRef = useRef(null);
  const [locationDetails, setLocationDetails] = useState(null);
  const [nearbyCities, setNearbyCities] = useState([]);
  const [nearbyMotels, setNearbyMotels] = useState([]);

  const GOOGLE_STREET_VIEW_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || import.meta.env.VITE_GOOGLE_STREET_VIEW_KEY || '';

  const getStreetViewImage = (lat, lon, name = '', city = '') => {
    if (!lat || !lon) return null;
    if (GOOGLE_STREET_VIEW_KEY) {
      const baseUrl = 'https://maps.googleapis.com/maps/api/streetview';
      const locationQuery = name
        ? `${name}${city ? ` ${city}` : ''}`
        : `${lat},${lon}`;
      const params = new URLSearchParams({
        size: '640x360',
        location: locationQuery,
        fov: '80',
        heading: '70',
        pitch: '0',
        source: 'outdoor',
        key: GOOGLE_STREET_VIEW_KEY
      });
      return `${baseUrl}?${params.toString()}`;
    }
    return 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=800&q=60';
  };

  const getUnlockStorageKey = (id) => `location_unlocks_${id}`;

  const persistUnlockState = (id, updates) => {
    if (!id) return;
    const key = getUnlockStorageKey(id);
    let current = {};
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        current = JSON.parse(stored) || {};
      }
    } catch (error) {
      console.warn("Erro ao ler unlock state da Localização:", error);
    }
    const merged = { ...current, ...updates };
    localStorage.setItem(key, JSON.stringify(merged));
  };

  const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
    const toRad = (value) => (value * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  };

  const formatDistance = (km) => {
    if (km < 1) {
      return `${Math.round(km * 1000)} m`;
    }
    return `${km.toFixed(1)} km`;
  };

  const fetchLocationDetails = async (lat, lon) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'pt-BR,pt;q=0.9'
          }
        }
      );

      if (!response.ok) return null;

      const data = await response.json();
      const address = data.address || {};

      return {
        neighborhood: address.suburb || address.neighbourhood || address.quarter || address.village || null,
        road: address.road || address.pedestrian || address.path || null,
        city: address.city || address.town || address.village || address.municipality || null,
        state: address.state || address.region || null
      };
    } catch (error) {
      console.warn('Não foi possível obter detalhes do endereço:', error);
      return null;
    }
  };

  const fetchNearbyCities = async (lat, lon) => {
    const radius = 50000;
    const overpassQuery = `[out:json][timeout:15];(
      node["place"="city"](around:${radius},${lat},${lon});
      node["place"="town"](around:${radius},${lat},${lon});
    );out body 20;`;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const data = await response.json();

      if (!data.elements) return [];

      const unique = new Map();
      data.elements.forEach((city) => {
        const name = city.tags?.name;
        if (!name || unique.has(name.toLowerCase())) return;
        const distance = calculateDistanceKm(lat, lon, city.lat, city.lon);
        unique.set(name.toLowerCase(), {
          name,
          distance,
        });
      });

      return Array.from(unique.values())
        .filter(city => city.distance <= 50)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 6);
    } catch (error) {
      console.warn('Não foi possível buscar cidades próximas:', error);
      return [];
    }
  };

  const motelFallbackImagePool = [
    'https://images.unsplash.com/photo-1496417263034-38ec4f0b665a?auto=format&fit=crop&w=1280&q=60',
    'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1280&q=60',
    'https://images.unsplash.com/photo-1528909514045-2fa4ac7a08ba?auto=format&fit=crop&w=1280&q=60',
    'https://images.unsplash.com/photo-1505691723518-36a5ac3be353?auto=format&fit=crop&w=1280&q=60',
    'https://images.unsplash.com/photo-1621330019960-d1574fef6e0f?auto=format&fit=crop&w=1280&q=60',
  ];

  const getMotelImage = async (motel) => {
    if (!motel?.name) return null;
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(motel.name)}%20${encodeURIComponent(motel.city || '')}&inputtype=textquery&fields=photos&key=${GOOGLE_STREET_VIEW_KEY}`
      );
      const data = await response.json();
      const photoRef = data?.candidates?.[0]?.photos?.[0]?.photo_reference;
      if (photoRef) {
        return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1280&photoreference=${photoRef}&key=${GOOGLE_STREET_VIEW_KEY}`;
      }
    } catch (error) {
      console.warn('Falha ao buscar foto real do estabelecimento:', error);
    }
    return null;
  };

  const buildFallbackMotels = async (lat, lon, cidade, estado, neighborhood = null) => {
    const sampleMotels = [
      {
        name: 'Motel Miragem Premium',
        address: neighborhood ? `${neighborhood}, ${cidade}` : `${cidade} - ${estado}`,
        description: 'Suítes temáticas com hidromassagem e garagem privativa.',
      },
      {
        name: 'Sensations Motel & Spa',
        address: `Região Metropolitana de ${cidade}`,
        description: 'Pacotes com pernoite, spa aromático e café da manhã exclusivo.',
      },
      {
        name: 'Lux Garden Motel',
        address: `Rodovia acesso ${cidade}, KM 08`,
        description: 'Suítes com teto panorâmico e piscina aquecida individual.',
      },
    ];

    const result = [];
    for (let index = 0; index < sampleMotels.length; index++) {
      const motel = sampleMotels[index];
      const jitterLat = lat + (Math.random() - 0.5) * 0.05;
      const jitterLon = lon + (Math.random() - 0.5) * 0.05;
      const baseData = {
        ...motel,
        distance: formatDistance((index + 1) * 4.8),
        lat: jitterLat,
        lon: jitterLon,
        city: cidade,
        categoria: 'motel',
      };
      let imageUrl = getStreetViewImage(jitterLat, jitterLon, motel.name, cidade);
      if (!imageUrl && GOOGLE_STREET_VIEW_KEY) {
        imageUrl = await getMotelImage({ ...baseData, name: motel.name });
      }
      baseData.imageUrl = imageUrl || motelFallbackImagePool[index % motelFallbackImagePool.length];
      result.push(baseData);
    }

    for (const motel of result) {
      try {
        const details = await fetchLocationDetails(motel.lat, motel.lon);
        if (details?.city) {
          motel.city = details.city;
        }
        if (details?.road) {
          motel.address = details.road;
        }
      } catch (error) {
        // ignore errors
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
    }

    return result;
  };

  const fetchNearbyMotels = async (lat, lon, cidade, estado, neighborhood = null) => {
    const radius = 50000;
    const overpassQuery = `[out:json][timeout:20];(
      node["amenity"="love_hotel"](around:${radius},${lat},${lon});
      node["amenity"="motel"](around:${radius},${lat},${lon});
    );out body 20;`;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const data = await response.json();

      if (!data.elements || data.elements.length === 0) {
        return await buildFallbackMotels(lat, lon, cidade, estado, neighborhood);
      }

      const unique = [];
      const namesSeen = new Set();
      data.elements.forEach((item) => {
        const name = item.tags?.name;
        const motelLat = item.lat || item.center?.lat;
        const motelLon = item.lon || item.center?.lon;
        const amenity = item.tags?.amenity;
        const originalName = name && name.trim();
        let placeName = originalName;
        const baseCity = item.tags?.['addr:city'] || item.tags?.city || item.tags?.town || item.tags?.village || cidade;
        if (!placeName) {
          const streetName = item.tags?.['addr:street'] || item.tags?.street;
          placeName = streetName ? `Motel confidencial ${streetName}` : `Motel confidencial em ${baseCity || 'região'}`;
        }
        const baseKey = placeName.toLowerCase();
        let uniqueKey = baseKey;
        let suffix = 2;
        while (namesSeen.has(uniqueKey)) {
          uniqueKey = `${baseKey} #${suffix++}`;
        }
        if (suffix > 2) {
          placeName = `${placeName} (${suffix - 1})`;
        }
        if (!motelLat || !motelLon) return;
        if (amenity !== 'love_hotel' && amenity !== 'motel') return;
        namesSeen.add(uniqueKey);
        const distanceKm = calculateDistanceKm(lat, lon, motelLat, motelLon);
        const rawCity = baseCity || item.tags?.municipality || item.tags?.['is_in:city'];
        const street = item.tags?.['addr:street'] || item.tags?.street;
        const houseNumber = item.tags?.['addr:housenumber'] || item.tags?.housenumber;
        const baseAddress = street ? `${street}${houseNumber ? `, ${houseNumber}` : ''}` : (item.tags?.address || item.tags?.addr_full || item.tags?.addr_street || rawCity);
        unique.push({
          name: placeName,
          address: baseAddress || cidade,
          distance: formatDistance(distanceKm),
          description: item.tags?.description || 'Suítes reservadas com garagem privativa e acesso discreto.',
          lat: motelLat,
          lon: motelLon,
          city: rawCity || cidade,
          categoria: 'motel',
        });
      });

      for (let i = 0; i < unique.length && i < 6; i++) {
        const motel = unique[i];
        if (!motel.city || motel.city.toLowerCase() === (cidade || '').toLowerCase()) {
          try {
            const details = await fetchLocationDetails(motel.lat, motel.lon);
            if (details?.city) {
              motel.city = details.city;
            }
            if (details?.road) {
              motel.address = details.road;
            }
          } catch (error) {
            // ignore
          }
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
      }

      const enriched = [];
      const limited = unique.slice(0, 6);
      for (let index = 0; index < limited.length; index++) {
        const motel = limited[index];
        let imageUrl = getStreetViewImage(motel.lat, motel.lon, motel.name, motel.city);
        if (!imageUrl && GOOGLE_STREET_VIEW_KEY) {
          imageUrl = await getMotelImage(motel);
        }
        enriched.push({
          ...motel,
          imageUrl: imageUrl || motelFallbackImagePool[index % motelFallbackImagePool.length],
        });
      }

      return enriched.length > 0 ? enriched : await buildFallbackMotels(lat, lon, cidade, estado, neighborhood);
    } catch (error) {
      console.warn('Não foi possível buscar motéis próximos:', error);
      return await buildFallbackMotels(lat, lon, cidade, estado, neighborhood);
    }
  };

  const hydrateLocationContext = async (location) => {
    if (!location) {
      return { details: null, cities: [], motels: [] };
    }

    const details = await fetchLocationDetails(location.lat, location.lon);
    setLocationDetails(details);

    const [cities, motelsList] = await Promise.all([
      fetchNearbyCities(location.lat, location.lon),
      fetchNearbyMotels(location.lat, location.lon, location.cidade, location.estado, details?.neighborhood),
    ]);

    setNearbyCities(cities);
    setNearbyMotels(motelsList);

    return { details, cities, motels: motelsList };
  };

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

  const {
    progress: timerProgress,
    canAccelerate,
    accelerate: accelerateTimer,
  } = useInvestigationTimer({ service: "Localização", investigation: activeLocationInvestigation });

  const completedLocationInvestigation = investigations.find(
    inv => inv.service_name === "Localização" && (inv.status === "completed" || inv.status === "accelerated")
  );

  const showAccelerateButton = Boolean(activeLocationInvestigation) && canAccelerate && !accelerating && timerProgress > 0 && timerProgress < 100;

  useEffect(() => {
    const currentId = activeLocationInvestigation?.id || completedLocationInvestigation?.id;
    if (!currentId) {
      setShowMoreLocations(false);
      setRealTimeTracking(false);
      setRealTimeProgress(0);
      setLocationDetails(null);
      setNearbyCities([]);
      setNearbyMotels([]);
      return;
    }

    try {
      const stored = localStorage.getItem(getUnlockStorageKey(currentId));
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (typeof parsed.showMoreLocations === 'boolean') {
        setShowMoreLocations(parsed.showMoreLocations);
      }
      if (typeof parsed.realTimeTracking === 'boolean') {
        setRealTimeTracking(parsed.realTimeTracking);
      }
      if (typeof parsed.realTimeProgress === 'number') {
        setRealTimeProgress(parsed.realTimeProgress);
      }
    } catch (error) {
      console.warn("Erro ao restaurar unlocks da Localização:", error);
    }
  }, [activeLocationInvestigation?.id, completedLocationInvestigation?.id]);

  useEffect(() => {
    const currentId = activeLocationInvestigation?.id || completedLocationInvestigation?.id;

    if (!realTimeTracking || realTimeProgress >= 100 || !currentId) {
      if (realTimeIntervalRef.current) {
        clearInterval(realTimeIntervalRef.current);
        realTimeIntervalRef.current = null;
      }
      if (realTimeProgress >= 100) {
        persistUnlockState(currentId, { realTimeProgress: 100 });
      }
      return () => {};
    }

    if (realTimeIntervalRef.current) {
      clearInterval(realTimeIntervalRef.current);
    }

    realTimeIntervalRef.current = setInterval(() => {
      setRealTimeProgress((prev) => {
        if (prev >= 100) {
          clearInterval(realTimeIntervalRef.current);
          realTimeIntervalRef.current = null;
          persistUnlockState(currentId, { realTimeProgress: 100 });
          return 100;
        }

        const increment = Math.floor(Math.random() * 9) + 8; // 8 a 16%
        const next = Math.min(100, prev + increment);
        persistUnlockState(currentId, { realTimeProgress: next });
        if (next >= 100) {
          clearInterval(realTimeIntervalRef.current);
          realTimeIntervalRef.current = null;
        }
        return next;
      });
    }, 90000);

    return () => {
      if (realTimeIntervalRef.current) {
        clearInterval(realTimeIntervalRef.current);
        realTimeIntervalRef.current = null;
      }
    };
  }, [realTimeTracking, realTimeProgress, activeLocationInvestigation?.id, completedLocationInvestigation?.id]);

  // Helper to update userProfile in react-query cache
  const updateUserProfileCache = (changes) => {
    queryClient.setQueryData(['userProfile', user?.email], (oldProfiles) => {
      if (!oldProfiles || oldProfiles.length === 0) return oldProfiles;
      const oldProfile = oldProfiles[0];
      const newProfile = { ...oldProfile, ...changes };
      return [newProfile];
    });
  };

  const updateLayoutProfileCache = (changes) => {
    queryClient.setQueryData(['layoutUserProfile', user?.email], (oldProfile) => {
      if (!oldProfile) return oldProfile;
      return { ...oldProfile, ...changes };
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
        setLocationDetails(savedResults.locationDetails || null);
        setNearbyCities(savedResults.nearbyCities || []);
        setNearbyMotels(savedResults.nearbyMotels || []);
        if ((!savedResults.nearbyCities || savedResults.nearbyCities.length === 0) && savedResults.detectedLocation?.lat && savedResults.detectedLocation?.lon) {
          hydrateLocationContext(savedResults.detectedLocation);
        }
      } else {
        // If completed, but no saved data, something is wrong, force a re-detection
        detectLocation();
      }
      
      setDataLoaded(true);
    };
    
    loadData();
  }, [completedLocationInvestigation?.id, user?.email, userProfile, dataLoaded]); // Added userProfile to dependencies

  useEffect(() => {
    if (!activeLocationInvestigation) {
      hasPlayedComplete.current = false;
      completionHandledRef.current = false;
      return;
    }

    if (timerProgress >= 100 && !completionHandledRef.current) {
      completionHandledRef.current = true;

      (async () => {
        try {
          await base44.entities.Investigation.update(activeLocationInvestigation.id, {
            progress: 100,
            status: "completed",
          });

          markCompleted({ service: "Localização", id: activeLocationInvestigation.id });
          playSound('complete');
          hasPlayedComplete.current = true;
          queryClient.invalidateQueries({ queryKey: ['investigations', user?.email] });
          await refetch();
        } catch (error) {
          console.error("Erro ao finalizar investigação de Localização:", error);
          completionHandledRef.current = false;
        }
      })();
    }
  }, [timerProgress, activeLocationInvestigation?.id, queryClient, refetch, user?.email]);

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
          const contextExtras = await hydrateLocationContext(location);
          await fetchNearbyLocations(location.lat, location.lon, location.cidade, location, contextExtras);
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
    const fallbackExtras = await hydrateLocationContext(fallback);
    await fetchNearbyLocations(fallback.lat, fallback.lon, fallback.cidade, fallback, fallbackExtras);
  };

  const fetchNearbyLocations = async (lat, lon, cidade, locationData, contextExtras = {}) => {
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
        `node["amenity"="fuel"]["name"](around:${radius},${lat},${lon});`,
        `node["leisure"="fitness_centre"]["name"](around:${radius},${lat},${lon});`,
        `node["tourism"="attraction"]["name"](around:${radius},${lat},${lon});`
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
          .map(place => {
            const tags = place.tags || {};
            const cityTag =
              tags['addr:city'] ||
              tags.city ||
              tags.town ||
              tags.village ||
              tags.municipality ||
              cidade;

            const street =
              tags['addr:street'] ||
              tags.street ||
              tags.road ||
              '';
            const houseNumber =
              tags['addr:housenumber'] ||
              tags.housenumber ||
              '';

            return {
              nome: tags.name,
              lat: place.lat,
              lon: place.lon,
              tipo: tags.amenity || tags.shop || tags.leisure || tags.tourism || "local",
              suspicious: false,
              needsGeocode: false,
              cidade: cityTag,
              city: cityTag,
              bairro: tags['addr:suburb'] || tags.suburb || null,
              endereco: street ? `${street}${houseNumber ? `, ${houseNumber}` : ''}` : undefined,
              categoria: tags.amenity || tags.shop || tags.leisure || tags.tourism || "outros",
            };
          });

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
          
          await saveToUserHistory(finalLocations, initialLocations, locationData, contextExtras);
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
    
    await saveToUserHistory(finalLocations, initialLocations, locationData, contextExtras);
  };

  const saveToUserHistory = async (finalLocations, initialLocations, locationData, contextExtras = {}) => {
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
      savedAt: new Date().toISOString(),
      locationDetails: contextExtras.details ?? locationDetails,
      nearbyCities: contextExtras.cities ?? nearbyCities,
      nearbyMotels: contextExtras.motels ?? nearbyMotels
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

  const fallbackCategories = [
    { tipo: 'shopping', label: 'Shopping center', searchTerm: 'shopping' },
    { tipo: 'praça', label: 'Praça movimentada', searchTerm: 'praça' },
    { tipo: 'restaurante', label: 'Restaurante reservado', searchTerm: 'restaurante' },
    { tipo: 'hotel', label: 'Hotel executivo', searchTerm: 'hotel' },
    { tipo: 'clinica', label: 'Clínica estética', searchTerm: 'clínica estética' },
    { tipo: 'coworking', label: 'Coworking', searchTerm: 'coworking' },
    { tipo: 'posto', label: 'Posto de combustível', searchTerm: 'posto 24h' },
  ];

  const computeSeed = (value) => {
    if (typeof value === 'number') {
      return value;
    }
    if (!value) return 0;
    const str = String(value);
    let hash = 0;
    for (let i = 0; i < str.length; i += 1) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0; // Keep 32 bits
    }
    return hash || str.length;
  };

  const seededRandomInt = (min, max, seedSource) => {
    const seedValue = computeSeed(seedSource);
    const normalized = Math.abs(Math.sin(seedValue) * 10000) % 1;
    return Math.floor(normalized * (max - min + 1)) + min;
  };

  const pickBySeed = (list, seedSource) => {
    if (!list || list.length === 0) return null;
    const seedValue = computeSeed(seedSource);
    const normalized = Math.abs(Math.sin(seedValue) + seedValue * 0.0001);
    return list[Math.floor(normalized * 1000) % list.length];
  };

  const hotspotNarratives = {
    shopping: [
      'Monitoramentos apontaram passagens rápidas pelo local em horários variados.',
      'Deslocamentos até este ponto costumam acontecer próximos ao fim do expediente.',
      'O aparelho costuma permanecer poucos minutos na área comercial antes de seguir viagem.',
    ],
    restaurante: [
      'Chegadas registradas em turnos noturnos chamam atenção para o endereço.',
      'O alvo costuma chegar ao restaurante e seguir para outra região logo em seguida.',
      'Aparelho detectado em reservas desse endereço em diferentes dias da semana.',
    ],
    praça: [
      'Espaço utilizado como ponto de parada antes de novos deslocamentos.',
      'O aparelho costuma aguardar alguns minutos na praça e, então, seguir rota semelhante.',
      'O local aparece como ponto intermediário em trajetos reiterados.',
    ],
    hotel: [
      'Visita registrada recentemente com permanência acima da média para hospedagens rápidas.',
      'Este endereço surge como destino quando o aparelho se desloca em horários incomuns.',
      'Lugar monitorado por ser utilizado em deslocamentos noturnos recorrentes.',
    ],
    clinica: [
      'Endereço cadastrado nas rotas mesmo fora de horários convencionais.',
      'Visitas ao local aparecem como parte de trajetos breves e discretos.',
      'Aparelho permanece por poucos minutos e retorna à mesma região de origem.',
    ],
    coworking: [
      'Destinos relacionados a reuniões surgem como pontos de atenção na vigília.',
      'Paradas em ambiente corporativo aparecem combinadas com deslocamentos mais longos.',
      'Local é usado como ponte entre dois bairros em monitoramentos seguidos.',
    ],
    posto: [
      'Parada rápida identificada em monitoramentos recentes de deslocamento.',
      'O endereço é recorrente como ponto de abastecimento ou encontro breve.',
      'Trânsito pelo posto acontece principalmente em rotas de madrugada.',
    ],
    default: [
      'Deslocamento monitorado aparece como parte de rotas repetidas pelo alvo.',
      'Endereço marcado como ponto de atenção devido à frequência detectada.',
      'Registro incluído no relatório por surgir em diferentes investigações deste período.',
    ],
  };

  const motelNarratives = [
    'Estadia recente vinculada ao aparelho monitorado chamou atenção para este endereço.',
    'Local aparece como destino preferencial em deslocamentos noturnos observados.',
    'Registro do aparelho indica permanência superior ao padrão em suítes deste motel.',
    'Deslocamentos até o motel ocorrem em horários reservados, reforçando o alerta.',
    'O endereço figura entre os principais pontos de sigilo mapeados pelo painel.',
  ];

  const timeframeNarratives = [
    'Última visita há poucos dias.',
    'Visita recente registrada há algumas semanas.',
    'Último deslocamento para este ponto ocorreu há cerca de 3 meses.',
    'Registro antigo: última presença há bastante tempo.',
    'Retorno detectado neste mês após período de silêncio.',
    'Frequência reduzida: última passagem identificada no trimestre anterior.',
    'Presença confirmada dias antes da suspeita inicial.',
  ];

  const hotspotMetaConfig = [
    {
      keywords: ['shopping', 'mall'],
      icon: '🛍️',
      badge: 'Frequência alta',
      tone: 'bg-violet-50 border-violet-200 text-violet-700',
      narrativeKey: 'shopping',
    },
    {
      keywords: ['praça', 'park'],
      icon: '🌳',
      badge: 'Ponto recorrente',
      tone: 'bg-emerald-50 border-emerald-200 text-emerald-700',
      narrativeKey: 'praça',
    },
    {
      keywords: ['restaurant', 'restaurante', 'bar', 'cafe'],
      icon: '🍷',
      badge: 'Encontro noturno',
      tone: 'bg-rose-50 border-rose-200 text-rose-700',
      narrativeKey: 'restaurante',
    },
    {
      keywords: ['hotel'],
      icon: '🏨',
      badge: 'Visita fora do padrão',
      tone: 'bg-slate-50 border-slate-200 text-slate-700',
      narrativeKey: 'hotel',
    },
    {
      keywords: ['clinica', 'hospital'],
      icon: '🩺',
      badge: 'Agendamento incomum',
      tone: 'bg-cyan-50 border-cyan-200 text-cyan-700',
      narrativeKey: 'clinica',
    },
    {
      keywords: ['coworking', 'office'],
      icon: '💼',
      badge: 'Reunião sigilosa',
      tone: 'bg-blue-50 border-blue-200 text-blue-700',
      narrativeKey: 'coworking',
    },
    {
      keywords: ['posto', 'fuel'],
      icon: '⛽️',
      badge: 'Parada rápida',
      tone: 'bg-amber-50 border-amber-200 text-amber-700',
      narrativeKey: 'posto',
    },
  ];

  const defaultHotspotMeta = {
    icon: '📍',
    badge: 'Monitoramento ativo',
    tone: 'bg-gray-50 border-gray-200 text-gray-700',
    narrativeKey: 'default',
  };

  const buildNarrativeForLocation = (location) => {
    const meta = getLocationMeta(location);
    const seedSource = `${location.nome || location.name || ''}_${location.lat || 0}_${location.lon || 0}`;
    const key = meta.narrativeKey || 'default';
    const pool =
      key === 'motel'
        ? motelNarratives
        : hotspotNarratives[key] || hotspotNarratives.default;
    const narrative = pickBySeed(pool, seedSource);
    const timeframe = pickBySeed(timeframeNarratives, `${seedSource}_time`);
    return { narrative, timeframe, meta };
  };

  const getLocationMeta = (location) => {
    if (location?.categoria === 'motel' || location?.tipo === 'motel') {
      return {
        icon: '💋',
        badge: (loc) => `Motel em ${loc?.city || loc?.cidade || detectedLocation?.cidade || 'cidade próxima'}`,
        tone: 'bg-rose-50 border-rose-200 text-rose-700',
        narrativeKey: 'motel',
      };
    }

    const tipo = (location?.tipo || location?.categoria || '').toLowerCase();
    const nome = (location?.nome || '').toLowerCase();

    for (const meta of hotspotMetaConfig) {
      if (meta.keywords.some((keyword) => tipo.includes(keyword) || nome.includes(keyword))) {
        return meta;
      }
    }

    return defaultHotspotMeta;
  };

  const searchPlacesWithNominatim = async (lat, lon, keyword, limit = 6) => {
    const delta = 0.18; // ~20km
    const viewbox = [
      (lon - delta).toFixed(6),
      (lat + delta).toFixed(6),
      (lon + delta).toFixed(6),
      (lat - delta).toFixed(6),
    ].join(',');

    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=${limit}&bounded=1&viewbox=${viewbox}&extratags=1&accept-language=pt-BR&q=${encodeURIComponent(keyword)}`;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'InstalkerPanel/1.0 (contact@instalker.app)',
        },
      });
      if (!response.ok) throw new Error(`status ${response.status}`);
      const data = await response.json();
      return data.map((item) => {
        const addr = item.address || {};
        const street =
          addr.road ||
          addr.pedestrian ||
          addr.path ||
          addr.street ||
          addr.highway ||
          null;
        const houseNumber = addr.house_number || null;
        const neighborhood =
          addr.suburb ||
          addr.neighbourhood ||
          addr.quarter ||
          addr.village ||
          null;
        const city =
          addr.city ||
          addr.town ||
          addr.village ||
          addr.municipality ||
          addr.city_district ||
          addr.state ||
          null;

        const primaryName = item.display_name
          ? item.display_name.split(',')[0].trim()
          : (item.namedetails?.name || null);

        let addressLabel = '';
        if (street) {
          addressLabel = `${street}${houseNumber ? `, ${houseNumber}` : ''}`;
        } else if (neighborhood) {
          addressLabel = neighborhood;
        } else if (city) {
          addressLabel = city;
        } else if (item.display_name) {
          addressLabel = item.display_name.split(',').slice(1, 3).join(', ').trim();
        }

        return {
          nome: primaryName || keyword,
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
          endereco: addressLabel || null,
          cidade: city,
        };
      });
    } catch (error) {
      console.warn(`Nominatim search falhou (${keyword}):`, error);
      return [];
    }
  };

  const createFallbackLocationsWithAddresses = async (lat, lon, cidade) => {
    const desiredCount = 24;
    const collected = [];
    const namesSeen = new Set();

    for (const category of fallbackCategories) {
      const searchTerm = category.searchTerm || `${category.label} ${cidade}`;
      const results = await searchPlacesWithNominatim(lat, lon, searchTerm, 6);

      for (const place of results) {
        const key = `${(place.nome || '').toLowerCase()}|${place.lat.toFixed(5)}|${place.lon.toFixed(5)}`;
        if (namesSeen.has(key)) continue;
        namesSeen.add(key);

        collected.push({
          lat: place.lat,
          lon: place.lon,
          tipo: category.tipo,
          categoria: category.tipo,
          suspicious: false,
          needsGeocode: false,
          nome: place.nome || category.label,
          nome: place.nome || category.label,
          cidade: place.cidade || cidade,
          endereco: place.endereco || null,
        });

        if (collected.length >= desiredCount) break;
      }

      if (collected.length >= desiredCount) break;
      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    if (collected.length < desiredCount) {
      console.warn('Fallback ainda insuficiente, completando com coordenadas aleatórias.');
      const remaining = desiredCount - collected.length;
      for (let i = 0; i < remaining; i++) {
        const randomLat = lat + (Math.random() - 0.5) * 0.05;
        const randomLon = lon + (Math.random() - 0.5) * 0.05;
        const category = fallbackCategories[(collected.length + i) % fallbackCategories.length];

        const geocode = await getAddressFromCoords(randomLat, randomLon);
        collected.push({
          lat: randomLat,
          lon: randomLon,
          tipo: category.tipo,
          categoria: category.tipo,
          suspicious: false,
          needsGeocode: false,
          nome: geocode?.name || category.label,
          cidade: geocode?.city || cidade,
          endereco: geocode?.address || null,
        });

        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    }

    return collected.slice(0, desiredCount);
  };

  const getDirectionsUrl = (location) => {
    if (!location) return '#';
    const name = location.nome || location.name || location.title;
    const city = location.city || location.cidade || locationDetails?.city || detectedLocation?.cidade;
    if (name) {
      const query = encodeURIComponent(`${name}${city ? ` ${city}` : ''}`);
      return `https://www.google.com/maps/search/?api=1&query=${query}`;
    }
    if (location.lat && location.lon) {
      return `https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lon}`;
    }
    return '#';
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
      const road = address.road || address.pedestrian || address.path || address.highway || '';
      const houseNumber = address.house_number || '';
      const suburb = address.suburb || address.neighbourhood || address.quarter || '';
      const city =
        address.city ||
        address.town ||
        address.village ||
        address.municipality ||
        address.city_district ||
        address.state ||
        '';

      const placeName = data.name || (data.display_name ? data.display_name.split(',')[0] : null);

      let formattedAddress = '';
      if (road) {
        formattedAddress = houseNumber ? `${road}, ${houseNumber}` : road;
      } else if (suburb) {
        formattedAddress = suburb;
      } else if (city) {
        formattedAddress = city;
      } else if (placeName) {
        formattedAddress = placeName;
      } else {
        const streetNames = ["Rua Principal", "Avenida Central", "Rua das Flores"];
        const randomStreet = streetNames[Math.floor(Math.random() * streetNames.length)];
        formattedAddress = `${randomStreet}, ${Math.floor(Math.random() * 1000)}`;
      }

      return {
        address: formattedAddress,
        name: placeName,
        city: city || null,
      };
    } catch (error) {
      console.warn('Erro ao buscar endereço:', error);
      const streetNames = ["Rua Principal", "Avenida Central", "Rua das Flores"];
      const randomStreet = streetNames[Math.floor(Math.random() * streetNames.length)];
      return {
        address: `${randomStreet}, ${Math.floor(Math.random() * 1000)}`,
        name: null,
        city: null,
      };
    }
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
    updateLayoutProfileCache({ credits: updatedCredits, xp: updatedXp });

    const newInvestigation = await base44.entities.Investigation.create({
      service_name: "Localização",
      target_username: "Rastreamento GPS",
      status: "processing",
      progress: 1,
      estimated_days: 0,
      is_accelerated: false,
      created_by: user?.email || ''
    });

    ensureTimer({
      service: "Localização",
      id: newInvestigation.id,
      durationMs: getDurationForInvestigation(newInvestigation),
      startAt: Date.now(),
    });
    localStorage.removeItem(getUnlockStorageKey(newInvestigation.id));

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
        resetTimer({ service: "Localização", id: activeLocationInvestigation.id });
        localStorage.removeItem(`location_unlocks_${activeLocationInvestigation.id}`);
        await queryClient.invalidateQueries(['investigations', user?.email]);
        setShowConfirmModal(false);
        hasPlayedComplete.current = false;
        navigate(createPageUrl("Dashboard"));
      }
    });
    setShowConfirmModal(true);
  };

  const handleConfirmDeleteById = async (investigationId) => {
    if (!investigationId) return;

    try {
      playSound('trash');
      await base44.entities.Investigation.delete(investigationId);
      resetTimer({ service: "Localização", id: investigationId });
      localStorage.removeItem(`location_unlocks_${investigationId}`);
      await queryClient.invalidateQueries(['investigations', user?.email]);

      if (pendingDeleteIdRef.current === investigationId) {
        pendingDeleteIdRef.current = null;
      }

      setDetectedLocation(null);
      setMotels([]);
      setRealLocations([]);
      setShowMoreLocations(false);
      setRealTimeTracking(false);
      setRealTimeProgress(0);
      setLocationDetails(null);
      setNearbyCities([]);
      setNearbyMotels([]);
      setDataLoaded(false);
      hasPlayedComplete.current = false;
      if (realTimeIntervalRef.current) {
        clearInterval(realTimeIntervalRef.current);
        realTimeIntervalRef.current = null;
      }

      setShowConfirmModal(false);
      navigate(createPageUrl("Dashboard"));
    } catch (error) {
      console.error("Erro ao apagar espionagem de Localização:", error);
      setShowConfirmModal(false);
    }
  };

  const handleDeleteInvestigation = async () => {
    playSound('trash'); // ✅ SOM ADICIONADO AQUI
    if (!completedLocationInvestigation) return;

    pendingDeleteIdRef.current = completedLocationInvestigation.id;

    setConfirmModalConfig({
      title: "Apagar Espionagem?",
      message: "⚠️ Todos os dados desta investigação serão perdidos permanentemente, e os créditos gastos não serão reembolsados.",
      confirmText: "Sim, apagar",
      cancelText: "Cancelar",
      type: "danger",
      onConfirm: () => handleConfirmDeleteById(completedLocationInvestigation.id)
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
 
    const updatedCredits = userProfile.credits - 30;
    const updatedXp = userProfile.xp + 20;
 
    await base44.entities.UserProfile.update(userProfile.id, {
      credits: updatedCredits,
      xp: updatedXp
    });
    updateUserProfileCache({ credits: updatedCredits, xp: updatedXp });
    updateLayoutProfileCache({ credits: updatedCredits, xp: updatedXp });
 
    const boost = Math.floor(Math.random() * 11) + 20; // 20% - 30%
    const newProgress = accelerateTimer(boost);

    await base44.entities.Investigation.update(activeLocationInvestigation.id, {
      progress: newProgress,
      status: newProgress >= 100 ? "completed" : "processing"
    });
 
    queryClient.setQueryData(['investigations', user?.email], (oldData) => {
      if (!oldData) return oldData;
      return oldData.map(inv => 
        inv.id === activeLocationInvestigation.id ? { ...inv, progress: newProgress, status: newProgress >= 100 ? "completed" : "processing" } : inv
      );
    });
 
    setCreditsSpent(30);
    setXpGained(20);
    setShowCreditAlert(true);
    setTimeout(() => setShowCreditAlert(false), 3000);

    setAccelerating(false);
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
    updateLayoutProfileCache({ credits: updatedCredits, xp: updatedXp });
    
    setCreditsSpent(40);
    setXpGained(25);
    setShowCreditAlert(true);
    setTimeout(() => setShowCreditAlert(false), 3000);
    
    setShowMoreLocations(true);
    const currentId = activeLocationInvestigation?.id || completedLocationInvestigation?.id;
    persistUnlockState(currentId, { showMoreLocations: true });
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
    updateLayoutProfileCache({ credits: updatedCredits, xp: updatedXp });
    
    setCreditsSpent(40);
    setXpGained(30);
    setShowCreditAlert(true);
    setTimeout(() => setShowCreditAlert(false), 3000);
    
    setRealTimeTracking(true);
    setRealTimeProgress(1);
    const currentId = activeLocationInvestigation?.id || completedLocationInvestigation?.id;
    persistUnlockState(currentId, {
      realTimeTracking: true,
      realTimeProgress: 1,
    });
  };

  const handleAccelerateRealTime = async () => {
    if (!userProfile || userProfile.credits < 30) {
      setAlertMessage("Créditos insuficientes! Você precisa de 30 créditos.");
      setShowAlertModal(true);
      return;
    }

    setAcceleratingRealTime(true);

    try {
      const updatedCredits = userProfile.credits - 30;
      const updatedXp = userProfile.xp + 25;

      await base44.entities.UserProfile.update(userProfile.id, {
        credits: updatedCredits,
        xp: updatedXp
      });
      // Update cache directly
      updateUserProfileCache({ credits: updatedCredits, xp: updatedXp });
      updateLayoutProfileCache({ credits: updatedCredits, xp: updatedXp });

      const boost = Math.floor(Math.random() * 11) + 20; // 20-30%
      const newProgress = Math.min(100, Math.round((realTimeProgress || 0) + boost));
      setRealTimeProgress(newProgress);

      setCreditsSpent(30);
      setXpGained(25);
      setShowCreditAlert(true);
      setTimeout(() => setShowCreditAlert(false), 3000);

      const currentId = activeLocationInvestigation?.id || completedLocationInvestigation?.id;
      persistUnlockState(currentId, {
        realTimeProgress: newProgress,
      });
    } finally {
      setAcceleratingRealTime(false);
    }
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
    const progress = timerProgress;
    const showAccelerate = showAccelerateButton;
    const steps = getSteps(progress);
    const estimatedTime = getEstimatedTime(progress);

    return (
      <>
      <div className="min-h-screen bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
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
      </>
    );
  }

  if (completedLocationInvestigation && detectedLocation) {
    const coordinates = [detectedLocation.lat, detectedLocation.lon];
    const additionalHotspots = motels.slice(realLocations.length);
    const potentialLocationsToReveal = additionalHotspots;
    const displayedHotspots = showMoreLocations ? [...realLocations, ...additionalHotspots] : realLocations;
    const displayedMotels = showMoreLocations ? nearbyMotels : nearbyMotels.slice(0, 2);
    const additionalMotelsLocked = Math.max(0, nearbyMotels.length - displayedMotels.length);
    const totalHiddenSpots = potentialLocationsToReveal.length + additionalMotelsLocked;
    const isRealTimeComplete = realTimeTracking && realTimeProgress >= 100;

    const cityInsightMap = new Map();
    const registerCity = (cityName, category, loc) => {
      if (!cityName) return;
      const normalized = cityName.toLowerCase();
      const entry = cityInsightMap.get(normalized) || { name: cityName, motels: 0, hotspots: 0, total: 0, distanceKm: null };
      entry.total += 1;
      if (category === 'motel') entry.motels += 1;
      if (category === 'hotspot') entry.hotspots += 1;
      if (loc && loc.lat && loc.lon && detectedLocation) {
        const distance = calculateDistanceKm(detectedLocation.lat, detectedLocation.lon, loc.lat, loc.lon);
        if (!entry.distanceKm || distance < entry.distanceKm) {
          entry.distanceKm = distance;
        }
      }
      cityInsightMap.set(normalized, entry);
    };

    [...realLocations, ...additionalHotspots].forEach((loc) =>
      registerCity(loc.cidade || loc.city || detectedLocation.cidade, 'hotspot', loc)
    );
    nearbyMotels.forEach((motel) =>
      registerCity(motel.city || detectedLocation.cidade, 'motel', motel)
    );

    let cityInsights = Array.from(cityInsightMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map((entry) => {
        const summaryParts = [];
        if (entry.motels > 0) summaryParts.push(`${entry.motels} ${entry.motels === 1 ? 'local suspeito' : 'locais suspeitos'}`);
        if (entry.hotspots > 0) summaryParts.push(`${entry.hotspots} ${entry.hotspots === 1 ? 'deslocamento suspeito' : 'deslocamentos suspeitos'}`);
        return {
          name: entry.name,
          summary: summaryParts.join(' • '),
        };
      });

    if (cityInsights.length < 5 && nearbyCities?.length) {
      const seenCities = new Set(cityInsights.map((city) => city.name.toLowerCase()));
      for (const city of nearbyCities) {
        if (seenCities.has(city.name.toLowerCase())) continue;
        const randomCount = seededRandomInt(1, 10, city.name);
        cityInsights.push({
          name: city.name,
          summary: `${randomCount} ${randomCount === 1 ? 'local suspeito monitorado' : 'locais suspeitos monitorados'}`,
        });
        seenCities.add(city.name.toLowerCase());
        if (cityInsights.length >= 5) break;
      }
    }

    if (loadingLocations) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-[#FFF8F3] via-[#FFF5ED] to-[#FFEEE0]">
          <div className="w-full max-w-2xl mx-auto p-3">
            <div className="text-center mb-4">
              <h1 className="text-2xl font-bold text-[#2D3748] mb-1"></h1>
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

                <h3 className="text-lg font-bold text-gray-900 mb-2">🔍 Analisando Localização</h3>
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
                    <span>Identificando locais suspeitos...</span>
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
      <>
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

        <div className="w-full max-w-2xl mx-auto p-4">
          <div className="text-center mb-2">
          </div>

          <Card className="bg-white border-0 shadow-md p-4 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF6B55] to-[#FF8F7A] flex items-center justify-center">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Última localização detectada:</p>
                <p className="text-base font-bold text-gray-900">
                  {detectedLocation.cidade}{detectedLocation.estado ? `, ${detectedLocation.estado}` : ''}
                </p>
              </div>
            </div>
          </Card>

          <Card className="bg-white border-0 shadow-md overflow-hidden mb-3 relative">
            <div className="h-64 relative">
              <MapContainer
                center={coordinates}
                zoom={12}
                scrollWheelZoom={false}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
                attributionControl={false}
              >
                <MapUpdater center={coordinates} />
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy;' />
                {(showMoreLocations ? motels : realLocations).map((loc, idx) => (
                  <CircleMarker key={idx} center={[loc.lat, loc.lon]} radius={8} fillColor="#FF9800" fillOpacity={0.8} color="white" weight={2} />
                ))}
              </MapContainer>

              <div className="absolute top-3 left-3 right-3 z-[1000]">
                <div className="bg-white/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-[#FF6B55]/30">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-[#FF6B55] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-gray-900"> Localizações suspeitas encontradas</p>
                      <p className="text-[12px] text-gray-600 mt-0.5">Veja alguns locais no mapa abaixo:</p>
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
                <div className={`w-2 h-2 rounded-full ${isRealTimeComplete ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`}></div>
                <p className={`text-xs font-medium ${isRealTimeComplete ? 'text-red-600' : 'text-green-600'}`}>
                  {isRealTimeComplete ? 'OFFLINE' : 'ONLINE'}
                </p>
              </div>

              <div className="mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="w-5 h-5 text-green-600" />
                  <h3 className="text-sm font-bold text-gray-900">Rastreamento em Tempo Real</h3>
                </div>
                <p className="text-xs text-gray-600">
                  {isRealTimeComplete
                    ? 'O aparelho interrompeu o envio de coordenadas. Aguardando nova ativação.'
                    : 'Localizando GPS em tempo real, isso pode demorar um pouco...'}
                </p>
              </div>

              {!isRealTimeComplete && (
                <>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div className="h-2 rounded-full transition-all duration-1000 bg-gradient-to-r from-green-500 to-emerald-500" style={{ width: `${realTimeProgress}%` }} />
                  </div>

                  <p className="text-xs text-gray-600 mb-3">
                    Progresso: {realTimeProgress}% • Tempo estimado: {realTimeProgress >= 90 ? '< 1 hora' : realTimeProgress >= 70 ? '2 horas' : realTimeProgress >= 50 ? '4 horas' : '6 horas'}
                  </p>
                </>
              )}

              {realTimeProgress < 100 && (
                <Button
                  onClick={handleAccelerateRealTime}
                  disabled={acceleratingRealTime}
                  className="w-full h-10 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold text-sm rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {acceleratingRealTime ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Aplicando aceleração...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      Acelerar por 30 créditos
                    </div>
                  )}
                </Button>
              )}

              {isRealTimeComplete && (
                <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded">
                  <p className="text-xs text-red-700 font-bold">Erro: Dispositivo offline ou GPS desativado.</p>
                  <p className="text-[11px] text-red-600 mt-1">
                    O aparelho espionado está com o GPS desativado ou sem conexão com a internet. A última localização rastreada foi em {detectedLocation?.cidade || 'área monitorada'}. <br></br>
                    Assim que o aparelho reconectar à internet, o rastreamento retomará automaticamente.
                  </p>
                </div>
              )}
            </Card>
          )}

          {realLocations.length > 0 && (
            <Card className="bg-white border-0 shadow-md p-4 mb-3">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-[17px] font-bold text-gray-900">📍 Localizações Encontradas</h3>
                  <p className="text-[13px] text-gray-500">Locais suspeitos onde o alvo possa ter passado.</p>
                </div>
    
              </div>

              <div className="space-y-3">
                {[...displayedHotspots, ...displayedMotels].map((loc, index) => {
                  const { meta, narrative, timeframe } = buildNarrativeForLocation(loc);
                  const badgeLabel = typeof meta.badge === 'function' ? meta.badge(loc) : meta.badge;
                  const cityLabel = loc.cidade || loc.city || detectedLocation.cidade;
                  return (
                    <div key={`location-${index}`} className="rounded-xl border border-gray-200 p-3 shadow-sm hover:border-orange-200 transition">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xl">{meta.icon}</span>
                            <p className="text-[15px] font-semibold text-gray-900">{loc.nome}</p>
                          </div>
                          {loc.endereco && (
                            <p className="text-[13px] text-gray-500">{loc.endereco}</p>
                          )}
                          {cityLabel && (
                            <p className="text-[13px] text-gray-500 mt-1">
                              <span className="font-semibold text-gray-700">{cityLabel}</span>
                            </p>
                          )}
                          {loc.categoria === 'motel' && loc.description && (
                            <p className="text-[13px] text-gray-500 mt-2">{loc.description}</p>
                          )}
                        </div>
                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[13px] font-semibold ${meta.tone}`}>
                          {meta.icon} {badgeLabel}
                        </div>
                      </div>
                      <p className="text-[13px] text-gray-600 mt-2">{narrative}</p>
                      <p className="text-[12px] text-gray-400 mt-1">{timeframe}</p>
                      <a
                        href={getDirectionsUrl(loc.categoria === 'motel' ? { ...loc, nome: loc.nome || loc.name } : loc)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-3 text-xs font-medium text-gray-400 hover:text-gray-500"
                      >
                        <span className="text-sm">↗</span>
                        Ver localização
                      </a>
                    </div>
                  );
                })}
              </div>

              {!showMoreLocations && totalHiddenSpots > 0 && (
                <Button onClick={handleBuyMoreLocations} variant="outline" className="w-full h-auto border-2 border-orange-300 hover:bg-orange-50 font-semibold text-sm rounded-xl p-4 mt-4">
                  <div className="text-center w-full">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="text-[15px]"></span>
                      <p className="text-sm font-bold text-gray-900">+ {totalHiddenSpots} locais suspeitos encontrados... </p>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-orange-600">
                      <span className="text-base font-bold">Desbloquear por 40 créditos</span>
                    </div>
                  </div>
                </Button>
              )}
            </Card>
          )}

          {cityInsights.length > 0 && (
            <Card className="bg-white border-0 shadow-md p-4 mb-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[17px] font-bold text-gray-900">📊 Dados por cidades</h3>
              </div>
              <div className="space-y-2">
                {cityInsights.map((entry, idx) => (
                  <div key={`city-${idx}`} className="rounded-xl border border-gray-200 p-3 flex items-start gap-3 bg-gray-50/60">
                    <div className="text-xl leading-none pt-0.5">📍</div>
                    <div>
                      <p className="text-[15px] font-semibold text-gray-900">{entry.name}</p>
                      <p className="text-[13px] text-gray-600">{entry.summary || 'Monitoramento ativo na região.'}</p>
                    </div>
                  </div>
                ))}
              </div>
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
      </>
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
        <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-[#FFE7D7] via-white to-[#FFDCCA] p-6 rounded-3xl">
          <div className="absolute -right-20 -top-24 w-52 h-52 bg-[#FFB59E]/40 rounded-full blur-3xl"></div>
          <div className="absolute -left-16 bottom-0 w-44 h-44 bg-[#FFE0D2]/60 rounded-full blur-3xl"></div>

          <div className="relative z-10 space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-14 h-14 rounded-2xl bg-white shadow-lg flex items-center justify-center">
                <MapPin className="w-7 h-7 text-[#FF6B55]" />
              </div>
              <div className="flex-1">
                <h1 className="text-xl font-extrabold text-gray-900 tracking-tight leading-tight">
                  Veja por onde ele(a) anda.
                </h1>
                <p className="text-sm text-gray-600 leading-relaxed"> Localize o celular do alvo em tempo real

                 
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl bg-white/95 border border-[#FFB59E]/40 p-5 shadow-sm space-y-4">
                <div>
                  <p className="text-[13px] font-bold text-[#FF6B55] flex items-center gap-2">
                    <span>🔍</span> Como funciona
                  </p>
                  <p className="mt-2 text-[13px] text-gray-700 leading-relaxed">
                    Nossa tecnologia rastreia o celular do alvo e mapeia locais frequentes, pontos suspeitos e padrões de movimento.
                  </p>
                </div>
                <div>
                  <p className="text-[13px] font-bold text-[#FF6B55] flex items-center gap-2">
                    <span>🔒</span> Confidencial para você
                  </p>
                  <p className="mt-2 text-[13px] text-gray-700 leading-relaxed">
                    Nenhum alerta é enviado para o aparelho monitorado. Você recebe todo o relatório aqui, no painel.
                  </p>
                </div>
              </div>

            </div>

            <Button
              onClick={handleStartInvestigation}
              disabled={loading}
              className="w-full h-14 bg-gradient-to-r from-[#FF6B55] to-[#FF8F7A] hover:from-[#FF5544] hover:to-[#FF7E69] text-white font-bold text-base rounded-xl shadow-lg"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Preparando monitoramento...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Iniciar Rastreamento - 60 créditos
                </div>
              )}
            </Button>

            {userProfile && (
              <p className="text-xs text-center text-gray-600">
              </p>
            )}
          </div>
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

