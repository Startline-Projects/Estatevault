import z from "zod";

export const attorneyReviewRequestSchema = z.object({
  // Request identifiers
  client_id: z.string().min(1, "Client ID is required"),
  order_id: z.string().min(1, "Order ID is required"),

  // Review details
  notes: z.string().optional(),
  urgency: z.enum(["standard", "urgent"]),

  // Acknowledgment
  acknowledgment_signed: z.boolean().refine((val) => val === true, {
    message: "You must sign the acknowledgment before proceeding",
  }),
});

export type AttorneyReviewRequest = z.infer<typeof attorneyReviewRequestSchema>;
