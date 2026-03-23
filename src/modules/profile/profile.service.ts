import { HTTPException } from "hono/http-exception";
import { prisma } from "../../utils/prisma";
import type { CreateProfileInput, UpdateProfileInput } from "./profile.schema";

export async function getProfileService(userId: string) {
	const profile = await prisma.profile.findUnique({
		where: { userId },
	});

	if (!profile) {
		throw new HTTPException(404, { message: "Profil belum dibuat" });
	}

	return { data: profile };
}

export async function createProfileService(
	userId: string,
	data: CreateProfileInput,
) {
	const existing = await prisma.profile.findUnique({ where: { userId } });

	if (existing) {
		throw new HTTPException(409, { message: "Profil sudah ada" });
	}

	const profile = await prisma.profile.create({
		data: {
			...data,
			userId,
		},
	});

	return { message: "Profil berhasil dibuat", data: profile };
}

export async function updateProfileService(
	userId: string,
	data: UpdateProfileInput,
) {
	const existing = await prisma.profile.findUnique({ where: { userId } });

	if (!existing) {
		throw new HTTPException(404, {
			message: "Profil tidak ditemukan. Buat profil terlebih dahulu",
		});
	}

	const profile = await prisma.profile.update({
		where: { userId },
		data,
	});

	return { message: "Profil berhasil diperbarui", data: profile };
}

export async function deleteProfileService(userId: string) {
	const existing = await prisma.profile.findUnique({ where: { userId } });

	if (!existing) {
		throw new HTTPException(404, { message: "Profil tidak ditemukan" });
	}

	await prisma.profile.delete({ where: { userId } });

	return { message: "Profil berhasil dihapus" };
}
