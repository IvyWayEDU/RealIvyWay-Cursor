export type SupportConversationStatus = 'open' | 'closed';

export type SupportMessageSender = 'user' | 'ai' | 'admin';

export interface SupportMessage {
  id: string;
  sender: SupportMessageSender;
  senderId?: string; // userId/adminId when applicable
  text: string;
  createdAt: string; // ISO
}

export interface SupportConversation {
  id: string;
  userId: string;
  messages: SupportMessage[];
  status: SupportConversationStatus;
  assignedAdminId?: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  lastReadByUserAt?: string; // ISO
  lastReadByAdminAt?: string; // ISO
}

export type SupportTicketSubject =
  | 'Booking issue'
  | 'Payment issue'
  | 'Technical issue'
  | 'Account issue'
  | 'Other';

export type SupportTicketStatus = 'open' | 'closed';

export interface SupportTicket {
  id: string;
  userId: string;
  role: 'student' | 'provider' | 'admin';
  subject: SupportTicketSubject;
  message: string;
  attachmentUrl?: string | null;
  status: SupportTicketStatus;
  createdAt: string; // ISO
}



