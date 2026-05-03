import { z } from "zod";

export const createMobilSellerSchema = z.object({
	nama: z.string().min(1, "Nama mobil tidak boleh kosong"),
	merek: z.string().optional(),
	model: z.string().optional(),
	tahun: z.coerce.number().int().min(1900).max(2100).optional(),
	warna: z.string().optional(),
	kilometer: z.string().optional(),
	bahan_bakar: z.string().optional(),
	transmisi: z.enum(["MANUAL", "OTOMATIS"]).optional(),
	deskripsi: z.string().optional(),
	harga: z.coerce.number().positive().optional().default(0),
});

export const updateMobilSellerSchema = createMobilSellerSchema.partial();

export const createPenawaranSchema = z.object({
	hargaTawar: z.coerce.number().positive("Harga tawar harus lebih dari 0"),
	catatanAdmin: z.string().optional(),
});

export const responPenawaranSchema = z.object({
	respon: z.enum(["DISETUJUI", "DITOLAK"]),
	catatanSeller: z.string().optional(),
	metode: z.enum(["TUNAI", "TRANSFER"]).optional(),
	noRekeningSeller: z.string().optional(),
	namaRekeningSeller: z.string().optional(),
	bankSeller: z.string().optional(),
});

export const konfirmasiPembayaranSchema = z.object({
	metode: z.enum(["TUNAI", "TRANSFER"]),
	buktiTransferUrl: z.string().url().optional(),
	kwitansiUrl: z.string().url().optional(),
});

export const updateStatusSellerMobilSchema = z.object({
	status: z.enum([
		"MENUNGGU_EVALUASI",
		"SEDANG_DIEVALUASI",
		"DITAWARKAN",
		"DISETUJUI",
		"DITOLAK",
		"TERSEDIA",
	]),
});

export const penjualanQuerySchema = z.object({
	status: z
		.enum([
			"DRAFT",
			"MENUNGGU_EVALUASI",
			"SEDANG_DIEVALUASI",
			"DITAWARKAN",
			"DISETUJUI",
			"DITOLAK",
			"TERSEDIA",
			"TERJUAL",
		])
		.optional(),
	page: z.coerce.number().int().min(1).optional().default(1),
	limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});

export type CreateMobilSellerInput = z.infer<typeof createMobilSellerSchema>;
export type UpdateMobilSellerInput = z.infer<typeof updateMobilSellerSchema>;
export type CreatePenawaranInput = z.infer<typeof createPenawaranSchema>;
export type ResponPenawaranInput = z.infer<typeof responPenawaranSchema>;
export type KonfirmasiPembayaranInput = z.infer<
	typeof konfirmasiPembayaranSchema
>;
export type UpdateStatusSellerMobilInput = z.infer<
	typeof updateStatusSellerMobilSchema
>;
export type PenjualanQueryInput = z.infer<typeof penjualanQuerySchema>;
