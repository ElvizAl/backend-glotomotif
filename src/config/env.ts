import { z } from "zod";

const envSchema = z.object({
	DATABASE_URL: z.string().url(),
	JWT_SECRET: z.string().min(1),

	JWT_EXPIRES_IN: z.string().default("5m"),
	EMAIL_FROM: z.string().default(""),
	RESEND_API_KEY: z.string().default(""),
	OTP_EXPIRES_MINUTES: z.coerce.number().default(5),
	GOOGLE_CLIENT_ID: z.string().default(""),
	GOOGLE_CLIENT_SECRET: z.string().default(""),
	GOOGLE_REDIRECT_URI: z
		.string()
		.url()
		.default("http://localhost:3000/api/auth/google/callback"),
	FRONTEND_URL: z.string().url().default("https://www.glotomotif.my.id"),
});

export const env = envSchema.parse(process.env);
