import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc, increment, collection, addDoc, onSnapshot, query, where, getDocs, deleteDoc, writeBatch, limit, startAfter, orderBy, setDoc } from 'firebase/firestore';
import { UserProfile, Rating, SocialAction } from '../types';
import { UserPlus, MessageCircle, Star, Eye, Heart, Users, ChevronRight, Info, Shield, MapPin, Trash2, Map, Compass, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { cn, handleQuotaError } from '../lib/utils';

interface ProfilePageProps {
  profileId: string;
  onMessage: (id: string) => void;
  addToHistory: (type: 'search' | 'view', targetId?: string, query?: string) => void;
}

export default function ProfilePage({ profileId, onMessage, addToHistory }: ProfilePageProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showListModal, setShowListModal] = useState<{ type: 'views' | 'likes' | 'friends', open: boolean }>({ type: 'views', open: false });
  const [listData, setListData] = useState<SocialAction[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [lastVisibleList, setLastVisibleList] = useState<any>(null);
  const [hasMoreList, setHasMoreList] = useState(true);
  const [rating, setRating] = useState({ personality: 50, friendliness: 50, attractiveness: 50, trustLevel: 50 });
  const [isLiked, setIsLiked] = useState(false);
  const [friendStatus, setFriendStatus] = useState<'none' | 'pending' | 'friends'>('none');

  const isOwnProfile = auth.currentUser?.uid === profileId;

  useEffect(() => {
    if (!profileId) return;

    const unsubscribe = onSnapshot(doc(db, 'users', profileId), (snap) => {
      if (snap.exists()) {
        setProfile(snap.data() as UserProfile);
      }
      setLoading(false);
    }, (err) => {
      handleQuotaError(err, 'ProfilePage');
      setLoading(false);
    });

    // Track view (once per session/user)
    if (auth.currentUser && !isOwnProfile) {
      const viewId = `${auth.currentUser.uid}_${profileId}`;
      getDoc(doc(db, 'socialActions', viewId)).then(async (snap) => {
        if (!snap.exists()) {
          await setDoc(doc(db, 'socialActions', viewId), {
            type: 'view',
            fromId: auth.currentUser!.uid,
            toId: profileId,
            timestamp: new Date().toISOString()
          });
          // Add to history
          addToHistory('view', profileId);
          await updateDoc(doc(db, 'users', profileId), {
            'stats.views': increment(1)
          });
        }
      });
    }

    // Check if liked
    if (auth.currentUser && !isOwnProfile) {
      const likeId = `${auth.currentUser.uid}_${profileId}_like`;
      getDoc(doc(db, 'socialActions', likeId)).then(snap => {
        setIsLiked(snap.exists());
      });
    }

    // Check friend status
    if (auth.currentUser && !isOwnProfile) {
      const q = query(
        collection(db, 'friendRequests'),
        where('from', 'in', [auth.currentUser.uid, profileId]),
        where('to', 'in', [auth.currentUser.uid, profileId])
      );
      onSnapshot(q, (snap) => {
        if (snap.empty) setFriendStatus('none');
        else {
          const req = snap.docs[0].data();
          setFriendStatus(req.status === 'accepted' ? 'friends' : 'pending');
        }
      });
    }

    return () => unsubscribe();
  }, [profileId, isOwnProfile]);

  const handleLike = async () => {
    if (!auth.currentUser || !profile || isLiked || isOwnProfile) return;
    const likeId = `${auth.currentUser.uid}_${profileId}_like`;
    try {
      await setDoc(doc(db, 'socialActions', likeId), {
        type: 'like',
        fromId: auth.currentUser.uid,
        toId: profileId,
        timestamp: new Date().toISOString()
      });
      await updateDoc(doc(db, 'users', profileId), {
        'stats.likes': increment(1)
      });
      
      // Create notification for recipient
      const currentUserSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const currentUserData = currentUserSnap.data() as UserProfile;
      
      await addDoc(collection(db, 'notifications'), {
        uid: profileId,
        fromId: auth.currentUser.uid,
        fromName: currentUserData.username,
        fromPhoto: currentUserData.photoURL,
        type: 'like',
        text: 'liked your profile!',
        timestamp: new Date().toISOString(),
        read: false
      });

      setIsLiked(true);
      toast.success('Liked profile!');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAddFriend = async () => {
    if (!auth.currentUser || !profile || friendStatus !== 'none' || isOwnProfile) return;
    try {
      await addDoc(collection(db, 'friendRequests'), {
        from: auth.currentUser.uid,
        to: profile.uid,
        status: 'pending',
        friendshipType: 'Regular',
        closeness: 50,
        attractiveness: 50,
        createdAt: new Date().toISOString()
      });
      toast.success('Friend request sent!');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const fetchListData = async (type: 'views' | 'likes' | 'friends', isLoadMore = false) => {
    if (!auth.currentUser) return;
    setLoadingList(true);
    
    let q;
    if (type === 'friends') {
      q = query(
        collection(db, 'friendRequests'),
        where('status', '==', 'accepted'),
        where('from', '==', profileId),
        orderBy('createdAt', 'desc'),
        limit(10)
      );
      // Note: This only gets one side of friendship, usually we'd need a more complex query or denormalized list
    } else {
      q = query(
        collection(db, 'socialActions'),
        where('toId', '==', profileId),
        where('type', '==', type.slice(0, -1)), // 'view' or 'like'
        orderBy('timestamp', 'desc'),
        limit(10)
      );
    }

    if (isLoadMore && lastVisibleList) {
      q = query(q, startAfter(lastVisibleList));
    }

    const snap = await getDocs(q);
    if (snap.empty) {
      if (!isLoadMore) setListData([]);
      setHasMoreList(false);
      setLoadingList(false);
      return;
    }

    const results = await Promise.all(snap.docs.map(async (d) => {
      const data = d.data() as any;
      const userId = type === 'friends' ? (data.from === profileId ? data.to : data.from) : data.fromId;
      const uSnap = await getDoc(doc(db, 'users', userId));
      return { id: d.id, ...data, user: uSnap.data() as UserProfile } as SocialAction;
    }));

    setListData(prev => isLoadMore ? [...prev, ...results] : results);
    setLastVisibleList(snap.docs[snap.docs.length - 1]);
    setHasMoreList(snap.docs.length === 10);
    setLoadingList(false);
  };

  const openListModal = (type: 'views' | 'likes' | 'friends') => {
    setShowListModal({ type, open: true });
    setListData([]);
    setLastVisibleList(null);
    setHasMoreList(true);
    fetchListData(type);
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm("Are you absolutely sure? This will permanently delete your account and all data.")) return;
    if (!auth.currentUser) return;

    try {
      const uid = auth.currentUser.uid;
      const batch = writeBatch(db);
      
      // Delete user doc
      batch.delete(doc(db, 'users', uid));
      
      // Delete social actions, messages, etc would require a cloud function or recursive delete
      // For now, we delete the main profile and sign out
      await batch.commit();
      await auth.currentUser.delete();
      window.location.reload();
    } catch (err: any) {
      toast.error("Failed to delete account. You may need to re-authenticate first.");
    }
  };

  const toggleVisibility = async (field: 'showOnMap' | 'showOnDiscover') => {
    if (!profile) return;
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        [field]: !profile[field]
      });
      toast.success(`${field === 'showOnMap' ? 'Map' : 'Discover'} visibility updated!`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRate = async () => {
    if (!auth.currentUser || !profile) return;
    try {
      await addDoc(collection(db, 'ratings'), {
        from: auth.currentUser.uid,
        to: profile.uid,
        ...rating
      });
      toast.success('Rating submitted!');
      setShowRatingModal(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  if (!profile) return <div className="flex items-center justify-center h-full text-neutral-500 font-bold">Profile not found</div>;

  return (
    <div className="max-w-4xl mx-auto p-4 lg:p-8">
      <div className="bg-white rounded-3xl lg:rounded-[3rem] shadow-2xl overflow-hidden border border-neutral-100">
        <div className="h-32 lg:h-48 bg-gradient-to-r from-blue-600 to-indigo-700 relative">
          <div className="absolute -bottom-12 lg:-bottom-16 left-6 lg:left-12">
            <div className="relative">
              <img 
                src={profile.photoURL} 
                alt={profile.username} 
                className="w-24 h-24 lg:w-40 lg:h-40 rounded-2xl lg:rounded-[2.5rem] object-cover border-4 lg:border-8 border-white shadow-2xl" 
              />
              {profile.isOnline && (
                <div className="absolute bottom-1 right-1 lg:bottom-2 lg:right-2 w-4 h-4 lg:w-6 lg:h-6 bg-green-500 rounded-full border-2 lg:border-4 border-white shadow-lg"></div>
              )}
            </div>
          </div>
          {isOwnProfile && (
            <div className="absolute top-4 right-4 flex gap-2">
              <button 
                onClick={() => toggleVisibility('showOnMap')}
                className={cn("p-2 rounded-xl transition shadow-lg", profile.showOnMap ? "bg-white text-blue-600" : "bg-white/20 text-white backdrop-blur-md")}
                title="Toggle Map Visibility"
              >
                <Map className="w-5 h-5" />
              </button>
              <button 
                onClick={() => toggleVisibility('showOnDiscover')}
                className={cn("p-2 rounded-xl transition shadow-lg", profile.showOnDiscover ? "bg-white text-blue-600" : "bg-white/20 text-white backdrop-blur-md")}
                title="Toggle Discover Visibility"
              >
                <Compass className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        <div className="pt-16 lg:pt-20 px-6 lg:px-12 pb-8 lg:pb-12">
          <div className="flex flex-col lg:flex-row justify-between items-start gap-6 mb-8">
            <div>
              <h1 className="text-3xl lg:text-4xl font-black tracking-tighter text-neutral-900 mb-1">{profile.username}</h1>
              <div className="flex items-center gap-2 text-neutral-500 font-bold text-xs lg:text-sm">
                <MapPin className="w-4 h-4" />
                <span>{profile.profession} • {profile.age} years old</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 lg:gap-3 w-full lg:w-auto">
              {!isOwnProfile ? (
                <>
                  <button 
                    onClick={handleAddFriend}
                    disabled={friendStatus !== 'none'}
                    className={cn(
                      "flex-1 lg:flex-none px-4 lg:px-6 py-3 rounded-xl lg:rounded-2xl font-black tracking-tight transition shadow-xl flex items-center justify-center gap-2 text-sm lg:text-base",
                      friendStatus === 'friends' ? "bg-green-100 text-green-600" : 
                      friendStatus === 'pending' ? "bg-neutral-100 text-neutral-400" : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100"
                    )}
                  >
                    {friendStatus === 'friends' ? <Check className="w-4 h-4 lg:w-5 lg:h-5" /> : <UserPlus className="w-4 h-4 lg:w-5 lg:h-5" />}
                    {friendStatus === 'friends' ? 'Friends' : friendStatus === 'pending' ? 'Requested' : 'Add Friend'}
                  </button>
                  <button 
                    onClick={() => onMessage(profile.uid)}
                    className="flex-1 lg:flex-none px-4 lg:px-6 py-3 bg-neutral-900 text-white rounded-xl lg:rounded-2xl font-black tracking-tight hover:bg-neutral-800 transition shadow-xl flex items-center justify-center gap-2 text-sm lg:text-base"
                  >
                    <MessageCircle className="w-4 h-4 lg:w-5 lg:h-5" /> Message
                  </button>
                  <button 
                    onClick={handleLike}
                    className={cn(
                      "p-3 rounded-xl lg:rounded-2xl transition shadow-lg",
                      isLiked ? "bg-red-50 text-red-500" : "bg-neutral-100 text-neutral-400 hover:bg-neutral-200"
                    )}
                  >
                    <Heart className={cn("w-5 h-5 lg:w-6 lg:h-6", isLiked && "fill-current")} />
                  </button>
                  <button 
                    onClick={() => setShowRatingModal(true)}
                    className="p-3 bg-neutral-100 text-neutral-900 rounded-xl lg:rounded-2xl hover:bg-neutral-200 transition"
                  >
                    <Star className="w-5 h-5 lg:w-6 lg:h-6" />
                  </button>
                </>
              ) : (
                <button 
                  onClick={handleDeleteAccount}
                  className="flex-1 lg:flex-none px-6 py-3 bg-red-50 text-red-600 rounded-xl lg:rounded-2xl font-black tracking-tight hover:bg-red-100 transition flex items-center justify-center gap-2 text-sm lg:text-base border border-red-100"
                >
                  <Trash2 className="w-5 h-5" /> Delete Account
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6 mb-12">
            <div 
              onClick={() => openListModal('views')}
              className="bg-neutral-50 p-4 lg:p-6 rounded-2xl lg:rounded-3xl border border-neutral-100 text-center group hover:bg-blue-50 hover:border-blue-100 transition duration-300 flex items-center sm:flex-col gap-4 sm:gap-0 cursor-pointer"
            >
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-white rounded-xl lg:rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition sm:mx-auto sm:mb-3">
                <Eye className="w-5 h-5 lg:w-6 lg:h-6 text-blue-600" />
              </div>
              <div className="text-left sm:text-center">
                <p className="text-xl lg:text-2xl font-black text-neutral-900">{profile.stats.views}</p>
                <p className="text-[9px] lg:text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Profile Views</p>
              </div>
            </div>
            <div 
              onClick={() => openListModal('likes')}
              className="bg-neutral-50 p-4 lg:p-6 rounded-2xl lg:rounded-3xl border border-neutral-100 text-center group hover:bg-red-50 hover:border-red-100 transition duration-300 flex items-center sm:flex-col gap-4 sm:gap-0 cursor-pointer"
            >
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-white rounded-xl lg:rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition sm:mx-auto sm:mb-3">
                <Heart className="w-5 h-5 lg:w-6 lg:h-6 text-red-500" />
              </div>
              <div className="text-left sm:text-center">
                <p className="text-xl lg:text-2xl font-black text-neutral-900">{profile.stats.likes}</p>
                <p className="text-[9px] lg:text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Total Likes</p>
              </div>
            </div>
            <div 
              onClick={() => openListModal('friends')}
              className="bg-neutral-50 p-4 lg:p-6 rounded-2xl lg:rounded-3xl border border-neutral-100 text-center group hover:bg-green-50 hover:border-green-100 transition duration-300 flex items-center sm:flex-col gap-4 sm:gap-0 cursor-pointer"
            >
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-white rounded-xl lg:rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition sm:mx-auto sm:mb-3">
                <Users className="w-5 h-5 lg:w-6 lg:h-6 text-green-600" />
              </div>
              <div className="text-left sm:text-center">
                <p className="text-xl lg:text-2xl font-black text-neutral-900">{profile.stats.friendsCount}</p>
                <p className="text-[9px] lg:text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Friends</p>
              </div>
            </div>
          </div>

          <div className="space-y-6 lg:space-y-8">
            <div>
              <h3 className="text-[10px] lg:text-xs font-black text-neutral-400 uppercase tracking-widest mb-4">About Me</h3>
              <p className="text-neutral-700 leading-relaxed font-medium bg-neutral-50 p-4 lg:p-6 rounded-2xl lg:rounded-3xl border border-neutral-100 text-sm lg:text-base">{profile.bio}</p>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 lg:p-6 bg-neutral-900 rounded-2xl lg:rounded-3xl text-white gap-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 lg:w-12 lg:h-12 bg-white/10 rounded-xl lg:rounded-2xl flex items-center justify-center">
                  <Info className="w-5 h-5 lg:w-6 lg:h-6" />
                </div>
                <div>
                  <p className="font-bold text-sm lg:text-base">Detailed Information</p>
                  <p className="text-[10px] lg:text-xs text-neutral-400">View religion, language, and more details.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowDetails(!showDetails)}
                className="w-full sm:w-auto px-6 py-2 bg-white text-neutral-900 rounded-xl font-bold text-xs hover:bg-neutral-100 transition flex items-center justify-center gap-2"
              >
                {showDetails ? 'Hide' : 'View Details'} <ChevronRight className={cn("w-4 h-4 transition", showDetails && "rotate-90")} />
              </button>
            </div>

            <AnimatePresence>
              {showDetails && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-2 gap-4 p-6 bg-neutral-50 rounded-3xl border border-neutral-100">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Gender</span>
                      <span className="font-bold text-neutral-900">{profile.gender}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Religion</span>
                      <span className="font-bold text-neutral-900">{profile.religion}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Language</span>
                      <span className="font-bold text-neutral-900">{profile.language}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Relationship</span>
                      <span className="font-bold text-neutral-900">{profile.relationshipStatus}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Economic Class</span>
                      <span className="font-bold text-neutral-900">{profile.economicClass}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Last Active</span>
                      <span className="font-bold text-neutral-900">{new Date(profile.lastSeen).toLocaleDateString()}</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* List Modal (Views/Likes/Friends) */}
      <AnimatePresence>
        {showListModal.open && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowListModal({ ...showListModal, open: false })} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
              <div className="p-8 border-b border-neutral-100 flex items-center justify-between">
                <h3 className="text-2xl font-black tracking-tighter text-neutral-900 capitalize">{showListModal.type}</h3>
                <button onClick={() => setShowListModal({ ...showListModal, open: false })} className="p-2 hover:bg-neutral-100 rounded-xl transition"><X className="w-6 h-6" /></button>
              </div>
              <div 
                className="flex-1 overflow-y-auto p-4 space-y-4"
                onScroll={(e) => {
                  const target = e.target as HTMLDivElement;
                  if (target.scrollHeight - target.scrollTop === target.clientHeight && hasMoreList && !loadingList) {
                    fetchListData(showListModal.type, true);
                  }
                }}
              >
                {listData.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 hover:bg-neutral-50 rounded-2xl transition">
                    <div className="flex items-center gap-4">
                      <img src={item.user?.photoURL} alt={item.user?.username} className="w-12 h-12 rounded-xl object-cover" />
                      <div>
                        <p className="font-black text-neutral-900 text-sm">{item.user?.username}</p>
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{item.user?.profession}</p>
                      </div>
                    </div>
                    {item.user?.uid !== auth.currentUser?.uid && (
                      <button 
                        onClick={() => {
                          setShowListModal({ ...showListModal, open: false });
                          onMessage(item.user!.uid);
                        }}
                        className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition"
                      >
                        <MessageCircle className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
                {loadingList && <div className="p-4 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div></div>}
                {!loadingList && listData.length === 0 && <p className="text-center text-neutral-400 font-bold py-8">No {showListModal.type} yet.</p>}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rating Modal */}
      <AnimatePresence>
        {showRatingModal && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowRatingModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl">
              <h3 className="text-2xl font-black tracking-tighter text-neutral-900 mb-6">Rate {profile.username}</h3>
              <div className="space-y-6">
                {Object.keys(rating).map((key) => (
                  <div key={key} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-black text-neutral-400 uppercase tracking-widest">{key}</label>
                      <span className="text-sm font-bold text-blue-600">{rating[key as keyof typeof rating]}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" max="100" 
                      value={rating[key as keyof typeof rating]} 
                      onChange={(e) => setRating({ ...rating, [key]: parseInt(e.target.value) })}
                      className="w-full h-2 bg-neutral-100 rounded-full appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>
                ))}
              </div>
              <button 
                onClick={handleRate}
                className="w-full mt-8 py-4 bg-blue-600 text-white rounded-2xl font-black tracking-tight hover:bg-blue-700 transition shadow-xl shadow-blue-100"
              >
                Submit Rating
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
