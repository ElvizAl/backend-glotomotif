/*
  Warnings:

  - You are about to drop the column `pengajuanId` on the `PenawaranHarga` table. All the data in the column will be lost.
  - You are about to drop the `FotoPengajuan` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PengajuanJual` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[mobilId]` on the table `PenawaranHarga` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `mobilId` to the `PenawaranHarga` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StatusMobil" ADD VALUE 'DRAFT';
ALTER TYPE "StatusMobil" ADD VALUE 'MENUNGGU_EVALUASI';
ALTER TYPE "StatusMobil" ADD VALUE 'SEDANG_DIEVALUASI';
ALTER TYPE "StatusMobil" ADD VALUE 'DITAWARKAN';
ALTER TYPE "StatusMobil" ADD VALUE 'DISETUJUI';
ALTER TYPE "StatusMobil" ADD VALUE 'DITOLAK';

-- DropForeignKey
ALTER TABLE "FotoPengajuan" DROP CONSTRAINT "FotoPengajuan_pengajuanId_fkey";

-- DropForeignKey
ALTER TABLE "PenawaranHarga" DROP CONSTRAINT "PenawaranHarga_pengajuanId_fkey";

-- DropForeignKey
ALTER TABLE "PengajuanJual" DROP CONSTRAINT "PengajuanJual_sellerId_fkey";

-- DropIndex
DROP INDEX "PenawaranHarga_pengajuanId_key";

-- AlterTable
ALTER TABLE "PenawaranHarga" DROP COLUMN "pengajuanId",
ADD COLUMN     "mobilId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "mobil" ADD COLUMN     "deskripsi" TEXT,
ADD COLUMN     "sellerId" TEXT;

-- DropTable
DROP TABLE "FotoPengajuan";

-- DropTable
DROP TABLE "PengajuanJual";

-- DropEnum
DROP TYPE "StatusPengajuan";

-- CreateIndex
CREATE UNIQUE INDEX "PenawaranHarga_mobilId_key" ON "PenawaranHarga"("mobilId");

-- AddForeignKey
ALTER TABLE "mobil" ADD CONSTRAINT "mobil_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PenawaranHarga" ADD CONSTRAINT "PenawaranHarga_mobilId_fkey" FOREIGN KEY ("mobilId") REFERENCES "mobil"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
