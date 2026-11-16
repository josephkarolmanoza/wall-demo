import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export type WallPost = { id: number; name: string; message: string; createdAt: string };

const dataDirectory = path.join(process.cwd(), "data");
const dataFile = path.join(dataDirectory, "wall-posts.json");

const examplePosts: WallPost[] = [
  { id: 1, name: "Anna", message: "Hey Greg, did you debug your coffee maker yet? Last cup tasted like JavaScript errors.", createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
  { id: 2, name: "Adelaida", message: "Greg, saw your last coding session - pretty sure you broke Stack Overflow again!", createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() },
  { id: 3, name: "Juho", message: "Greg, are you still coding in pajamas, or have you upgraded to full-time sweatpants mode?", createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString() },
  { id: 4, name: "Maija", message: "Greg, rumor has it your computer has more stickers than code running on it. Confirm?", createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() },
  { id: 5, name: "Alex", message: "Yo Greg, just pulled an all-nighter on the assignment. Turns out sleep deprivation doesn't improve coding skills. Weird!", createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() },
  { id: 6, name: "Sheryl", message: "Greg, when are we gonna deploy your latest dance moves to production? #AgileDancer", createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString() },
];

const exampleAgeHours = [2, 3, 4, 5, 6, 8];

function sortNewestFirst(posts: Partial<WallPost>[]): WallPost[] {
  return posts.map((post) => {
    const id = typeof post.id === "number" ? post.id : Date.now();
    const savedTime = post.createdAt ? Date.parse(post.createdAt) : NaN;
    const timestamp = Number.isFinite(savedTime)
      ? savedTime
      : id >= 1_000_000_000_000
        ? id
        : Date.now() - (exampleAgeHours[id - 1] ?? 0) * 60 * 60 * 1000;

    return {
      id,
      name: post.name ?? "Someone",
      message: post.message ?? "",
      createdAt: new Date(timestamp).toISOString(),
    };
  }).sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));
}

async function readFromDisk(): Promise<WallPost[]> {
  await mkdir(dataDirectory, { recursive: true });
  try {
    return sortNewestFirst(JSON.parse(await readFile(dataFile, "utf8")) as Partial<WallPost>[]);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    await writeFile(dataFile, JSON.stringify(examplePosts, null, 2), "utf8");
    return examplePosts;
  }
}

let writeQueue: Promise<void> = Promise.resolve();

export async function getWallPosts() {
  await writeQueue;
  return sortNewestFirst(await readFromDisk());
}

export function createWallPost(message: string, name: string) {
  const operation = writeQueue.then(async () => {
    const posts = sortNewestFirst(await readFromDisk());
    const post: WallPost = { id: Date.now(), name, message, createdAt: new Date().toISOString() };
    const updatedPosts = [post, ...posts];
    const temporaryFile = `${dataFile}.tmp`;
    await writeFile(temporaryFile, JSON.stringify(updatedPosts, null, 2), "utf8");
    await rename(temporaryFile, dataFile);
    return post;
  });

  writeQueue = operation.then(() => undefined, () => undefined);
  return operation;
}
