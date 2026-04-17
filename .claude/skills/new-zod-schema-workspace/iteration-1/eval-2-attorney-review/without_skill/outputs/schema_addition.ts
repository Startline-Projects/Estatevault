import { z } from "zod";

export const attorneyReviewRequestSchema = z.object({
  // Required identifiers
  client_id: z.string().min(1, "Client ID is required"),
  order_id: z.string().min(1, "Order ID is required"),

  // Optional notes
  notes: z.string().optional(),

  // Urgency level
  urgency: z.enum(["standard", "urgent"]),

  // Acknowledgment
  acknowledgment_signed: z.boolean().refine((val) => val === true, {
    message: "You must check the acknowledgment box before submitting",
  }),
});

export type AttorneyReviewRequest = z.infer<typeof attorneyReviewRequestSchema>;
