import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import type { AppVariables } from "../../types";
import { createProfileSchema, updateProfileSchema } from "./profile.schema";
import {
	createProfileService,
	deleteProfileService,
	getProfileService,
	updateProfileService,
} from "./profile.service";

export const profileRouter = new Hono<AppVariables>()
	// Semua route butuh autentikasi
	.use("*", requireAuth)

	// GET /profile — ambil profil user yang login
	.get("/", async (c) => {
		const userId = c.get("user").sub;
		const result = await getProfileService(userId);
		return c.json(result, 200);
	})

	// POST /profile — buat profil baru
	.post("/", zValidator("json", createProfileSchema), async (c) => {
		const userId = c.get("user").sub;
		const body = c.req.valid("json");
		const result = await createProfileService(userId, body);
		return c.json(result, 201);
	})

	// PUT /profile — update profil
	.put("/", zValidator("json", updateProfileSchema), async (c) => {
		const userId = c.get("user").sub;
		const body = c.req.valid("json");
		const result = await updateProfileService(userId, body);
		return c.json(result, 200);
	})

	// DELETE /profile — hapus profil
	.delete("/", async (c) => {
		const userId = c.get("user").sub;
		const result = await deleteProfileService(userId);
		return c.json(result, 200);
	});
