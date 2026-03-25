import React, { useState } from 'react';
import { Search, Bell, HelpCircle, LogIn, UserPlus, User, LogOut } from 'lucide-react';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { UserProfile } from '../types';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

interface NavbarProps {
  user: UserProfile | null;
  onlineCount: number;
  onLogin: () => void;
  onSignup: () => void;
  onTabChange: (tab: string) => void;
}

export default function Navbar({ user, onlineCount, onLogin, onSignup, onTabChange }: NavbarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [showResults, setShowResults] = useState(false);

  const handleSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (val.length > 0) {
      const q = query(
        collection(db, 'users'),
        where('username', '>=', val),
        where('username', '<=', val + '\uf8ff'),
        limit(5)
      );
      const snap = await getDocs(q);
      setSearchResults(snap.docs.map(doc => doc.data() as UserProfile));
      setShowResults(true);
    } else {
      setSearchResults([]);
      setShowResults(false);
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-xl border-b border-neutral-100 z-50 flex items-center px-4 sm:px-6 justify-between shadow-sm">
      <div className="flex items-center gap-2 cursor-pointer shrink-0" onClick={() => onTabChange('map')}>
        <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
          <span className="text-white text-[10px] font-black">MM</span>
        </div>
        <div className="flex flex-col">
          <span className="text-lg font-black tracking-tighter text-neutral-900 leading-none">MAPMATES</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[8px] font-black text-blue-600 uppercase tracking-widest leading-none hidden sm:block">Real-time Social Map</span>
            <div className="flex items-center gap-1 bg-green-50 px-1.5 py-0.5 rounded-full">
              <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-[7px] font-black text-green-600 uppercase tracking-widest">{onlineCount} Online</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-md mx-2 sm:mx-8 relative hidden sm:block">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4 group-focus-within:text-blue-600 transition-colors" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={handleSearch}
            onFocus={() => setShowResults(true)}
            className="w-full bg-neutral-100 border-none rounded-full py-2 pl-10 pr-4 focus:ring-2 focus:ring-blue-500 transition-all text-xs sm:text-sm font-bold"
          />
        </div>

        {showResults && searchResults.length > 0 && (
          <div className="absolute top-full mt-2 w-full bg-white rounded-2xl shadow-2xl border border-neutral-100 overflow-hidden">
            {searchResults.map((res) => (
              <div
                key={res.uid}
                onClick={() => { onTabChange('profile'); setShowResults(false); }}
                className="flex items-center gap-3 p-3 hover:bg-neutral-50 cursor-pointer transition"
              >
                <img src={res.photoURL} alt={res.username} className="w-10 h-10 rounded-full object-cover" />
                <div>
                  <p className="font-bold text-sm">{res.username}</p>
                  <p className="text-xs text-neutral-500">{res.profession}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-4">
        <button className="p-2 text-neutral-500 hover:bg-neutral-50 rounded-full transition relative hidden md:flex">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
        
        {user ? (
          <div className="flex items-center gap-2 sm:gap-3 ml-1 sm:ml-2">
            <div 
              className="flex items-center gap-2 cursor-pointer hover:bg-neutral-50 p-1 rounded-full sm:pr-3 transition"
              onClick={() => onTabChange('profile')}
            >
              <img src={user.photoURL} alt={user.username} className="w-8 h-8 rounded-full object-cover border border-neutral-100 shadow-sm" />
              <span className="text-sm font-bold hidden sm:block">{user.username}</span>
            </div>
            <button 
              onClick={() => signOut(auth)}
              className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-full transition"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button 
              onClick={onLogin}
              className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold text-neutral-600 hover:bg-neutral-50 rounded-full transition flex items-center gap-2"
            >
              <LogIn className="w-4 h-4" /> <span className="hidden xs:block">Login</span>
            </button>
            <button 
              onClick={onSignup}
              className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold bg-blue-600 text-white rounded-full hover:bg-blue-700 transition shadow-lg shadow-blue-100 flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" /> <span className="hidden xs:block">Signup</span>
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
