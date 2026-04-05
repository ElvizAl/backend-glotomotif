import { Hono } from "hono";
import { requireAuth, requireRole } from "../../middleware/auth";
import {
	createMobilSellerSchema,
	createPenawaranSchema,
	konfirmasiPembayaranSchema,
	penjualanQuerySchema,
	responPenawaranSchema,
	updateMobilSellerSchema,
	updateStatusSellerMobilSchema,
} from "./penjualan.schema";
import {
	addFotoSellerService,
	createMobilSellerService,
	createPenawaranService,
	deleteFotoSellerService,
	deleteMobilSellerService,
	getAllPenjualanService,
	getMyMobilByIdService,
	getMyMobilSellerService,
	getPenjualanByIdService,
	konfirmasiPembayaranService,
	responPenawaranService,
	setPrimaryFotoSellerService,
	submitMobilSellerService,
	updateMobilSellerService,
	updateStatusPenjualanService,
} from "./penjualan.service";

export const penjualanRouter = new Hono()

	// ─── SELLER ROUTES ────────────────────────────────────────

	// GET /penjualan/my — daftar mobil yang diajukan seller ini
	.get("/my", requireAuth, requireRole(["SELLER"]), async (c) => {
		const sellerId = c.get("user").sub;
		const parsed = penjualanQuerySchema.safeParse(c.req.query());
		if (!parsed.success)
			return c.json({ message: parsed.error.issues[0].message }, 400);
		const result = await getMyMobilSellerService(sellerId, parsed.data);
		return c.json(result, 200);
	})

	// GET /penjualan/my/:id — detail mobil milik seller
	.get("/my/:id", requireAuth, requireRole(["SELLER"]), async (c) => {
		const sellerId = c.get("user").sub;
		const result = await getMyMobilByIdService(c.req.param("id"), sellerId);
		return c.json(result, 200);
	})

	// POST /penjualan — seller tambah mobil (DRAFT, multipart + foto)
	.post("/", requireAuth, requireRole(["SELLER"]), async (c) => {
		const sellerId = c.get("user").sub;
		const formData = await c.req.formData();

		const getStr = (k: string) => {
			const v = formData.get(k);
			return (v === null || v.toString().trim() === "") ? undefined : v.toString();
		};

		const parsed = createMobilSellerSchema.safeParse({
			nama: getStr("nama"),
			merek: getStr("merek"),
			model: getStr("model"),
			tahun: getStr("tahun"),
			warna: getStr("warna"),
			kilometer: getStr("kilometer"),
			bahan_bakar: getStr("bahan_bakar"),
			transmisi: getStr("transmisi"),
			deskripsi: getStr("deskripsi"),
		});
		if (!parsed.success)
			return c.json({ message: parsed.error.issues[0].message }, 400);

		const fotoFiles = formData.getAll("foto") as File[];
		const validFotos = fotoFiles.filter((f) => f instanceof File && f.size > 0);
		const fotoBuffers = await Promise.all(
			validFotos.map((f) => f.arrayBuffer().then((ab) => Buffer.from(ab))),
		);

		const result = await createMobilSellerService(
			sellerId,
			parsed.data,
			fotoBuffers,
		);
		return c.json(result, 201);
	})

	// PATCH /penjualan/:id/submit — seller submit pengajuan ke admin
	.patch("/:id/submit", requireAuth, requireRole(["SELLER"]), async (c) => {
		const sellerId = c.get("user").sub;
		const result = await submitMobilSellerService(c.req.param("id"), sellerId);
		return c.json(result, 200);
	})

	// PUT /penjualan/:id — seller edit data (hanya saat DRAFT)
	.put("/:id", requireAuth, requireRole(["SELLER"]), async (c) => {
		const sellerId = c.get("user").sub;
		const parsed = updateMobilSellerSchema.safeParse(await c.req.json());
		if (!parsed.success)
			return c.json({ message: parsed.error.issues[0].message }, 400);
		const result = await updateMobilSellerService(
			c.req.param("id"),
			sellerId,
			parsed.data,
		);
		return c.json(result, 200);
	})

	// DELETE /penjualan/:id — seller hapus (hanya DRAFT / DITOLAK)
	.delete("/:id", requireAuth, requireRole(["SELLER"]), async (c) => {
		const sellerId = c.get("user").sub;
		const result = await deleteMobilSellerService(c.req.param("id"), sellerId);
		return c.json(result, 200);
	})

	// POST /penjualan/:id/foto — seller tambah foto
	.post("/:id/foto", requireAuth, requireRole(["SELLER"]), async (c) => {
		const sellerId = c.get("user").sub;
		const id = c.req.param("id");
		const formData = await c.req.formData();
		const fotoFiles = formData.getAll("foto") as File[];
		const validFotos = fotoFiles.filter((f) => f instanceof File && f.size > 0);
		if (validFotos.length === 0)
			return c.json({ message: "Minimal satu foto harus diupload" }, 400);
		const fotoBuffers = await Promise.all(
			validFotos.map((f) => f.arrayBuffer().then((ab) => Buffer.from(ab))),
		);
		const result = await addFotoSellerService(id, sellerId, fotoBuffers);
		return c.json(result, 201);
	})

	// PATCH /penjualan/foto/:fotoId/primary — seller set foto primary
	.patch(
		"/foto/:fotoId/primary",
		requireAuth,
		requireRole(["SELLER"]),
		async (c) => {
			const sellerId = c.get("user").sub;
			const result = await setPrimaryFotoSellerService(
				c.req.param("fotoId"),
				sellerId,
			);
			return c.json(result, 200);
		},
	)

	// DELETE /penjualan/foto/:fotoId — seller hapus satu foto
	.delete("/foto/:fotoId", requireAuth, requireRole(["SELLER"]), async (c) => {
		const sellerId = c.get("user").sub;
		const result = await deleteFotoSellerService(
			c.req.param("fotoId"),
			sellerId,
		);
		return c.json(result, 200);
	})

	// POST /penjualan/:id/respon — seller setuju/tolak penawaran harga dari admin
	.post("/:id/respon", requireAuth, requireRole(["SELLER"]), async (c) => {
		const sellerId = c.get("user").sub;
		const parsed = responPenawaranSchema.safeParse(await c.req.json());
		if (!parsed.success)
			return c.json({ message: parsed.error.issues[0].message }, 400);
		const result = await responPenawaranService(
			c.req.param("id"),
			sellerId,
			parsed.data,
		);
		return c.json(result, 200);
	})

	// ─── ADMIN ROUTES ─────────────────────────────────────────

	// GET /penjualan — admin: semua pengajuan dari seller
	.get("/", requireAuth, requireRole(["ADMIN"]), async (c) => {
		const parsed = penjualanQuerySchema.safeParse(c.req.query());
		if (!parsed.success)
			return c.json({ message: parsed.error.issues[0].message }, 400);
		const result = await getAllPenjualanService(parsed.data);
		return c.json(result, 200);
	})

	// GET /penjualan/:id — admin: detail pengajuan
	.get("/:id", requireAuth, requireRole(["ADMIN"]), async (c) => {
		const result = await getPenjualanByIdService(c.req.param("id"));
		return c.json(result, 200);
	})

	// PATCH /penjualan/:id/status — admin: update status evaluasi
	.patch("/:id/status", requireAuth, requireRole(["ADMIN"]), async (c) => {
		const parsed = updateStatusSellerMobilSchema.safeParse(await c.req.json());
		if (!parsed.success)
			return c.json({ message: parsed.error.issues[0].message }, 400);
		const result = await updateStatusPenjualanService(
			c.req.param("id"),
			parsed.data,
		);
		return c.json(result, 200);
	})

	// POST /penjualan/:id/tawar — admin: beri penawaran harga ke seller
	.post("/:id/tawar", requireAuth, requireRole(["ADMIN"]), async (c) => {
		const parsed = createPenawaranSchema.safeParse(await c.req.json());
		if (!parsed.success)
			return c.json({ message: parsed.error.issues[0].message }, 400);
		const result = await createPenawaranService(c.req.param("id"), parsed.data);
		return c.json(result, 201);
	})

	// PATCH /penjualan/:id/bayar — admin: konfirmasi bayar seller → mobil jadi TERSEDIA
	.patch("/:id/bayar", requireAuth, requireRole(["ADMIN"]), async (c) => {
		const parsed = konfirmasiPembayaranSchema.safeParse(await c.req.json());
		if (!parsed.success)
			return c.json({ message: parsed.error.issues[0].message }, 400);
		const result = await konfirmasiPembayaranService(
			c.req.param("id"),
			parsed.data,
		);
		return c.json(result, 200);
	});
