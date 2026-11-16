"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const defaultUsername = "Greg Wientjes";
type WallPost = { id: number; name: string; message: string; createdAt: string };

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
  const [message, setMessage] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [status, setStatus] = useState("");
  const [username, setUsername] = useState(defaultUsername);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [photoError, setPhotoError] = useState("");

  const nameParts = username.trim().split(/\s+/).filter(Boolean);
  const initials = nameParts.length > 1
    ? `${Array.from(nameParts[0])[0]}${Array.from(nameParts[nameParts.length - 1])[0]}`.toUpperCase()
    : Array.from(nameParts[0] ?? "?").slice(0, 2).join("").toUpperCase();

  useEffect(() => {
    try {
      const savedUsername = window.localStorage.getItem("wall.username");
      const savedImage = window.localStorage.getItem("wall.profileImage");
      if (savedUsername) setUsername(savedUsername);
      if (savedImage) setProfileImage(savedImage);
    } catch {
      // The profile still works for this session if browser storage is unavailable.
    }
    setProfileLoaded(true);
  }, []);

  useEffect(() => {
    if (!profileLoaded) return;
    try {
      window.localStorage.setItem("wall.username", username);
      if (profileImage) window.localStorage.setItem("wall.profileImage", profileImage);
      else window.localStorage.removeItem("wall.profileImage");
    } catch {
      setPhotoError("This browser couldn't save your profile changes.");
    }
  }, [profileImage, profileLoaded, username]);

  useEffect(() => {
    let active = true;
    const refreshFeed = async () => {
      try {
        const response = await fetch("/api/posts", { cache: "no-store" });
        if (!response.ok) throw new Error("Feed request failed");
        const latestPosts = await response.json();
        if (active) setPosts(latestPosts);
      } catch {
        if (active) setStatus("Couldn't refresh the wall. Retrying shortly…");
      }
    };

    void refreshFeed();
    const interval = window.setInterval(refreshFeed, 4000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

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
      setProfileImage(imageData);
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "That photo couldn't be uploaded.");
    } finally {
      input.value = "";
    }
  }

  async function addPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = message.trim();
    const authorName = username.trim();
    if (!trimmed || trimmed.length > 280 || !authorName || authorName.length > 40 || isPosting) return;
    setIsPosting(true);
    setStatus("");
    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, name: authorName }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Your message could not be shared.");
      setPosts((currentPosts) => [result, ...currentPosts.filter((post) => post.id !== result.id)]);
      setMessage("");
      setStatus("Your message is on the wall!");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Your message could not be shared.");
    } finally {
      setIsPosting(false);
    }
  }

  return (
    <main className="page-shell">
      <header className="topbar"><a href="#top" className="brand" id="top">wall</a></header>

      <div className="layout">
        <aside className="profile-column" aria-label={`${username || "Your"} profile`}>
          <div className="portrait-group">
            <div className={`portrait-wrap${profileImage ? " has-photo" : ""}`} style={profileImage ? { backgroundImage: `url("${profileImage}")` } : undefined}>
              <span className="sr-only">Profile photo for {username || "your profile"}</span>
              {!profileImage && <span className="portrait-initials" aria-hidden="true">{initials}</span>}
              <input className="sr-only" id="profile-photo" type="file" accept="image/*" onChange={uploadProfilePhoto} aria-describedby="photo-error" />
              <label className="portrait-caption" htmlFor="profile-photo">{profileImage ? "Change photo" : "Upload photo"}</label>
            </div>
            <p className="photo-error" id="photo-error" role="status">{photoError}</p>
          </div>
          <div className="profile-identity">
            <label className="sr-only" htmlFor="profile-name">Edit your username</label>
            <input id="profile-name" className="username-input" value={username} maxLength={40} onChange={(event) => setUsername(event.target.value)} aria-label="Edit your username" />
            <p className="profile-subtitle">wall</p>
          </div>
          <section className="info-card">
            <h2 className="info-heading">Information</h2>
            <div className="info-content hatched-card">
              <div><h3>Networks</h3><p>Stanford Alum</p></div>
              <div><h3>Current City</h3><p>Palo Alto, CA</p></div>
            </div>
          </section>
        </aside>

        <section className="wall-column" aria-label={`${username || "Your"}’s wall`}>
          <form className="composer" id="wall-form" onSubmit={addPost}>
            <label className="sr-only" htmlFor="wall-message">Write on {username || "your"}’s wall</label>
            <textarea id="wall-message" value={message} maxLength={280} onChange={(event) => setMessage(event.target.value)} placeholder="What's on your mind?" rows={3} aria-describedby="wall-message-count wall-status" />
          </form>
          <div className="share-row">
            <span className="character-count" id="wall-message-count">{280 - message.length} characters remaining</span>
            <Button className="share-button" type="submit" form="wall-form" disabled={isPosting || !message.trim() || !username.trim()}>{isPosting ? "Sharing…" : "Share"}</Button>
          </div>
          <p className="status-message" id="wall-status" role="status">{status}</p>

          <div className="feed" aria-live="polite">
            {posts.map((post) => <article className="post" key={post.id}>
              <div className="post-heading"><h2>{post.name}</h2><time dateTime={post.createdAt}>{formatPostTime(post.createdAt)}</time></div>
              <p>{post.message}</p>
            </article>)}
          </div>
          <footer className="wall-footer">A wall full of good people <span aria-hidden="true">✳</span></footer>
        </section>
      </div>
    </main>
  );
}
