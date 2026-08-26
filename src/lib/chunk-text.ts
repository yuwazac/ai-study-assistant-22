import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export type DocumentChunk = {
  pageContent: string;
  metadata: {
    source: string;
    chunkIndex: number;
    characterCount: number;
  };
};

type ChunkTextOptions = {
  text: string;
  fileName: string;
  chunkSize?: number;
  chunkOverlap?: number;
};

export async function chunkText({
  text,
  fileName,
  chunkSize = 1000,
  chunkOverlap = 200,
}: ChunkTextOptions): Promise<DocumentChunk[]> {
  if (chunkSize <= 0) {
    throw new Error("Chunk size must be greater than zero.");
  }

  if (chunkOverlap < 0 || chunkOverlap >= chunkSize) {
    throw new Error(
      "Chunk overlap must be zero or greater and smaller than chunk size.",
    );
  }

  const normalizedText = text.replace(/\u0000/g, "").trim();

  if (!normalizedText) {
    return [];
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
    separators: ["\n\n", "\n", ". ", " ", ""],
  });

  const parts = await splitter.splitText(normalizedText);

  return parts
    .filter((part) => part.trim().length > 0)
    .map((part, chunkIndex) => ({
      pageContent: part,
      metadata: {
        source: fileName,
        chunkIndex,
        characterCount: part.length,
      },
    }));
}