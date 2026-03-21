import { z } from "zod";

export const userQuerySchema = z.object({
	page: z.coerce.number().min(1, "Halaman minimal 1").default(1),
	limit: z.coerce
		.number()
		.min(1, "Limit minimal 1")
		.max(100, "Limit maksimal 100")
		.default(10),
	search: z.string().optional(),
});

export const updateUserSchema = z.object({
	name: z.string().min(2, "Nama minimal 2 karakter").optional(),
	email: z.email("Format email tidak valid").optional(),
	role: z.enum(["SELLER", "BUYER", "ADMIN"]).optional(),
});

export const banUserSchema = z.object({
	onBanned: z.boolean(),
});

export type UserQueryInput = z.infer<typeof userQuerySchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type BanUserInput = z.infer<typeof banUserSchema>;
