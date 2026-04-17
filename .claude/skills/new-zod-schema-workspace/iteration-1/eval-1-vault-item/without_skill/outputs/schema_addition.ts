export const vaultItemSchema = z.object({
  item_name: z.string().min(1, "Item name is required"),
  category: z.enum([
    "insurance",
    "financial",
    "digital",
    "physical",
    "contact",
    "wishes",
  ]),
  notes: z.string().optional(),
  url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

export type VaultItem = z.infer<typeof vaultItemSchema>;
