import { z } from "zod";

export const createOrderSchema = z.object({
	mobilId: z.string().min(1, "mobilId wajib diisi"),
	metodePembayaran: z.enum(["TUNAI", "TRANSFER"]).default("TRANSFER"),
	metodePengambilan: z.enum(["AMBIL_SENDIRI", "DIANTAR"]).optional(),
	alamatKirim: z.string().optional(),
});

export const uploadPembayaranSchema = z.object({
	tipe: z.enum(["BUKTI_PESANAN", "DP", "PELUNASAN"]),
	metode: z.enum(["TUNAI", "TRANSFER"]),
	nominal: z.coerce.number().positive().optional(),
	buktiTransferUrl: z.string().url().optional(),
});

export const verifikasiPembayaranSchema = z.object({
	sudahDiverifikasi: z.boolean(),
	kwitansiUrl: z.string().url().optional(),
});

export const updateStatusSuratSchema = z.object({
	statusStnk: z.enum(["BELUM_DIPROSES", "SEDANG_DIPROSES", "SELESAI"]).optional(),
	statusBpkb: z.enum(["BELUM_DIPROSES", "SEDANG_DIPROSES", "SELESAI"]).optional(),
});

export const updatePengambilanSchema = z.object({
	metodePengambilan: z.enum(["AMBIL_SENDIRI", "DIANTAR"]),
	alamatKirim: z.string().optional(),
	suratJalanUrl: z.string().url().optional(),
});

export const orderQuerySchema = z.object({
	status: z
		.enum([
			"MENUNGGU_BUKTI_PESANAN",
			"MENUNGGU_DP",
			"DIBATALKAN",
			"MENUNGGU_PELUNASAN",
			"LUNAS_SIAP_SERAH",
			"SELESAI",
		])
		.optional(),
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const uploadKtpSchema = z.object({
	ktpUrl: z.string().url("URL KTP tidak valid"),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UploadPembayaranInput = z.infer<typeof uploadPembayaranSchema>;
export type VerifikasiPembayaranInput = z.infer<typeof verifikasiPembayaranSchema>;
export type UpdateStatusSuratInput = z.infer<typeof updateStatusSuratSchema>;
export type UpdatePengambilanInput = z.infer<typeof updatePengambilanSchema>;
export type OrderQueryInput = z.infer<typeof orderQuerySchema>;
