"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Heart, ImagePlus, MessageCircle, X } from "lucide-react";
import { uploadAvatar, uploadPostImage } from "@/lib/supabase-browser";

const defaultUsername = "Greg Wientjes";
type WallComment = { id: number | string; name: string; message: string; createdAt: string; avatarUrl: string | null };
type WallPost = {
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

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1
    ? `${Array.from(parts[0])[0]}${Array.from(parts[parts.length - 1])[0]}`
    : Array.from(parts[0] ?? "?").slice(0, 2).join("")).toUpperCase();
}

function formatPostTime(createdAt: string) {
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - Date.parse(createdAt)) / 60_000));
  if (elapsedMinutes < 1) return "now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h`;
  return `${Math.floor(elapsedHours / 24)}d`;
}

export default function Home() {
  const [posts, setPosts] = useState<WallPost[]>([]);
  const [animatedPostId, setAnimatedPostId] = useState<string | null>(null);
  const knownPostIds = useRef<Set<string> | null>(null);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [message, setMessage] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [isUploadingPostImage, setIsUploadingPostImage] = useState(false);
  const [postImageUrl, setPostImageUrl] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [status, setStatus] = useState("");
  const [username, setUsername] = useState(defaultUsername);
  const [networks, setNetworks] = useState("Stanford Alum");
  const [currentCity, setCurrentCity] = useState("Palo Alto, CA");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [visitorId, setVisitorId] = useState("");
  const [likingPostId, setLikingPostId] = useState<string | null>(null);
  const [commentingPostId, setCommentingPostId] = useState<string | null>(null);
  const [openCommentPostIds, setOpenCommentPostIds] = useState<Set<string>>(new Set());
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  const initials = getInitials(username);

  useEffect(() => {
    try {
      const savedUsername = window.localStorage.getItem("wall.username");
      const savedImage = window.localStorage.getItem("wall.profileImage");
      const savedNetworks = window.localStorage.getItem("wall.networks");
      const savedCurrentCity = window.localStorage.getItem("wall.currentCity");
      if (savedUsername) setUsername(savedUsername);
      if (savedImage) setProfileImage(savedImage);
      if (savedNetworks !== null) setNetworks(savedNetworks);
      if (savedCurrentCity !== null) setCurrentCity(savedCurrentCity);
    } catch {
      // The profile still works for this session if browser storage is unavailable.
    }
    setProfileLoaded(true);
  }, []);

  useEffect(() => {
    try {
      let savedVisitorId = window.localStorage.getItem("wall.visitorId");
      if (!savedVisitorId) {
        savedVisitorId = window.crypto.randomUUID();
        window.localStorage.setItem("wall.visitorId", savedVisitorId);
      }
      setVisitorId(savedVisitorId);
    } catch {
      setStatus("Your browser couldn't save the identity needed for likes and comments.");
      setIsLoadingPosts(false);
    }
  }, []);

  useEffect(() => {
    if (!profileLoaded) return;
    try {
      window.localStorage.setItem("wall.username", username);
      window.localStorage.setItem("wall.networks", networks);
      window.localStorage.setItem("wall.currentCity", currentCity);
      if (profileImage) window.localStorage.setItem("wall.profileImage", profileImage);
      else window.localStorage.removeItem("wall.profileImage");
    } catch {
      setPhotoError("This browser couldn't save your profile changes.");
    }
  }, [currentCity, networks, profileImage, profileLoaded, username]);

  useEffect(() => {
    if (!profileLoaded || !profileImage?.startsWith("data:image/")) return;
    let active = true;
    setIsUploadingPhoto(true);
    void uploadAvatar(profileImage)
      .then((avatarUrl) => {
        if (active) setProfileImage(avatarUrl);
      })
      .catch((error) => {
        if (active) setPhotoError(error instanceof Error ? error.message : "That photo couldn't be uploaded to Supabase.");
      })
      .finally(() => {
        if (active) setIsUploadingPhoto(false);
      });
    return () => { active = false; };
  }, [profileImage, profileLoaded]);

  useEffect(() => {
    if (!visitorId) return;
    let active = true;
    const refreshFeed = async () => {
      try {
        const response = await fetch(`/api/posts?visitorId=${encodeURIComponent(visitorId)}`, { cache: "no-store" });
        const latestPosts = await response.json();
        if (!response.ok) throw new Error(latestPosts.error ?? "Feed request failed");
        if (active) {
          const latestIds = new Set<string>(latestPosts.map((post: WallPost) => String(post.id)));
          if (knownPostIds.current) {
            const newPost = latestPosts.find((post: WallPost) => !knownPostIds.current?.has(String(post.id)));
            if (newPost) setAnimatedPostId(String(newPost.id));
          }
          knownPostIds.current = latestIds;
          setPosts(latestPosts);
        }
      } catch (error) {
        if (active) setStatus(error instanceof Error ? error.message : "Couldn't refresh your feed. Retrying shortly…");
      } finally {
        if (active) setIsLoadingPosts(false);
      }
    };

    void refreshFeed();
    const interval = window.setInterval(refreshFeed, 4000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [visitorId]);

  async function uploadProfilePhoto(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setPhotoError("");
    if (!file.type.startsWith("image/")) {
      setPhotoError("Choose an image file to use as your profile photo.");
      input.value = "";
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const image = await createImageBitmap(file);
      const scale = Math.min(1, 700 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not prepare that image.");
      context.fillStyle = "#f5f5f5";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      image.close();
      const imageData = canvas.toDataURL("image/jpeg", 0.82);
      if (imageData.length > 2_500_000) throw new Error("That image is too large. Please choose a smaller one.");
      const avatarUrl = await uploadAvatar(imageData);
      setProfileImage(avatarUrl);
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "That photo couldn't be uploaded.");
    } finally {
      setIsUploadingPhoto(false);
      input.value = "";
    }
  }

  async function addPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = message.trim();
    const authorName = username.trim();
    if ((!trimmed && !postImageUrl) || trimmed.length > 280 || !authorName || authorName.length > 40 || isPosting || isUploadingPhoto || isUploadingPostImage) return;
    setIsPosting(true);
    setStatus("");
    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, name: authorName, avatarUrl: profileImage, imageUrl: postImageUrl }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Your message could not be shared.");
      knownPostIds.current?.add(String(result.id));
      setAnimatedPostId(String(result.id));
      setPosts((currentPosts) => [result, ...currentPosts.filter((post) => post.id !== result.id)]);
      setMessage("");
      setPostImageUrl(null);
      setStatus("Your post has been shared!");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Your message could not be shared.");
    } finally {
      setIsPosting(false);
    }
  }

  async function attachPostImage(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setStatus("");
    setIsUploadingPostImage(true);
    try {
      setPostImageUrl(await uploadPostImage(file));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "That image couldn't be uploaded.");
    } finally {
      setIsUploadingPostImage(false);
      input.value = "";
    }
  }

  async function toggleLike(post: WallPost) {
    const postId = String(post.id);
    if (!visitorId || likingPostId) return;
    setLikingPostId(postId);
    try {
      const response = await fetch(`/api/posts/${postId}/likes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Couldn't update the like.");
      setPosts((currentPosts) => currentPosts.map((item) => item.id === post.id
        ? { ...item, likes: result.likes, likedByMe: result.likedByMe }
        : item));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Couldn't update the like.");
    } finally {
      setLikingPostId(null);
    }
  }

  async function addComment(event: FormEvent<HTMLFormElement>, post: WallPost) {
    event.preventDefault();
    const postId = String(post.id);
    const draft = (commentDrafts[postId] ?? "").trim();
    const authorName = username.trim();
    if (!draft || draft.length > 280 || !authorName || !visitorId || isUploadingPhoto || commentingPostId) return;
    setCommentingPostId(postId);
    try {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: draft, name: authorName, avatarUrl: profileImage, visitorId }),
      });
      const comment = await response.json();
      if (!response.ok) throw new Error(comment.error ?? "Couldn't save your comment.");
      setPosts((currentPosts) => currentPosts.map((item) => item.id === post.id
        ? { ...item, comments: [...item.comments, comment] }
        : item));
      setCommentDrafts((current) => ({ ...current, [postId]: "" }));
      setStatus("Your comment has been added.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Couldn't save your comment.");
    } finally {
      setCommentingPostId(null);
    }
  }

  function toggleComments(postId: string) {
    setOpenCommentPostIds((current) => {
      const updated = new Set(current);
      if (updated.has(postId)) updated.delete(postId);
      else updated.add(postId);
      return updated;
    });
  }

  return (
    <main className="page-shell">
      <header className="topbar"><a href="#top" className="brand" id="top">Wallbook</a></header>

      <div className="layout">
        <aside className="profile-column" aria-label={`${username || "Your"} profile`}>
          <div className="portrait-group">
            <div className={`portrait-wrap${profileImage ? " has-photo" : ""}`} style={profileImage ? { backgroundImage: `url("${profileImage}")` } : undefined}>
              <span className="sr-only">Profile photo for {username || "your profile"}</span>
              {!profileImage && <span className="portrait-initials" aria-hidden="true">{initials}</span>}
              <input className="sr-only" id="profile-photo" type="file" accept="image/*" onChange={uploadProfilePhoto} aria-describedby="photo-error" disabled={isUploadingPhoto} />
              <label className="portrait-caption" htmlFor="profile-photo">{isUploadingPhoto ? "Preparing photo…" : profileImage ? "Change photo" : "Upload photo"}</label>
            </div>
            <p className="photo-error" id="photo-error" role="status">{photoError}</p>
          </div>
          <div className="profile-identity">
            <label className="sr-only" htmlFor="profile-name">Edit your username</label>
            <input id="profile-name" className="username-input" value={username} maxLength={40} onChange={(event) => setUsername(event.target.value)} aria-label="Edit your username" />
            <p className="profile-subtitle">Wallbook</p>
          </div>
          <section className="info-card">
            <h2 className="info-heading">Information</h2>
            <div className="info-content hatched-card">
              <div className="info-field"><label className="info-label" htmlFor="profile-networks">Networks</label><input className="info-value" id="profile-networks" value={networks} maxLength={80} onChange={(event) => setNetworks(event.target.value)} /></div>
              <div className="info-field"><label className="info-label" htmlFor="profile-city">Current City</label><input className="info-value" id="profile-city" value={currentCity} maxLength={80} onChange={(event) => setCurrentCity(event.target.value)} /></div>
            </div>
          </section>
        </aside>

        <section className="wall-column" aria-label={`${username || "Your"}’s Wallbook feed`}>
          <form className="composer" id="wall-form" onSubmit={addPost}>
            <label className="sr-only" htmlFor="wall-message">Write a message for {username || "your"}’s Wallbook feed</label>
            <textarea id="wall-message" value={message} maxLength={280} onChange={(event) => setMessage(event.target.value)} placeholder="What's on your mind?" rows={3} aria-describedby="wall-message-count wall-status" />
            {postImageUrl && <div className="post-image-preview-wrap">
              <img className="post-image-preview" src={postImageUrl} alt="Image attached to your post" />
              <button className="remove-post-image" type="button" onClick={() => setPostImageUrl(null)} aria-label="Remove attached image"><X size={18} /></button>
            </div>}
            <div className="composer-tools">
              <input className="sr-only" id="post-image-upload" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={attachPostImage} disabled={isUploadingPostImage || isPosting} />
              <label className={`attach-image-button${isUploadingPostImage || isPosting ? " is-disabled" : ""}`} htmlFor="post-image-upload" role="button" tabIndex={isUploadingPostImage || isPosting ? -1 : 0} aria-disabled={isUploadingPostImage || isPosting} onKeyDown={(event) => {
                if ((event.key === "Enter" || event.key === " ") && !isUploadingPostImage && !isPosting) {
                  event.preventDefault();
                  document.getElementById("post-image-upload")?.click();
                }
              }}>
                {isUploadingPostImage ? <span className="button-spinner" aria-hidden="true" /> : <ImagePlus size={18} aria-hidden="true" />}
                {isUploadingPostImage ? "Uploading image…" : postImageUrl ? "Change image" : "Add image"}
              </label>
              <span className="image-size-hint">JPEG, PNG, WebP, or GIF · up to 5 MB</span>
            </div>
          </form>
          <div className="share-row">
            <span className="character-count" id="wall-message-count">{280 - message.length} characters remaining</span>
            <Button className="share-button" type="submit" form="wall-form" disabled={isPosting || isUploadingPhoto || isUploadingPostImage || (!message.trim() && !postImageUrl) || !username.trim()}>{(isPosting || isUploadingPhoto || isUploadingPostImage) && <span className="button-spinner" aria-hidden="true" />}{isUploadingPhoto ? "Uploading photo…" : isUploadingPostImage ? "Uploading image…" : isPosting ? "Sharing…" : "Share"}</Button>
          </div>
          <p className="status-message" id="wall-status" role="status">{status}</p>

          <div className="feed" aria-live="polite" aria-busy={isLoadingPosts}>
            {isLoadingPosts ? <div className="feed-skeletons" role="status" aria-label="Loading posts">
              <span className="sr-only">Loading posts…</span>
              {[0, 1, 2].map((item) => <div className="post-skeleton" key={item} aria-hidden="true">
                <div className="post-skeleton-heading"><span className="skeleton skeleton-name" /><span className="skeleton skeleton-time" /></div>
                <span className="skeleton skeleton-message" />
              </div>)}
            </div> : posts.length === 0 ? <p className="empty-feed">No messages yet. Leave the first note.</p> : posts.map((post) => <article className={`post${animatedPostId === String(post.id) ? " post-enter" : ""}`} key={post.id}>
              <div className="post-heading"><div className="post-author">
                <div className="post-avatar" role="img" aria-label={`${post.name} profile picture`} style={post.avatarUrl ? { backgroundImage: `url("${post.avatarUrl}")` } : undefined}>
                  {!post.avatarUrl && <span aria-hidden="true">{getInitials(post.name)}</span>}
                </div>
                <h2>{post.name}</h2>
              </div><time dateTime={post.createdAt}>{formatPostTime(post.createdAt)}</time></div>
              {post.message && <p>{post.message}</p>}
              {post.imageUrl && <img className="post-image" src={post.imageUrl} alt={`Image shared by ${post.name}`} loading="lazy" />}
              <div className="post-actions">
                <button className={`post-action like-action${post.likedByMe ? " is-liked" : ""}`} type="button" onClick={() => void toggleLike(post)} disabled={!visitorId || likingPostId !== null} aria-pressed={post.likedByMe} aria-label={`${post.likedByMe ? "Unlike" : "Like"} ${post.name}'s post`}>
                  <Heart size={18} aria-hidden="true" fill={post.likedByMe ? "currentColor" : "none"} />
                  <span>{post.likes}</span>
                </button>
                <button className="post-action" type="button" onClick={() => toggleComments(String(post.id))} aria-expanded={openCommentPostIds.has(String(post.id))} aria-controls={`comments-${post.id}`}>
                  <MessageCircle size={18} aria-hidden="true" />
                  <span>Comment</span><span className="comment-count">{post.comments.length}</span>
                </button>
              </div>
              {openCommentPostIds.has(String(post.id)) && <section className="comments-panel" id={`comments-${post.id}`} aria-label={`Comments on ${post.name}'s post`}>
                {post.comments.length > 0 && <ol className="comments-list">
                  {post.comments.map((comment) => <li className="comment" key={comment.id}>
                    <div className="comment-avatar" role="img" aria-label={`${comment.name} profile picture`} style={comment.avatarUrl ? { backgroundImage: `url("${comment.avatarUrl}")` } : undefined}>
                      {!comment.avatarUrl && <span aria-hidden="true">{getInitials(comment.name)}</span>}
                    </div>
                    <div className="comment-content"><p className="comment-author">{comment.name}</p><p>{comment.message}</p></div>
                  </li>)}
                </ol>}
                <form className="comment-form" onSubmit={(event) => void addComment(event, post)}>
                  <label className="sr-only" htmlFor={`comment-${post.id}`}>Write a comment</label>
                  <textarea id={`comment-${post.id}`} value={commentDrafts[String(post.id)] ?? ""} maxLength={280} rows={2} placeholder="Write a comment…" onChange={(event) => setCommentDrafts((current) => ({ ...current, [String(post.id)]: event.target.value }))} />
                  <div className="comment-form-footer">
                    <span>{280 - (commentDrafts[String(post.id)] ?? "").length} characters remaining</span>
                    <button className="comment-submit" type="submit" disabled={!visitorId || isUploadingPhoto || commentingPostId !== null || !(commentDrafts[String(post.id)] ?? "").trim()}>
                      {commentingPostId === String(post.id) ? "Sending…" : "Reply"}
                    </button>
                  </div>
                </form>
              </section>}
            </article>)}
          </div>
          <footer className="wall-footer">A feed full of good people <span aria-hidden="true">✳</span></footer>
        </section>
      </div>
    </main>
  );
}
