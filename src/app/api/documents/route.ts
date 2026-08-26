import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";

import { chunkText } from "@/lib/chunk-text";
import {
  createEmbeddings,
  EMBEDDING_MODEL,
} from "@/lib/embeddings";
import { connectDatabase } from "@/lib/mongodb";
import { DocumentChunkModel } from "@/models/document-chunk";

import { getPineconeIndex } from "@/lib/pinecone";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "text/plain",
];

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const uploadedFile = formData.get("file");

    if (!(uploadedFile instanceof File)) {
      return NextResponse.json(
        { error: "A file is required." },
        { status: 400 },
      );
    }

    if (
      !ALLOWED_FILE_TYPES.includes(uploadedFile.type)
    ) {
      return NextResponse.json(
        {
          error:
            "Only PDF and TXT files are supported.",
        },
        { status: 400 },
      );
    }

    if (uploadedFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: "The file must be 10 MB or smaller.",
        },
        { status: 400 },
      );
    }

    let extractedText = "";
    let totalPages: number | null = null;

    if (uploadedFile.type === "application/pdf") {
      const arrayBuffer =
        await uploadedFile.arrayBuffer();

      const bytes = new Uint8Array(arrayBuffer);

      // Real PDF files begin with "%PDF-".
      const signature = new TextDecoder().decode(
        bytes.slice(0, 5),
      );

      if (signature !== "%PDF-") {
        return NextResponse.json(
          {
            error:
              "The uploaded file is not a valid PDF.",
          },
          { status: 400 },
        );
      }

      const pdf = await getDocumentProxy(bytes);

      const result = await extractText(pdf, {
        mergePages: true,
      });

      extractedText = Array.isArray(result.text)
        ? result.text.join("\n")
        : result.text;

      totalPages = result.totalPages;
    } else {
      extractedText = await uploadedFile.text();
    }

    const cleanedText = extractedText
      .replace(/\u0000/g, "")
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (!cleanedText) {
      return NextResponse.json(
        {
          error:
            "No readable text was found in this file.",
        },
        { status: 422 },
      );
    }

    const chunks = await chunkText({
      text: cleanedText,
      fileName: uploadedFile.name,
    });

    if (chunks.length === 0) {
      throw new Error(
        "The document did not produce any chunks.",
      );
    }

    // Confirm the database works before using
    // OpenRouter embedding credits.
    await connectDatabase();

    const chunkTexts = chunks.map(
      (chunk) => chunk.pageContent,
    );

    const embeddings =
      await createEmbeddings(chunkTexts);

    if (embeddings.length !== chunks.length) {
      throw new Error(
        "The number of embeddings does not match the number of chunks.",
      );
    }

    const documentId = randomUUID();

    const documentChunkRecords = chunks.map(
      (chunk, index) => {
        const embedding = embeddings[index];

        if (!embedding) {
          throw new Error(
            `Missing embedding for chunk ${index}.`,
          );
        }

        return {
          documentId,
          fileName: uploadedFile.name,
          mimeType: uploadedFile.type,
          chunkIndex: chunk.metadata.chunkIndex,
          content: chunk.pageContent,
          characterCount:
            chunk.metadata.characterCount,
          embedding,
          embeddingModel: EMBEDDING_MODEL,
        };
      },
    );

    await DocumentChunkModel.insertMany(
      documentChunkRecords,
    );

    const pineconeIndex = getPineconeIndex();

const pineconeRecords = documentChunkRecords.map((chunk) => ({
  id: `${chunk.documentId}-${chunk.chunkIndex}`,

  values: chunk.embedding,

  metadata: {
    documentId: chunk.documentId,
    fileName: chunk.fileName,
    chunkIndex: chunk.chunkIndex,
    content: chunk.content,
  },
}));

await pineconeIndex.upsert({
  records: pineconeRecords,
});

    const storedChunkCount =
      await DocumentChunkModel.countDocuments({
        documentId,
      });

    const embeddingDimensions =
      embeddings[0]?.length ?? 0;

    return NextResponse.json({
      document: {
        documentId,
        name: uploadedFile.name,
        type: uploadedFile.type,
        size: uploadedFile.size,
        totalPages,
        characterCount: cleanedText.length,
        chunkCount: chunks.length,
        storedChunkCount,
        embeddingCount: embeddings.length,
        embeddingDimensions,
        pineconeVectorCount: pineconeRecords.length,
        preview: cleanedText.slice(0, 500),
      },
    });
  } catch (error) {
    console.error(
      "Document processing failed:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "The document could not be processed.",
      },
      { status: 500 },
    );
  }
}