import { NextResponse } from "next/server";

import { retrieveChunks } from "@/lib/retrieve-chunks";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const documentId = body.documentId;

    const question = body.question;

    if (
      typeof documentId !== "string" ||
      !documentId.trim()
    ) {
      return NextResponse.json(
        { error: "A document ID is required." },
        { status: 400 },
      );
    }

    if (
      typeof question !== "string" ||
      !question.trim()
    ) {
      return NextResponse.json(
        { error: "A question is required." },
        { status: 400 },
      );
    }

    const chunks = await retrieveChunks({
      documentId,
      question,
    });

    return NextResponse.json({
      documentId,
      question,
      chunkCount: chunks.length,
      chunks,
    });
  } catch (error) {
    console.error("Document search failed:", error);

    return NextResponse.json(
      { error: "The document could not be searched." },
      { status: 500 },
    );
  }
}