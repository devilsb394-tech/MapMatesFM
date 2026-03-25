import React from 'react';
import { Map, Users, Shuffle, MessageSquare, User, Settings as SettingsIcon } from 'lucide-react';
import { cn } from '../lib/utils';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const menuItems = [
    { id: 'map', label: 'MapVibe', icon: Map },
    { id: 'active', label: 'Active Users', icon: Users },
    { id: 'random', label: 'Random Profiles', icon: Shuffle },
    { id: 'friends', label: 'Friend List', icon: Users },
    { id: 'chat', label: 'Inbox / Messages', icon: MessageSquare },
    { id: 'profile', label: 'My Profile', icon: User },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <aside className="w-64 bg-white border-r border-neutral-200 flex flex-col p-4 gap-2">
      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-4 mb-2">Navigation</p>
      {menuItems.map((item) => (
        <button
          key={item.id}
          onClick={() => onTabChange(item.id)}
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 group",
            activeTab === item.id 
              ? "bg-blue-600 text-white shadow-lg shadow-blue-100" 
              : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
          )}
        >
          <item.icon className={cn("w-5 h-5", activeTab === item.id ? "text-white" : "text-neutral-400 group-hover:text-blue-600")} />
          <span className="font-bold text-sm">{item.label}</span>
        </button>
      ))}

      <div className="mt-auto p-4 bg-neutral-50 rounded-3xl border border-neutral-100">
        <p className="text-xs font-bold text-neutral-900 mb-1">Go Premium</p>
        <p className="text-[10px] text-neutral-500 leading-relaxed mb-3">Unlock advanced filters and unlimited messages.</p>
        <button className="w-full py-2 bg-neutral-900 text-white text-[10px] font-bold rounded-xl hover:bg-neutral-800 transition">
          Upgrade Now
        </button>
      </div>
    </aside>
  );
}
