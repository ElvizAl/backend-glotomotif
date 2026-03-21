import { zValidator } from "@hono/zod-validator";
import { generateCodeVerifier, generateState } from "arctic";
import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { requireAuth } from "../../middleware/auth";
import { google } from "../../utils/arctic";
import {
	forgotPasswordSchema,
	loginSchema,
	registerSchema,
	resendVerificationOtpSchema,
	resetPasswordSchema,
	verifyEmailOtpSchema,
} from "./auth.schema";
import {
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

	.get("/google", async (c) => {
		const state = generateState();
		const code = generateCodeVerifier();
		const scopes = ["profile", "email"];

		setCookie(c, "code", code, {
			path: "/",
			secure: process.env.NODE_ENV === "production",
			httpOnly: true,
			maxAge: 60 * 10,
			sameSite: "Lax",
		});

		setCookie(c, "google_state", state, {
			path: "/",
			secure: process.env.NODE_ENV === "production",
			httpOnly: true,
			maxAge: 60 * 10,
			sameSite: "Lax",
		});

		const url = await google.createAuthorizationURL(state, code, scopes);

		return c.redirect(url.href);
	})

	.get("/google/callback", async (c) => {
		const { code, state } = c.req.query();
		const codeVerifier = getCookie(c, "code");
		const storedState = getCookie(c, "google_state");

		if (!code || !codeVerifier) {
			throw new HTTPException(400, {
				message: "Parameter callback tidak lengkap",
			});
		}

		if (!storedState || storedState !== state) {
			throw new HTTPException(400, {
				message: "State tidak valid (kemungkinan CSRF)",
			});
		}

		const result = await googleCallbackService(code, codeVerifier);
		return c.json(result, 200);
	});
