"use client";

import {
  useState,
  type FormEvent,
} from "react";

import { LoaderCircle } from "lucide-react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type StudyChatProps = {
  documentId: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ChatResponse = {
  answer?: string;
  error?: string;
};

export default function StudyChat({
  documentId,
}: StudyChatProps) {
  const [question, setQuestion] = useState("");

  const [messages, setMessages] = useState<
    ChatMessage[]
  >([]);

  const [error, setError] = useState("");

  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const normalizedQuestion = question.trim();

    if (!normalizedQuestion) {
      setError("Please enter a question.");

      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: normalizedQuestion,
    };

    const history = messages.map((message) => ({
      role: message.role,
      content: message.content,
    }));

    setMessages((previousMessages) => [
      ...previousMessages,
      userMessage,
    ]);

    setQuestion("");

    setError("");

    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          documentId,
          question: normalizedQuestion,
          history,
        }),
      });

      const result =
        (await response.json()) as ChatResponse;

      if (!response.ok) {
        throw new Error(
          result.error ??
            "The question could not be answered.",
        );
      }

      if (!result.answer) {
        throw new Error(
          "The response did not contain an answer.",
        );
      }

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: result.answer,
      };

      setMessages((previousMessages) => [
        ...previousMessages,
        assistantMessage,
      ]);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong.";

      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section
      aria-labelledby="study-chat-title"
      className="mt-6 min-w-0 rounded-lg border p-4 sm:mt-8 sm:p-6"
    >
      <h2
        id="study-chat-title"
        className="text-lg font-semibold text-balance sm:text-xl"
      >
        Ask about your study material
      </h2>

      <p className="mt-2 text-sm text-muted-foreground">
        Ask questions about the document you uploaded.
      </p>

      {messages.length > 0 && (
        <div
          className="mt-6 min-w-0 space-y-4"
          aria-live="polite"
          aria-busy={isLoading}
        >
          {messages.map((message) => (
            <article
              key={message.id}
              className={
                message.role === "user"
                  ? "ml-auto max-w-[95%] min-w-0 rounded-lg bg-primary p-3 text-primary-foreground sm:max-w-[85%] sm:p-4 lg:max-w-[75%]"
                  : "max-w-[95%] min-w-0 rounded-lg bg-muted p-3 sm:max-w-[85%] sm:p-4 lg:max-w-[75%]"
              }
            >
              <p className="mb-2 text-sm font-semibold">
                {message.role === "user"
                  ? "You"
                  : "Study Assistant"}
              </p>

              <p className="whitespace-pre-wrap break-words leading-6 [overflow-wrap:anywhere] sm:leading-7">
                {message.content}
              </p>
            </article>
          ))}

          {isLoading && (
            <div
              className="flex max-w-[95%] items-center gap-2 rounded-lg bg-muted p-3 sm:max-w-[85%] sm:p-4 lg:max-w-[75%]"
              role="status"
            >
              <LoaderCircle
                aria-hidden="true"
                className="size-4 shrink-0 animate-spin text-muted-foreground"
              />

              <p className="break-words text-sm text-muted-foreground">
                The assistant is preparing an answer...
              </p>
            </div>
          )}
        </div>
      )}

      {error && (
        <Alert
          id="study-chat-error"
          variant="destructive"
          className="mt-4"
        >
          <AlertTitle>Unable to answer</AlertTitle>
          <AlertDescription className="break-words [overflow-wrap:anywhere]">
            {error}
          </AlertDescription>
        </Alert>
      )}

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-4"
      >
        <Label
          htmlFor="study-question"
        >
          Your question
        </Label>

        <Textarea
          id="study-question"
          name="question"
          value={question}
          onChange={(event) =>
            setQuestion(event.target.value)
          }
          placeholder="Ask a question about your document..."
          maxLength={2000}
          rows={3}
          disabled={isLoading}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? "study-chat-error" : undefined
          }
          className="min-h-28 resize-y px-3 py-3 text-base"
        />

        <Button
          type="submit"
          disabled={
            isLoading || !question.trim()
          }
          className="min-h-11 w-full text-white px-4 sm:w-auto bg-green-600 hover:bg-green-650 focus-visible:ring-green-650 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? (
            <>
              <LoaderCircle aria-hidden="true" className="animate-spin" />
              Generating answer...
            </>
          ) : (
            "Send question"
          )}~
        </Button>
      </form>
    </section>
  );
}
