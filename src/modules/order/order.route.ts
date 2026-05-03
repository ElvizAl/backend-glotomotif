import { Hono } from "hono";
import { requireAuth, requireRole } from "../../middleware/auth";
import { prisma } from "../../utils/prisma";
import {
	createOrderSchema,
	orderQuerySchema,
	updatePengambilanSchema,
	updateStatusSuratSchema,
	uploadPembayaranSchema,
	verifikasiPembayaranSchema,
} from "./order.schema";
import {
	cancelOrderService,
	createOrderService,
	getAllOrdersService,
	getDashboardStatsService,
	getLaporanService,
	getMyOrderByIdService,
	getMyOrdersService,
	getOrderByIdService,
	updatePengambilanService,
	updateStatusSuratService,
	uploadKtpService,
	uploadPembayaranService,
	verifikasiPembayaranService,
	processRefundService,
	tandaiSelesaiService,
} from "./order.service";

export const orderRouter = new Hono()

	// ─── STATIC ROUTES FIRST (before /:id wildcards) ──────

	// GET /order/stats — statistik dashboard (admin)
	.get("/stats", requireAuth, requireRole(["ADMIN"]), async (c) => {
		const result = await getDashboardStatsService();
		return c.json(result, 200);
	})

	// GET /order/laporan — laporan penjualan (admin)
	.get("/laporan", requireAuth, requireRole(["ADMIN"]), async (c) => {
		const { bulan, tahun } = c.req.query();
		const result = await getLaporanService({
			bulan: bulan ? Number(bulan) : undefined,
			tahun: tahun ? Number(tahun) : undefined,
		});
		return c.json(result, 200);
	})

	// GET /order/rekening — list rekening admin aktif (publik/buyer)
	.get("/rekening", requireAuth, async (c) => {
		const rekening = await prisma.rekeningAdmin.findMany({
			where: { isActive: true },
			orderBy: { createdAt: "asc" },
		});
		return c.json({ data: rekening }, 200);
	})

	// POST /order/rekening — tambah rekening admin (admin)
	.post("/rekening", requireAuth, requireRole(["ADMIN"]), async (c) => {
		const body = await c.req.json();
		const { bank, noRekening, atasNama } = body;
		if (!bank || !noRekening || !atasNama)
			return c.json({ message: "bank, noRekening, atasNama wajib diisi" }, 400);
		const rekening = await prisma.rekeningAdmin.create({ data: { bank, noRekening, atasNama } });
		return c.json({ data: rekening }, 201);
	})

	// DELETE /order/rekening/:id — hapus rekening admin (admin)
	.delete("/rekening/:id", requireAuth, requireRole(["ADMIN"]), async (c) => {
		const id = c.req.param("id");
		await prisma.rekeningAdmin.delete({ where: { id } });
		return c.json({ message: "Rekening berhasil dihapus" }, 200);
	})

	// GET /order/my — order milik buyer yang login
	.get("/my", requireAuth, requireRole(["BUYER"]), async (c) => {
		const buyerId = c.get("user").sub;
		const parsed = orderQuerySchema.safeParse(c.req.query());
		if (!parsed.success)
			return c.json({ message: parsed.error.issues[0].message }, 400);
		const result = await getMyOrdersService(buyerId, parsed.data);
		return c.json(result, 200);
	})

	// GET /order/my/:id — detail order buyer
	.get("/my/:id", requireAuth, requireRole(["BUYER"]), async (c) => {
		const buyerId = c.get("user").sub;
		const id = c.req.param("id");
		const result = await getMyOrderByIdService(id, buyerId);
		return c.json(result, 200);
	})

	// POST /order/my/:id/ktp — upload KTP (buyer)
	.post("/my/:id/ktp", requireAuth, requireRole(["BUYER"]), async (c) => {
		const buyerId = c.get("user").sub;
		const id = c.req.param("id");
		const formData = await c.req.formData();
		const ktpFile = formData.get("ktp") as File | null;

		if (!ktpFile || ktpFile.size === 0)
			return c.json({ message: "File KTP wajib diupload" }, 400);

		const ktpBuffer = Buffer.from(await ktpFile.arrayBuffer());
		const result = await uploadKtpService(id, buyerId, ktpBuffer);
		return c.json(result, 200);
	})

	// POST /order/my/:id/bayar — upload bukti pembayaran (buyer)
	.post("/my/:id/bayar", requireAuth, requireRole(["BUYER"]), async (c) => {
		const buyerId = c.get("user").sub;
		const id = c.req.param("id");
		const formData = await c.req.formData();

		const parsed = uploadPembayaranSchema.safeParse({
			tipe: formData.get("tipe"),
			metode: formData.get("metode"),
			nominal: formData.get("nominal") || undefined,
			buktiTransferUrl: formData.get("buktiTransferUrl") || undefined,
		});
		if (!parsed.success)
			return c.json({ message: parsed.error.issues[0].message }, 400);

		const buktiFile = formData.get("bukti") as File | null;
		const buktiBuffer =
			buktiFile && buktiFile.size > 0
				? Buffer.from(await buktiFile.arrayBuffer())
				: undefined;

		const result = await uploadPembayaranService(id, buyerId, parsed.data, buktiBuffer);
		return c.json(result, 201);
	})

	// PATCH /order/my/:id/cancel — batalkan pesanan (buyer)
	.patch("/my/:id/cancel", requireAuth, requireRole(["BUYER"]), async (c) => {
		const buyerId = c.get("user").sub;
		const id = c.req.param("id");
		const body = await c.req.json().catch(() => ({}));
		const refundInfo = body.noRekening
			? { noRekening: body.noRekening, namaRekening: body.namaRekening, bank: body.bank }
			: undefined;
		const result = await cancelOrderService(id, buyerId, refundInfo);
		return c.json(result, 200);
	})

	// POST /order — buat order baru (buyer)
	.post("/", requireAuth, requireRole(["BUYER"]), async (c) => {
		const buyerId = c.get("user").sub;
		const body = await c.req.json();
		const parsed = createOrderSchema.safeParse(body);
		if (!parsed.success)
			return c.json({ message: parsed.error.issues[0].message }, 400);
		const result = await createOrderService(buyerId, parsed.data);
		return c.json(result, 201);
	})

	// ─── ADMIN WILDCARD ROUTES (after static routes) ──────

	// GET /order — semua order (admin)
	.get("/", requireAuth, requireRole(["ADMIN"]), async (c) => {
		const parsed = orderQuerySchema.safeParse(c.req.query());
		if (!parsed.success)
			return c.json({ message: parsed.error.issues[0].message }, 400);
		const result = await getAllOrdersService(parsed.data);
		return c.json(result, 200);
	})

	// PATCH /order/pembayaran/:pembayaranId/verifikasi — verifikasi + upload kwitansi (admin)
	.patch(
		"/pembayaran/:pembayaranId/verifikasi",
		requireAuth,
		requireRole(["ADMIN"]),
		async (c) => {
			const pembayaranId = c.req.param("pembayaranId");
			const formData = await c.req.formData();

			const parsed = verifikasiPembayaranSchema.safeParse({
				sudahDiverifikasi: formData.get("sudahDiverifikasi") === "true",
				kwitansiUrl: formData.get("kwitansiUrl") || undefined,
			});
			if (!parsed.success)
				return c.json({ message: parsed.error.issues[0].message }, 400);

			const kwitansiFile = formData.get("kwitansi") as File | null;
			const kwitansiBuffer =
				kwitansiFile && kwitansiFile.size > 0
					? Buffer.from(await kwitansiFile.arrayBuffer())
					: undefined;

			const result = await verifikasiPembayaranService(
				pembayaranId,
				parsed.data,
				kwitansiBuffer,
			);
			return c.json(result, 200);
		},
	)

	// PATCH /order/pembayaran/:pembayaranId/refund — proses refund uang muka (admin)
	.patch(
		"/pembayaran/:pembayaranId/refund",
		requireAuth,
		requireRole(["ADMIN"]),
		async (c) => {
			const pembayaranId = c.req.param("pembayaranId");
			const formData = await c.req.formData();
			
			const buktiFile = formData.get("bukti") as File | null;
			const buktiBuffer =
				buktiFile && buktiFile.size > 0
					? Buffer.from(await buktiFile.arrayBuffer())
					: undefined;

			const result = await processRefundService(pembayaranId, buktiBuffer);
			return c.json(result, 200);
		},
	)

	// GET /order/:id — detail order (admin)
	.get("/:id", requireAuth, requireRole(["ADMIN"]), async (c) => {
		const id = c.req.param("id");
		const result = await getOrderByIdService(id);
		return c.json(result, 200);
	})

	// PATCH /order/:id/surat — update status STNK/BPKB (admin)
	.patch("/:id/surat", requireAuth, requireRole(["ADMIN"]), async (c) => {
		const id = c.req.param("id");
		const body = await c.req.json();
		const parsed = updateStatusSuratSchema.safeParse(body);
		if (!parsed.success)
			return c.json({ message: parsed.error.issues[0].message }, 400);
		const result = await updateStatusSuratService(id, parsed.data);
		return c.json(result, 200);
	})

	// PATCH /order/:id/pengambilan — set metode pengambilan + upload surat jalan (admin)
	.patch("/:id/pengambilan", requireAuth, requireRole(["ADMIN"]), async (c) => {
		const id = c.req.param("id");
		const formData = await c.req.formData();
		const parsed = updatePengambilanSchema.safeParse({
			metodePengambilan: formData.get("metodePengambilan"),
			alamatKirim: formData.get("alamatKirim"),
			suratJalanUrl: formData.get("suratJalanUrl"),
		});
		if (!parsed.success)
			return c.json({ message: parsed.error.issues[0].message }, 400);

		const suratFile = formData.get("suratJalan") as File | null;
		const suratBuffer =
			suratFile && suratFile.size > 0
				? Buffer.from(await suratFile.arrayBuffer())
				: undefined;

		const result = await updatePengambilanService(id, parsed.data, suratBuffer);
		return c.json(result, 200);
	})

	// PATCH /order/:id/selesai — tandai serah terima berhasil (admin)
	.patch("/:id/selesai", requireAuth, requireRole(["ADMIN"]), async (c) => {
		const id = c.req.param("id");
		// tandaiSelesaiService needs to be imported
		const result = await tandaiSelesaiService(id);
		return c.json(result, 200);
	});
