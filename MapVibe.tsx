import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { db, auth } from '../firebase';
import { collection, onSnapshot, query, where, limit, getDocs, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { UserProfile, MapPing } from '../types';
import { Search, Map as MapIcon, Layers, Navigation, Crosshair, Send, X, ZoomIn, UserPlus, MessageCircle, Plane, MapPin, Radio, Zap, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { cn, handleQuotaError } from '../lib/utils';

// Fix for default marker icons
const markerIcon = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
const markerShadow = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface MapVibeProps {
  onProfileClick: (id: string) => void;
  onDirectChat: (id: string) => void;
  addToHistory: (type: 'search' | 'view', targetId?: string, query?: string) => void;
}

export interface MapVibeHandle {
  flyToUser: (lat: number, lng: number, userId: string) => void;
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

function MapEvents({ onDoubleClick, onClick, isPingMode }: { onDoubleClick: (lat: number, lng: number) => void, onClick: (lat: number, lng: number) => void, isPingMode: boolean }) {
  const map = useMap();
  useEffect(() => {
    const handleDblClick = (e: any) => {
      if (!isPingMode) onDoubleClick(e.latlng.lat, e.latlng.lng);
    };
    const handleClick = (e: any) => {
      if (isPingMode) onClick(e.latlng.lat, e.latlng.lng);
    };

    map.on('dblclick', handleDblClick);
    map.on('click', handleClick);
    
    return () => {
      map.off('dblclick', handleDblClick);
      map.off('click', handleClick);
    };
  }, [map, onDoubleClick, onClick, isPingMode]);
  return null;
}

const MapVibe = forwardRef<MapVibeHandle, MapVibeProps>(({ onProfileClick, onDirectChat, addToHistory }, ref) => {
  const [center, setCenter] = useState<[number, number]>([31.5204, 74.3587]); // Default to Lahore
  const [zoom, setZoom] = useState(13);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [pings, setPings] = useState<MapPing[]>([]);
  const [mapType, setMapType] = useState<'normal' | 'satellite' | 'hybrid'>('normal');
  const [searchQuery, setSearchQuery] = useState('');
  const [showMapControls, setShowMapControls] = useState(false);
  const [showDiscoverMobile, setShowDiscoverMobile] = useState(false);
  const [isPingMode, setIsPingMode] = useState(false);
  const mapRef = useRef<L.Map | null>(null);

  useImperativeHandle(ref, () => ({
    flyToUser: (lat: number, lng: number, userId: string) => {
      zoomToUser(lat, lng, userId);
    }
  }));

  useEffect(() => {
    // Get current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCenter([pos.coords.latitude, pos.coords.longitude]);
        },
        (err) => console.error(err)
      );
    }

    // Fetch users periodically instead of onSnapshot to save quota
    const fetchUsers = async () => {
      try {
        const q = query(
          collection(db, 'users'), 
          where('showOnMap', '==', true),
          limit(50)
        );
        const snap = await getDocs(q);
        const usersData = snap.docs.map(doc => doc.data() as UserProfile);
        setUsers(usersData);
      } catch (err) {
        handleQuotaError(err, 'MapVibe Users Fetch');
      }
    };

    fetchUsers();
    const usersInterval = setInterval(fetchUsers, 120000); // Update users every 2 minutes

    // Subscribe to pings - Keep this live but limited
    const pingsQ = query(
      collection(db, 'mapPings'),
      orderBy('timestamp', 'desc'),
      limit(10)
    );
    const unsubscribePings = onSnapshot(pingsQ, (snap) => {
      const pingsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MapPing));
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      setPings(pingsData.filter(p => new Date(p.timestamp).getTime() > fiveMinutesAgo));
    }, (err) => {
      if (err.code !== 'resource-exhausted') {
        console.error('Pings error:', err);
      }
    });

    // Cleanup old pings from state every minute
    const cleanupInterval = setInterval(() => {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      setPings(prev => prev.filter(p => new Date(p.timestamp).getTime() > fiveMinutesAgo));
    }, 60000);

    return () => {
      clearInterval(usersInterval);
      clearInterval(cleanupInterval);
      unsubscribePings();
    };
  }, []);

  const handleMapDoubleClick = async (lat: number, lng: number) => {
    // Default double click behavior or custom
  };

  const handleMapClick = async (lat: number, lng: number) => {
    if (!isPingMode || !auth.currentUser) return;
    
    const user = users.find(u => u.uid === auth.currentUser?.uid);
    if (!user) return;

    try {
      await addDoc(collection(db, 'mapPings'), {
        uid: auth.currentUser.uid,
        username: user.username,
        photoURL: user.photoURL,
        lat,
        lng,
        timestamp: new Date().toISOString(),
        type: 'ping'
      });
      toast.success('Ping dropped!');
      setIsPingMode(false);
    } catch (err) {
      console.error('Error dropping ping:', err);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${searchQuery}`);
      const data = await res.json();
      if (data.length > 0) {
        setCenter([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
        setZoom(19); // Zoom to roof level
        
        // Add to history
        addToHistory('search', undefined, searchQuery);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getTileUrl = () => {
    switch (mapType) {
      case 'satellite':
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      case 'hybrid':
        return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'; // Hybrid usually needs multiple layers, simplifying for now
      default:
        return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    }
  };

  const createCustomIcon = (photoURL: string, isOnline: boolean) => {
    return L.divIcon({
      className: 'custom-div-icon',
      html: `
        <div class="relative group">
          <div class="w-14 h-14 rounded-full border-[3px] ${isOnline ? 'border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.5)]' : 'border-white shadow-xl'} overflow-hidden bg-white transition-all duration-500 group-hover:scale-110">
            <img src="${photoURL}" class="w-full h-full object-cover" />
          </div>
          <div class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-neutral-400'}"></div>
        </div>
      `,
      iconSize: [56, 56],
      iconAnchor: [28, 56],
      popupAnchor: [0, -56]
    });
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    if (d < 1) return `${(d * 1000).toFixed(0)}m away`;
    return `${d.toFixed(1)}km away`;
  };

  const zoomToUser = (lat: number, lng: number, userId: string) => {
    if (mapRef.current) {
      mapRef.current.flyTo([lat, lng], 19, {
        duration: 2.5,
        easeLinearity: 0.25
      });
      
      // Auto-open popup after zoom
      setTimeout(() => {
        mapRef.current?.eachLayer((layer: any) => {
          if (layer instanceof L.Marker && (layer.options as any).userId === userId) {
            layer.openPopup();
          }
        });
      }, 2700);
    }
  };

  return (
    <div className="relative h-full w-full">
      {/* Search Bar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-md px-4 sm:top-6">
        <form onSubmit={handleSearch} className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4 sm:w-5 sm:h-5 group-focus-within:text-blue-600 transition-colors" />
          <input
            type="text"
            placeholder="Search city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/95 backdrop-blur-xl border border-white/20 rounded-2xl sm:rounded-full py-3 sm:py-4 pl-10 sm:pl-12 pr-6 shadow-2xl focus:ring-2 focus:ring-blue-500 transition-all outline-none font-bold text-xs sm:text-sm"
          />
        </form>
      </div>

      {/* Map Controls */}
      <div className="absolute top-20 right-4 z-[1000] flex flex-col gap-2 sm:top-6 sm:right-6 sm:gap-3">
        <div className="bg-white/95 backdrop-blur-xl p-1.5 sm:p-2 rounded-2xl shadow-2xl border border-white/20 flex flex-col gap-1.5 sm:gap-2">
          <button 
            onClick={() => setMapType('normal')}
            className={cn("p-2 sm:p-3 rounded-xl transition", mapType === 'normal' ? "bg-blue-600 text-white" : "text-neutral-500 hover:bg-neutral-100")}
            title="Normal Map"
          >
            <MapIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button 
            onClick={() => setMapType('satellite')}
            className={cn("p-2 sm:p-3 rounded-xl transition", mapType === 'satellite' ? "bg-blue-600 text-white" : "text-neutral-500 hover:bg-neutral-100")}
            title="Satellite View"
          >
            <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button 
            onClick={() => setIsPingMode(!isPingMode)}
            className={cn("p-2 sm:p-3 rounded-xl transition", isPingMode ? "bg-orange-500 text-white animate-pulse" : "text-neutral-500 hover:bg-neutral-100")}
            title="Drop a Ping"
          >
            <Radio className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button 
            onClick={() => {
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition((pos) => {
                  setCenter([pos.coords.latitude, pos.coords.longitude]);
                  if (mapRef.current) mapRef.current.flyTo([pos.coords.latitude, pos.coords.longitude], 19);
                });
              }
            }}
            className="p-2 sm:p-3 text-neutral-500 hover:bg-neutral-100 rounded-xl transition"
            title="My Location"
          >
            <Crosshair className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button 
            onClick={() => setShowDiscoverMobile(!showDiscoverMobile)}
            className={cn("p-2 sm:p-3 rounded-xl transition lg:hidden", showDiscoverMobile ? "bg-blue-600 text-white" : "text-neutral-500 hover:bg-neutral-100")}
            title="Discover Nearby"
          >
            <Navigation className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      {/* Mobile Discover Overlay */}
      <AnimatePresence>
        {showDiscoverMobile && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-20 left-4 right-4 z-[1000] lg:hidden"
          >
            <div className="bg-white/95 backdrop-blur-xl p-6 rounded-[2.5rem] shadow-2xl border border-white/40 overflow-hidden">
              <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="text-sm font-black tracking-tighter text-neutral-900 uppercase">Discover Nearby</h3>
                <button onClick={() => setShowDiscoverMobile(false)} className="p-1 hover:bg-neutral-100 rounded-full transition">
                  <X className="w-4 h-4 text-neutral-400" />
                </button>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                {users.slice(0, 15).map((user) => (
                  <div 
                    key={user.uid}
                    className="flex flex-col items-center gap-3 bg-neutral-50 p-4 rounded-[2rem] shadow-sm border border-neutral-100 min-w-[140px] hover:bg-blue-50 transition-all group"
                  >
                    <div className="relative" onClick={() => onProfileClick(user.uid)}>
                      <img src={user.photoURL} alt={user.username} className="w-20 h-20 rounded-[1.5rem] object-cover shadow-md group-hover:scale-105 transition-transform" />
                      {user.isOnline && <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white"></div>}
                    </div>
                    <div className="text-center w-full">
                      <p className="text-xs font-black text-neutral-900 truncate">{user.username}</p>
                      <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest truncate">{user.profession}</p>
                    </div>
                    <div className="flex gap-1 w-full">
                      <button 
                        onClick={() => onProfileClick(user.uid)}
                        className="flex-1 py-2 bg-white border border-neutral-200 text-neutral-900 text-[9px] font-black rounded-xl hover:bg-neutral-50 transition"
                      >
                        Profile
                      </button>
                      {user.location && (
                        <button 
                          onClick={() => zoomToUser(user.location!.lat, user.location!.lng, user.uid)}
                          className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition"
                          title="Zoom to User"
                        >
                          <ZoomIn className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <MapContainer 
        center={center} 
        zoom={zoom} 
        className="h-full w-full z-0" 
        zoomControl={false}
        ref={mapRef as any}
        maxZoom={19}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url={getTileUrl()}
        />
        <MapUpdater center={center} />
        <MapEvents onDoubleClick={handleMapDoubleClick} onClick={handleMapClick} isPingMode={isPingMode} />
        <ZoomControl position="bottomright" />

        {/* Render Pings */}
        {pings.map((ping) => (
          <Marker
            key={ping.id}
            position={[ping.lat, ping.lng]}
            icon={L.divIcon({
              className: 'ping-icon',
              html: `
                <div class="relative flex items-center justify-center">
                  <div class="absolute w-12 h-12 bg-blue-500/30 rounded-full animate-ping"></div>
                  <div class="absolute w-8 h-8 bg-blue-500/50 rounded-full animate-pulse"></div>
                  <div class="relative w-10 h-10 rounded-2xl border-2 border-white shadow-xl overflow-hidden bg-white">
                    <img src="${ping.photoURL}" class="w-full h-full object-cover" />
                  </div>
                  <div class="absolute -top-8 bg-black/80 text-white text-[9px] font-black px-2 py-1 rounded-lg whitespace-nowrap backdrop-blur-sm border border-white/20">
                    ${ping.username} pinged!
                  </div>
                </div>
              `,
              iconSize: [40, 40],
              iconAnchor: [20, 20]
            })}
          />
        ))}

        {users.filter(u => u.uid !== auth.currentUser?.uid).map((user) => (
          user.location && (
            <Marker 
              key={user.uid} 
              position={[user.location.lat, user.location.lng]}
              icon={createCustomIcon(user.photoURL, user.isOnline)}
              {...({ userId: user.uid } as any)}
            >
              <Popup className="custom-popup">
                <div className="p-2 min-w-[220px]">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="relative">
                      <img src={user.photoURL} alt={user.username} className="w-14 h-14 rounded-2xl object-cover border-2 border-blue-500 shadow-lg" />
                      <div className={cn("absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white", user.isOnline ? "bg-green-500" : "bg-neutral-400")}></div>
                    </div>
                    <div>
                      <p className="font-black text-neutral-900 leading-tight text-base">{user.username}</p>
                      <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest mb-1">{user.profession}</p>
                      <div className="flex items-center gap-1 text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full w-fit">
                        <MapPin className="w-2.5 h-2.5" />
                        {calculateDistance(center[0], center[1], user.location.lat, user.location.lng)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <button 
                      onClick={() => onProfileClick(user.uid)}
                      className="flex items-center justify-center gap-2 py-2.5 bg-neutral-900 text-white text-[10px] font-black rounded-xl hover:bg-neutral-800 transition uppercase tracking-wider"
                    >
                      <MapIcon className="w-3 h-3" /> Profile
                    </button>
                    <button 
                      onClick={() => onDirectChat(user.uid)}
                      className="flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white text-[10px] font-black rounded-xl hover:bg-blue-700 transition uppercase tracking-wider shadow-lg shadow-blue-100"
                    >
                      <MessageCircle className="w-3 h-3" /> Message
                    </button>
                  </div>
                  
                  <button 
                    onClick={() => onProfileClick(user.uid)}
                    className="w-full py-2.5 bg-white border border-neutral-200 text-neutral-900 text-[10px] font-black rounded-xl hover:bg-neutral-50 transition flex items-center justify-center gap-2 uppercase tracking-wider"
                  >
                    <UserPlus className="w-3 h-3" /> Add Friend
                  </button>

                  <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between">
                    <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">Exact Location</p>
                    <button 
                      onClick={() => zoomToUser(user.location!.lat, user.location!.lng, user.uid)}
                      className="text-blue-600 hover:text-blue-700 transition"
                    >
                      <Plane className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          )
        ))}
      </MapContainer>
    </div>
  );
});

export default MapVibe;
