export const EMBEDDING_MODEL = "openai/text-embedding-3-small";

type EmbeddingItem = {
  embedding: number[];
  index: number;
};

type OpenRouterEmbeddingResponse = {
  data?: EmbeddingItem[];
  error?: {
    message?: string;
  };
};

export async function createEmbeddings(
  texts: string[],
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  const response = await fetch(
    "https://openrouter.ai/api/v1/embeddings",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: texts,
      }),
    },
  );

  const result =
    (await response.json()) as OpenRouterEmbeddingResponse;

  if (!response.ok) {
    throw new Error(
      result.error?.message ?? "Embedding request failed.",
    );
  }

  if (!result.data) {
    throw new Error("Embedding response did not contain data.");
  }

  return result.data
    .sort((first, second) => first.index - second.index)
    .map((item) => item.embedding);
}