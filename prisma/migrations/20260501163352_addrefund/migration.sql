-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "bankRefund" TEXT,
ADD COLUMN     "namaRekeningRefund" TEXT,
ADD COLUMN     "noRekeningRefund" TEXT;

-- AlterTable
ALTER TABLE "Pembayaran" ADD COLUMN     "buktiRefundUrl" TEXT,
ADD COLUMN     "isRefunded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "refundedAt" TIMESTAMP(3);
