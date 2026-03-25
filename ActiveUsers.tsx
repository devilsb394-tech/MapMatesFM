import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, limit, getDocs } from 'firebase/firestore';
import { UserProfile } from '../types';
import { MapPin, UserPlus, Plane } from 'lucide-react';
import { motion } from 'motion/react';
import { handleQuotaError } from '../lib/utils';

interface ActiveUsersProps {
  onProfileClick: (id: string) => void;
  onFlyTo?: (userId: string) => void;
}

export default function ActiveUsers({ onProfileClick, onFlyTo }: ActiveUsersProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const q = query(
          collection(db, 'users'), 
          where('isOnline', '==', true),
          limit(100)
        );
        const snap = await getDocs(q);
        setUsers(snap.docs.map(doc => doc.data() as UserProfile));
      } catch (err) {
        handleQuotaError(err, 'ActiveUsers');
      }
    };

    fetchUsers();
  }, []);

  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-neutral-900">Active Mates</h2>
          <p className="text-sm text-neutral-500 font-medium">People currently online and ready to connect.</p>
        </div>
        <div className="flex items-center gap-2 bg-green-50 px-4 py-2 rounded-full border border-green-100">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-xs font-black text-green-600 uppercase tracking-widest">{users.length} Online</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {users.map((user) => (
          <motion.div
            key={user.uid}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-neutral-100 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group cursor-pointer"
            onClick={() => onProfileClick(user.uid)}
          >
            <div className="relative mb-6">
              <img src={user.photoURL} alt={user.username} className="w-full aspect-square rounded-[2rem] object-cover shadow-inner" />
              <div className="absolute top-4 right-4 w-4 h-4 bg-green-500 rounded-full border-4 border-white shadow-lg"></div>
              {onFlyTo && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onFlyTo(user.uid);
                  }}
                  className="absolute bottom-4 right-4 p-3 bg-white/90 backdrop-blur-sm text-blue-600 rounded-2xl shadow-xl hover:bg-blue-50 transition-colors"
                  title="Go to location"
                >
                  <Plane className="w-5 h-5" />
                </button>
              )}
            </div>
            <div className="space-y-1 mb-6">
              <h3 className="text-xl font-black tracking-tighter text-neutral-900">{user.username}</h3>
              <div className="flex items-center gap-1 text-[10px] text-neutral-400 font-bold uppercase tracking-widest">
                <MapPin className="w-3 h-3" />
                <span>{user.profession}</span>
              </div>
            </div>
            <button className="w-full py-3 bg-blue-600 text-white rounded-2xl font-black tracking-tight hover:bg-blue-700 transition shadow-xl shadow-blue-100 flex items-center justify-center gap-2">
              <UserPlus className="w-4 h-4" /> Add Friend
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
