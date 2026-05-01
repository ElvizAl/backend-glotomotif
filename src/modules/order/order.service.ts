import { HTTPException } from "hono/http-exception";
import { uploadImageToCloudinary } from "../../utils/cloudinary";
import { prisma } from "../../utils/prisma";
import type {
  CreateOrderInput,
  OrderQueryInput,
  UpdatePengambilanInput,
  UpdateStatusSuratInput,
  UploadPembayaranInput,
  VerifikasiPembayaranInput,
} from "./order.schema";

const includeOrder = {
  mobil: {
    include: {
      fotomobils: { where: { isPrimary: true }, take: 1 },
    },
  },
  buyer: {
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      profile: true,
    },
  },
  pembayarans: {
    orderBy: { createdAt: "desc" as const },
  },
};

// ─── BUYER ─────────────────────────────────────────────────────────────────

export async function createOrderService(
  buyerId: string,
  data: CreateOrderInput,
) {
  // Cek mobil tersedia
  const mobil = await prisma.mobil.findUnique({
    where: { id: data.mobilId },
    include: { order: true },
  });

  if (!mobil)
    throw new HTTPException(404, { message: "Mobil tidak ditemukan" });
  if (mobil.status !== "TERSEDIA")
    throw new HTTPException(400, { message: "Mobil sudah tidak tersedia" });
  if (mobil.order)
    throw new HTTPException(400, {
      message: "Mobil ini sudah memiliki pesanan",
    });

  const harga = Number(mobil.harga);
  const nominalDp = Math.round(harga * 0.3);
  const sisaPelunasan = harga - nominalDp;
  const batasWaktuDp = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 hari

  const order = await prisma.$transaction(async (tx) => {
    // Update mobil jadi tidak tersedia lagi
    await tx.mobil.update({
      where: { id: data.mobilId },
      data: { status: "TERJUAL" },
    });

    return tx.order.create({
      data: {
        buyerId,
        mobilId: data.mobilId,
        nominalDp,
        sisaPelunasan,
        batasWaktuDp,
        metodePengambilan: data.metodePengambilan,
        alamatKirim: data.alamatKirim,
        statusOrder: "MENUNGGU_BUKTI_PESANAN",
      },
      include: includeOrder,
    });
  });

  return { message: "Pesanan berhasil dibuat", data: order };
}

export async function getMyOrdersService(
  buyerId: string,
  query: OrderQueryInput,
) {
  const { status, page, limit } = query;
  const skip = (page - 1) * limit;

  const where = {
    buyerId,
    ...(status && { statusOrder: status }),
  };

  const [data, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        mobil: {
          include: {
            fotomobils: { where: { isPrimary: true }, take: 1 },
          },
        },
        pembayarans: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return {
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

export async function getMyOrderByIdService(id: string, buyerId: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: includeOrder,
  });

  if (!order)
    throw new HTTPException(404, { message: "Pesanan tidak ditemukan" });
  if (order.buyerId !== buyerId)
    throw new HTTPException(403, { message: "Akses ditolak" });

  return { data: order };
}

export async function uploadKtpService(
  id: string,
  buyerId: string,
  ktpBuffer: Buffer,
) {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order)
    throw new HTTPException(404, { message: "Pesanan tidak ditemukan" });
  if (order.buyerId !== buyerId)
    throw new HTTPException(403, { message: "Akses ditolak" });

  const ktpUrl = await uploadImageToCloudinary(ktpBuffer, "ktp");

  const updated = await prisma.order.update({
    where: { id },
    data: { ktpUrl },
    include: includeOrder,
  });

  return { message: "KTP berhasil diupload", data: updated };
}

export async function uploadPembayaranService(
  orderId: string,
  buyerId: string,
  data: UploadPembayaranInput,
  buktiBuffer?: Buffer,
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { pembayarans: true },
  });

  if (!order)
    throw new HTTPException(404, { message: "Pesanan tidak ditemukan" });
  if (order.buyerId !== buyerId)
    throw new HTTPException(403, { message: "Akses ditolak" });

  let buktiTransferUrl = data.buktiTransferUrl;
  if (buktiBuffer && buktiBuffer.length > 0) {
    buktiTransferUrl = await uploadImageToCloudinary(
      buktiBuffer,
      "bukti-pembayaran",
    );
  }

  // Tentukan nominal berdasarkan tipe
  let nominal = data.nominal;
  if (data.tipe === "BUKTI_PESANAN") nominal = 500000;
  else if (data.tipe === "DP") nominal = Number(order.nominalDp);
  else if (data.tipe === "PELUNASAN") nominal = Number(order.sisaPelunasan);

  // Tentukan status baru order setelah pembayaran diupload
  const nextStatusMap: Record<string, string> = {
    BUKTI_PESANAN: "MENUNGGU_DP",
    DP: "MENUNGGU_PELUNASAN",
    PELUNASAN: "LUNAS_SIAP_SERAH",
  };

  const pembayaran = await prisma.$transaction(async (tx) => {
    const p = await tx.pembayaran.create({
      data: {
        orderId,
        tipe: data.tipe,
        metode: data.metode,
        nominal,
        buktiTransferUrl,
      },
    });

    // Update status order setelah upload
    await tx.order.update({
      where: { id: orderId },
      data: { statusOrder: nextStatusMap[data.tipe] as any },
    });

    return p;
  });

  return { message: "Bukti pembayaran berhasil diupload", data: pembayaran };
}

// ─── ADMIN ─────────────────────────────────────────────────────────────────

export async function getAllOrdersService(query: OrderQueryInput) {
  const { status, page, limit } = query;
  const skip = (page - 1) * limit;

  const where = {
    ...(status && { statusOrder: status }),
  };

  const [data, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        mobil: {
          include: { fotomobils: { where: { isPrimary: true }, take: 1 } },
        },
        buyer: { select: { id: true, name: true, email: true } },
        pembayarans: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return {
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

export async function getOrderByIdService(id: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: includeOrder,
  });
  if (!order)
    throw new HTTPException(404, { message: "Pesanan tidak ditemukan" });
  return { data: order };
}

export async function verifikasiPembayaranService(
  pembayaranId: string,
  data: VerifikasiPembayaranInput,
  kwitansiBuffer?: Buffer,
) {
  const pembayaran = await prisma.pembayaran.findUnique({
    where: { id: pembayaranId },
    include: { order: { include: { pembayarans: true } } },
  });

  if (!pembayaran)
    throw new HTTPException(404, { message: "Pembayaran tidak ditemukan" });

  let kwitansiUrl = data.kwitansiUrl;
  if (kwitansiBuffer && kwitansiBuffer.length > 0) {
    kwitansiUrl = await uploadImageToCloudinary(kwitansiBuffer, "kwitansi");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const p = await tx.pembayaran.update({
      where: { id: pembayaranId },
      data: {
        sudahDiverifikasi: data.sudahDiverifikasi,
        verifiedAt: data.sudahDiverifikasi ? new Date() : null,
        kwitansiUrl,
      },
    });

    // Jika pelunasan diverifikasi → status SELESAI
    if (data.sudahDiverifikasi && pembayaran.tipe === "PELUNASAN") {
      await tx.order.update({
        where: { id: pembayaran.orderId },
        data: { statusOrder: "SELESAI" },
      });
    }

    return p;
  });

  return { message: "Pembayaran berhasil diverifikasi", data: updated };
}

export async function updateStatusSuratService(
  orderId: string,
  data: UpdateStatusSuratInput,
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order)
    throw new HTTPException(404, { message: "Pesanan tidak ditemukan" });

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      ...(data.statusStnk && { statusStnk: data.statusStnk }),
      ...(data.statusBpkb && { statusBpkb: data.statusBpkb }),
    },
    include: includeOrder,
  });

  return { message: "Status surat diperbarui", data: updated };
}

export async function updatePengambilanService(
  orderId: string,
  data: UpdatePengambilanInput,
  suratJalanBuffer?: Buffer,
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order)
    throw new HTTPException(404, { message: "Pesanan tidak ditemukan" });

  let suratJalanUrl = data.suratJalanUrl;
  if (suratJalanBuffer && suratJalanBuffer.length > 0) {
    suratJalanUrl = await uploadImageToCloudinary(
      suratJalanBuffer,
      "surat-jalan",
    );
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      metodePengambilan: data.metodePengambilan,
      alamatKirim: data.alamatKirim,
      suratJalanUrl,
    },
    include: includeOrder,
  });

  return { message: "Info pengambilan diperbarui", data: updated };
}

export async function getDashboardStatsService() {
  const [
    totalMobil,
    mobilTersedia,
    totalOrder,
    orderSelesai,
    totalUser,
    revenueAgg,
  ] = await Promise.all([
    prisma.mobil.count(),
    prisma.mobil.count({ where: { status: "TERSEDIA" } }),
    prisma.order.count(),
    prisma.order.count({ where: { statusOrder: "SELESAI" } }),
    prisma.user.count({ where: { role: { not: "ADMIN" } } }),
    prisma.pembayaran.aggregate({
      where: { sudahDiverifikasi: true },
      _sum: { nominal: true },
    }),
  ]);

  return {
    data: {
      totalMobil,
      mobilTersedia,
      totalOrder,
      orderSelesai,
      totalUser,
      totalRevenue: Number(revenueAgg._sum.nominal ?? 0),
    },
  };
}

export async function getLaporanService(params: {
  bulan?: number;
  tahun?: number;
}) {
  const { bulan, tahun } = params;

  // Build date range filter (based on createdAt)
  let dateFilter: { gte?: Date; lte?: Date } = {};
  if (tahun) {
    const y = tahun;
    const m = bulan ?? 0;
    if (m) {
      dateFilter = {
        gte: new Date(y, m - 1, 1),
        lte: new Date(y, m, 0, 23, 59, 59),
      };
    } else {
      dateFilter = {
        gte: new Date(y, 0, 1),
        lte: new Date(y, 11, 31, 23, 59, 59),
      };
    }
  }

  const whereOrder = {
    // Semua order kecuali yang dibatalkan
    NOT: [{ statusOrder: "DIBATALKAN" as any }],
    ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
  };

  const orders = await prisma.order.findMany({
    where: whereOrder,
    orderBy: { createdAt: "desc" },
    include: {
      mobil: {
        select: {
          nama: true,
          merek: true,
          model: true,
          tahun: true,
          harga: true,
        },
      },
      buyer: { select: { name: true, email: true } },
      pembayarans: {
        where: { sudahDiverifikasi: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  // Summary
  const totalPendapatan = orders.reduce((sum, o) => {
    return sum + o.pembayarans.reduce((s, p) => s + Number(p.nominal), 0);
  }, 0);

  const totalMobilTerjual = orders.length;
  const totalSelesai = orders.filter((o) => o.statusOrder === "SELESAI").length;

  return {
    data: {
      summary: { totalMobilTerjual, totalSelesai, totalPendapatan },
      orders: orders.map((o) => ({
        id: o.id,
        tanggalPesan: o.createdAt,
        statusOrder: o.statusOrder,
        mobil: o.mobil,
        buyer: o.buyer,
        metodePengambilan: o.metodePengambilan,
        totalDibayar: o.pembayarans.reduce((s, p) => s + Number(p.nominal), 0),
        hargaMobil: Number(o.mobil?.harga ?? 0),
      })),
    },
  };
}

export async function checkAndCancelExpiredOrders() {
  const now = new Date();

  // Cari pesanan yang statusnya masih 'MENUNGGU_DP' dan batas waktunya sudah lewat
  const expiredOrders = await prisma.order.findMany({
    where: {
      statusOrder: "MENUNGGU_DP",
      batasWaktuDp: {
        lt: now,
      },
    },
  });

  if (expiredOrders.length === 0) {
    return { message: "Tidak ada pesanan kedaluwarsa." };
  }

  const cancelledOrderIds = expiredOrders.map((o) => o.id);
  const cancelledMobilIds = expiredOrders.map((o) => o.mobilId);

  await prisma.$transaction(async (tx) => {
    // 1. Batalkan semua pesanan yang kedaluwarsa
    await tx.order.updateMany({
      where: { id: { in: cancelledOrderIds } },
      data: { statusOrder: "DIBATALKAN" },
    });

    // 2. Kembalikan status mobil menjadi TERSEDIA
    await tx.mobil.updateMany({
      where: { id: { in: cancelledMobilIds } },
      data: { status: "TERSEDIA" },
    });
  });

  return {
    message: `Berhasil membatalkan ${expiredOrders.length} pesanan yang kedaluwarsa.`,
    data: {
      cancelledOrdersCount: expiredOrders.length,
      cancelledOrderIds,
    },
  };
}

export async function cancelOrderService(
  id: string,
  buyerId: string,
  refundInfo?: { noRekening: string; namaRekening: string; bank: string },
) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: { pembayarans: true },
  });

  if (!order)
    throw new HTTPException(404, { message: "Pesanan tidak ditemukan" });
  if (order.buyerId !== buyerId)
    throw new HTTPException(403, { message: "Akses ditolak" });

  const cancellableStatuses = [
    "MENUNGGU_BUKTI_PESANAN",
    "MENUNGGU_DP",
    "MENUNGGU_PELUNASAN",
  ] as const;

  if (!cancellableStatuses.includes(order.statusOrder as any)) {
    throw new HTTPException(400, {
      message: "Pesanan tidak bisa dibatalkan pada status ini",
    });
  }

  // Jika sudah ada pembayaran terverifikasi, wajib isi rekening refund
  const hasVerifiedPayment = order.pembayarans.some(
    (p: any) => p.sudahDiverifikasi,
  );
  if (hasVerifiedPayment && !refundInfo?.noRekening) {
    throw new HTTPException(400, {
      message:
        "Nomor rekening wajib diisi karena sudah ada pembayaran yang terverifikasi",
    });
  }

  await prisma.$transaction(async (tx) => {
    // 1. Batalkan pesanan + simpan info rekening refund
    await tx.order.update({
      where: { id },
      data: {
        statusOrder: "DIBATALKAN",
        ...(refundInfo && {
          noRekeningRefund: refundInfo.noRekening,
          namaRekeningRefund: refundInfo.namaRekening,
          bankRefund: refundInfo.bank,
        }),
      },
    });

    // 2. Kembalikan status mobil menjadi TERSEDIA
    await tx.mobil.update({
      where: { id: order.mobilId },
      data: { status: "TERSEDIA" },
    });
  });

  const result = await prisma.order.findUnique({
    where: { id },
    include: includeOrder,
  });

  return { message: "Pesanan berhasil dibatalkan", data: result };
}

export async function processRefundService(
  pembayaranId: string,
  buktiRefundBuffer?: Buffer
) {
  const pembayaran = await prisma.pembayaran.findUnique({
    where: { id: pembayaranId },
    include: { order: true },
  });

  if (!pembayaran) {
    throw new HTTPException(404, { message: "Pembayaran tidak ditemukan" });
  }

  if (pembayaran.tipe !== "BUKTI_PESANAN") {
    throw new HTTPException(400, {
      message: "Refund hanya bisa dilakukan untuk tipe BUKTI_PESANAN",
    });
  }

  if (pembayaran.order.statusOrder !== "DIBATALKAN") {
    throw new HTTPException(400, {
      message: "Pesanan belum DIBATALKAN, tidak bisa proses refund",
    });
  }

  let buktiRefundUrl = undefined;
  if (buktiRefundBuffer && buktiRefundBuffer.length > 0) {
    buktiRefundUrl = await uploadImageToCloudinary(
      buktiRefundBuffer,
      "bukti-refund"
    );
  }

  const updatedPembayaran = await prisma.pembayaran.update({
    where: { id: pembayaranId },
    data: {
      isRefunded: true,
      refundedAt: new Date(),
      ...(buktiRefundUrl && { buktiRefundUrl }),
    },
  });

  return {
    message: "Refund berhasil diproses",
    data: updatedPembayaran,
  };
}
