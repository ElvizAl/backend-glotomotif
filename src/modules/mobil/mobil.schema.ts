import { z } from "zod";

export const createMobilSchema = z.object({
	nama: z.string().min(1, "Nama mobil tidak boleh kosong"),
	merek: z.string().optional(),
	model: z.string().optional(),
	tahun: z.coerce.number().int().min(1900).max(2100).optional(),
	warna: z.string().optional(),
	kilometer: z.string().optional(),
	bahan_bakar: z.string().optional(),
	transmisi: z.enum(["MANUAL", "OTOMATIS"]).optional(),
	harga: z.coerce.number().positive("Harga harus lebih dari 0"),
	status: z.enum(["TERSEDIA", "TERJUAL"]).optional().default("TERSEDIA"),
});

export const updateMobilSchema = createMobilSchema
	.omit({ status: true })
	.partial()
	.extend({
		status: z.enum(["TERSEDIA", "TERJUAL"]).optional(),
	});

export const mobilQuerySchema = z.object({
	status: z.enum(["TERSEDIA", "TERJUAL"]).optional(),
	transmisi: z.enum(["MANUAL", "OTOMATIS"]).optional(),
	merek: z.string().optional(),
	page: z.coerce.number().int().min(1).optional().default(1),
	limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});

export type CreateMobilInput = z.infer<typeof createMobilSchema>;
export type UpdateMobilInput = z.infer<typeof updateMobilSchema>;
export type MobilQueryInput = z.infer<typeof mobilQuerySchema>;
