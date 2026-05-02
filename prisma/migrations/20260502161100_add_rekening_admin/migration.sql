-- CreateTable
CREATE TABLE "RekeningAdmin" (
    "id" TEXT NOT NULL,
    "bank" TEXT NOT NULL,
    "noRekening" TEXT NOT NULL,
    "atasNama" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RekeningAdmin_pkey" PRIMARY KEY ("id")
);
