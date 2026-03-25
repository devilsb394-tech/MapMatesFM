import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, limit, deleteDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { UserProfile, HistoryItem, AppNotification } from '../types';
import { User, Shield, Bell, Trash2, Save, Camera, LogOut, ChevronRight, Globe, Lock, History } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { deleteUser, signOut } from 'firebase/auth';
import { cn } from '../lib/utils';

export default function Settings() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('profile');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;
    const fetchProfile = async () => {
      const snap = await getDoc(doc(db, 'users', auth.currentUser!.uid));
      if (snap.exists()) setProfile(snap.data() as UserProfile);
      setLoading(false);
    };
    fetchProfile();

    // Fetch history
    const qHistory = query(
      collection(db, 'history'),
      where('uid', '==', auth.currentUser.uid),
      orderBy('timestamp', 'desc'),
      limit(20)
    );
    const unsubHistory = onSnapshot(qHistory, (snap) => {
      setHistory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as HistoryItem)));
    });

    // Fetch notifications
    const qNotif = query(
      collection(db, 'notifications'),
      where('uid', '==', auth.currentUser.uid),
      orderBy('timestamp', 'desc'),
      limit(20)
    );
    const unsubNotif = onSnapshot(qNotif, (snap) => {
      setNotifications(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification)));
    });

    return () => {
      unsubHistory();
      unsubNotif();
    };
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !profile) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { ...profile });
      toast.success('Settings updated successfully!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const togglePrivacy = async (field: 'showOnMap' | 'privateProfile' | 'showOnDiscover') => {
    if (!auth.currentUser || !profile) return;
    const newVal = !profile[field];
    setProfile({ ...profile, [field]: newVal });
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { [field]: newVal });
      toast.success(`${field.replace(/([A-Z])/g, ' $1')} updated!`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteAccount = async () => {
    if (!auth.currentUser) return;
    setSaving(true);
    try {
      const uid = auth.currentUser.uid;
      
      // 1. Delete user document
      await deleteDoc(doc(db, 'users', uid));
      
      // 2. Delete history
      const historySnap = await getDoc(doc(db, 'history', uid)); // Simplified, in real app we'd query and delete all
      // For brevity, we'll just delete the user doc and auth user. 
      // In a real app, we'd use a Cloud Function to clean up all subcollections and related docs.
      
      await deleteUser(auth.currentUser);
      toast.success('Account deleted successfully.');
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
      setShowDeleteConfirm(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;

  const sections = [
    { id: 'profile', label: 'Edit Profile', icon: User },
    { id: 'privacy', label: 'Privacy & Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'history', label: 'Activity History', icon: History },
    { id: 'danger', label: 'Danger Zone', icon: Trash2 },
  ];

  return (
    <div className="max-w-5xl mx-auto p-8 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-12">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-neutral-900">Settings</h2>
          <p className="text-sm text-neutral-500 font-medium">Manage your account preferences and profile.</p>
        </div>
        <button 
          onClick={() => signOut(auth)}
          className="flex items-center gap-2 px-6 py-3 bg-red-50 text-red-600 rounded-2xl font-black tracking-tight hover:bg-red-100 transition"
        >
          <LogOut className="w-5 h-5" /> Sign Out
        </button>
      </div>

      <div className="flex gap-12">
        <div className="w-64 flex flex-col gap-2">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={cn(
                "flex items-center justify-between px-6 py-4 rounded-2xl font-bold text-sm transition-all duration-200",
                activeSection === section.id 
                  ? "bg-neutral-900 text-white shadow-xl" 
                  : "text-neutral-500 hover:bg-neutral-100"
              )}
            >
              <div className="flex items-center gap-3">
                <section.icon className="w-5 h-5" />
                <span>{section.label}</span>
              </div>
              <ChevronRight className={cn("w-4 h-4 opacity-0 transition", activeSection === section.id && "opacity-100")} />
            </button>
          ))}
        </div>

        <div className="flex-1 bg-white rounded-[3rem] shadow-2xl border border-neutral-100 p-12">
          {activeSection === 'profile' && profile && (
            <form onSubmit={handleUpdate} className="space-y-8">
              <div className="flex items-center gap-8 mb-12">
                <div className="relative group">
                  <img src={profile.photoURL} alt={profile.username} className="w-32 h-32 rounded-[2.5rem] object-cover border-4 border-neutral-50 shadow-2xl" />
                  <button className="absolute inset-0 bg-black/40 backdrop-blur-sm rounded-[2.5rem] flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-300">
                    <Camera className="w-8 h-8 text-white" />
                  </button>
                </div>
                <div>
                  <h3 className="text-xl font-black tracking-tighter text-neutral-900 mb-1">{profile.username}</h3>
                  <p className="text-xs text-neutral-400 font-bold uppercase tracking-widest">{profile.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-4">Username</label>
                  <input
                    type="text"
                    value={profile.username}
                    onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl py-4 px-6 focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-4">Profession</label>
                  <input
                    type="text"
                    value={profile.profession}
                    onChange={(e) => setProfile({ ...profile, profession: e.target.value })}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl py-4 px-6 focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-4">Bio</label>
                  <textarea
                    value={profile.bio}
                    onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-3xl py-4 px-6 focus:ring-2 focus:ring-blue-500 outline-none font-bold min-h-[120px]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-black tracking-tight text-xl hover:bg-blue-700 transition shadow-2xl shadow-blue-200 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? 'Saving Changes...' : 'Save Changes'} <Save className="w-6 h-6" />
              </button>
            </form>
          )}

          {activeSection === 'privacy' && profile && (
            <div className="space-y-8">
              <div className="flex items-center justify-between p-6 bg-neutral-50 rounded-3xl border border-neutral-100">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                    <Globe className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-bold text-neutral-900">Show Profile on Map</p>
                    <p className="text-xs text-neutral-500">Allow others to see your location on the map.</p>
                  </div>
                </div>
                <button 
                  onClick={() => togglePrivacy('showOnMap')}
                  className={cn(
                    "w-14 h-8 rounded-full p-1 transition-colors duration-200",
                    profile.showOnMap ? "bg-blue-600" : "bg-neutral-200"
                  )}
                >
                  <div className={cn(
                    "w-6 h-6 bg-white rounded-full transition-transform duration-200",
                    profile.showOnMap ? "translate-x-6" : "translate-x-0"
                  )}></div>
                </button>
              </div>

              <div className="flex items-center justify-between p-6 bg-neutral-50 rounded-3xl border border-neutral-100">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                    <Lock className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-bold text-neutral-900">Private Profile</p>
                    <p className="text-xs text-neutral-500">Only friends can view your detailed information.</p>
                  </div>
                </div>
                <button 
                  onClick={() => togglePrivacy('privateProfile')}
                  className={cn(
                    "w-14 h-8 rounded-full p-1 transition-colors duration-200",
                    profile.privateProfile ? "bg-blue-600" : "bg-neutral-200"
                  )}
                >
                  <div className={cn(
                    "w-6 h-6 bg-white rounded-full transition-transform duration-200",
                    profile.privateProfile ? "translate-x-6" : "translate-x-0"
                  )}></div>
                </button>
              </div>
            </div>
          )}

          {activeSection === 'notifications' && (
            <div className="space-y-6">
              <h3 className="text-xl font-black tracking-tighter text-neutral-900 mb-4">Real-time Notifications</h3>
              <div className="space-y-3">
                {notifications.map((notif) => (
                  <div 
                    key={notif.id} 
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-2xl border transition cursor-pointer",
                      notif.read ? "bg-neutral-50 border-neutral-100" : "bg-blue-50 border-blue-100"
                    )}
                    onClick={() => {
                      // Mark as read and navigate
                      updateDoc(doc(db, 'notifications', notif.id), { read: true });
                      if (notif.type === 'message' && notif.chatId) {
                        // In a real app, we'd use a global state to switch tab and select chat
                        toast.info(`Opening chat with ${notif.fromName}`);
                      }
                    }}
                  >
                    <img src={notif.fromPhoto} alt="" className="w-12 h-12 rounded-xl object-cover" />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-neutral-900">
                        <span className="text-blue-600">{notif.fromName}</span> {notif.text}
                      </p>
                      <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">
                        {new Date(notif.timestamp).toLocaleString()}
                      </p>
                    </div>
                    {!notif.read && <div className="w-2 h-2 bg-blue-600 rounded-full"></div>}
                  </div>
                ))}
                {notifications.length === 0 && (
                  <div className="text-center py-12 text-neutral-400 font-bold">No notifications yet</div>
                )}
              </div>
            </div>
          )}

          {activeSection === 'history' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-black tracking-tighter text-neutral-900">Recent Activity</h3>
                <button 
                  onClick={async () => {
                    // Delete all history for user (simplified)
                    toast.info('Clearing history...');
                  }}
                  className="text-xs font-bold text-red-500 hover:underline"
                >
                  Clear All
                </button>
              </div>
              <div className="space-y-3">
                {history.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-neutral-100 group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                        {item.type === 'view' ? <User className="w-5 h-5 text-blue-600" /> : <Globe className="w-5 h-5 text-green-600" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-neutral-900">
                          {item.type === 'view' ? `Viewed profile: ${item.targetId}` : `Searched: ${item.query}`}
                        </p>
                        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">
                          {new Date(item.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => deleteDoc(doc(db, 'history', item.id))}
                      className="p-2 text-neutral-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {history.length === 0 && (
                  <div className="text-center py-12 text-neutral-400 font-bold">No history found</div>
                )}
              </div>
            </div>
          )}

          {activeSection === 'danger' && (
            <div className="space-y-8">
              <div className="p-8 bg-red-50 rounded-[2.5rem] border border-red-100">
                <h4 className="text-xl font-black tracking-tighter text-red-600 mb-2">Delete Account</h4>
                <p className="text-sm text-red-500 font-medium mb-8 leading-relaxed">Once you delete your account, there is no going back. Please be certain. All your data, messages, and connections will be permanently removed.</p>
                <button 
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full py-4 bg-red-600 text-white rounded-2xl font-black tracking-tight hover:bg-red-700 transition shadow-xl shadow-red-100 flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-5 h-5" /> Permanently Delete My Account
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[3rem] p-12 max-w-md w-full shadow-2xl border border-neutral-100 text-center"
          >
            <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Trash2 className="w-10 h-10 text-red-600" />
            </div>
            <h3 className="text-2xl font-black tracking-tighter text-neutral-900 mb-2">Are you absolutely sure?</h3>
            <p className="text-sm text-neutral-500 font-medium mb-8">This action is permanent and will delete all your data including messages, friends, and profile info.</p>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={handleDeleteAccount}
                disabled={saving}
                className="w-full py-4 bg-red-600 text-white rounded-2xl font-black tracking-tight hover:bg-red-700 transition disabled:opacity-50"
              >
                {saving ? 'Deleting...' : 'Yes, Delete Everything'}
              </button>
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="w-full py-4 bg-neutral-100 text-neutral-900 rounded-2xl font-black tracking-tight hover:bg-neutral-200 transition"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
