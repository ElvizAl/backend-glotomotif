import { Hono } from "hono";
import { requireAuth, requireRole } from "../../middleware/auth";
import {
	createMobilSchema,
	mobilQuerySchema,
	updateMobilSchema,
} from "./mobil.schema";
import {
	addFotoMobilService,
	createMobilService,
	deleteFotoMobilService,
	deleteMobilService,
	getAllMobilService,
	getMobilByIdService,
	getMobilCardsService,
	setPrimaryFotoService,
	updateMobilService,
} from "./mobil.service";

export const mobilRouter = new Hono()
	// GET /mobil — public, dengan filter & pagination
	.get("/", async (c) => {
		const parsed = mobilQuerySchema.safeParse(c.req.query());
		if (!parsed.success) {
			return c.json({ message: parsed.error.issues[0].message }, 400);
		}
		const result = await getAllMobilService(parsed.data);
		return c.json(result, 200);
	})

	// GET /mobil/cards — public, untuk homepage (take 6, field card)
	.get("/cards", async (c) => {
		const result = await getMobilCardsService();
		return c.json(result, 200);
	})

	// GET /mobil/:id — public, detail + semua foto
	.get("/:id", async (c) => {
		const id = c.req.param("id");
		const result = await getMobilByIdService(id);
		return c.json(result, 200);
	})

	// POST /mobil — Admin, multipart/form-data
	.post("/", requireAuth, requireRole(["ADMIN"]), async (c) => {
		const formData = await c.req.formData();

		const getStr = (k: string) => {
			const v = formData.get(k);
			return (v === null || v.toString().trim() === "") ? undefined : v.toString();
		};

		const parsed = createMobilSchema.safeParse({
			nama: getStr("nama"),
			merek: getStr("merek"),
			model: getStr("model"),
			tahun: getStr("tahun"),
			warna: getStr("warna"),
			kilometer: getStr("kilometer"),
			bahan_bakar: getStr("bahan_bakar"),
			transmisi: getStr("transmisi"),
			harga: getStr("harga"),
			status: getStr("status"),
		});

		if (!parsed.success) {
			return c.json({ message: parsed.error.issues[0].message }, 400);
		}

		// Ambil semua file foto (bisa multiple)
		const fotoFiles = formData.getAll("foto") as File[];
		const validFotos = fotoFiles.filter((f) => f instanceof File && f.size > 0);
		const fotoBuffers = await Promise.all(
			validFotos.map((f) => f.arrayBuffer().then((ab) => Buffer.from(ab))),
		);

		const result = await createMobilService(parsed.data, fotoBuffers);
		return c.json(result, 201);
	})

	// PUT /mobil/:id — Admin, update data (tanpa foto)
	.put("/:id", requireAuth, requireRole(["ADMIN"]), async (c) => {
		const id = c.req.param("id");
		const body = await c.req.json();

		const parsed = updateMobilSchema.safeParse(body);
		if (!parsed.success) {
			return c.json({ message: parsed.error.issues[0].message }, 400);
		}

		const result = await updateMobilService(id, parsed.data);
		return c.json(result, 200);
	})

	// DELETE /mobil/:id — Admin
	.delete("/:id", requireAuth, requireRole(["ADMIN"]), async (c) => {
		const id = c.req.param("id");
		const result = await deleteMobilService(id);
		return c.json(result, 200);
	})

	// POST /mobil/:id/foto — Admin, tambah foto ke mobil yang ada
	.post("/:id/foto", requireAuth, requireRole(["ADMIN"]), async (c) => {
		const id = c.req.param("id");
		const formData = await c.req.formData();

		const fotoFiles = formData.getAll("foto") as File[];
		const validFotos = fotoFiles.filter((f) => f instanceof File && f.size > 0);

		if (validFotos.length === 0) {
			return c.json({ message: "Minimal satu foto harus diupload" }, 400);
		}

		const fotoBuffers = await Promise.all(
			validFotos.map((f) => f.arrayBuffer().then((ab) => Buffer.from(ab))),
		);

		const result = await addFotoMobilService(id, fotoBuffers);
		return c.json(result, 201);
	})

	// PATCH /mobil/foto/:fotoId/primary — Admin, set foto sebagai primary
	.patch(
		"/foto/:fotoId/primary",
		requireAuth,
		requireRole(["ADMIN"]),
		async (c) => {
			const fotoId = c.req.param("fotoId");
			const result = await setPrimaryFotoService(fotoId);
			return c.json(result, 200);
		},
	)

	// DELETE /mobil/foto/:fotoId — Admin, hapus satu foto
	.delete("/foto/:fotoId", requireAuth, requireRole(["ADMIN"]), async (c) => {
		const fotoId = c.req.param("fotoId");
		const result = await deleteFotoMobilService(fotoId);
		return c.json(result, 200);
	});
