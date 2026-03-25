import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, limit, onSnapshot, where, getDocs } from 'firebase/firestore';
import { UserProfile } from '../types';
import { MapPin, UserPlus, Shuffle, Heart, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, handleQuotaError } from '../lib/utils';

interface RandomProfilesProps {
  onProfileClick: (id: string) => void;
}

export default function RandomProfiles({ onProfileClick }: RandomProfilesProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), where('showOnDiscover', '==', true), limit(12));
      const snap = await getDocs(q);
      setUsers(snap.docs.map(doc => doc.data() as UserProfile));
    } catch (err) {
      handleQuotaError(err, 'RandomProfiles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleShuffle = () => {
    fetchUsers();
  };

  return (
    <div className="p-8 h-full overflow-y-auto bg-neutral-50">
      <div className="flex items-center justify-between mb-12">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-neutral-900">Discover Mates</h2>
          <p className="text-sm text-neutral-500 font-medium">Meet random people from around the globe!</p>
        </div>
        <button 
          onClick={handleShuffle}
          className="flex items-center gap-3 px-8 py-4 bg-white border border-neutral-200 rounded-[2rem] font-black tracking-tight text-neutral-900 hover:bg-neutral-100 transition shadow-xl shadow-neutral-100"
        >
          <Shuffle className={cn("w-5 h-5 text-blue-600", loading && "animate-spin")} /> Shuffle Profiles
        </button>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8"
          >
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-[3rem] shadow-xl border border-neutral-100 animate-pulse">
                <div className="w-full aspect-square bg-neutral-100 rounded-[2.5rem] mb-6"></div>
                <div className="h-6 bg-neutral-100 rounded-full w-2/3 mb-2"></div>
                <div className="h-4 bg-neutral-100 rounded-full w-1/2 mb-6"></div>
                <div className="h-12 bg-neutral-100 rounded-2xl w-full"></div>
              </div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8"
          >
            {users.map((user) => (
              <motion.div
                key={user.uid}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -10 }}
                className="group bg-white p-6 rounded-[3rem] shadow-xl border border-neutral-100 hover:shadow-2xl transition-all duration-500 cursor-pointer relative overflow-hidden"
                onClick={() => onProfileClick(user.uid)}
              >
                <div className="relative mb-6">
                  <img src={user.photoURL} alt={user.username} className="w-full aspect-square rounded-[2.5rem] object-cover shadow-2xl group-hover:scale-105 transition-transform duration-700" />
                  <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <button className="p-3 bg-white/90 backdrop-blur-md rounded-2xl shadow-xl text-red-500 hover:bg-red-50 transition"><Heart className="w-5 h-5" /></button>
                    <button className="p-3 bg-white/90 backdrop-blur-md rounded-2xl shadow-xl text-blue-600 hover:bg-blue-50 transition"><MessageCircle className="w-5 h-5" /></button>
                  </div>
                  {user.isOnline && <div className="absolute bottom-4 left-4 px-3 py-1 bg-green-500/90 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg">Online</div>}
                </div>
                
                <div className="space-y-1 mb-8">
                  <h3 className="text-2xl font-black tracking-tighter text-neutral-900 group-hover:text-blue-600 transition">{user.username}</h3>
                  <div className="flex items-center gap-1 text-xs text-neutral-400 font-bold uppercase tracking-widest">
                    <MapPin className="w-3 h-3" />
                    <span>{user.profession} • {user.age}</span>
                  </div>
                </div>

                <button className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-black tracking-tight hover:bg-blue-600 transition shadow-xl shadow-neutral-100 flex items-center justify-center gap-2">
                  <UserPlus className="w-5 h-5" /> Add Friend
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
