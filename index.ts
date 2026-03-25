export interface UserProfile {
  uid: string;
  username: string;
  fullName: string;
  email: string;
  photoURL: string;
  bio: string;
  gender: string;
  religion: string;
  language: string;
  age: number;
  relationshipStatus: string;
  profession: string;
  economicClass: string;
  location: {
    lat: number;
    lng: number;
    lastUpdated: string;
  };
  isOnline: boolean;
  lastSeen: string;
  showOnMap: boolean;
  privateProfile: boolean;
  showOnDiscover: boolean;
  stats: {
    views: number;
    likes: number;
    friendsCount: number;
  };
}

export interface AppNotification {
  id: string;
  uid: string; // Recipient
  fromId: string; // Sender
  fromName: string;
  fromPhoto: string;
  type: 'message' | 'friend_request' | 'like';
  text: string;
  chatId?: string; // For message notifications
  read: boolean;
  timestamp: string;
}

export interface FriendRequest {
  id: string;
  from: string;
  to: string;
  status: 'pending' | 'accepted' | 'rejected';
  friendshipType: string;
  closeness: number;
  attractiveness: number;
  createdAt: string;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  timestamp: string;
  read: boolean;
}

export interface Conversation {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageTimestamp: string;
  lastMessageSenderId: string;
  unreadCount: { [uid: string]: number };
  typing?: { [uid: string]: boolean };
  targetUser?: UserProfile; // Joined for UI
}

export interface MapPing {
  id: string;
  uid: string;
  username: string;
  photoURL: string;
  lat: number;
  lng: number;
  timestamp: string;
  type: 'vibe' | 'ping' | 'help';
}

export interface SocialAction {
  id: string;
  fromId: string;
  timestamp: string;
  user?: UserProfile; // Joined for UI
}

export interface Rating {
  id: string;
  from: string;
  to: string;
  personality: number;
  friendliness: number;
  attractiveness: number;
  trustLevel: number;
}

export interface HistoryItem {
  id: string;
  uid: string;
  type: 'search' | 'view';
  targetId?: string;
  query?: string;
  timestamp: string;
}
