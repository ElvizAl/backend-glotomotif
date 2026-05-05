import "dotenv/config";

import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { authRouter } from "./modules/auth/auth.route";
import { bannerRouter } from "./modules/banner/banner.route";
import { mobilRouter } from "./modules/mobil/mobil.route";
import { orderRouter } from "./modules/order/order.route";
import { penjualanRouter } from "./modules/penjualan/penjualan.route";
import { profileRouter } from "./modules/profile/profile.route";
import { cronRouter } from "./modules/order/cron.route";
import { userRouter } from "./modules/users/user.route";

const app = new Hono()
	.basePath("api")

	.use(logger())

	.use(
		"*",
		cors({
			origin: (origin, c) => {
				const allowed = [
					"http://localhost:3000",
					"https://www.glotomotif.my.id",
					"https://glotomotif.my.id",
					"https://vercel.app",
				];
				// Allow Vercel preview deployments
				if (
					!origin ||
					allowed.includes(origin) ||
					origin.endsWith(".vercel.app")
				) {
					return origin;
				}
				return "https://www.glotomotif.my.id";
			},
			allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
			allowHeaders: ["Content-Type", "Authorization"],
			credentials: true,
			maxAge: 86400,
		}),
	)

	// Routing setup
	.route("/auth", authRouter)
	.route("/users", userRouter)
	.route("/profile", profileRouter)
	.route("/banner", bannerRouter)
	.route("/mobil", mobilRouter)
	.route("/order", orderRouter)
	.route("/penjualan", penjualanRouter)
	.route("/cron", cronRouter)

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
