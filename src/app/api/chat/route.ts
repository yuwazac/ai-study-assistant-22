import { NextResponse } from "next/server";

import {
  generateAnswer,
  type ChatHistoryMessage,
} from "@/lib/generate-answer";

import {
  retrieveChunks,
} from "@/lib/retrieve-chunks";

export const runtime = "nodejs";

function isChatHistoryMessage(
  value: unknown,
): value is ChatHistoryMessage {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  const message = value as {
    role?: unknown;
    content?: unknown;
  };

  return (
    (message.role === "user" ||
      message.role === "assistant") &&
    typeof message.content === "string"
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const documentId = body.documentId;

    const question = body.question;

    const rawHistory = body.history ?? [];

    if (
      typeof documentId !== "string" ||
      !documentId.trim()
    ) {
      return NextResponse.json(
        {
          error: "A document ID is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      typeof question !== "string" ||
      !question.trim()
    ) {
      return NextResponse.json(
        {
          error: "A question is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (!Array.isArray(rawHistory)) {
      return NextResponse.json(
        {
          error:
            "Conversation history must be an array.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !rawHistory.every(isChatHistoryMessage)
    ) {
      return NextResponse.json(
        {
          error:
            "Conversation history contains an invalid message.",
        },
        {
          status: 400,
        },
      );
    }

    const normalizedQuestion = question.trim();

    if (normalizedQuestion.length > 2000) {
      return NextResponse.json(
        {
          error:
            "The question must be 2,000 characters or fewer.",
        },
        {
          status: 400,
        },
      );
    }

    const history = rawHistory
      .slice(-8)
      .map((message) => ({
        role: message.role,
        content: message.content.trim(),
      }));

    const previousQuestions = history
      .filter(
        (message) => message.role === "user",
      )
      .slice(-2)
      .reverse()
      .map((message) => message.content);

    const retrievalQuestion = [
      normalizedQuestion,
      ...previousQuestions,
    ].join("\n");

    const chunks = await retrieveChunks({
      documentId: documentId.trim(),
      question: retrievalQuestion,
      limit: 5,
    });

    if (chunks.length === 0) {
      return NextResponse.json(
        {
          error:
            "No relevant study material was found for this document.",
        },
        {
          status: 404,
        },
      );
    }

    const answer = await generateAnswer({
      question: normalizedQuestion,
      chunks,
      history,
    });

    return NextResponse.json({
      documentId,
      question: normalizedQuestion,
      answer,
    });
  } catch (error) {
    console.error(
      "Chat request failed:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "The question could not be answered.",
      },
      {
        status: 500,
      },
    );
  }
}