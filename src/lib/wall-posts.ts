import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

export type WallPost = { id: number; name: string; message: string; createdAt: string };

export class WallStorageConfigurationError extends Error {
  constructor() {
    super("The wall needs a Postgres database. Add a Neon database to this Vercel project and redeploy.");
    this.name = "WallStorageConfigurationError";
  }
}

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

function fromDatabaseRow(row: { id: number | string; name: string; message: string; createdAt: string | Date }): WallPost {
  return {
    id: Number(row.id),
    name: row.name,
    message: row.message,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

let databaseSetup: Promise<void> | undefined;

async function connectDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    if (process.env.VERCEL) throw new WallStorageConfigurationError();
    return null;
  }

  const sql = neon(connectionString);
  if (!databaseSetup) {
    databaseSetup = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS wall_posts (
        id BIGSERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        message TEXT NOT NULL CHECK (char_length(message) <= 280),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        seed_key TEXT UNIQUE
      )`;

      for (const post of examplePosts) {
        await sql`INSERT INTO wall_posts (name, message, created_at, seed_key)
          VALUES (${post.name}, ${post.message}, ${post.createdAt}, ${`example-${post.id}`})
          ON CONFLICT (seed_key) DO NOTHING`;
      }
    })();
  }

  try {
    await databaseSetup;
  } catch (error) {
    databaseSetup = undefined;
    throw error;
  }

  return sql;
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

export async function getWallPosts(): Promise<WallPost[]> {
  const sql = await connectDatabase();
  if (sql) {
    const rows = await sql`SELECT id, name, message, created_at AS "createdAt"
      FROM wall_posts ORDER BY created_at DESC, id DESC`;
    return rows.map((row) => fromDatabaseRow(row as { id: number | string; name: string; message: string; createdAt: string | Date }));
  }

  await writeQueue;
  return sortNewestFirst(await readFromDisk());
}

export async function createWallPost(message: string, name: string): Promise<WallPost> {
  const sql = await connectDatabase();
  if (sql) {
    const rows = await sql`INSERT INTO wall_posts (name, message)
      VALUES (${name}, ${message})
      RETURNING id, name, message, created_at AS "createdAt"`;
    return fromDatabaseRow(rows[0] as { id: number | string; name: string; message: string; createdAt: string | Date });
  }

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
