export interface User {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  avatarUrl?: string | null;
  createdAt?: string;
}

export interface RoomMember {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  role: 'ADMIN' | 'MEMBER';
}

export interface Message {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  imageUrl?: string | null;
  isEdited: boolean;
  isDeleted: boolean;
  clientTempId?: string | null;
  createdAt: string;
  updatedAt?: string;
  sender: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
  };
}

export interface Room {
  id: string;
  name: string | null;
  displayName: string;
  type: 'GROUP' | 'DIRECT';
  description?: string | null;
  isPrivate: boolean;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  unreadCount: number;
  otherUser?: User | null;
  lastMessage?: {
    id: string;
    content: string;
    imageUrl?: string | null;
    createdAt: string;
    sender: {
      id: string;
      username: string;
      displayName: string;
    };
  } | null;
  members?: RoomMember[];
}

export interface TypingEvent {
  roomId: string;
  user: {
    id: string;
    username: string;
    displayName: string;
  };
}
