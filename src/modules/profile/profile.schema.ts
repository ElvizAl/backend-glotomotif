import { z } from "zod";

export const createProfileSchema = z.object({
	fullName: z.string().min(2, "Nama lengkap minimal 2 karakter"),
	phone: z.string().min(8, "Nomor telepon minimal 8 karakter"),
	email: z.email("Format email tidak valid"),
	gender: z.enum(["Laki-laki", "Perempuan"]).optional(),
	birthDate: z.coerce.date().optional(),
});

export const updateProfileSchema = createProfileSchema.partial();

export type CreateProfileInput = z.infer<typeof createProfileSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
