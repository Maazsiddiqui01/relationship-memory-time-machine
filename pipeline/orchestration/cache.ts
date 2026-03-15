import { DatabaseSync } from "node:sqlite";

import { PATHS, PROJECT_CONFIG } from "../config.js";
import type { ChunkAnalysisResult } from "./provider.js";

type CachedRecord = {
  provider_name: string;
  prompt_version: string;
  chunk_hash: string;
  payload_json: string;
};

export class PipelineCache {
  private readonly db: DatabaseSync;

  constructor() {
    this.db = new DatabaseSync(PATHS.cacheDb);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chunk_cache (
        provider_name TEXT NOT NULL,
        prompt_version TEXT NOT NULL,
        chunk_hash TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (provider_name, prompt_version, chunk_hash)
      );
    `);
  }

  get(chunkHash: string, providerName: string): ChunkAnalysisResult | null {
    const statement = this.db.prepare(`
      SELECT provider_name, prompt_version, chunk_hash, payload_json
      FROM chunk_cache
      WHERE provider_name = ? AND prompt_version = ? AND chunk_hash = ?
    `);
    const row = statement.get(providerName, PROJECT_CONFIG.promptVersion, chunkHash) as CachedRecord | undefined;
    if (!row) {
      return null;
    }

    return JSON.parse(row.payload_json) as ChunkAnalysisResult;
  }

  set(chunkHash: string, providerName: string, payload: ChunkAnalysisResult): void {
    const statement = this.db.prepare(`
      INSERT INTO chunk_cache (provider_name, prompt_version, chunk_hash, payload_json, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(provider_name, prompt_version, chunk_hash)
      DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at
    `);
    statement.run(
      providerName,
      PROJECT_CONFIG.promptVersion,
      chunkHash,
      JSON.stringify(payload),
      new Date().toISOString(),
    );
  }

  close(): void {
    this.db.close();
  }
}
