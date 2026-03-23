import { HTTPException } from "hono/http-exception";
import {
	deleteImageFromCloudinary,
	extractPublicId,
	uploadImageToCloudinary,
} from "../../utils/cloudinary";
import { prisma } from "../../utils/prisma";
import type { CreateBannerInput, UpdateBannerInput } from "./banner.schema";

export async function getAllBannersService() {
	const banners = await prisma.banner.findMany({
		orderBy: { urutan: "asc" },
	});
	return { data: banners };
}

export async function getBannerByIdService(id: string) {
	const banner = await prisma.banner.findUnique({ where: { id } });

	if (!banner) {
		throw new HTTPException(404, { message: "Banner tidak ditemukan" });
	}

	return { data: banner };
}

export async function createBannerService(
	data: CreateBannerInput,
	imageBuffer: Buffer,
) {
	const imageUrl = await uploadImageToCloudinary(imageBuffer, "banners");

	const banner = await prisma.banner.create({
		data: {
			judul: data.judul,
			isActive: data.isActive ?? true,
			urutan: data.urutan ?? 0,
			imageUrl,
		},
	});

	return { message: "Banner berhasil dibuat", data: banner };
}

export async function updateBannerService(
	id: string,
	data: UpdateBannerInput,
	imageBuffer?: Buffer,
) {
	const existing = await prisma.banner.findUnique({ where: { id } });

	if (!existing) {
		throw new HTTPException(404, { message: "Banner tidak ditemukan" });
	}

	let imageUrl = existing.imageUrl;

	if (imageBuffer) {
		const publicId = extractPublicId(existing.imageUrl);
		if (publicId) {
			await deleteImageFromCloudinary(publicId);
		}
		imageUrl = await uploadImageToCloudinary(imageBuffer, "banners");
	}

	const banner = await prisma.banner.update({
		where: { id },
		data: { ...data, imageUrl },
	});

	return { message: "Banner berhasil diperbarui", data: banner };
}

export async function deleteBannerService(id: string) {
	const existing = await prisma.banner.findUnique({ where: { id } });

	if (!existing) {
		throw new HTTPException(404, { message: "Banner tidak ditemukan" });
	}

	const publicId = extractPublicId(existing.imageUrl);
	if (publicId) {
		await deleteImageFromCloudinary(publicId);
	}

	await prisma.banner.delete({ where: { id } });

	return { message: "Banner berhasil dihapus" };
}
