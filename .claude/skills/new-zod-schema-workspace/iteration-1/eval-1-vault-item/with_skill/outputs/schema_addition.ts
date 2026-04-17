export const vaultItemSchema = z.object({
  // Item details
  item_name: z.string().min(1, "Item name is required"),
  category: z.enum([
    "insurance",
    "financial",
    "digital",
    "physical",
    "contact",
    "wishes",
  ]),

  // Optional fields
  notes: z.string().optional(),
  url: z.string().optional(),
});

export type VaultItem = z.infer<typeof vaultItemSchema>;
