-- CreateEnum
CREATE TYPE "StatusOrder" AS ENUM ('MENUNGGU_BUKTI_PESANAN', 'MENUNGGU_DP', 'DIBATALKAN', 'MENUNGGU_PELUNASAN', 'LUNAS_SIAP_SERAH', 'SELESAI');

-- CreateEnum
CREATE TYPE "StatusSurat" AS ENUM ('BELUM_DIPROSES', 'SEDANG_DIPROSES', 'SELESAI');

-- CreateEnum
CREATE TYPE "MetodePengambilan" AS ENUM ('AMBIL_SENDIRI', 'DIANTAR');

-- CreateEnum
CREATE TYPE "MetodeBayar" AS ENUM ('TUNAI', 'TRANSFER');

-- CreateEnum
CREATE TYPE "TipePembayaran" AS ENUM ('BUKTI_PESANAN', 'DP', 'PELUNASAN');

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "mobilId" TEXT NOT NULL,
    "buktiPesanan" DECIMAL(15,2) NOT NULL DEFAULT 500000,
    "persenDp" INTEGER NOT NULL DEFAULT 30,
    "nominalDp" DECIMAL(15,2),
    "sisaPelunasan" DECIMAL(15,2),
    "tanggalPesan" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "batasWaktuDp" TIMESTAMP(3) NOT NULL,
    "ktpUrl" TEXT,
    "statusOrder" "StatusOrder" NOT NULL DEFAULT 'MENUNGGU_BUKTI_PESANAN',
    "statusStnk" "StatusSurat" NOT NULL DEFAULT 'BELUM_DIPROSES',
    "statusBpkb" "StatusSurat" NOT NULL DEFAULT 'BELUM_DIPROSES',
    "metodePengambilan" "MetodePengambilan",
    "alamatKirim" TEXT,
    "suratJalanUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pembayaran" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "tipe" "TipePembayaran" NOT NULL,
    "metode" "MetodeBayar" NOT NULL,
    "nominal" DECIMAL(15,2),
    "buktiTransferUrl" TEXT,
    "sudahDiverifikasi" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "kwitansiUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pembayaran_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_mobilId_key" ON "Order"("mobilId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_mobilId_fkey" FOREIGN KEY ("mobilId") REFERENCES "mobil"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pembayaran" ADD CONSTRAINT "Pembayaran_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
