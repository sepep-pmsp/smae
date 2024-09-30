import { BadRequestException, HttpException } from '@nestjs/common';
import { CompromissoOrigemRelacionamento, Prisma, ProjetoOrigemTipo } from '@prisma/client';
import { PessoaFromJwt } from '../../auth/models/PessoaFromJwt';
import { PrismaService } from '../../prisma/prisma.service';
import { DetalhesOrigensMetasItemDto, ResumoOrigensMetasItemDto, UpsertOrigemDto } from '../dto/origem-pdm.dto';

export class CompromissoOrigemHelper {
    static async upsert(
        entityId: number,
        entityType: 'projeto' | 'meta' | 'iniciativa' | 'atividade',
        origens: UpsertOrigemDto[],
        prismaTx: Prisma.TransactionClient,
        user: PessoaFromJwt,
        now: Date
    ): Promise<void> {
        const relacionamento = CompromissoOrigemHelper.getRelacionamento(entityType);
        const entityCol = CompromissoOrigemHelper.getEntityColumn(entityType);

        const currentOrigens = await prismaTx.compromissoOrigem.findMany({
            where: {
                relacionamento,
                removido_em: null,
                [entityCol]: entityId,
            },
        });

        const updated = origens
            .filter((o) => o.id !== undefined)
            .filter((oNew) => {
                const oOld = currentOrigens.find((o) => o.id === oNew.id);
                if (oOld) {
                    return (
                        oNew.origem_tipo !== oOld.origem_tipo ||
                        oNew.origem_outro !== oOld.origem_outro ||
                        oNew.meta_id !== oOld.meta_id ||
                        oNew.iniciativa_id !== oOld.iniciativa_id ||
                        oNew.atividade_id !== oOld.atividade_id ||
                        oNew.meta_codigo !== oOld.meta_codigo
                    );
                }
                throw new BadRequestException(`Registro anterior com ID ${oNew.id} não encontrado.`);
            });

        const created = origens.filter((o) => o.id == undefined);

        const deleted = currentOrigens.filter((o) => !origens.some((oNew) => oNew.id === o.id)).map((o) => o.id);

        const operations = [];
        console.log('updated', updated);
        console.log('created', created);
        console.log('deleted', deleted);

        for (const o of updated) {
            operations.push(
                prismaTx.compromissoOrigem.update({
                    where: {
                        id: o.id!,
                        relacionamento,
                        removido_em: null,
                    },
                    data: {
                        origem_tipo: o.origem_tipo,
                        origem_outro: o.origem_outro,
                        meta_id: o.meta_id,
                        iniciativa_id: o.iniciativa_id,
                        atividade_id: o.atividade_id,
                        meta_codigo: o.meta_codigo,
                        atualizado_em: now,
                        atualizado_por: user.id,
                    },
                })
            );
        }

        for (const o of created) {
            operations.push(
                prismaTx.compromissoOrigem.create({
                    data: {
                        relacionamento,
                        [entityCol]: entityId,
                        origem_tipo: o.origem_tipo,
                        origem_outro: o.origem_outro,
                        meta_id: o.meta_id,
                        iniciativa_id: o.iniciativa_id,
                        atividade_id: o.atividade_id,
                        meta_codigo: o.meta_codigo,
                        criado_em: now,
                        criado_por: user.id,
                    },
                })
            );
        }

        if (deleted.length > 0) {
            operations.push(
                prismaTx.compromissoOrigem.updateMany({
                    where: {
                        relacionamento,
                        id: { in: deleted },
                        [entityCol]: entityId,
                        removido_em: null,
                    },
                    data: {
                        removido_em: now,
                        removido_por: user.id,
                    },
                })
            );
        }

        await Promise.all(operations);
    }

    static async processaOrigens(
        origens: UpsertOrigemDto[] | undefined,
        prisma: Prisma.TransactionClient
    ): Promise<ResumoOrigensMetasItemDto> {
        const cached: ResumoOrigensMetasItemDto = {
            metas: [],
        };
        if (!origens || (Array.isArray(origens) && origens.length == 0)) return cached;

        for (const dto of origens) {
            const meta_id: number | null = dto.meta_id ? dto.meta_id : null;
            const iniciativa_id: number | null = dto.iniciativa_id ? dto.iniciativa_id : null;
            const atividade_id: number | null = dto.atividade_id ? dto.atividade_id : null;
            const meta_codigo: string | null = dto.meta_codigo ? dto.meta_codigo : null;
            const origem_tipo: ProjetoOrigemTipo = dto.origem_tipo;

            if (origem_tipo === ProjetoOrigemTipo.PdmSistema) {
                const _info = await validaPdmSistema(dto);
                cached.metas.push({
                    codigo: _info.codigo,
                    id: _info.id,
                    pdm_id: _info.pdm_id,
                });
            } else if (origem_tipo === ProjetoOrigemTipo.PdmAntigo) {
                validaPdmAntigo(dto);
                cached.metas.push({
                    codigo: dto.meta_codigo!,
                    id: null,
                    pdm_id: null,
                });
            } else if (origem_tipo === ProjetoOrigemTipo.Outro) {
                throw new HttpException('origem_tipo=Outro não é suportado para tipo extra', 500);
            } else {
                throw new HttpException(`origem_tipo ${origem_tipo} não é suportado`, 500);
            }

            dto.meta_id = meta_id;
            dto.iniciativa_id = iniciativa_id;
            dto.atividade_id = atividade_id;
            dto.meta_codigo = meta_codigo;
            dto.origem_tipo = origem_tipo;
        }

        return cached;

        function validaPdmAntigo(dto: UpsertOrigemDto) {
            const errMsg = 'caso origem seja outro sistema de meta';
            if (!dto.meta_codigo) throw new HttpException(`meta_codigo| Meta código deve ser enviado ${errMsg}`, 400);
            if (!dto.origem_outro)
                throw new HttpException(`origem_outro| Descrição da origem deve ser enviado ${errMsg}`, 400);

            if (dto.meta_id) throw new HttpException(`meta_id| Meta não deve ser enviado ${errMsg}`, 400);
            if (dto.iniciativa_id)
                throw new HttpException(`iniciativa_id| Iniciativa não deve ser enviado ${errMsg}`, 400);
            if (dto.atividade_id)
                throw new HttpException(`atividade_id| Atividade não deve ser enviado ${errMsg}`, 400);

            // força a limpeza no banco, pode ser que tenha vindo como undefined
            dto.meta_id = dto.atividade_id = dto.iniciativa_id = null;
        }

        async function validaPdmSistema(dto: UpsertOrigemDto) {
            if (!dto.atividade_id && !dto.iniciativa_id && !dto.meta_id)
                throw new HttpException(
                    'meta| é obrigatório enviar meta_id|iniciativa_id|atividade_id quando origem_tipo=PdmSistema',
                    400
                );

            if (dto.atividade_id) {
                const atv = await prisma.atividade.findFirstOrThrow({
                    where: { id: dto.atividade_id, removido_em: null },
                    select: { iniciativa_id: true },
                });
                const ini = await prisma.iniciativa.findFirstOrThrow({
                    where: { id: atv.iniciativa_id, removido_em: null },
                    select: { meta_id: true },
                });
                await prisma.iniciativa.findFirstOrThrow({
                    where: { id: ini.meta_id, removido_em: null },
                    select: { id: true },
                });

                dto.iniciativa_id = atv.iniciativa_id;
                dto.meta_id = ini.meta_id;
            } else if (dto.iniciativa_id) {
                const ini = await prisma.iniciativa.findFirstOrThrow({
                    where: { id: dto.iniciativa_id, removido_em: null },
                    select: { meta_id: true },
                });

                dto.meta_id = ini.meta_id;
                dto.atividade_id = null;
            } else if (dto.meta_id) {
                await prisma.meta.findFirstOrThrow({
                    where: { id: dto.meta_id, removido_em: null },
                    select: { id: true },
                });

                dto.iniciativa_id = dto.atividade_id = null;
            }

            if (dto.origem_outro)
                throw new HttpException('origem_outro| Não deve ser enviado caso origem_tipo seja PdmSistema', 400);
            if (dto.meta_codigo)
                throw new HttpException('meta_codigo| Não deve ser enviado caso origem_tipo seja PdmSistema', 400);

            // força a limpeza no banco, pode ser que tenha vindo como undefined
            dto.meta_codigo = dto.origem_outro = null;

            const meta = await prisma.meta.findFirstOrThrow({
                where: { id: dto.meta_id! },
                select: { codigo: true, pdm_id: true, id: true },
            });
            return meta;
        }
    }

    private static getRelacionamento(
        entityType: 'projeto' | 'meta' | 'iniciativa' | 'atividade'
    ): CompromissoOrigemRelacionamento {
        const map: Record<typeof entityType, CompromissoOrigemRelacionamento> = {
            projeto: 'Projeto',
            meta: 'Meta',
            iniciativa: 'Iniciativa',
            atividade: 'Meta',
        };
        return map[entityType];
    }

    private static getEntityColumn(entityType: 'projeto' | 'meta' | 'iniciativa' | 'atividade'): string {
        return entityType === 'projeto' ? entityType + '_id' : 'rel_' + entityType + '_id';
    }

    static async buscaOrigensComDetalhes(
        entityType: 'projeto' | 'meta' | 'iniciativa' | 'atividade',
        entityId: number,
        prismaTx: PrismaService
    ): Promise<DetalhesOrigensMetasItemDto> {
        const relacionamento = CompromissoOrigemHelper.getRelacionamento(entityType);
        const entityColumn = CompromissoOrigemHelper.getEntityColumn(entityType);

        const origens = await prismaTx.compromissoOrigem.findMany({
            where: {
                relacionamento,
                [entityColumn]: entityId,
                removido_em: null,
            },
            select: {
                id: true,
                origem_tipo: true,
                origem_outro: true,
                meta_id: true,
                iniciativa_id: true,
                atividade_id: true,
                meta_codigo: true,
            },
        });

        return {
            detalhes: origens.map((origem) => ({
                id: origem.id,
                origem_tipo: origem.origem_tipo,
                origem_outro: origem.origem_outro,
                meta_id: origem.meta_id,
                iniciativa_id: origem.iniciativa_id,
                atividade_id: origem.atividade_id,
                meta_codigo: origem.meta_codigo,
            })),
        };
    }
}
