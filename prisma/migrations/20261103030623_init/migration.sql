-- AlterTable
ALTER TABLE "_ProviderServices" ADD CONSTRAINT "_ProviderServices_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_ProviderServices_AB_unique";
