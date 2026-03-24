-- CreateEnum
CREATE TYPE "StatusPengajuan" AS ENUM ('MENUNGGU_EVALUASI', 'SEDANG_DIEVALUASI', 'DITAWARKAN', 'DISETUJUI', 'DITOLAK', 'SELESAI');

-- CreateEnum
CREATE TYPE "ResponPenawaran" AS ENUM ('MENUNGGU', 'DISETUJUI', 'DITOLAK');

-- CreateTable
CREATE TABLE "PengajuanJual" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "merek" TEXT,
    "model" TEXT,
    "tahun" INTEGER,
    "warna" TEXT,
    "kilometer" TEXT,
    "bahan_bakar" TEXT,
    "transmisi" "Transmisi",
    "deskripsi" TEXT,
    "status" "StatusPengajuan" NOT NULL DEFAULT 'MENUNGGU_EVALUASI',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PengajuanJual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotoPengajuan" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "pengajuanId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotoPengajuan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PenawaranHarga" (
    "id" TEXT NOT NULL,
    "pengajuanId" TEXT NOT NULL,
    "hargaTawar" DECIMAL(15,2) NOT NULL,
    "catatanAdmin" TEXT,
    "respon" "ResponPenawaran" NOT NULL DEFAULT 'MENUNGGU',
    "catatanSeller" TEXT,
    "metode" "MetodeBayar",
    "buktiTransferUrl" TEXT,
    "kwitansiUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PenawaranHarga_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PenawaranHarga_pengajuanId_key" ON "PenawaranHarga"("pengajuanId");

-- AddForeignKey
ALTER TABLE "PengajuanJual" ADD CONSTRAINT "PengajuanJual_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotoPengajuan" ADD CONSTRAINT "FotoPengajuan_pengajuanId_fkey" FOREIGN KEY ("pengajuanId") REFERENCES "PengajuanJual"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PenawaranHarga" ADD CONSTRAINT "PenawaranHarga_pengajuanId_fkey" FOREIGN KEY ("pengajuanId") REFERENCES "PengajuanJual"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
