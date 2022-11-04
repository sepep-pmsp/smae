/*
  Warnings:

  - You are about to drop the column `enviado_para_cp` on the `variavel_ciclo_fisico_documento` table. All the data in the column will be lost.
  - Added the required column `enviado_para_cp` to the `variavel_ciclo_fisico_pedido_complementacao` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "variavel_ciclo_fisico_documento" DROP COLUMN "enviado_para_cp";

-- AlterTable
ALTER TABLE "variavel_ciclo_fisico_pedido_complementacao" ADD COLUMN     "enviado_para_cp" BOOLEAN NOT NULL;
