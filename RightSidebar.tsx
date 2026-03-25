import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, limit, onSnapshot, getDocs } from 'firebase/firestore';
import { UserProfile } from '../types';
import { UserPlus, MapPin, MessageCircle, Users, Plane } from 'lucide-react';
import { handleQuotaError } from '../lib/utils';

interface RightSidebarProps {
  onProfileClick: (id: string) => void;
  onFlyTo?: (userId: string) => void;
}

export default function RightSidebar({ onProfileClick, onFlyTo }: RightSidebarProps) {
  const [nearbyUsers, setNearbyUsers] = useState<UserProfile[]>([]);

  useEffect(() => {
    // Optimization: Use getDocs instead of onSnapshot for non-critical live data to save reads
    const fetchUsers = async () => {
      try {
        const q = query(collection(db, 'users'), limit(5));
        const snap = await getDocs(q);
        setNearbyUsers(snap.docs.map(doc => doc.data() as UserProfile));
      } catch (err) {
        handleQuotaError(err, 'RightSidebar');
      }
    };

    fetchUsers();
  }, []);

  return (
    <aside className="w-80 bg-white border-l border-neutral-200 p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-black tracking-tighter text-neutral-900">Discover New Connections</h2>
        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">Nearby</span>
      </div>

      <div className="flex flex-col gap-4">
        {nearbyUsers.map((user) => (
          <div 
            key={user.uid}
            className="group bg-neutral-50 rounded-3xl p-4 border border-neutral-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all duration-300 cursor-pointer"
            onClick={() => onProfileClick(user.uid)}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="relative">
                <img src={user.photoURL} alt={user.username} className="w-12 h-12 rounded-2xl object-cover shadow-md" />
                {user.isOnline && <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-sm"></div>}
              </div>
              <div>
                <p className="font-bold text-sm text-neutral-900">{user.username}</p>
                <div className="flex items-center gap-1 text-[10px] text-neutral-500 font-medium">
                  <MapPin className="w-3 h-3" />
                  <span>2.4 km away</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button className="flex-1 py-2.5 bg-white border border-neutral-200 text-neutral-900 text-[10px] font-bold rounded-xl hover:bg-neutral-100 transition flex items-center justify-center gap-2">
                <UserPlus className="w-3 h-3" /> Add Friend
              </button>
              {onFlyTo && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onFlyTo(user.uid);
                  }}
                  className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-100"
                  title="Go to location"
                >
                  <Plane className="w-4 h-4" />
                </button>
              )}
              <button className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-100">
                <MessageCircle className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {nearbyUsers.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-neutral-300" />
            </div>
            <p className="text-sm font-bold text-neutral-400">No users found nearby</p>
            <p className="text-[10px] text-neutral-400 mt-1">Try expanding your search radius</p>
          </div>
        )}
      </div>

      <div className="mt-8 p-6 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2rem] text-white shadow-2xl shadow-blue-200 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
        <p className="text-xl font-black tracking-tighter mb-2 relative z-10">MapVibe Pro</p>
        <p className="text-xs text-blue-100 leading-relaxed mb-4 relative z-10">See who's looking at your profile in real-time.</p>
        <button className="w-full py-3 bg-white text-blue-600 text-xs font-bold rounded-2xl hover:bg-blue-50 transition relative z-10">
          Try Free for 7 Days
        </button>
      </div>
    </aside>
  );
}
