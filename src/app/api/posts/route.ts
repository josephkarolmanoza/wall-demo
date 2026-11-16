import { createWallPost, getWallPosts, WallStorageConfigurationError } from "@/lib/wall-posts";

export const runtime = "nodejs";

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof WallStorageConfigurationError) {
    return Response.json({ error: error.message }, { status: 503 });
  }
  return Response.json({ error: fallback }, { status: 500 });
}

export async function GET() {
  try {
    return Response.json(await getWallPosts(), {
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

  if (typeof message !== "string" || !message.trim()) {
    return Response.json({ error: "Write a message before sharing." }, { status: 400 });
  }

  const trimmedMessage = message.trim();
  if (trimmedMessage.length > 280) {
    return Response.json({ error: "Messages must be 280 characters or fewer." }, { status: 400 });
  }

  if (typeof name !== "string" || !name.trim() || name.trim().length > 40) {
    return Response.json({ error: "Add a username of 1 to 40 characters before sharing." }, { status: 400 });
  }

  try {
    const post = await createWallPost(trimmedMessage, name.trim());
    return Response.json(post, { status: 201 });
  } catch (error) {
    return errorResponse(error, "Your message could not be saved. Please try again.");
  }
}
