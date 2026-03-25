import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc, limit, setDoc, updateDoc, increment, startAfter, getDocs } from 'firebase/firestore';
import { Message, UserProfile, Conversation } from '../types';
import { Send, Phone, Video, MoreVertical, Smile, Check, CheckCheck, MessageSquare, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn, handleQuotaError } from '../lib/utils';

interface ChatInboxProps {
  selectedChatId: string | null;
}

export default function ChatInbox({ selectedChatId }: ChatInboxProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(selectedChatId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [targetUser, setTargetUser] = useState<UserProfile | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [remoteTyping, setRemoteTyping] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [lastVisibleConv, setLastVisibleConv] = useState<any>(null);
  const [hasMoreConvs, setHasMoreConvs] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inboxScrollRef = useRef<HTMLDivElement>(null);

  // Fetch conversations
  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', auth.currentUser.uid),
      orderBy('lastMessageTimestamp', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, async (snap) => {
      const convs = await Promise.all(snap.docs.map(async (d) => {
        const data = d.data() as Conversation;
        const targetId = data.participants.find(p => p !== auth.currentUser?.uid);
        let targetUserData;
        if (targetId) {
          const uSnap = await getDoc(doc(db, 'users', targetId));
          targetUserData = uSnap.data() as UserProfile;
        }
        return { id: d.id, ...data, targetUser: targetUserData };
      }));
      setConversations(convs);
      setLastVisibleConv(snap.docs[snap.docs.length - 1]);
      setLoadingConversations(false);
    }, (err) => {
      handleQuotaError(err, 'ChatInbox Conversations');
      setLoadingConversations(false);
    });

    return () => unsubscribe();
  }, []);

  // Infinite scroll for conversations
  const loadMoreConversations = async () => {
    if (!auth.currentUser || !lastVisibleConv || !hasMoreConvs) return;

    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', auth.currentUser.uid),
      orderBy('lastMessageTimestamp', 'desc'),
      startAfter(lastVisibleConv),
      limit(20)
    );

    const snap = await getDocs(q);
    if (snap.empty) {
      setHasMoreConvs(false);
      return;
    }

    const newConvs = await Promise.all(snap.docs.map(async (d) => {
      const data = d.data() as Conversation;
      const targetId = data.participants.find(p => p !== auth.currentUser?.uid);
      let targetUserData;
      if (targetId) {
        const uSnap = await getDoc(doc(db, 'users', targetId));
        targetUserData = uSnap.data() as UserProfile;
      }
      return { id: d.id, ...data, targetUser: targetUserData };
    }));

    setConversations(prev => [...prev, ...newConvs]);
    setLastVisibleConv(snap.docs[snap.docs.length - 1]);
  };

  // Handle selectedChatId from props
  useEffect(() => {
    if (selectedChatId && auth.currentUser) {
      if (selectedChatId === auth.currentUser.uid) {
        toast.error("You cannot message yourself!");
        return;
      }
      setActiveChat(selectedChatId);
      
      // Ensure conversation exists
      const convId = [auth.currentUser.uid, selectedChatId].sort().join('_');
      getDoc(doc(db, 'conversations', convId)).then(snap => {
        if (!snap.exists()) {
          setDoc(doc(db, 'conversations', convId), {
            participants: [auth.currentUser!.uid, selectedChatId],
            lastMessage: '',
            lastMessageTimestamp: new Date().toISOString(),
            lastMessageSenderId: '',
            unreadCount: { [auth.currentUser!.uid]: 0, [selectedChatId]: 0 }
          });
        }
      });
    }
  }, [selectedChatId]);

  // Fetch messages and target user info
  useEffect(() => {
    if (!activeChat || !auth.currentUser) return;

    // Fetch target user info
    getDoc(doc(db, 'users', activeChat)).then(snap => {
      if (snap.exists()) setTargetUser(snap.data() as UserProfile);
    });

    // Fetch messages
    const convId = [auth.currentUser.uid, activeChat].sort().join('_');
    const q = query(
      collection(db, 'conversations', convId, 'messages'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs.reverse());
      
      // Mark as read
      updateDoc(doc(db, 'conversations', convId), {
        [`unreadCount.${auth.currentUser!.uid}`]: 0
      });
    }, (err) => {
      handleQuotaError(err, 'ChatInbox Messages');
    });

    // Listen for typing status
    const unsubTyping = onSnapshot(doc(db, 'conversations', convId), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Conversation;
        setRemoteTyping(!!data.typing?.[activeChat]);
      }
    }, (err) => {
      if (err.code !== 'resource-exhausted') {
        console.error('Typing status error:', err);
      }
    });

    return () => {
      unsubscribe();
      unsubTyping();
    };
  }, [activeChat]);

  // Handle typing status updates
  useEffect(() => {
    if (!activeChat || !auth.currentUser) return;
    const convId = [auth.currentUser.uid, activeChat].sort().join('_');
    
    const updateTyping = async (typing: boolean) => {
      try {
        await updateDoc(doc(db, 'conversations', convId), {
          [`typing.${auth.currentUser!.uid}`]: typing
        });
      } catch (err) {
        console.error('Error updating typing status:', err);
      }
    };

    if (newMessage.length > 0) {
      if (!isTyping) {
        setIsTyping(true);
        updateTyping(true);
      }
      
      const timeout = setTimeout(() => {
        setIsTyping(false);
        updateTyping(false);
      }, 3000);
      
      return () => clearTimeout(timeout);
    } else if (isTyping) {
      setIsTyping(false);
      updateTyping(false);
    }
  }, [newMessage, activeChat]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat || !auth.currentUser) return;

    const convId = [auth.currentUser.uid, activeChat].sort().join('_');
    const timestamp = new Date().toISOString();
    const msgData = {
      senderId: auth.currentUser.uid,
      receiverId: activeChat,
      text: newMessage,
      timestamp,
      read: false
    };

    setNewMessage('');
    
    try {
      await addDoc(collection(db, 'conversations', convId, 'messages'), msgData);
      await updateDoc(doc(db, 'conversations', convId), {
        lastMessage: newMessage,
        lastMessageTimestamp: timestamp,
        lastMessageSenderId: auth.currentUser.uid,
        [`unreadCount.${activeChat}`]: increment(1)
      });

      // Create notification for receiver
      const currentUserSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const currentUserData = currentUserSnap.data() as UserProfile;
      
      await addDoc(collection(db, 'notifications'), {
        uid: activeChat,
        fromId: auth.currentUser.uid,
        fromName: currentUserData.username,
        fromPhoto: currentUserData.photoURL,
        type: 'message',
        text: `sent you a message: ${newMessage.substring(0, 30)}${newMessage.length > 30 ? '...' : ''}`,
        chatId: auth.currentUser.uid,
        read: false,
        timestamp
      });
    } catch (err: any) {
      console.error('Error sending message:', err);
      toast.error("Failed to send message");
    }
  };

  const handleCall = () => {
    toast.info("Voice and video calls will be available in the next update!");
  };

  return (
    <div className="flex h-full bg-white relative overflow-hidden">
      {/* Conversations List */}
      <div className={cn(
        "w-full lg:w-96 border-r border-neutral-100 flex flex-col transition-all duration-300",
        activeChat && "hidden lg:flex"
      )}>
        <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
          <h2 className="text-2xl font-black tracking-tighter text-neutral-900">Messages</h2>
          <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-blue-600" />
          </div>
        </div>
        <div 
          className="flex-1 overflow-y-auto"
          ref={inboxScrollRef}
          onScroll={(e) => {
            const target = e.target as HTMLDivElement;
            if (target.scrollHeight - target.scrollTop === target.clientHeight) {
              loadMoreConversations();
            }
          }}
        >
          {loadingConversations ? (
            <div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div></div>
          ) : conversations.length > 0 ? (
            conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => setActiveChat(conv.targetUser?.uid || null)}
                className={cn(
                  "flex items-center gap-4 p-5 cursor-pointer transition-all duration-200 border-b border-neutral-50",
                  activeChat === conv.targetUser?.uid ? "bg-blue-50 border-r-4 border-blue-600" : "hover:bg-neutral-50"
                )}
              >
                <div className="relative">
                  <img src={conv.targetUser?.photoURL} alt={conv.targetUser?.username} className="w-14 h-14 rounded-2xl object-cover shadow-sm" />
                  {conv.targetUser?.isOnline && <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-sm"></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <p className="font-black text-sm text-neutral-900 truncate">{conv.targetUser?.username}</p>
                    <span className="text-[10px] text-neutral-400 font-bold">
                      {conv.lastMessageTimestamp ? format(new Date(conv.lastMessageTimestamp), 'h:mm a') : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className={cn(
                      "text-xs truncate font-medium",
                      conv.unreadCount?.[auth.currentUser?.uid || ''] > 0 ? "text-neutral-900 font-black" : "text-neutral-500"
                    )}>
                      {conv.lastMessageSenderId === auth.currentUser?.uid ? 'You: ' : ''}{conv.lastMessage || 'Start a conversation'}
                    </p>
                    {conv.unreadCount?.[auth.currentUser?.uid || ''] > 0 && (
                      <div className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                        {conv.unreadCount[auth.currentUser!.uid]}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center">
              <p className="text-neutral-400 font-bold text-sm">No conversations yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* Chat Window */}
      <div className={cn(
        "flex-1 flex flex-col bg-neutral-50 transition-all duration-300",
        !activeChat && "hidden lg:flex"
      )}>
        {activeChat && targetUser ? (
          <>
            <div className="h-20 bg-white border-b border-neutral-100 px-4 lg:px-8 flex items-center justify-between shadow-sm z-10">
              <div className="flex items-center gap-3 lg:gap-4">
                <button 
                  onClick={() => setActiveChat(null)}
                  className="lg:hidden p-2 text-neutral-400 hover:bg-neutral-50 rounded-xl transition"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <div className="relative">
                  <img src={targetUser.photoURL} alt={targetUser.username} className="w-10 h-10 lg:w-12 lg:h-12 rounded-2xl object-cover" />
                  {targetUser.isOnline && <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>}
                </div>
                <div>
                  <p className="font-black text-neutral-900 leading-tight text-sm lg:text-base">{targetUser.username}</p>
                  {remoteTyping ? (
                    <p className="text-[9px] lg:text-[10px] text-blue-600 font-black animate-pulse uppercase tracking-widest">Typing...</p>
                  ) : (
                    <p className="text-[9px] lg:text-[10px] text-green-500 font-bold tracking-widest uppercase">{targetUser.isOnline ? 'Online Now' : 'Offline'}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 lg:gap-2">
                <button onClick={handleCall} className="p-2 lg:p-3 text-neutral-400 hover:bg-neutral-50 hover:text-blue-600 rounded-xl transition"><Phone className="w-5 h-5" /></button>
                <button onClick={handleCall} className="p-2 lg:p-3 text-neutral-400 hover:bg-neutral-50 hover:text-blue-600 rounded-xl transition"><Video className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-6">
              {messages.map((msg, idx) => {
                const isMe = msg.senderId === auth.currentUser?.uid;
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn("flex flex-col", isMe ? "items-end" : "items-start")}
                  >
                    <div className={cn(
                      "max-w-[85%] lg:max-w-[70%] p-4 rounded-3xl shadow-sm relative",
                      isMe ? "bg-blue-600 text-white rounded-tr-none" : "bg-white text-neutral-900 rounded-tl-none"
                    )}>
                      <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
                      <div className={cn("flex items-center gap-1 mt-1", isMe ? "justify-end" : "justify-start")}>
                        <span className={cn("text-[9px] font-bold", isMe ? "text-blue-100" : "text-neutral-400")}>
                          {format(new Date(msg.timestamp), 'h:mm a')}
                        </span>
                        {isMe && (msg.read ? <CheckCheck className="w-3 h-3 text-blue-100" /> : <Check className="w-3 h-3 text-blue-100" />)}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              <div ref={scrollRef} />
            </div>

            <div className="p-4 lg:p-6 bg-white border-t border-neutral-100">
              <form onSubmit={handleSendMessage} className="flex items-center gap-2 lg:gap-4">
                <button type="button" className="p-2 lg:p-3 text-neutral-400 hover:bg-neutral-50 rounded-xl transition"><Smile className="w-6 h-6" /></button>
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1 bg-neutral-50 border-none rounded-2xl py-3 lg:py-4 px-4 lg:px-6 focus:ring-2 focus:ring-blue-500 transition-all outline-none font-medium text-sm"
                />
                <button 
                  type="submit"
                  className="p-3 lg:p-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition shadow-xl shadow-blue-100"
                >
                  <Send className="w-5 h-5 lg:w-6 lg:h-6" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
            <div className="w-24 h-24 bg-blue-50 rounded-[2rem] flex items-center justify-center mb-6">
              <MessageSquare className="w-12 h-12 text-blue-600" />
            </div>
            <h3 className="text-2xl font-black tracking-tighter text-neutral-900 mb-2">Your Inbox</h3>
            <p className="text-neutral-500 font-medium max-w-xs">Select a conversation from the left to start chatting with your mates.</p>
          </div>
        )}
      </div>
    </div>
  );
}
