type ParticipantLike = {
  label: string;
};

export type ProjectProfile = {
  primaryReader: string;
  giftFrom: string | null;
  participantNames: string[];
  pairLabel: string;
  bookTitle: string;
  bookSubtitle: string;
  bookTagline: string;
  keepsakeLine: string;
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

function resolvePrimaryReader(participantNames: string[]): string {
  return process.env.RELATIONSHIP_MEMORY_PRIMARY_READER?.trim() || participantNames[0] || "You";
}

function resolveGiftFrom(participantNames: string[], primaryReader: string): string | null {
  const configured = process.env.RELATIONSHIP_MEMORY_GIFT_FROM?.trim();
  if (configured) {
    return configured;
  }

  return participantNames.find((name) => name.toLowerCase() !== primaryReader.toLowerCase()) ?? null;
}

export function deriveProjectProfile(participants: ParticipantLike[] = []): ProjectProfile {
  const participantNames = uniqueNames(participants);
  const primaryReader = resolvePrimaryReader(participantNames);
  const giftFrom = resolveGiftFrom(participantNames, primaryReader);
  const pairLabel =
    participantNames.length >= 2
      ? `${participantNames[0]} & ${participantNames[1]}`
      : participantNames[0] ?? "Relationship Memory Time Machine";
  const bookTitle = process.env.RELATIONSHIP_MEMORY_BOOK_TITLE?.trim() || pairLabel;
  const bookSubtitle = process.env.RELATIONSHIP_MEMORY_BOOK_SUBTITLE?.trim() || `For ${primaryReader}`;
  const bookTagline =
    process.env.RELATIONSHIP_MEMORY_BOOK_TAGLINE?.trim() ||
    "A keepsake of the rhythm, the phases, and the quiet ways you kept finding each other.";
  const keepsakeLine = giftFrom
    ? `A keepsake for ${primaryReader}, from ${giftFrom}`
    : `A keepsake for ${primaryReader}`;

  return {
    primaryReader,
    giftFrom,
    participantNames,
    pairLabel,
    bookTitle,
    bookSubtitle,
    bookTagline,
    keepsakeLine,
  };
}

export function addressReader(primaryReader: string, sentence: string): string {
  if (!primaryReader || primaryReader.toLowerCase() === "you") {
    return sentence;
  }

  return `${primaryReader}, ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}`;
}
