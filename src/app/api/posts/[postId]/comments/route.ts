import { createWallComment } from "@/lib/wall-posts";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ postId: string }> }) {
  const { postId: rawPostId } = await context.params;
  const postId = rawPostId;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(postId)) {
    return Response.json({ error: "That post could not be found." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a valid comment." }, { status: 400 });
  }
  const values = typeof body === "object" && body !== null
    ? body as { message?: unknown; name?: unknown; avatarUrl?: unknown; visitorId?: unknown }
    : {};
  if (typeof values.message !== "string" || !values.message.trim() || values.message.trim().length > 280) {
    return Response.json({ error: "Comments must be between 1 and 280 characters." }, { status: 400 });
  }
  if (typeof values.name !== "string" || !values.name.trim() || values.name.trim().length > 40) {
    return Response.json({ error: "Add a username of 1 to 40 characters before commenting." }, { status: 400 });
  }
  if (typeof values.visitorId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(values.visitorId)) {
    return Response.json({ error: "Your browser identity is unavailable. Refresh and try again." }, { status: 400 });
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicAvatarPrefix = supabaseUrl
    ? `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/avatars/`
    : null;
  if (values.avatarUrl !== null && values.avatarUrl !== undefined
    && (typeof values.avatarUrl !== "string" || !publicAvatarPrefix || !values.avatarUrl.startsWith(publicAvatarPrefix))) {
    return Response.json({ error: "Choose a profile photo stored in this app's Supabase project." }, { status: 400 });
  }

  try {
    const comment = await createWallComment(postId, values.name.trim(), values.message.trim(), (values.avatarUrl as string | null | undefined) ?? null, values.visitorId);
    return Response.json(comment, { status: 201 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Couldn't save your comment.";
    console.error("Comment creation failed:", detail);
    return Response.json({ error: "Couldn't save your comment. Check that the Supabase setup has been applied." }, { status: 500 });
  }
}
