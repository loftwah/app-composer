export interface Env {
  DB: D1Database;
  ADMIN_TOKEN?: string;
  PUBLIC_ORIGIN?: string;
}

export interface EventRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  event_date: string;
  start_note: string;
  location: string;
  cost: string;
  publication: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface NoticeRow {
  id: string;
  title: string;
  body: string;
  notice_date: string;
  publication: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface VolunteerRoleRow {
  id: string;
  title: string;
  description: string;
  event_date: string;
  start_note: string;
  location: string;
  capacity: number;
  publication: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  taken?: number;
  remaining?: number;
}

export interface VolunteerSignupRow {
  id: string;
  role_id: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  state: string;
  created_at: string;
}

export interface EnquiryRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  enquiry_type: string;
  message: string;
  review_state: string;
  review_note: string;
  created_at: string;
  reviewed_at: string | null;
}
