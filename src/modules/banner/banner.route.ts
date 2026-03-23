import { Hono } from "hono";
import { requireAuth, requireRole } from "../../middleware/auth";
import { createBannerSchema, updateBannerSchema } from "./banner.schema";
import {
	createBannerService,
	deleteBannerService,
	getAllBannersService,
	getBannerByIdService,
	updateBannerService,
} from "./banner.service";

export const bannerRouter = new Hono()
	// GET /banner — public
	.get("/", async (c) => {
		const result = await getAllBannersService();
		return c.json(result, 200);
	})

	// GET /banner/:id — public
	.get("/:id", async (c) => {
		const id = c.req.param("id");
		const result = await getBannerByIdService(id);
		return c.json(result, 200);
	})

	// POST /banner — khusus Admin, multipart/form-data
	.post("/", requireAuth, requireRole(["ADMIN"]), async (c) => {
		const formData = await c.req.formData();

		const imageFile = formData.get("image") as File | null;
		if (!imageFile || imageFile.size === 0) {
			return c.json({ message: "Gambar banner wajib diupload" }, 400);
		}

		const parsed = createBannerSchema.safeParse({
			judul: formData.get("judul"),
			isActive: formData.get("isActive"),
			urutan: formData.get("urutan"),
		});

		if (!parsed.success) {
			return c.json({ message: parsed.error.issues[0].message }, 400);
		}

		const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
		const result = await createBannerService(parsed.data, imageBuffer);
		return c.json(result, 201);
	})

	// PUT /banner/:id — khusus Admin
	.put("/:id", requireAuth, requireRole(["ADMIN"]), async (c) => {
		const id = c.req.param("id");
		const formData = await c.req.formData();

		const parsed = updateBannerSchema.safeParse({
			...(formData.get("judul") && { judul: formData.get("judul") }),
			...(formData.get("isActive") && { isActive: formData.get("isActive") }),
			...(formData.get("urutan") && { urutan: formData.get("urutan") }),
		});

		if (!parsed.success) {
			return c.json({ message: parsed.error.issues[0].message }, 400);
		}

		const imageFile = formData.get("image") as File | null;
		const imageBuffer =
			imageFile && imageFile.size > 0
				? Buffer.from(await imageFile.arrayBuffer())
				: undefined;

		const result = await updateBannerService(id, parsed.data, imageBuffer);
		return c.json(result, 200);
	})

	// DELETE /banner/:id — khusus Admin
	.delete("/:id", requireAuth, requireRole(["ADMIN"]), async (c) => {
		const id = c.req.param("id");
		const result = await deleteBannerService(id);
		return c.json(result, 200);
	});
