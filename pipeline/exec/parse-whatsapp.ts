import { stat } from "node:fs/promises";

import { PATHS } from "../config.js";
import { ensureProjectDirectories, writeJson, writeNdjson } from "../lib/io.js";
import { parseWhatsAppTranscript } from "./chat-parser.js";

async function main(): Promise<void> {
  await ensureProjectDirectories();
  const { messages, participants } = await parseWhatsAppTranscript(PATHS.sourceTranscript);
  const sourceStats = await stat(PATHS.sourceTranscript);

  await writeNdjson(PATHS.canonicalMessages, messages);
  await writeJson(PATHS.participants, participants);
  await writeJson(PATHS.sourceManifest, {
    source_file: PATHS.sourceTranscript,
    byte_size: sourceStats.size,
    message_count: messages.length,
    participant_count: participants.length,
    first_timestamp: messages[0]?.timestamp_local ?? null,
    last_timestamp: messages.at(-1)?.timestamp_local ?? null,
  });

  console.log(
    JSON.stringify(
      {
        stage: "parse",
        message_count: messages.length,
        participant_count: participants.length,
      },
      null,
      2,
    ),
  );
}

void main();
