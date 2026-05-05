import { HTTPException } from "hono/http-exception";
import {
	deleteImageFromCloudinary,
	extractPublicId,
	uploadImageToCloudinary,
} from "../../utils/cloudinary";
import { prisma } from "../../utils/prisma";
import type {
	CreateMobilInput,
	MobilQueryInput,
	UpdateMobilInput,
} from "./mobil.schema";

export async function getAllMobilService(query: MobilQueryInput) {
	const { status, transmisi, merek, page, limit } = query;
	const skip = (page - 1) * limit;

	const where = {
		...(status && { status }),
		...(transmisi && { transmisi }),
		...(merek && { merek: { contains: merek, mode: "insensitive" as const } }),
	};

	const [mobils, total] = await Promise.all([
		prisma.mobil.findMany({
			where,
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
			include: {
				fotomobils: {
					where: { isPrimary: true },
					take: 1,
				},
			},
		}),
		prisma.mobil.count({ where }),
	]);

	return {
		data: mobils,
		meta: {
			total,
			page,
			limit,
			totalPages: Math.ceil(total / limit),
		},
	};
}

export async function getMobilCardsService() {
	const mobils = await prisma.mobil.findMany({
		where: { status: "TERSEDIA" },
		take: 6,
		orderBy: { createdAt: "desc" },
		select: {
			id: true,
			nama: true,
			merek: true,
			harga: true,
			warna: true,
			kilometer: true,
			transmisi: true,
			fotomobils: {
				where: { isPrimary: true },
				take: 1,
				select: { url: true },
			},
		},
	});

	return { data: mobils };
}

export async function getMobilByIdService(id: string) {
	const mobil = await prisma.mobil.findUnique({
		where: { id },
		include: {
			fotomobils: {
				orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
			},
		},
	});

	if (!mobil) {
		throw new HTTPException(404, { message: "Mobil tidak ditemukan" });
	}

	return { data: mobil };
}

export async function createMobilService(
	data: CreateMobilInput,
	fotoBuffers: Buffer[],
) {
	const mobil = await prisma.mobil.create({
		data: {
			nama: data.nama,
			merek: data.merek,
			model: data.model,
			tahun: data.tahun,
			warna: data.warna,
			kilometer: data.kilometer,
			bahan_bakar: data.bahan_bakar,
			transmisi: data.transmisi,
			harga: data.harga,
			deskripsi: data.deskripsi,
			status: data.status ?? "TERSEDIA",
		},
	});

	// Upload semua foto
	if (fotoBuffers.length > 0) {
		let uploadedUrls: string[];
		try {
			uploadedUrls = await Promise.all(
				fotoBuffers.map((buf) => uploadImageToCloudinary(buf, "mobils")),
			);
		} catch (err) {
			// Rollback: hapus mobil yang sudah dibuat jika upload foto gagal
			await prisma.mobil.delete({ where: { id: mobil.id } });
			const message =
				err instanceof Error ? err.message : "Gagal mengupload foto";
			throw new HTTPException(500, { message });
		}

		await prisma.fotomobil.createMany({
			data: uploadedUrls.map((url, idx) => ({
				url,
				isPrimary: idx === 0, // foto pertama jadi primary
				mobilId: mobil.id,
			})),
		});
	}

	const result = await prisma.mobil.findUnique({
		where: { id: mobil.id },
		include: { fotomobils: true },
	});

	return { message: "Mobil berhasil ditambahkan", data: result };
}

export async function updateMobilService(id: string, data: UpdateMobilInput) {
	const existing = await prisma.mobil.findUnique({ where: { id } });

	if (!existing) {
		throw new HTTPException(404, { message: "Mobil tidak ditemukan" });
	}

	// Tidak boleh ubah status dari TERJUAL ke TERSEDIA
	if (existing.status === "TERJUAL" && data.status === "TERSEDIA") {
		throw new HTTPException(400, {
			message: "Mobil yang sudah terjual tidak dapat diubah menjadi tersedia",
		});
	}

	const mobil = await prisma.mobil.update({
		where: { id },
		data,
		include: { fotomobils: true },
	});

	return { message: "Mobil berhasil diperbarui", data: mobil };
}

export async function deleteMobilService(id: string) {
	const existing = await prisma.mobil.findUnique({
		where: { id },
		include: {
			fotomobils: true,
			order: { include: { pembayarans: true } },
		},
	});

	if (!existing) {
		throw new HTTPException(404, { message: "Mobil tidak ditemukan" });
	}

	// Cek apakah ada order yang masih aktif
	const FINAL_STATUSES = ["DIBATALKAN", "SELESAI"];
	if (existing.order && !FINAL_STATUSES.includes(existing.order.statusOrder)) {
		throw new HTTPException(400, {
			message:
				"Mobil tidak dapat dihapus karena masih memiliki order yang aktif.",
		});
	}

	// Kalau ada order yang sudah selesai/dibatalkan, hapus dulu beserta pembayarannya
	if (existing.order) {
		await prisma.pembayaran.deleteMany({
			where: { orderId: existing.order.id },
		});
		await prisma.order.delete({ where: { id: existing.order.id } });
	}

	// Hapus semua foto dari Cloudinary
	await Promise.all(
		existing.fotomobils.map(async (foto) => {
			const publicId = extractPublicId(foto.url);
			if (publicId) await deleteImageFromCloudinary(publicId);
		}),
	);

	// Hapus mobil (PenawaranHarga otomatis terhapus via onDelete: Cascade)
	await prisma.mobil.delete({ where: { id } });

	return { message: "Mobil berhasil dihapus" };
}

export async function addFotoMobilService(id: string, fotoBuffers: Buffer[]) {
	const existing = await prisma.mobil.findUnique({ where: { id } });

	if (!existing) {
		throw new HTTPException(404, { message: "Mobil tidak ditemukan" });
	}

	// Cek apakah sudah ada foto primary
	const hasPrimary = await prisma.fotomobil.findFirst({
		where: { mobilId: id, isPrimary: true },
	});

	const uploadedUrls = await Promise.all(
		fotoBuffers.map((buf) => uploadImageToCloudinary(buf, "mobils")),
	);

	await prisma.fotomobil.createMany({
		data: uploadedUrls.map((url, idx) => ({
			url,
			isPrimary: !hasPrimary && idx === 0,
			mobilId: id,
		})),
	});

	const fotos = await prisma.fotomobil.findMany({
		where: { mobilId: id },
		orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
	});

	return { message: "Foto berhasil ditambahkan", data: fotos };
}

export async function deleteFotoMobilService(fotoId: string) {
	const foto = await prisma.fotomobil.findUnique({ where: { id: fotoId } });

	if (!foto) {
		throw new HTTPException(404, { message: "Foto tidak ditemukan" });
	}

	const publicId = extractPublicId(foto.url);
	if (publicId) await deleteImageFromCloudinary(publicId);

	await prisma.fotomobil.delete({ where: { id: fotoId } });

	// Jika foto yang dihapus adalah primary, set foto pertama sisanya jadi primary
	if (foto.isPrimary) {
		const next = await prisma.fotomobil.findFirst({
			where: { mobilId: foto.mobilId },
			orderBy: { createdAt: "asc" },
		});
		if (next) {
			await prisma.fotomobil.update({
				where: { id: next.id },
				data: { isPrimary: true },
			});
		}
	}

	return { message: "Foto berhasil dihapus" };
}

export async function setPrimaryFotoService(fotoId: string) {
	const foto = await prisma.fotomobil.findUnique({ where: { id: fotoId } });

	if (!foto) {
		throw new HTTPException(404, { message: "Foto tidak ditemukan" });
	}

	// Reset semua foto mobil ini jadi non-primary
	await prisma.fotomobil.updateMany({
		where: { mobilId: foto.mobilId },
		data: { isPrimary: false },
	});

	// Set foto ini jadi primary
	await prisma.fotomobil.update({
		where: { id: fotoId },
		data: { isPrimary: true },
	});

	return { message: "Foto primary berhasil diubah" };
}
