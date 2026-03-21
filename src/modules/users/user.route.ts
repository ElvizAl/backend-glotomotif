import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { requireAuth, requireRole } from "../../middleware/auth";
import {
	banUserSchema,
	updateUserSchema,
	userQuerySchema,
} from "./user.schema";
import {
	banUserService,
	deleteUserService,
	getAllUsersService,
	updateUserService,
} from "./user.service";

export const userRouter = new Hono()
	// Middleware Global untuk seluruh User Route
	.use("*", requireAuth, requireRole(["ADMIN"]))

	// Get All Users (with pagination & search)
	// Kita bisa tambahkan middleware checkAdmin / requireRole("ADMIN") di sini
	.get("/", zValidator("query", userQuerySchema), async (c) => {
		const query = c.req.valid("query");
		const result = await getAllUsersService(query);
		return c.json(result, 200);
	})

	// Update User Content (Name, Email, Role)
	.put("/:id", zValidator("json", updateUserSchema), async (c) => {
		const id = c.req.param("id");
		const body = c.req.valid("json");
		const result = await updateUserService(id, body);
		return c.json(result, 200);
	})

	// Delete User
	.delete("/:id", async (c) => {
		const id = c.req.param("id");
		const result = await deleteUserService(id);
		return c.json(result, 200);
	})

	// Ban or Unban User
	.patch("/:id/ban", zValidator("json", banUserSchema), async (c) => {
		const id = c.req.param("id");
		const body = c.req.valid("json");
		const result = await banUserService(id, body);
		return c.json(result, 200);
	});
