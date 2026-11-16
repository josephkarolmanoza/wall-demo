import { createWallPost, getWallPosts, WallStorageConfigurationError } from "@/lib/wall-posts";

export const runtime = "nodejs";

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof WallStorageConfigurationError) {
    return Response.json({ error: error.message }, { status: 503 });
  }
  const detail = error instanceof Error
    ? error.message
    : typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
      ? error.message
      : "";
  if (detail) console.error("Wall storage error:", detail);
  return Response.json({ error: detail ? `${fallback} ${detail}` : fallback }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const visitorId = new URL(request.url).searchParams.get("visitorId") ?? "";
    return Response.json(await getWallPosts(visitorId), {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    return errorResponse(error, "The wall feed is unavailable right now.");
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a valid message to post." }, { status: 400 });
  }

  const message = typeof body === "object" && body !== null && "message" in body
    ? (body as { message: unknown }).message
    : undefined;
  const name = typeof body === "object" && body !== null && "name" in body
    ? (body as { name: unknown }).name
    : undefined;
  const avatarUrl = typeof body === "object" && body !== null && "avatarUrl" in body
    ? (body as { avatarUrl: unknown }).avatarUrl
    : null;
  const imageUrl = typeof body === "object" && body !== null && "imageUrl" in body
    ? (body as { imageUrl: unknown }).imageUrl
    : null;

  if (typeof message !== "string") {
    return Response.json({ error: "Write a message or attach an image before sharing." }, { status: 400 });
  }

  const trimmedMessage = message.trim();
  if (trimmedMessage.length > 280) {
    return Response.json({ error: "Messages must be 280 characters or fewer." }, { status: 400 });
  }

  if (typeof name !== "string" || !name.trim() || name.trim().length > 40) {
    return Response.json({ error: "Add a username of 1 to 40 characters before sharing." }, { status: 400 });
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicAvatarPrefix = supabaseUrl
    ? `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/avatars/`
    : null;
  if (avatarUrl !== null && (typeof avatarUrl !== "string" || !publicAvatarPrefix || !avatarUrl.startsWith(publicAvatarPrefix))) {
    return Response.json({ error: "Choose a profile photo stored in this app's Supabase project." }, { status: 400 });
  }

  const publicPostImagePrefix = supabaseUrl
    ? `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/post-images/`
    : null;
  if (imageUrl !== null && (typeof imageUrl !== "string" || !publicPostImagePrefix || !imageUrl.startsWith(publicPostImagePrefix))) {
    return Response.json({ error: "Choose a post image stored in this app's Supabase project." }, { status: 400 });
  }
  if (!trimmedMessage && imageUrl === null) {
    return Response.json({ error: "Write a message or attach an image before sharing." }, { status: 400 });
  }

  try {
    const post = await createWallPost(trimmedMessage, name.trim(), avatarUrl as string | null, imageUrl as string | null);
    return Response.json(post, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Your message could not be saved. Please try again.");
  }
}
