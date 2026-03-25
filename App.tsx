import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc, serverTimestamp, addDoc, collection, updateDoc, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { Toaster, toast } from 'sonner';
import { UserProfile, HistoryItem } from './types';
import { cn } from './lib/utils';
import { Map, Users, Shuffle, MessageSquare, User as UserIcon, Settings as SettingsIcon, X } from 'lucide-react';

// Components
import SplashScreen from './components/SplashScreen';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import MapVibe, { MapVibeHandle } from './components/MapVibe';
import RightSidebar from './components/RightSidebar';
import AuthModal from './components/AuthModal';
import SignupFlow from './components/SignupFlow';
import ProfilePage from './components/ProfilePage';
import ChatInbox from './components/ChatInbox';
import ActiveUsers from './components/ActiveUsers';
import RandomProfiles from './components/RandomProfiles';
import FriendList from './components/FriendList';
import Settings from './components/Settings';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [activeTab, setActiveTab] = useState('map');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSignupFlow, setShowSignupFlow] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [showSignupPopup, setShowSignupPopup] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [lastDismissedTime, setLastDismissedTime] = useState<number>(() => {
    const saved = localStorage.getItem('signup_popup_dismissed');
    return saved ? parseInt(saved) : 0;
  });

  const mapRef = useRef<MapVibeHandle>(null);

  const dismissPopup = (minutes: number) => {
    const now = Date.now();
    setLastDismissedTime(now);
    localStorage.setItem('signup_popup_dismissed', now.toString());
    setShowSignupPopup(false);
    toast.info("We'll remind you later!");
  };

  const handleFirestoreError = (error: any, operation: string, path: string) => {
    if (error.code === 'resource-exhausted' || error.message?.includes('Quota exceeded')) {
      setQuotaExceeded(true);
      toast.error('Daily limit reached', {
        description: 'The app has reached its free tier limit for today. Real-time features will resume tomorrow.',
        duration: 10000
      });
      return;
    }
    const errInfo = {
      error: error.message || String(error),
      operation,
      path,
      auth: {
        uid: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified
      }
    };
    console.error('Firestore Error:', JSON.stringify(errInfo, null, 2));
  };

  const addToHistory = async (type: 'search' | 'view', targetId?: string, query?: string) => {
    if (!auth.currentUser) return;
    try {
      await addDoc(collection(db, 'history'), {
        uid: auth.currentUser.uid,
        type,
        targetId,
        query,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('History error:', err);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 3000); // 3 seconds splash screen

    let unsubProfile: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      
      // Cleanup previous profile subscription
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      if (user) {
        const userRef = doc(db, 'users', user.uid);
        unsubProfile = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfile);
            setShowSignupFlow(false);
            // Only update online status if profile exists to avoid rule violations during signup
            updateDoc(userRef, {
              isOnline: true,
              lastSeen: new Date().toISOString(),
              showOnMap: true // Ensure they show up on the map
            }).catch(err => console.warn('Status update deferred until profile created'));
          } else {
            // Show signup flow after a small delay to let them see the map first
            setTimeout(() => {
              setShowSignupFlow(true);
            }, 2000);
          }
        }, (err) => {
          handleFirestoreError(err, 'get', `users/${user.uid}`);
        });
      } else {
        setUserProfile(null);
        setShowSignupFlow(false);
      }
    });

    // Online users count - Changed to periodic fetch to save quota
    const fetchOnlineCount = async () => {
      try {
        const onlineQ = query(collection(db, 'users'), where('isOnline', '==', true), limit(100));
        const snap = await getDocs(onlineQ);
        setOnlineCount(snap.size);
      } catch (err) {
        console.warn('Online count fetch failed:', err);
      }
    };

    fetchOnlineCount();
    const onlineInterval = setInterval(fetchOnlineCount, 120000); // Update every 2 minutes

    // Signup popup logic for non-logged in users
    const popupTimer = setInterval(() => {
      if (!auth.currentUser) {
        const now = Date.now();
        const saved = localStorage.getItem('signup_popup_dismissed');
        const lastTime = saved ? parseInt(saved) : 0;
        
        // If never dismissed, show after 1 minute (60000ms)
        // If dismissed, show after 3 minutes (180000ms)
        const delay = lastTime === 0 ? 60000 : 180000;
        
        if (now - lastTime >= delay) {
          setShowSignupPopup(true);
        }
      }
    }, 5000); // Check every 5 seconds

    return () => {
      clearTimeout(timer);
      unsubscribe();
      if (unsubProfile) unsubProfile();
      clearInterval(onlineInterval);
      clearInterval(popupTimer);
    };
  }, []);

  // Live location tracking
  useEffect(() => {
    if (!currentUser || !userProfile) return;

    let watchId: number | null = null;
    let lastUpdateTime = 0;
    const UPDATE_INTERVAL = 60000; // Increased to 60 seconds to save quota

    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const now = Date.now();
          if (now - lastUpdateTime < UPDATE_INTERVAL) return;

          const { latitude, longitude } = pos.coords;
          const userRef = doc(db, 'users', currentUser.uid);
          
          updateDoc(userRef, {
            'location.lat': latitude,
            'location.lng': longitude,
            'location.lastUpdated': new Date().toISOString()
          }).then(() => {
            lastUpdateTime = now;
          }).catch(err => {
            if (err.code === 'resource-exhausted') {
              console.warn('Firestore quota exceeded - location update skipped');
            } else {
              console.error('Location update error:', err);
            }
          });
        },
        (err) => console.error('Geolocation watch error:', err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }

    // Notification listener
    const q = query(
      collection(db, 'notifications'),
      where('uid', '==', currentUser.uid),
      where('read', '==', false),
      orderBy('timestamp', 'desc'),
      limit(1)
    );
    const unsubNotif = onSnapshot(q, (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const notif = change.doc.data();
          toast(notif.fromName, {
            description: notif.text,
            action: {
              label: 'View',
              onClick: () => {
                updateDoc(doc(db, 'notifications', change.doc.id), { read: true });
                if (notif.type === 'message') {
                  setSelectedProfileId(notif.fromId);
                  setActiveTab('chat');
                } else if (notif.type === 'like') {
                  setSelectedProfileId(notif.fromId);
                  setActiveTab('profile');
                }
              }
            }
          });
        }
      });
    }, (err) => {
      if (err.code === 'resource-exhausted') {
        console.warn('Notifications quota exceeded');
      }
    });

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
      unsubNotif();
    };
  }, [currentUser, !!userProfile]);

  if (loading) return <SplashScreen />;

  const handleInteraction = () => {
    if (!currentUser && !showAuthModal) {
      setShowSignupPopup(true);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans selection:bg-blue-100" onClick={handleInteraction}>
      <Toaster position="top-right" />
      
      <Navbar 
        user={userProfile} 
        onlineCount={onlineCount}
        onLogin={() => setShowAuthModal(true)} 
        onSignup={() => setShowAuthModal(true)}
        onTabChange={(tab) => {
          if (!currentUser && (tab === 'chat' || tab === 'profile' || tab === 'settings')) {
            setShowSignupPopup(true);
            return;
          }
          setActiveTab(tab);
        }}
      />

      {quotaExceeded && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[4000] w-full max-w-lg px-4">
          <motion.div 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-red-600 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4 border border-red-500"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                <SettingsIcon className="w-4 h-4 animate-spin" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest">Daily Limit Reached</p>
                <p className="text-[10px] font-bold text-red-100">Real-time features will resume tomorrow. You can still browse the map.</p>
              </div>
            </div>
            <button 
              onClick={() => setQuotaExceeded(false)}
              className="p-2 hover:bg-white/10 rounded-xl transition"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        </div>
      )}

      <div className="flex pt-16 h-[calc(100vh-64px)] pb-20 lg:pb-0 relative">
        <div className="hidden lg:flex">
          <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
        
        <main className="flex-1 relative overflow-hidden bg-neutral-50">
          <AnimatePresence mode="wait">
            {activeTab === 'map' && (
              <motion.div
                key="map"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full"
              >
                <MapVibe 
                  ref={mapRef}
                  onProfileClick={(id) => {
                    setSelectedProfileId(id);
                    setActiveTab('profile');
                    addToHistory('view', id);
                  }} 
                  onDirectChat={(id) => {
                    setSelectedProfileId(id);
                    setActiveTab('chat');
                    addToHistory('view', id);
                  }}
                  addToHistory={addToHistory}
                />
              </motion.div>
            )}
            {activeTab === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="h-full overflow-y-auto"
              >
                <ProfilePage 
                  profileId={selectedProfileId || userProfile?.uid || ''} 
                  onMessage={(id) => {
                    setSelectedProfileId(id);
                    setActiveTab('chat');
                  }}
                  addToHistory={addToHistory}
                />
              </motion.div>
            )}
            {activeTab === 'chat' && (
              <motion.div
                key="chat"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="h-full"
              >
                <ChatInbox selectedChatId={selectedProfileId} />
              </motion.div>
            )}
            {activeTab === 'active' && (
              <ActiveUsers 
                onProfileClick={(id) => { 
                  setSelectedProfileId(id); 
                  setActiveTab('profile'); 
                  addToHistory('view', id); 
                }} 
                onFlyTo={(userId) => {
                  setActiveTab('map');
                  setTimeout(() => mapRef.current?.flyToUser(userId), 100);
                }}
              />
            )}
            {activeTab === 'random' && <RandomProfiles onProfileClick={(id) => { setSelectedProfileId(id); setActiveTab('profile'); addToHistory('view', id); }} />}
            {activeTab === 'friends' && (
              <motion.div
                key="friends"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="h-full"
              >
                <FriendList onProfileClick={(id) => { setSelectedProfileId(id); setActiveTab('profile'); }} />
              </motion.div>
            )}
            {activeTab === 'settings' && <Settings />}
          </AnimatePresence>
        </main>

        {activeTab === 'map' && (
          <div className="hidden lg:block">
            <RightSidebar onProfileClick={(id) => { setSelectedProfileId(id); setActiveTab('profile'); addToHistory('view', id); }} />
          </div>
        )}
      </div>

      {/* Mobile Bottom Nav */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-20 bg-white/95 backdrop-blur-2xl border-t border-neutral-100 flex items-center justify-around px-4 z-[9999] pb-6 shadow-[0_-8px_30px_rgb(0,0,0,0.1)]">
        {[
          { id: 'map', icon: Map, label: 'Map' },
          { id: 'active', icon: Users, label: 'Active' },
          { id: 'chat', icon: MessageSquare, label: 'Chat' },
          { id: 'friends', icon: Users, label: 'Friends' },
          { id: 'profile', icon: UserIcon, label: 'Profile' },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "flex flex-col items-center gap-1 transition-all duration-300",
              activeTab === item.id ? "text-blue-600 scale-110" : "text-neutral-400"
            )}
          >
            <div className={cn(
              "p-2 rounded-2xl transition-all duration-300",
              activeTab === item.id ? "bg-blue-50" : ""
            )}>
              <item.icon className={cn("w-6 h-6", activeTab === item.id ? "fill-blue-600/10" : "")} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-tighter">{item.label}</span>
          </button>
        ))}
      </div>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      
      {showSignupFlow && (
        <SignupFlow 
          user={currentUser} 
          onComplete={(profile) => {
            setUserProfile(profile);
            setShowSignupFlow(false);
          }} 
        />
      )}

      <AnimatePresence>
        {showSignupPopup && !currentUser && (
          <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white p-8 rounded-[2rem] shadow-2xl max-w-sm w-full text-center border border-neutral-100"
            >
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Users className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-black tracking-tight mb-2">Join MAPMATES</h2>
              <p className="text-sm text-neutral-500 mb-8 font-medium leading-relaxed">Create an account to continue using MAPMATES</p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => { setShowAuthModal(true); setShowSignupPopup(false); }}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black tracking-tight hover:bg-blue-700 transition shadow-xl shadow-blue-100"
                >
                  Sign Up Now
                </button>
                <button 
                  onClick={() => dismissPopup(3)}
                  className="w-full py-4 text-neutral-400 font-bold text-sm hover:text-neutral-600 transition"
                >
                  Maybe Later
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
