import { toggleWallLike } from "@/lib/wall-posts";

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
    return Response.json({ error: "Couldn't update the like." }, { status: 400 });
  }
  const visitorId = typeof body === "object" && body !== null && "visitorId" in body
    ? (body as { visitorId: unknown }).visitorId
    : undefined;
  if (typeof visitorId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(visitorId)) {
    return Response.json({ error: "Your browser identity is unavailable. Refresh and try again." }, { status: 400 });
  }

  try {
    return Response.json(await toggleWallLike(postId, visitorId));
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Couldn't update the like.";
    console.error("Like update failed:", detail);
    return Response.json({ error: "Couldn't update the like. Check that the Supabase setup has been applied." }, { status: 500 });
  }
}
