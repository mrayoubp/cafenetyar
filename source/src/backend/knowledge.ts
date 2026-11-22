const STOP_WORDS = new Set([
  "برای",
  "از",
  "به",
  "با",
  "در",
  "که",
  "این",
  "آن",
  "است",
  "هست",
  "چه",
  "چی",
  "چگونه",
  "کدام",
  "می",
  "شود",
  "کنم",
  "کنید",
  "باید",
  "لازم",
  "یک",
  "و",
  "یا",
  "هم",
  "را",
  "تا",
  "بر",
  "کردن",
  "شده",
]);

export function normalizeFa(value: string) {
  return value
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .toLocaleLowerCase("fa");
}

export function tokenize(value: string) {
  return normalizeFa(value)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
}

/** Splits long guide content into overlapping, paragraph-aware chunks. */
export function chunkKnowledge(content: string, maxLength = 850) {
  const paragraphs = content
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if (!current) {
      current = paragraph;
      continue;
    }
    if (`${current}\n\n${paragraph}`.length <= maxLength) {
      current = `${current}\n\n${paragraph}`;
      continue;
    }
    chunks.push(current);
    current = paragraph;
  }
  if (current) chunks.push(current);

  return chunks.flatMap((chunk) => {
    if (chunk.length <= maxLength * 1.4) return [chunk];
    const sentences = chunk.split(/(?<=[.!؟?])\s+/);
    const parts: string[] = [];
    let part = "";
    for (const sentence of sentences) {
      if (`${part} ${sentence}`.trim().length > maxLength && part) {
        parts.push(part);
        part = sentence;
      } else {
        part = `${part} ${sentence}`.trim();
      }
    }
    if (part) parts.push(part);
    return parts;
  });
}

export type ScoredKnowledge = {
  documentId: string;
  categoryId: string;
  content: string;
  score: number;
};

export function scoreKnowledgeChunk(
  query: string,
  title: string,
  summary: string,
  tags: string[],
  chunk: string,
) {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return 0;
  const titleTokens = new Set(
    tokenize(`${title} ${summary} ${tags.join(" ")}`),
  );
  const chunkTokens = new Set(tokenize(chunk));
  let score = 0;
  for (const token of queryTokens) {
    if (titleTokens.has(token)) score += 5;
    if (chunkTokens.has(token)) score += 2;
    if (
      [...titleTokens].some(
        (candidate) =>
          candidate.startsWith(token) || token.startsWith(candidate),
      )
    ) {
      score += 1;
    }
  }
  return score;
}
