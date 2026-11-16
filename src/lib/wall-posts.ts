import { createClient } from "@supabase/supabase-js";

export type WallComment = { id: number | string; name: string; message: string; createdAt: string; avatarUrl: string | null };
export type WallPost = {
  id: number | string;
  name: string;
  message: string;
  createdAt: string;
  avatarUrl: string | null;
  imageUrl: string | null;
  likes: number;
  likedByMe: boolean;
  comments: WallComment[];
};

type SupabaseWallPost = {
  id: number | string;
  name: string;
  body: string;
  created_at: string;
  avatar_url: string | null;
  image_url: string | null;
};

type SupabaseWallComment = {
  id: number | string;
  post_id: number | string;
  name: string;
  body: string;
  created_at: string;
  avatar_url: string | null;
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

function mapPost(row: SupabaseWallPost, likes: { post_id: number | string; visitor_id: string }[], comments: SupabaseWallComment[], visitorId: string): WallPost {
  const postComments = comments.filter((comment) => String(comment.post_id) === String(row.id));
  return {
    id: row.id,
    name: row.name,
    message: row.body,
    createdAt: new Date(row.created_at).toISOString(),
    avatarUrl: row.avatar_url,
    imageUrl: row.image_url,
    likes: likes.filter((like) => String(like.post_id) === String(row.id)).length,
    likedByMe: likes.some((like) => String(like.post_id) === String(row.id) && like.visitor_id === visitorId),
    comments: postComments.map((comment) => ({
      id: comment.id,
      name: comment.name,
      message: comment.body,
      createdAt: new Date(comment.created_at).toISOString(),
      avatarUrl: comment.avatar_url,
    })),
  };
}

export async function getWallPosts(visitorId: string): Promise<WallPost[]> {
  const supabase = getSupabase();
  const [postsResult, likesResult, commentsResult] = await Promise.all([
    supabase.from("posts").select("id, name, body, created_at, avatar_url, image_url").order("created_at", { ascending: false }).order("id", { ascending: false }),
    supabase.from("post_likes").select("post_id, visitor_id"),
    supabase.from("post_comments").select("id, post_id, name, body, created_at, avatar_url").order("created_at", { ascending: true }),
  ]);

  if (postsResult.error) throw postsResult.error;
  if (likesResult.error) throw likesResult.error;
  if (commentsResult.error) throw commentsResult.error;
  const likes = likesResult.data as { post_id: number | string; visitor_id: string }[];
  const comments = commentsResult.data as SupabaseWallComment[];
  return (postsResult.data as SupabaseWallPost[]).map((post) => mapPost(post, likes, comments, visitorId));
}

export async function createWallPost(message: string, name: string, avatarUrl: string | null, imageUrl: string | null): Promise<WallPost> {
  const { data, error } = await getSupabase()
    .from("posts")
    .insert({ name, body: message, avatar_url: avatarUrl, image_url: imageUrl })
    .select("id, name, body, created_at, avatar_url, image_url")
    .single();

  if (error) throw error;
  const post = data as SupabaseWallPost;
  return { ...mapPost(post, [], [], ""), likes: 0, likedByMe: false, comments: [] };
}

export async function toggleWallLike(postId: string, visitorId: string) {
  const supabase = getSupabase();
  const { data: existingLike, error: lookupError } = await supabase
    .from("post_likes")
    .select("post_id")
    .eq("post_id", postId)
    .eq("visitor_id", visitorId)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (existingLike) {
    const { error } = await supabase.from("post_likes").delete().eq("post_id", postId).eq("visitor_id", visitorId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("post_likes").insert({ post_id: postId, visitor_id: visitorId });
    if (error) throw error;
  }

  const { count, error: countError } = await supabase
    .from("post_likes")
    .select("post_id", { count: "exact", head: true })
    .eq("post_id", postId);
  if (countError) throw countError;
  return { likes: count ?? 0, likedByMe: !existingLike };
}

export async function createWallComment(postId: string, name: string, message: string, avatarUrl: string | null, visitorId: string): Promise<WallComment> {
  const { data, error } = await getSupabase()
    .from("post_comments")
    .insert({ post_id: postId, name, body: message, avatar_url: avatarUrl, visitor_id: visitorId })
    .select("id, post_id, name, body, created_at, avatar_url")
    .single();
  if (error) throw error;
  const comment = data as SupabaseWallComment;
  return {
    id: comment.id,
    name: comment.name,
    message: comment.body,
    createdAt: new Date(comment.created_at).toISOString(),
    avatarUrl: comment.avatar_url,
  };
}
