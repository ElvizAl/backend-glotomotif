import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { authRouter } from "./modules/auth/auth.route";
import { bannerRouter } from "./modules/banner/banner.route";
import { mobilRouter } from "./modules/mobil/mobil.route";
import { penjualanRouter } from "./modules/penjualan/penjualan.route";
import { profileRouter } from "./modules/profile/profile.route";
import { userRouter } from "./modules/users/user.route";

import "dotenv";

const app = new Hono()
	.basePath("api")

	.use(logger())

	.use(
		"*",
		cors({
			origin: ["http://localhost:3000", "https://www.glotomotif.my.id"],
			allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
			allowHeaders: ["Content-Type", "Authorization"],
			credentials: true,
		}),
	)

	// Routing setup
	.route("/auth", authRouter)
	.route("/users", userRouter)
	.route("/profile", profileRouter)
	.route("/banner", bannerRouter)
	.route("/mobil", mobilRouter)
	.route("/penjualan", penjualanRouter)

	.notFound((c) => {
		return c.json({ message: "Tidak Ditemukan" }, 404);
	})

	.onError((err, c) => {
		if (err instanceof HTTPException) {
			return c.json({ message: err.message }, err.status);
		}

		console.error("Internal Server Error:", err);
		return c.json({ message: "Internal Server Error" }, 500);
	});

export default {
	fetch: app.fetch,
	port: 8080,
};
