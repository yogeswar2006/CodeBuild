/*
  Warnings:

  - You are about to drop the `FileNode` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "FileNode" DROP CONSTRAINT "FileNode_parentId_fkey";

-- DropForeignKey
ALTER TABLE "FileNode" DROP CONSTRAINT "FileNode_projectId_fkey";

-- DropTable
DROP TABLE "FileNode";

-- DropEnum
DROP TYPE "NodeType";
