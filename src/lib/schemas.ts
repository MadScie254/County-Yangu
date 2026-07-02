import { z } from "zod";

export const voteSchema = z.object({
  wardId: z.string().min(1, "Choose your ward"),
  optionId: z.string().min(1, "Choose one project"),
  channel: z.enum(["web", "ussd", "ivr"]),
});

export const reportSchema = z.object({
  wardId: z.string().min(1, "Choose the ward"),
  category: z.string().min(1, "Choose a category"),
  description: z
    .string()
    .min(12, "Add a short description")
    .max(420, "Keep it under 420 characters"),
  channel: z.enum(["web", "ussd", "ivr"]),
});

export const alertSchema = z.object({
  wardId: z.string().min(1, "Choose a ward"),
  channel: z.enum(["sms", "ussd"]),
  phoneHint: z
    .string()
    .min(3, "Add the last three digits only")
    .max(4, "Do not enter a full phone number"),
});

export type VoteInput = z.infer<typeof voteSchema>;
export type ReportInput = z.infer<typeof reportSchema>;
export type AlertInput = z.infer<typeof alertSchema>;
