import { DatabaseSync } from "node:sqlite";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";

function sqliteValue(value) {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value === undefined) return null;
  return value;
}

class LocalD1PreparedStatement {
  constructor(database, sql, values = []) {
    this.database = database;
    this.sql = sql;
    this.values = values;
  }

  bind(...values) {
    return new LocalD1PreparedStatement(this.database, this.sql, values.map(sqliteValue));
  }

  statement() {
    return this.database.sqlite.prepare(this.sql);
  }

  async first(column) {
    const row = this.statement().get(...this.values) ?? null;
    if (column !== undefined) return row?.[column] ?? null;
    return row;
  }

  async all() {
    return {
      success: true,
      results: this.statement().all(...this.values),
      meta: {},
    };
  }

  async run() {
    const result = this.statement().run(...this.values);
    return {
      success: true,
      results: [],
      meta: {
        changes: Number(result.changes ?? 0),
        last_row_id: Number(result.lastInsertRowid ?? 0),
      },
    };
  }

  async raw(options = {}) {
    const rows = this.statement().all(...this.values).map((row) => Object.values(row));
    if (!options.columnNames) return rows;
    const columns = this.statement().columns().map((column) => column.name);
    return [columns, ...rows];
  }
}

export class LocalD1Database {
  constructor(databasePath) {
    this.sqlite = new DatabaseSync(databasePath, { timeout: 5_000 });
    this.sqlite.exec("PRAGMA journal_mode = WAL");
    this.sqlite.exec("PRAGMA synchronous = NORMAL");
    this.sqlite.exec("PRAGMA foreign_keys = ON");
    this.sqlite.exec("PRAGMA busy_timeout = 5000");
  }

  prepare(sql) {
    return new LocalD1PreparedStatement(this, sql);
  }

  async exec(sql) {
    this.sqlite.exec(sql);
    return { count: 0, duration: 0 };
  }

  async batch(statements) {
    this.sqlite.exec("BEGIN IMMEDIATE");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }

  close() {
    this.sqlite.close();
  }
}

const contentTypes = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export class LocalUploadBucket {
  constructor(root) {
    this.root = resolve(root);
  }

  objectPath(key) {
    if (typeof key !== "string" || key.includes("\\")) throw new Error("Chave de upload inválida.");
    const segments = key.split("/");
    if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
      throw new Error("Chave de upload inválida.");
    }
    const target = resolve(this.root, ...segments);
    if (!target.startsWith(`${this.root}${sep}`)) throw new Error("Chave de upload inválida.");
    return target;
  }

  async put(key, value, options = {}) {
    const target = this.objectPath(key);
    const bytes = value instanceof ArrayBuffer
      ? Buffer.from(value)
      : ArrayBuffer.isView(value)
        ? Buffer.from(value.buffer, value.byteOffset, value.byteLength)
        : Buffer.from(value);
    await mkdir(dirname(target), { recursive: true });
    const temporary = `${target}.${crypto.randomUUID()}.tmp`;
    await writeFile(temporary, bytes, { flag: "wx" });
    await rename(temporary, target);
    const metadata = {
      contentType: options.httpMetadata?.contentType ?? contentTypes[extname(target).toLowerCase()] ?? "application/octet-stream",
    };
    await writeFile(`${target}.metadata.json`, JSON.stringify(metadata), "utf8");
    return { key, size: bytes.byteLength, httpMetadata: metadata };
  }

  async get(key) {
    const target = this.objectPath(key);
    try {
      const body = await readFile(target);
      let metadata;
      try {
        metadata = JSON.parse(await readFile(`${target}.metadata.json`, "utf8"));
      } catch {
        metadata = { contentType: contentTypes[extname(target).toLowerCase()] ?? "application/octet-stream" };
      }
      return { key, size: body.byteLength, body, httpMetadata: metadata };
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  }

  async delete(key) {
    const target = this.objectPath(key);
    await Promise.all([
      unlink(target).catch((error) => { if (error?.code !== "ENOENT") throw error; }),
      unlink(`${target}.metadata.json`).catch((error) => { if (error?.code !== "ENOENT") throw error; }),
    ]);
  }
}

export async function createSelfhostBindings(dataDirectory) {
  const root = resolve(dataDirectory);
  const uploadRoot = resolve(root, "uploads");
  await mkdir(uploadRoot, { recursive: true });
  return {
    DB: new LocalD1Database(resolve(root, "pelada.sqlite")),
    UPLOADS: new LocalUploadBucket(uploadRoot),
  };
}
