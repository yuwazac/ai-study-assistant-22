import {
  InferSchemaType,
  Schema,
  model,
  models,
} from "mongoose";

const documentChunkSchema = new Schema(
  {
    documentId: {
      type: String,
      required: true,
      index: true,
    },

    fileName: {
      type: String,
      required: true,
    },

    mimeType: {
      type: String,
      required: true,
    },

    chunkIndex: {
      type: Number,
      required: true,
      min: 0,
    },

    content: {
      type: String,
      required: true,
    },

    characterCount: {
      type: Number,
      required: true,
      min: 1,
    },

    embedding: {
      type: [Number],
      required: true,
      validate: {
        validator: (value: number[]) => value.length === 1536,
        message: "Embedding must contain exactly 1536 numbers.",
      },
    },

    embeddingModel: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

documentChunkSchema.index(
  {
    documentId: 1,
    chunkIndex: 1,
  },
  {
    unique: true,
  },
  
);

export type DocumentChunkRecord = InferSchemaType<
  typeof documentChunkSchema
>;

export const DocumentChunkModel =
  models.DocumentChunk ??
  model("DocumentChunk", documentChunkSchema);