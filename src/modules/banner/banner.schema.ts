import { z } from "zod";

export const createBannerSchema = z.object({
	judul: z.string().min(1, "Judul tidak boleh kosong"),
	isActive: z.coerce.boolean().optional().default(true),
	urutan: z.coerce.number().int().optional().default(0),
});

export const updateBannerSchema = createBannerSchema.partial();

export type CreateBannerInput = z.infer<typeof createBannerSchema>;
export type UpdateBannerInput = z.infer<typeof updateBannerSchema>;
