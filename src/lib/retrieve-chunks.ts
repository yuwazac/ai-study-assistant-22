import { createEmbeddings } from "@/lib/embeddings";
import { connectDatabase } from "@/lib/mongodb";
import { getPineconeIndex } from "@/lib/pinecone";
import { DocumentChunkModel } from "@/models/document-chunk";

export type RetrievedChunk = {
  documentId: string;
  fileName: string;
  chunkIndex: number;
  content: string;
  score: number;
};

type RetrieveChunksOptions = {
  documentId: string;
  question: string;
  limit?: number;
};

type StoredChunk = {
  documentId: string;
  fileName: string;
  chunkIndex: number;
  content: string;
};

const REFERENCE_LABEL =
  String.raw`(?:qodob(?:ka|kii)?|article|section)`;

const REFERENCE_PREFIX =
  String.raw`(?:number\s*|no\.?\s*)?`;

function extractReferenceNumber(
  question: string,
): number | null {
  const pattern = new RegExp(
    `${REFERENCE_LABEL}\\s*${REFERENCE_PREFIX}` +
      String.raw`(\d{1,4})(?:\s*-\s*)?` +
      String.raw`(?:aad|th|st|nd|rd)?\b`,
    "i",
  );

  const match = question.match(pattern);

  if (!match?.[1]) {
    return null;
  }

  const referenceNumber = Number(match[1]);

  if (!Number.isInteger(referenceNumber)) {
    return null;
  }

  return referenceNumber;
}

function countReferences(content: string) {
  const pattern = new RegExp(
    `${REFERENCE_LABEL}\\s*${REFERENCE_PREFIX}` +
      String.raw`\d{1,4}(?:\s*-\s*)?` +
      String.raw`(?:aad|th|st|nd|rd)?\b`,
    "gi",
  );

  return content.match(pattern)?.length ?? 0;
}

async function retrieveExactReferenceChunks({
  documentId,
  question,
  limit,
}: {
  documentId: string;
  question: string;
  limit: number;
}): Promise<RetrievedChunk[]> {
  const referenceNumber =
    extractReferenceNumber(question);

  if (referenceNumber === null) {
    return [];
  }

  await connectDatabase();

  const exactPattern = new RegExp(
    `${REFERENCE_LABEL}\\s*${REFERENCE_PREFIX}` +
      `${referenceNumber}` +
      String.raw`(?:\s*-\s*)?` +
      String.raw`(?:aad|th|st|nd|rd)?\b`,
    "i",
  );

  const headingPattern = new RegExp(
    `(?:^|\\n)\\s*${REFERENCE_LABEL}` +
      `\\s*${REFERENCE_PREFIX}` +
      `${referenceNumber}` +
      String.raw`(?:\s*-\s*)?` +
      String.raw`(?:aad|th|st|nd|rd)?\b`,
    "i",
  );

  const matchingRecords =
    (await DocumentChunkModel.find({
      documentId,
      content: exactPattern,
    })
      .select({
        _id: 0,
        documentId: 1,
        fileName: 1,
        chunkIndex: 1,
        content: 1,
      })
      .lean()) as unknown as StoredChunk[];

  if (matchingRecords.length === 0) {
    return [];
  }

  const rankedRecords = [...matchingRecords].sort(
    (first, second) => {
      const firstHasHeading = headingPattern.test(
        first.content,
      );

      const secondHasHeading = headingPattern.test(
        second.content,
      );

      if (firstHasHeading !== secondHasHeading) {
        return secondHasHeading ? 1 : -1;
      }

      const firstReferenceCount = countReferences(
        first.content,
      );

      const secondReferenceCount = countReferences(
        second.content,
      );

      if (
        firstReferenceCount !== secondReferenceCount
      ) {
        return (
          firstReferenceCount -
          secondReferenceCount
        );
      }

      return second.chunkIndex - first.chunkIndex;
    },
  );

  // We keep two possible matches because one may be
  // from the table of contents and one from the article.
  const anchorRecords = rankedRecords.slice(0, 2);

  const requiredChunkIndexes = [
    ...new Set(
      anchorRecords.flatMap((record) => [
        record.chunkIndex,
        record.chunkIndex + 1,
      ]),
    ),
  ];

  const nearbyRecords =
    (await DocumentChunkModel.find({
      documentId,
      chunkIndex: {
        $in: requiredChunkIndexes,
      },
    })
      .select({
        _id: 0,
        documentId: 1,
        fileName: 1,
        chunkIndex: 1,
        content: 1,
      })
      .lean()) as unknown as StoredChunk[];

  const recordsByIndex = new Map(
    nearbyRecords.map((record) => [
      record.chunkIndex,
      record,
    ]),
  );

  const orderedRecords: StoredChunk[] = [];

  const usedIndexes = new Set<number>();

  for (const anchor of anchorRecords) {
    const indexes = [
      anchor.chunkIndex,
      anchor.chunkIndex + 1,
    ];

    for (const chunkIndex of indexes) {
      const record = recordsByIndex.get(chunkIndex);

      if (!record || usedIndexes.has(chunkIndex)) {
        continue;
      }

      orderedRecords.push(record);

      usedIndexes.add(chunkIndex);
    }
  }

  return orderedRecords
    .slice(0, limit)
    .map((record, index) => ({
      documentId: record.documentId,
      fileName: record.fileName,
      chunkIndex: record.chunkIndex,
      content: record.content,
      score: 1 - index * 0.01,
    }));
}

async function retrieveSemanticChunks({
  documentId,
  question,
  limit,
}: {
  documentId: string;
  question: string;
  limit: number;
}): Promise<RetrievedChunk[]> {
  const pineconeIndex = getPineconeIndex();

  const embeddings = await createEmbeddings([
    question,
  ]);

  const questionEmbedding = embeddings[0];

  if (!questionEmbedding) {
    throw new Error(
      "Could not create an embedding for the question.",
    );
  }

  const results = await pineconeIndex.query({
    vector: questionEmbedding,
    topK: limit,
    includeMetadata: true,
    filter: {
      documentId: {
        $eq: documentId,
      },
    },
  });

  return results.matches.flatMap((match) => {
    const metadata = match.metadata;

    if (
      !metadata ||
      typeof metadata.documentId !== "string" ||
      typeof metadata.fileName !== "string" ||
      typeof metadata.chunkIndex !== "number" ||
      typeof metadata.content !== "string"
    ) {
      return [];
    }

    return [
      {
        documentId: metadata.documentId,
        fileName: metadata.fileName,
        chunkIndex: metadata.chunkIndex,
        content: metadata.content,
        score: match.score ?? 0,
      },
    ];
  });
}

export async function retrieveChunks({
  documentId,
  question,
  limit = 5,
}: RetrieveChunksOptions): Promise<RetrievedChunk[]> {
  const normalizedQuestion = question.trim();

  const normalizedDocumentId = documentId.trim();

  if (!normalizedQuestion) {
    throw new Error("A question is required.");
  }

  if (!normalizedDocumentId) {
    throw new Error("A document ID is required.");
  }

  const safeLimit =
    Number.isInteger(limit) && limit > 0
      ? Math.min(limit, 10)
      : 5;

  const exactChunks =
    await retrieveExactReferenceChunks({
      documentId: normalizedDocumentId,
      question: normalizedQuestion,
      limit: safeLimit,
    });

  if (exactChunks.length > 0) {
    return exactChunks;
  }

  return retrieveSemanticChunks({
    documentId: normalizedDocumentId,
    question: normalizedQuestion,
    limit: safeLimit,
  });
}