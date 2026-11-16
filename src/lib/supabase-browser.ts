import { createClient } from "@supabase/supabase-js";

export function getBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) throw new Error("Supabase is not configured for photo uploads.");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function uploadAvatar(dataUrl: string) {
  const image = await fetch(dataUrl);
  const file = await image.blob();
  const path = `${crypto.randomUUID()}.jpg`;
  const supabase = getBrowserSupabase();
  const { error } = await supabase.storage.from("avatars").upload(path, file, {
    contentType: "image/jpeg",
    upsert: false,
  });

  if (error) throw new Error(error.message);
  return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}

export async function uploadPostImage(file: File) {
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  const extension = extensions[file.type];
  if (!extension) throw new Error("Choose a JPEG, PNG, WebP, or GIF image.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Choose an image smaller than 5 MB.");

  const path = `${crypto.randomUUID()}.${extension}`;
  const supabase = getBrowserSupabase();
  const { error } = await supabase.storage.from("post-images").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) throw new Error(error.message);
  return supabase.storage.from("post-images").getPublicUrl(path).data.publicUrl;
}
