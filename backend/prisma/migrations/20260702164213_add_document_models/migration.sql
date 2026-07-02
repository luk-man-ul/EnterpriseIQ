-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('Pending', 'Processing', 'Completed', 'Failed');

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "filename" VARCHAR(512) NOT NULL,
    "uploadDate" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" UUID NOT NULL,
    "tags" VARCHAR(100)[],
    "documentType" VARCHAR(50) NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'Pending',
    "contentHash" VARCHAR(64) NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "filePath" VARCHAR(512) NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_permissions" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "roleId" UUID,
    "departmentId" UUID,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "documents_contentHash_key" ON "documents"("contentHash");

-- CreateIndex
CREATE INDEX "documents_status_idx" ON "documents"("status");

-- CreateIndex
CREATE INDEX "documents_uploadedById_idx" ON "documents"("uploadedById");

-- CreateIndex
CREATE INDEX "document_permissions_documentId_idx" ON "document_permissions"("documentId");

-- CreateIndex
CREATE INDEX "document_permissions_roleId_idx" ON "document_permissions"("roleId");

-- CreateIndex
CREATE INDEX "document_permissions_departmentId_idx" ON "document_permissions"("departmentId");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_permissions" ADD CONSTRAINT "document_permissions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_permissions" ADD CONSTRAINT "document_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_permissions" ADD CONSTRAINT "document_permissions_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
