import type { SupabaseClient } from "@supabase/supabase-js";

/** Workaround for @supabase/ssr@0.7.0 missing OTP type methods */
type AuthError = { message: string; code?: string; hint?: string; details?: string };
export type AuthLike = {
  getUser: () => Promise<{ data: { user: { id: string; email?: string } | null }; error: AuthError | null }>;
  signInWithOtp: (params: { email: string; options?: { shouldCreateUser?: boolean } }) => Promise<{ data: unknown; error: AuthError | null }>;
  verifyOtp: (params: { email: string; token: string; type: string }) => Promise<{ data: unknown; error: AuthError | null }>;
  signInWithPassword: (params: { email: string; password: string }) => Promise<{ data: unknown; error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  admin: {
    listUsers: (params?: { page?: number; perPage?: number }) => Promise<{ data: { users: Array<{ id: string; email?: string; created_at: string; last_sign_in_at?: string }>; total: number; page: number; perPage: number }; error: AuthError | null }>;
    deleteUser: (id: string) => Promise<{ data: unknown; error: AuthError | null }>;
  };
};

export function getAuth(supabase: SupabaseClient): AuthLike {
  return supabase.auth as unknown as AuthLike;
}

/** Shared Supabase query result shapes for joined queries */
export interface PlotRow {
  id: string;
  plot_number: string;
  plot_size: number;
  plot_size_unit: string;
  street: string;
  status: string;
  inspection_status: string;
  approval_status: string;
  latitude: number | null;
  longitude: number | null;
  block: { block_number: string } | { block_number: string }[] | null;
  estate: { name: string } | { name: string }[] | null;
}

export interface PlotListItem {
  id: string;
  plotNumber: string;
  status: string;
  inspectionStatus: string;
  approvalStatus: string;
  assignmentStatus: string | null;
  lat: number | null;
  lng: number | null;
  block: string;
  estate: string;
}

/** Normalize Supabase join result (returns object or array) to first item */
export function first<T>(val: T | T[] | null): T | null {
  if (!val) return null;
  return Array.isArray(val) ? val[0] ?? null : val;
}
