"use client";

import {
  useCallback,
  useState,
  type FormEvent,
} from "react";

import type { FileRejection } from "react-dropzone";

import { useDropzone } from "react-dropzone";

import {
  CheckCircle2,
  FileText,
  LoaderCircle,
  UploadCloud,
  X,
} from "lucide-react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import StudyChat from "@/component/study-chat";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
  "text/plain",
]);

type UploadStatus =
  | "idle"
  | "ready"
  | "uploading"
  | "success"
  | "error";

type DocumentMetadata = {
  documentId: string;

  name: string;

  type: string;

  size: number;

  totalPages: number | null;

  characterCount: number;

  preview: string;
};

type UploadResponse = {
  document?: DocumentMetadata;

  error?: string;
};

function getFileValidationError(file: File) {
  if (!ALLOWED_FILE_TYPES.has(file.type)) {
    return "Only PDF and TXT files are supported.";
  }

  if (file.size > MAX_FILE_SIZE) {
    return "The file must be 10 MB or smaller.";
  }

  return null;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function FileUpload() {
  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [error, setError] = useState<string | null>(
    null,
  );

  const [status, setStatus] =
    useState<UploadStatus>("idle");

  const [document, setDocument] =
    useState<DocumentMetadata | null>(null);

  const onDropAccepted = useCallback(
    (files: File[]) => {
      const file = files[0];

      if (!file) {
        setSelectedFile(null);

        setDocument(null);

        setError("No file selected.");

        setStatus("error");

        return;
      }

      const validationError =
        getFileValidationError(file);

      if (validationError) {
        setSelectedFile(null);

        setDocument(null);

        setError(validationError);

        setStatus("error");

        return;
      }

      setSelectedFile(file);

      setDocument(null);

      setError(null);

      setStatus("ready");
    },
    [],
  );

  const onDropRejected = useCallback(
    (rejections: FileRejection[]) => {
      const rejection = rejections[0];

      const errorCode = rejection?.errors[0]?.code;

      if (errorCode === "file-too-large") {
        setError(
          "The file must be 10 MB or smaller.",
        );

        setStatus("error");

        return;
      }

      if (errorCode === "file-invalid-type") {
        setError(
          "Only PDF and TXT files are supported.",
        );

        setStatus("error");

        return;
      }

      setError("The file could not be selected.");

      setStatus("error");
    },
    [],
  );

  const isUploading = status === "uploading";

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    open,
  } = useDropzone({
    accept: {
      "application/pdf": [".pdf"],

      "text/plain": [".txt"],
    },

    maxFiles: 1,

    maxSize: MAX_FILE_SIZE,

    noClick: true,

    noKeyboard: true,

    disabled: isUploading,

    onDropAccepted,

    onDropRejected,
  });

  function removeFile() {
    setSelectedFile(null);

    setDocument(null);

    setError(null);

    setStatus("idle");
  }

  async function uploadFile(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!selectedFile || isUploading) {
      return;
    }

    const validationError =
      getFileValidationError(selectedFile);

    if (validationError) {
      setError(validationError);

      setDocument(null);

      setStatus("error");

      return;
    }

    setError(null);

    setDocument(null);

    setStatus("uploading");

    try {
      const formData = new FormData();

      formData.append("file", selectedFile);

      const response = await fetch(
        "/api/documents",
        {
          method: "POST",

          body: formData,
        },
      );

      const result =
        (await response.json()) as UploadResponse;

      if (!response.ok) {
        throw new Error(
          result.error ??
            "The document could not be uploaded.",
        );
      }

      if (!result.document) {
        throw new Error(
          "The document response was incomplete.",
        );
      }

      if (!result.document.documentId) {
        throw new Error(
          "The document response did not include an ID.",
        );
      }

      setDocument(result.document);

      setStatus("success");
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "The document could not be uploaded.",
      );

      setStatus("error");
    }
  }

  return (
    <Card className="min-w-0">
      <CardHeader className="px-4 sm:px-(--card-spacing)">
        <CardTitle>
          Upload study material
        </CardTitle>

        <CardDescription>
          Select one PDF or TXT file. Maximum size:
          10 MB.
        </CardDescription>
      </CardHeader>

      <CardContent className="min-w-0 px-4 sm:px-(--card-spacing)">
        <form
          className="min-w-0 space-y-4"
          onSubmit={uploadFile}
        >
          <div
            {...getRootProps()}
            className={`min-w-0 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors sm:p-8 ${
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            } ${
              isUploading
                ? "cursor-not-allowed opacity-60"
                : ""
            }`}
          >
            <input {...getInputProps()} />

            <UploadCloud
              aria-hidden="true"
              className="mx-auto mb-4 size-9 text-muted-foreground sm:size-10"
            />

            <p className="font-medium">
              {isDragActive
                ? "Drop your file here"
                : "Drag and drop your study material"}
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              PDF and TXT files are supported
            </p>

            <Button
              type="button"
              variant="outline"
              className="mt-4 min-h-11 w-full px-4 sm:w-auto"
              disabled={isUploading}
              onClick={open}
            >
              Choose file
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>
                {selectedFile
                  ? "Upload failed"
                  : "Invalid file"}
              </AlertTitle>

              <AlertDescription>
                {error}
              </AlertDescription>
            </Alert>
          )}

          {selectedFile ? (
            <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:p-4">
              <FileText
                aria-hidden="true"
                className="size-8 text-primary"
              />

              <div className="min-w-0 flex-1">
                <p className="break-all font-medium leading-6">
                  {selectedFile.name}
                </p>

                <p className="text-sm text-muted-foreground">
                  {formatFileSize(
                    selectedFile.size,
                  )}
                </p>
              </div>

              <Badge
                variant="secondary"
                className="col-start-2 row-start-2 justify-self-start sm:col-start-3 sm:row-start-1"
              >
                {isUploading
                  ? "Uploading"
                  : status === "success"
                    ? "Uploaded"
                    : "Ready"}
              </Badge>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="col-start-3 row-start-1 size-11 sm:col-start-4"
                aria-label="Remove selected file"
                disabled={isUploading}
                onClick={removeFile}
              >
                <X className="size-4" />
              </Button>
            </div>
          ) : (
            <p
              className="text-sm text-muted-foreground"
              role="status"
            >
              No file selected.
            </p>
          )}

          <Button
            type="submit"
            className="min-h-11 w-full text-white px-4 sm:w-auto bg-green-600 pointer  focus-visible:ring-green-650 hover:bg-green-650 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={
              !selectedFile || isUploading
            }
          >
            {isUploading ? (
              <>
                <LoaderCircle className="animate-spin" />

                Uploading
              </>
            ) : (
              `Upload document `
            )}
          </Button>

          {document &&
            status === "success" && (
              <div
                className="min-w-0 space-y-4 overflow-hidden rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 sm:p-5"
                role="status"
              >
                <div className="flex min-w-0 items-start gap-2 font-medium">
                  <CheckCircle2
                    aria-hidden="true"
                    className="mt-0.5 size-5 shrink-0 text-emerald-600"
                  />

                  <span className="break-words">
                    Document uploaded successfully
                  </span>
                </div>

                <dl className="grid min-w-0 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div className="min-w-0">
                    <dt className="text-emerald-800">
                      Name
                    </dt>

                    <dd className="break-all font-medium leading-6">
                      {document.name}
                    </dd>
                  </div>

                  <div className="min-w-0">
                    <dt className="text-emerald-800">
                      Size
                    </dt>

                    <dd className="font-medium">
                      {formatFileSize(
                        document.size,
                      )}
                    </dd>
                  </div>

                  {document.totalPages !==
                    null && (
                    <div className="min-w-0">
                      <dt className="text-emerald-800">
                        Pages
                      </dt>

                      <dd className="font-medium">
                        {document.totalPages}
                      </dd>
                    </div>
                  )}

                  <div className="min-w-0">
                    <dt className="text-emerald-800">
                      Characters
                    </dt>

                    <dd className="font-medium">
                      {document.characterCount.toLocaleString()}
                    </dd>
                  </div>
                </dl>

                <div className="min-w-0">
                  <p className="text-sm text-emerald-800">
                    Text preview
                  </p>

                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 [overflow-wrap:anywhere]">
                    {document.preview}
                  </p>
                </div>
              </div>
            )}
        </form>

        {document &&
          status === "success" && (
            <StudyChat
              key={document.documentId}
              documentId={document.documentId}
            />
          )}
      </CardContent>
    </Card>
  );
}
