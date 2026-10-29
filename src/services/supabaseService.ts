import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { AppState } from "../types";

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || "";
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "";

export let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.error("Gagal inisialisasi Supabase client:", err);
  }
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export const supabaseService = {
  /**
   * Status konfigurasi Supabase
   */
  isConfigured(): boolean {
    return !!supabaseUrl && !!supabaseAnonKey;
  },

  /**
   * Inisialisasi runtime client jika user menginput URL & Anon Key di UI
   */
  initClient(url: string, key: string): SupabaseClient {
    supabase = createClient(url, key);
    return supabase;
  },

  /**
   * Tes koneksi ke Supabase
   */
  async testConnection(customUrl?: string, customKey?: string): Promise<{ success: boolean; message: string }> {
    const client = (customUrl && customKey) ? createClient(customUrl, customKey) : supabase;
    if (!client) {
      return {
        success: false,
        message: "Supabase URL atau Anon Key belum dikonfigurasi di file .env atau modal.",
      };
    }

    try {
      // Tes query tabel tp1_sessions atau auth ping
      const { data, error } = await client.from("tp1_sessions").select("id").limit(1);
      if (error && error.code !== "PGRST116" && !error.message.includes("relation") && !error.message.includes("does not exist")) {
        return { success: false, message: error.message };
      }
      return { success: true, message: "Koneksi ke Supabase berhasil aktif!" };
    } catch (err: any) {
      return { success: false, message: err.message || "Gagal menghubungi Supabase" };
    }
  },

  /**
   * Simpan session state ke Supabase PostgreSQL (tabel: tp1_sessions)
   */
  async saveSessionToSupabase(sessionId: string, state: AppState): Promise<{ success: boolean; error?: string }> {
    if (!supabase) {
      return { success: false, error: "Supabase belum diinisialisasi" };
    }
    try {
      const { error } = await supabase.from("tp1_sessions").upsert({
        id: sessionId,
        payload: state,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Load session state dari Supabase PostgreSQL
   */
  async loadSessionFromSupabase(sessionId: string): Promise<{ success: boolean; data?: AppState; error?: string }> {
    if (!supabase) {
      return { success: false, error: "Supabase belum diinisialisasi" };
    }
    try {
      const { data, error } = await supabase.from("tp1_sessions").select("payload").eq("id", sessionId).single();
      if (error) throw error;
      return { success: true, data: data?.payload as AppState };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};
