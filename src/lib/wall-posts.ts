import { createClient } from "@supabase/supabase-js";

export type WallPost = { id: number | string; name: string; message: string; createdAt: string };

type SupabaseWallPost = {
  id: number | string;
  name: string;
  body: string;
  created_at: string;
};

export class WallStorageConfigurationError extends Error {
  constructor() {
    super("Connect Supabase by setting SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY, then redeploy.");
    this.name = "WallStorageConfigurationError";
  }
}

function getSupabase() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.SUPABASE_ANON_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new WallStorageConfigurationError();

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function mapPost(row: SupabaseWallPost): WallPost {
  return {
    id: row.id,
    name: row.name,
    message: row.body,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function getWallPosts(): Promise<WallPost[]> {
  const { data, error } = await getSupabase()
    .from("posts")
    .select("id, name, body, created_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) throw error;
  return (data as SupabaseWallPost[]).map(mapPost);
}

export async function createWallPost(message: string, name: string): Promise<WallPost> {
  const { data, error } = await getSupabase()
    .from("posts")
    .insert({ name, body: message })
    .select("id, name, body, created_at")
    .single();

  if (error) throw error;
  return mapPost(data as SupabaseWallPost);
}
