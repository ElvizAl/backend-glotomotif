-- DropForeignKey
ALTER TABLE "PenawaranHarga" DROP CONSTRAINT "PenawaranHarga_mobilId_fkey";

-- AddForeignKey
ALTER TABLE "PenawaranHarga" ADD CONSTRAINT "PenawaranHarga_mobilId_fkey" FOREIGN KEY ("mobilId") REFERENCES "mobil"("id") ON DELETE CASCADE ON UPDATE CASCADE;
