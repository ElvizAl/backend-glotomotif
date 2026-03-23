import { googleAuth } from "@hono/oauth-providers/google";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { env } from "../../config/env";
import { requireAuth } from "../../middleware/auth";
import {
	changePasswordSchema,
	forgotPasswordSchema,
	loginSchema,
	registerSchema,
	resendVerificationOtpSchema,
	resetPasswordSchema,
	verifyEmailOtpSchema,
} from "./auth.schema";
import {
	changePasswordService,
	forgotPasswordService,
	getMeService,
	googleCallbackService,
	loginService,
	registerService,
	resendVerificationOtpService,
	resetPasswordService,
	verifyEmailOtpService,
} from "./auth.service";

export const authRouter = new Hono()

	.post("/register", zValidator("json", registerSchema), async (c) => {
		const data = c.req.valid("json");
		const result = await registerService(data);
		return c.json(result, 201);
	})

	.post("/login", zValidator("json", loginSchema), async (c) => {
		const data = c.req.valid("json");
		const result = await loginService(data);
		return c.json(result, 200);
	})

	.post(
		"/verify-email",
		zValidator("json", verifyEmailOtpSchema),
		async (c) => {
			const data = c.req.valid("json");
			const result = await verifyEmailOtpService(data);
			return c.json(result, 200);
		},
	)

	.post(
		"/resend-otp",
		zValidator("json", resendVerificationOtpSchema),
		async (c) => {
			const data = c.req.valid("json");
			const result = await resendVerificationOtpService(data);
			return c.json(result, 200);
		},
	)

	.post(
		"/forgot-password",
		zValidator("json", forgotPasswordSchema),
		async (c) => {
			const data = c.req.valid("json");
			const result = await forgotPasswordService(data);
			return c.json(result, 200);
		},
	)

	.post(
		"/reset-password",
		zValidator("json", resetPasswordSchema),
		async (c) => {
			const data = c.req.valid("json");
			const result = await resetPasswordService(data);
			return c.json(result, 200);
		},
	)

	.get("/me", requireAuth, async (c) => {
		const user = c.get("user");
		if (!user) {
			throw new HTTPException(401, {
				message: "Sesi tidak valid atau belum login",
			});
		}

		const result = await getMeService(user.sub);
		return c.json(result, 200);
	})

	.post(
		"/change-password",
		requireAuth,
		zValidator("json", changePasswordSchema),
		async (c) => {
			const userId = c.get("user").sub;
			const body = c.req.valid("json");
			const result = await changePasswordService(userId, body);
			return c.json(result, 200);
		},
	)

	.get(
		"/google",
		googleAuth({
			client_id: env.GOOGLE_CLIENT_ID,
			client_secret: env.GOOGLE_CLIENT_SECRET,
			scope: ["openid", "email", "profile"],
		}),
		async (c) => {
			const googleUser = c.get("user-google");

			if (!googleUser) {
				throw new HTTPException(400, {
					message: "Gagal mengambil data dari Google",
				});
			}

			const result = await googleCallbackService({
				email: googleUser.email as string,
				name: googleUser.name as string,
				picture: googleUser.picture as string | undefined,
			});

			return c.redirect(
				`${env.FRONTEND_URL}/callback?token=${result.accessToken}`,
			);
		},
	);
