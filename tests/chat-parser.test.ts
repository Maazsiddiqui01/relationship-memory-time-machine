import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { parseWhatsAppTranscript } from "../pipeline/exec/chat-parser.js";

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("parseWhatsAppTranscript", () => {
  it("parses single-line, multiline, and system entries", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "relationship-memory-"));
    tempDirectories.push(directory);
    const transcriptPath = path.join(directory, "chat.txt");

    await writeFile(
      transcriptPath,
      [
        "05/05/2024, 10:20 pm - Messages and calls are end-to-end encrypted.",
        "05/05/2024, 10:21 pm - Alice: hey there",
        "05/05/2024, 10:22 pm - Bob: first line",
        "second line",
        "05/05/2024, 10:23 pm - Alice: <Media omitted>",
      ].join("\n"),
      "utf8",
    );

    const { messages, participants } = await parseWhatsAppTranscript(transcriptPath);

    expect(messages).toHaveLength(4);
    expect(participants).toHaveLength(2);
    expect(messages[0].message_type).toBe("system");
    expect(messages[1].sender_label).toBe("Alice");
    expect(messages[2].is_multiline).toBe(true);
    expect(messages[2].text).toContain("second line");
    expect(messages[3].message_type).toBe("media_omitted");
  });
});
