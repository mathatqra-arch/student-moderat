export type Announcement = {
  id: string;
  title: string;
  content: string;
  /** تصنيف ديناميكي من جدول categories — مش مقيد بقيم ثابتة */
  category: string;
  is_pinned: boolean;
  created_by?: string;
  created_at: string;
};

export type Task = {
  id: string;
  subject: string;
  title: string;
  description?: string;
  deadline: string;
  status: 'active' | 'closed';
  created_at: string;
};

export type Inquiry = {
  id: string;
  full_name: string;
  whatsapp_number: string;
  message: string;
  /** تصنيف ديناميكي من جدول categories — مش مقيد بقيم ثابتة */
  category: string;
  status: 'new' | 'in_progress' | 'resolved' | 'archived';
  ai_suggestion?: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
};

export type QuickLink = {
  id: string;
  title: string;
  url: string;
  type: 'schedule' | 'group' | 'material' | 'drive';
  icon?: string;
  order_index: number;
  created_at: string;
};

export type TeamMember = {
  id: string;
  user_id: string;
  name: string;
  role: 'super_admin' | 'leader' | 'assistant';
  created_at: string;
};
