import { HTTPException } from "hono/http-exception";
import type { StatusMobil } from "../../generated/prisma/enums";
import {
	deleteImageFromCloudinary,
	extractPublicId,
	uploadImageToCloudinary,
} from "../../utils/cloudinary";
import { prisma } from "../../utils/prisma";
import type {
	CreateMobilSellerInput,
	CreatePenawaranInput,
	KonfirmasiPembayaranInput,
	PenjualanQueryInput,
	ResponPenawaranInput,
	UpdateMobilSellerInput,
	UpdateStatusSellerMobilInput,
} from "./penjualan.schema";

const mobilSellerStatuses: StatusMobil[] = [
	"DRAFT",
	"MENUNGGU_EVALUASI",
	"SEDANG_DIEVALUASI",
	"DITAWARKAN",
	"DISETUJUI",
	"DITOLAK",
];

const includeDetail = {
	fotomobils: {
		orderBy: [{ isPrimary: "desc" as const }, { createdAt: "asc" as const }],
	},
	penawaran: true,
	seller: {
		select: { id: true, name: true, email: true, avatarUrl: true },
	},
};

// ─── SELLER ────────────────────────────────────────────────

export async function createMobilSellerService(
	sellerId: string,
	data: CreateMobilSellerInput,
	fotoBuffers: Buffer[],
) {
	const mobil = await prisma.mobil.create({
		data: {
			sellerId,
			nama: data.nama,
			merek: data.merek,
			model: data.model,
			tahun: data.tahun,
			warna: data.warna,
			kilometer: data.kilometer,
			bahan_bakar: data.bahan_bakar,
			transmisi: data.transmisi,
			deskripsi: data.deskripsi,
			harga: data.harga ?? 0,
			status: "DRAFT",
		},
	});

	if (fotoBuffers.length > 0) {
		const uploadedUrls = await Promise.all(
			fotoBuffers.map((buf) => uploadImageToCloudinary(buf, "mobils")),
		);
		await prisma.fotomobil.createMany({
			data: uploadedUrls.map((url, idx) => ({
				url,
				isPrimary: idx === 0,
				mobilId: mobil.id,
			})),
		});
	}

	const result = await prisma.mobil.findUnique({
		where: { id: mobil.id },
		include: includeDetail,
	});

	return { message: "Mobil berhasil ditambahkan", data: result };
}

export async function submitMobilSellerService(id: string, sellerId: string) {
	const mobil = await prisma.mobil.findUnique({ where: { id } });

	if (!mobil)
		throw new HTTPException(404, { message: "Mobil tidak ditemukan" });
	if (mobil.sellerId !== sellerId)
		throw new HTTPException(403, { message: "Akses ditolak" });
	if (mobil.status !== "DRAFT")
		throw new HTTPException(400, {
			message: "Hanya mobil berstatus DRAFT yang bisa disubmit",
		});

	const result = await prisma.mobil.update({
		where: { id },
		data: { status: "MENUNGGU_EVALUASI" },
		include: includeDetail,
	});

	return { message: "Pengajuan berhasil dikirim ke admin", data: result };
}

export async function getMyMobilSellerService(
	sellerId: string,
	query: PenjualanQueryInput,
) {
	const { status, page, limit } = query;
	const skip = (page - 1) * limit;

	const where = {
		sellerId,
		...(status ? { status } : { status: { in: mobilSellerStatuses } }),
	};

	const [data, total] = await Promise.all([
		prisma.mobil.findMany({
			where,
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
			include: {
				fotomobils: { where: { isPrimary: true }, take: 1 },
				penawaran: true,
			},
		}),
		prisma.mobil.count({ where }),
	]);

	return {
		data,
		meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
	};
}

export async function getMyMobilByIdService(id: string, sellerId: string) {
	const mobil = await prisma.mobil.findUnique({
		where: { id },
		include: includeDetail,
	});

	if (!mobil)
		throw new HTTPException(404, { message: "Mobil tidak ditemukan" });
	if (mobil.sellerId !== sellerId)
		throw new HTTPException(403, { message: "Akses ditolak" });

	return { data: mobil };
}

export async function updateMobilSellerService(
	id: string,
	sellerId: string,
	data: UpdateMobilSellerInput,
) {
	const mobil = await prisma.mobil.findUnique({ where: { id } });

	if (!mobil)
		throw new HTTPException(404, { message: "Mobil tidak ditemukan" });
	if (mobil.sellerId !== sellerId)
		throw new HTTPException(403, { message: "Akses ditolak" });
	if (mobil.status !== "DRAFT")
		throw new HTTPException(400, {
			message: "Mobil hanya bisa diedit saat status DRAFT",
		});

	const result = await prisma.mobil.update({
		where: { id },
		data,
		include: includeDetail,
	});

	return { message: "Mobil berhasil diperbarui", data: result };
}

export async function deleteMobilSellerService(id: string, sellerId: string) {
	const mobil = await prisma.mobil.findUnique({
		where: { id },
		include: { fotomobils: true },
	});

	if (!mobil)
		throw new HTTPException(404, { message: "Mobil tidak ditemukan" });
	if (mobil.sellerId !== sellerId)
		throw new HTTPException(403, { message: "Akses ditolak" });
	if (!["DRAFT", "DITOLAK"].includes(mobil.status))
		throw new HTTPException(400, {
			message: "Mobil tidak bisa dihapus pada status ini",
		});

	await Promise.all(
		mobil.fotomobils.map(async (foto) => {
			const publicId = extractPublicId(foto.url);
			if (publicId) await deleteImageFromCloudinary(publicId);
		}),
	);

	await prisma.mobil.delete({ where: { id } });
	return { message: "Mobil berhasil dihapus" };
}

export async function addFotoSellerService(
	id: string,
	sellerId: string,
	fotoBuffers: Buffer[],
) {
	const mobil = await prisma.mobil.findUnique({ where: { id } });

	if (!mobil)
		throw new HTTPException(404, { message: "Mobil tidak ditemukan" });
	if (mobil.sellerId !== sellerId)
		throw new HTTPException(403, { message: "Akses ditolak" });

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

export async function deleteFotoSellerService(
	fotoId: string,
	sellerId: string,
) {
	const foto = await prisma.fotomobil.findUnique({
		where: { id: fotoId },
		include: { mobil: true },
	});

	if (!foto) throw new HTTPException(404, { message: "Foto tidak ditemukan" });
	if (foto.mobil.sellerId !== sellerId)
		throw new HTTPException(403, { message: "Akses ditolak" });

	const publicId = extractPublicId(foto.url);
	if (publicId) await deleteImageFromCloudinary(publicId);

	await prisma.fotomobil.delete({ where: { id: fotoId } });

	if (foto.isPrimary) {
		const next = await prisma.fotomobil.findFirst({
			where: { mobilId: foto.mobilId },
			orderBy: { createdAt: "asc" },
		});
		if (next)
			await prisma.fotomobil.update({
				where: { id: next.id },
				data: { isPrimary: true },
			});
	}

	return { message: "Foto berhasil dihapus" };
}

export async function setPrimaryFotoSellerService(
	fotoId: string,
	sellerId: string,
) {
	const foto = await prisma.fotomobil.findUnique({
		where: { id: fotoId },
		include: { mobil: true },
	});

	if (!foto) throw new HTTPException(404, { message: "Foto tidak ditemukan" });
	if (foto.mobil.sellerId !== sellerId)
		throw new HTTPException(403, { message: "Akses ditolak" });

	await prisma.fotomobil.updateMany({
		where: { mobilId: foto.mobilId },
		data: { isPrimary: false },
	});
	await prisma.fotomobil.update({
		where: { id: fotoId },
		data: { isPrimary: true },
	});

	return { message: "Foto primary berhasil diubah" };
}

export async function responPenawaranService(
	mobilId: string,
	sellerId: string,
	data: ResponPenawaranInput,
) {
	const mobil = await prisma.mobil.findUnique({
		where: { id: mobilId },
		include: { penawaran: true },
	});

	if (!mobil)
		throw new HTTPException(404, { message: "Mobil tidak ditemukan" });
	if (mobil.sellerId !== sellerId)
		throw new HTTPException(403, { message: "Akses ditolak" });
	if (mobil.status !== "DITAWARKAN" || !mobil.penawaran)
		throw new HTTPException(400, {
			message: "Belum ada penawaran untuk direspons",
		});
	if (mobil.penawaran.respon !== "MENUNGGU")
		throw new HTTPException(400, {
			message: "Penawaran sudah direspons sebelumnya",
		});

	const newStatus = data.respon === "DISETUJUI" ? "DISETUJUI" : "DITOLAK";

	await prisma.$transaction([
		prisma.penawaranHarga.update({
			where: { id: mobil.penawaran.id },
			data: {
				respon: data.respon,
				catatanSeller: data.catatanSeller,
				metode: data.metode,
			},
		}),
		prisma.mobil.update({
			where: { id: mobilId },
			data: { status: newStatus },
		}),
	]);

	const result = await prisma.mobil.findUnique({
		where: { id: mobilId },
		include: includeDetail,
	});
	return {
		message: `Penawaran berhasil ${data.respon === "DISETUJUI" ? "disetujui" : "ditolak"}`,
		data: result,
	};
}

// ─── ADMIN ─────────────────────────────────────────────────

export async function getAllPenjualanService(query: PenjualanQueryInput) {
	const { status, page, limit } = query;
	const skip = (page - 1) * limit;

	const where = {
		sellerId: { not: null },
		...(status ? { status } : { status: { in: mobilSellerStatuses } }),
	};

	const [data, total] = await Promise.all([
		prisma.mobil.findMany({
			where,
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
			include: {
				fotomobils: { where: { isPrimary: true }, take: 1 },
				penawaran: true,
				seller: { select: { id: true, name: true, email: true } },
			},
		}),
		prisma.mobil.count({ where }),
	]);

	return {
		data,
		meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
	};
}

export async function getPenjualanByIdService(id: string) {
	const mobil = await prisma.mobil.findUnique({
		where: { id },
		include: includeDetail,
	});
	if (!mobil)
		throw new HTTPException(404, { message: "Mobil tidak ditemukan" });
	return { data: mobil };
}

export async function updateStatusPenjualanService(
	id: string,
	data: UpdateStatusSellerMobilInput,
) {
	const mobil = await prisma.mobil.findUnique({ where: { id } });
	if (!mobil)
		throw new HTTPException(404, { message: "Mobil tidak ditemukan" });

	const result = await prisma.mobil.update({
		where: { id },
		data: { status: data.status },
		include: includeDetail,
	});

	return { message: "Status berhasil diperbarui", data: result };
}

export async function createPenawaranService(
	mobilId: string,
	data: CreatePenawaranInput,
) {
	const mobil = await prisma.mobil.findUnique({
		where: { id: mobilId },
		include: { penawaran: true },
	});

	if (!mobil)
		throw new HTTPException(404, { message: "Mobil tidak ditemukan" });
	if (mobil.penawaran)
		throw new HTTPException(400, {
			message: "Penawaran sudah ada untuk mobil ini",
		});

	await prisma.$transaction([
		prisma.penawaranHarga.create({
			data: {
				mobilId,
				hargaTawar: data.hargaTawar,
				catatanAdmin: data.catatanAdmin,
			},
		}),
		prisma.mobil.update({
			where: { id: mobilId },
			data: { status: "DITAWARKAN" },
		}),
	]);

	const result = await prisma.mobil.findUnique({
		where: { id: mobilId },
		include: includeDetail,
	});
	return { message: "Penawaran berhasil dikirim ke seller", data: result };
}

export async function konfirmasiPembayaranService(
	mobilId: string,
	data: KonfirmasiPembayaranInput,
	buktiTransferBuf?: Buffer,
	kwitansiBuf?: Buffer,
) {
	const mobil = await prisma.mobil.findUnique({
		where: { id: mobilId },
		include: { penawaran: true },
	});

	if (!mobil)
		throw new HTTPException(404, { message: "Mobil tidak ditemukan" });
	if (mobil.status !== "DISETUJUI" || !mobil.penawaran)
		throw new HTTPException(400, { message: "Mobil belum disetujui seller" });

	let finalBuktiTransferUrl = data.buktiTransferUrl;
	if (buktiTransferBuf) {
		finalBuktiTransferUrl = await uploadImageToCloudinary(buktiTransferBuf, "pembayaran");
	}

	let finalKwitansiUrl = data.kwitansiUrl;
	if (kwitansiBuf) {
		finalKwitansiUrl = await uploadImageToCloudinary(kwitansiBuf, "pembayaran");
	}

	await prisma.$transaction([
		prisma.penawaranHarga.update({
			where: { id: mobil.penawaran.id },
			data: {
				metode: data.metode,
				buktiTransferUrl: finalBuktiTransferUrl,
				kwitansiUrl: finalKwitansiUrl,
			},
		}),
		// Setelah bayar seller → mobil jadi TERSEDIA di listing customer
		prisma.mobil.update({
			where: { id: mobilId },
			data: { status: "TERSEDIA", harga: mobil.penawaran.hargaTawar },
		}),
	]);

	const result = await prisma.mobil.findUnique({
		where: { id: mobilId },
		include: includeDetail,
	});
	return {
		message: "Pembayaran dikonfirmasi. Mobil sekarang tampil di listing.",
		data: result,
	};
}
