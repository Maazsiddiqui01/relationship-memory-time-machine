type ParticipantLike = {
  label: string;
};

export type PresentationMode = "gift" | "archive";

export type ProjectProfile = {
  presentationMode: PresentationMode;
  primaryReader: string;
  giftFrom: string | null;
  participantNames: string[];
  pairLabel: string;
  bookTitle: string;
  bookSubtitle: string;
  bookTagline: string;
  keepsakeLine: string;
  heroKicker: string;
};

function normalizeFirstName(label: string): string {
  return label
    .trim()
    .replace(/\s+/gu, " ")
    .split(" ")
    .filter(Boolean)[0] ?? "";
}

function uniqueNames(participants: ParticipantLike[]): string[] {
  return participants
    .map((participant) => normalizeFirstName(participant.label))
    .filter(Boolean)
    .filter((name, index, values) => values.indexOf(name) === index);
}

function resolvePresentationMode(): PresentationMode {
  const configured = process.env.RELATIONSHIP_MEMORY_PRESENTATION_MODE?.trim().toLowerCase();
  if (configured === "gift" || configured === "archive") {
    return configured;
  }

  return process.env.RELATIONSHIP_MEMORY_PRIMARY_READER?.trim() ? "gift" : "archive";
}

function resolvePrimaryReader(participantNames: string[], mode: PresentationMode): string {
  if (mode === "archive") {
    return "You";
  }

  return process.env.RELATIONSHIP_MEMORY_PRIMARY_READER?.trim() || participantNames[0] || "You";
}

function resolveGiftFrom(
  participantNames: string[],
  primaryReader: string,
  mode: PresentationMode,
): string | null {
  if (mode === "archive") {
    return null;
  }

  const configured = process.env.RELATIONSHIP_MEMORY_GIFT_FROM?.trim();
  if (configured) {
    return configured;
  }

  return participantNames.find((name) => name.toLowerCase() !== primaryReader.toLowerCase()) ?? null;
}

export function deriveProjectProfile(participants: ParticipantLike[] = []): ProjectProfile {
  const participantNames = uniqueNames(participants);
  const presentationMode = resolvePresentationMode();
  const primaryReader = resolvePrimaryReader(participantNames, presentationMode);
  const giftFrom = resolveGiftFrom(participantNames, primaryReader, presentationMode);
  const pairLabel =
    participantNames.length >= 2
      ? `${participantNames[0]} & ${participantNames[1]}`
      : participantNames[0] ?? "Conversation Archive";
  const bookTitle = process.env.RELATIONSHIP_MEMORY_BOOK_TITLE?.trim() || pairLabel;
  const bookSubtitle =
    process.env.RELATIONSHIP_MEMORY_BOOK_SUBTITLE?.trim() ||
    (presentationMode === "gift" ? `For ${primaryReader}` : "Conversation Archive");
  const bookTagline =
    process.env.RELATIONSHIP_MEMORY_BOOK_TAGLINE?.trim() ||
    (presentationMode === "gift"
      ? "A keepsake of the rhythm, the phases, and the quiet ways you kept finding each other."
      : "A visual archive of the rhythm, themes, and changes inside one conversation history.");
  const keepsakeLine =
    presentationMode === "gift"
      ? giftFrom
        ? `A keepsake for ${primaryReader}, from ${giftFrom}`
        : `A keepsake for ${primaryReader}`
      : "A visual archive assembled from the conversation history.";
  const heroKicker = presentationMode === "gift" ? `For ${primaryReader}` : "Conversation Archive";

  return {
    presentationMode,
    primaryReader,
    giftFrom,
    participantNames,
    pairLabel,
    bookTitle,
    bookSubtitle,
    bookTagline,
    keepsakeLine,
    heroKicker,
  };
}

export function addressReader(primaryReader: string, sentence: string): string {
  if (!primaryReader || primaryReader.toLowerCase() === "you") {
    return sentence;
  }

  return `${primaryReader}, ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}`;
}
