import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, getDoc, doc, limit, startAfter, getDocs, orderBy } from 'firebase/firestore';
import { UserProfile } from '../types';
import { Users, Search, MessageCircle, User } from 'lucide-react';
import { motion } from 'motion/react';
import { cn, handleQuotaError } from '../lib/utils';

interface FriendListProps {
  onProfileClick: (id: string) => void;
}

export default function FriendList({ onProfileClick }: FriendListProps) {
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const fetchFriends = async () => {
      try {
        const q = query(
          collection(db, 'friendRequests'),
          where('status', '==', 'accepted'),
          where('from', '==', auth.currentUser!.uid),
          orderBy('createdAt', 'desc'),
          limit(20)
        );

        const snap = await getDocs(q);
        const results = await Promise.all(snap.docs.map(async (d) => {
          const data = d.data();
          const targetId = data.from === auth.currentUser?.uid ? data.to : data.from;
          const uSnap = await getDoc(doc(db, 'users', targetId));
          return uSnap.data() as UserProfile;
        }));
        setFriends(results);
        setLastVisible(snap.docs[snap.docs.length - 1]);
        setLoading(false);
      } catch (err) {
        handleQuotaError(err, 'FriendList');
        setLoading(false);
      }
    };

    fetchFriends();
  }, []);

  const loadMore = async () => {
    if (!auth.currentUser || !lastVisible || !hasMore) return;

    const q = query(
      collection(db, 'friendRequests'),
      where('status', '==', 'accepted'),
      where('from', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc'),
      startAfter(lastVisible),
      limit(20)
    );

    const snap = await getDocs(q);
    if (snap.empty) {
      setHasMore(false);
      return;
    }

    const results = await Promise.all(snap.docs.map(async (d) => {
      const data = d.data();
      const targetId = data.from === auth.currentUser?.uid ? data.to : data.from;
      const uSnap = await getDoc(doc(db, 'users', targetId));
      return uSnap.data() as UserProfile;
    }));

    setFriends(prev => [...prev, ...results]);
    setLastVisible(snap.docs[snap.docs.length - 1]);
  };

  const filteredFriends = friends.filter(f => 
    f.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto p-4 lg:p-8 h-full flex flex-col">
      <div className="mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-neutral-900">Your Friends</h2>
          <p className="text-neutral-500 font-medium">You have {friends.length} mates connected.</p>
        </div>
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 group-focus-within:text-blue-600 transition" />
          <input
            type="text"
            placeholder="Search friends..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 pr-6 py-3 bg-white border border-neutral-100 rounded-2xl w-full lg:w-64 focus:ring-2 focus:ring-blue-500 outline-none transition shadow-sm font-medium"
          />
        </div>
      </div>

      <div 
        className="flex-1 overflow-y-auto space-y-4 pr-2"
        onScroll={(e) => {
          const target = e.target as HTMLDivElement;
          if (target.scrollHeight - target.scrollTop === target.clientHeight) {
            loadMore();
          }
        }}
      >
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredFriends.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredFriends.map((friend) => (
              <motion.div
                key={friend.uid}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white p-4 rounded-3xl border border-neutral-100 shadow-sm flex items-center justify-between group hover:border-blue-200 transition duration-300"
              >
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <img src={friend.photoURL} alt={friend.username} className="w-14 h-14 rounded-2xl object-cover" />
                    {friend.isOnline && <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-sm"></div>}
                  </div>
                  <div>
                    <p className="font-black text-neutral-900">{friend.username}</p>
                    <p className="text-xs text-neutral-400 font-bold uppercase tracking-widest">{friend.profession}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => onProfileClick(friend.uid)}
                    className="p-3 bg-neutral-50 text-neutral-400 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition"
                  >
                    <User className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-[3rem] border border-neutral-100 shadow-sm">
            <div className="w-20 h-20 bg-neutral-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Users className="w-10 h-10 text-neutral-300" />
            </div>
            <h3 className="text-xl font-black text-neutral-900 mb-2">No friends found</h3>
            <p className="text-neutral-500 font-medium">Start exploring the map to find new mates!</p>
          </div>
        )}
      </div>
    </div>
  );
}
