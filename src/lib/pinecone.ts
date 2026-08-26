import { Pinecone } from "@pinecone-database/pinecone";

export function getPineconeIndex() {
  const apiKey = process.env.PINECONE_API_KEY;

  const indexName = process.env.PINECONE_INDEX_NAME;

  if (!apiKey) {
    throw new Error("PINECONE_API_KEY is not configured.");
  }

  if (!indexName) {
    throw new Error("PINECONE_INDEX_NAME is not configured.");
  }

  const pinecone = new Pinecone({
    apiKey,
  });

  return pinecone.index(indexName);
}