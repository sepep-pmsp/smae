import { HttpException, Injectable, Logger } from '@nestjs/common';
import { Prisma, ProjetoAcompanhamentoItem } from '@prisma/client';
import { RecordWithId } from 'src/common/dto/record-with-id.dto';

import { PessoaFromJwt } from '../../auth/models/PessoaFromJwt';
import { PrismaService } from '../../prisma/prisma.service';

import { HtmlSanitizer } from '../../common/html-sanitizer';
import { CreateProjetoAcompanhamentoDto } from './dto/create-acompanhamento.dto';
import { UpdateProjetoAcompanhamentoDto } from './dto/update-acompanhamento.dto';
import {
    DetailProjetoAcompanhamentoDto,
    ProjetoAcompanhamento,
    ProjetoAcompanhamentoRowDto,
} from './entities/acompanhamento.entity';

@Injectable()
export class AcompanhamentoService {
    private readonly logger = new Logger(AcompanhamentoService.name);
    constructor(private readonly prisma: PrismaService) {}

    async create(projeto_id: number, dto: CreateProjetoAcompanhamentoDto, user: PessoaFromJwt): Promise<RecordWithId> {
        //if (!dto.risco_tarefa_outros && Array.isArray(dto.risco) == false || (Array.isArray(dto.risco) && dto.risco.length == 0))
        //throw new HttpException('Se não for enviado um risco do sistema, é necessário informar um risco externo', 400);

        const created = await this.prisma.$transaction(
            async (prismaTx: Prisma.TransactionClient): Promise<RecordWithId> => {
                const now = new Date(Date.now());

                dto.detalhamento = HtmlSanitizer(dto.detalhamento);

                // TODO: corrigir nome do campo no schema
                // foi criado com typo
                const acompanhamento_tipo_id = dto.acompanhamento_tipo_id;
                delete dto.acompanhamento_tipo_id;

                const acompanhamento = await prismaTx.projetoAcompanhamento.create({
                    data: {
                        projeto_id: projeto_id,
                        acompanhanmento_tipo_id: acompanhamento_tipo_id,
                        ...{
                            ...dto,
                            risco: undefined,
                            acompanhamentos: undefined,
                        },

                        criado_em: now,
                        criado_por: user.id,
                    },
                    select: { id: true },
                });

                if (Array.isArray(dto.risco) && dto.risco.length) {
                    await prismaTx.projetoAcompanhamentoRisco.createMany({
                        data: dto.risco.map((r) => {
                            return {
                                projeto_acompanhamento_id: acompanhamento.id,
                                projeto_risco_id: r,
                            };
                        }),
                    });
                }

                if (Array.isArray(dto.acompanhamentos) && dto.acompanhamentos.length) {
                    await prismaTx.projetoAcompanhamentoItem.createMany({
                        data: dto.acompanhamentos.map((r, i) => {
                            return {
                                encaminhamento: r.encaminhamento,
                                prazo_encaminhamento: r.prazo_encaminhamento,
                                prazo_realizado: r.prazo_realizado,
                                responsavel: r.responsavel,
                                projeto_acompanhamento_id: acompanhamento.id,
                                ordem: i + 1,
                            };
                        }),
                    });
                }

                await this.atualizaProjeto(prismaTx, projeto_id, now);

                return { id: acompanhamento.id };
            }
        );

        return { id: created.id };
    }

    async findAll(projetoId: number, user: PessoaFromJwt): Promise<ProjetoAcompanhamento[]> {
        const projetoAcompanhamento = await this.prisma.projetoAcompanhamento.findMany({
            where: {
                projeto_id: projetoId,
                removido_em: null,
            },
            orderBy: [{ criado_em: 'desc' }],
            select: {
                id: true,
                data_registro: true,
                participantes: true,

                detalhamento: true,
                pauta: true,

                acompanhamento_tipo: {
                    select: { id: true, nome: true }
                },

                ProjetoAcompanhamentoItem: {
                    orderBy: { ordem: 'asc' },
                },

                ProjetoAcompanhamentoRisco: {
                    select: {
                        projeto_risco: {
                            select: {
                                id: true,
                                codigo: true,
                            },
                        },
                    },
                },
            },
        });

        return projetoAcompanhamento.map((a) => {
            return {
                id: a.id,
                data_registro: a.data_registro,
                participantes: a.participantes,
                detalhamento: a.detalhamento,
                pauta: a.pauta,
                acompanhamento_tipo: a.acompanhamento_tipo ? {
                    id: a.acompanhamento_tipo.id,
                    nome: a.acompanhamento_tipo.nome
                } : null,

                acompanhamentos: a.ProjetoAcompanhamentoItem.map(this.renderAcompanhamento),

                risco: a.ProjetoAcompanhamentoRisco.map((r) => {
                    return {
                        id: r.projeto_risco.id,
                        codigo: r.projeto_risco.codigo,
                    };
                }),
            };
        });
    }

    renderAcompanhamento(r: ProjetoAcompanhamentoItem): ProjetoAcompanhamentoRowDto {
        return {
            encaminhamento: r.encaminhamento,
            prazo_encaminhamento: r.prazo_encaminhamento ? r.prazo_encaminhamento : null,
            prazo_realizado: r.prazo_realizado ? r.prazo_realizado : null,
            responsavel: r.responsavel,
        };
    }

    async findOne(projetoId: number, id: number, user: PessoaFromJwt): Promise<DetailProjetoAcompanhamentoDto> {
        const projetoAcompanhamento = await this.prisma.projetoAcompanhamento.findFirst({
            where: {
                id,
                projeto_id: projetoId,
                removido_em: null,
            },
            select: {
                id: true,
                data_registro: true,
                participantes: true,
                detalhamento: true,

                observacao: true,
                detalhamento_status: true,
                pontos_atencao: true,
                pauta: true,

                cronograma_paralisado: true,

                acompanhamento_tipo: {
                    select: { id: true, nome: true }
                },

                ProjetoAcompanhamentoItem: {
                    orderBy: { ordem: 'asc' },
                },

                ProjetoAcompanhamentoRisco: {
                    select: {
                        projeto_risco: {
                            select: {
                                id: true,
                                codigo: true,
                            },
                        },
                    },
                },
            },
        });
        if (!projetoAcompanhamento) throw new HttpException('Não foi possível encontrar o Acompanhamento', 400);

        return {
            id: projetoAcompanhamento.id,
            data_registro: projetoAcompanhamento.data_registro,
            participantes: projetoAcompanhamento.participantes,

            detalhamento: projetoAcompanhamento.detalhamento,
            pauta: projetoAcompanhamento.pauta,

            observacao: projetoAcompanhamento.observacao,
            detalhamento_status: projetoAcompanhamento.detalhamento_status,
            pontos_atencao: projetoAcompanhamento.pontos_atencao,

            cronograma_paralisado: projetoAcompanhamento.cronograma_paralisado,

            acompanhamentos: projetoAcompanhamento.ProjetoAcompanhamentoItem.map(this.renderAcompanhamento),

            acompanhamento_tipo: projetoAcompanhamento.acompanhamento_tipo ? {
                id: projetoAcompanhamento.acompanhamento_tipo.id,
                nome: projetoAcompanhamento.acompanhamento_tipo.nome
            } : null,

            risco: projetoAcompanhamento.ProjetoAcompanhamentoRisco.map((r) => {
                return {
                    id: r.projeto_risco.id,
                    codigo: r.projeto_risco.codigo,
                };
            }),
        };
    }

    async update(projeto_id: number, id: number, dto: UpdateProjetoAcompanhamentoDto, user: PessoaFromJwt) {
        const self = await this.prisma.projetoAcompanhamento.findFirstOrThrow({
            where: {
                id,
                removido_em: null,
                projeto_id: projeto_id,
            },
            select: { id: true },
        });

        dto.detalhamento = HtmlSanitizer(dto.detalhamento);

        const updated = await this.prisma.$transaction(
            async (prismaTx: Prisma.TransactionClient): Promise<RecordWithId> => {
                const now = new Date(Date.now());
                if (dto.risco !== undefined) {
                    await prismaTx.projetoAcompanhamentoRisco.deleteMany({
                        where: { projeto_acompanhamento_id: self.id },
                    });

                    if (Array.isArray(dto.risco) && dto.risco.length > 0)
                        await prismaTx.projetoAcompanhamentoRisco.createMany({
                            data: dto.risco.map((r) => {
                                return {
                                    projeto_acompanhamento_id: self.id,
                                    projeto_risco_id: r,
                                };
                            }),
                        });
                }

                if (dto.acompanhamentos !== undefined) {
                    await prismaTx.projetoAcompanhamentoItem.deleteMany({
                        where: { projeto_acompanhamento_id: self.id },
                    });

                    if (Array.isArray(dto.acompanhamentos) && dto.acompanhamentos.length) {
                        await prismaTx.projetoAcompanhamentoItem.createMany({
                            data: dto.acompanhamentos.map((r, i) => {
                                return {
                                    encaminhamento: r.encaminhamento,
                                    prazo_encaminhamento: r.prazo_encaminhamento,
                                    prazo_realizado: r.prazo_realizado,
                                    responsavel: r.responsavel,
                                    projeto_acompanhamento_id: self.id,
                                    ordem: i + 1,
                                };
                            }),
                        });
                    }
                }

                await this.atualizaProjeto(prismaTx, projeto_id, now);

                // TODO: corrigir nome do campo no schema
                // foi criado com typo
                const acompanhamento_tipo_id = dto.acompanhamento_tipo_id;
                delete dto.acompanhamento_tipo_id;

                return await prismaTx.projetoAcompanhamento.update({
                    where: {
                        id,
                    },
                    data: {
                        ...{
                            ...dto,
                            risco: undefined,
                            acompanhamentos: undefined,
                            acompanhanmento_tipo_id: acompanhamento_tipo_id
                        },
                        atualizado_em: now,
                        atualizado_por: user.id,
                    },
                    select: { id: true },
                });
            }
        );

        return updated;
    }

    private async atualizaProjeto(prismaTx: Prisma.TransactionClient, projeto_id: number, now: Date) {
        await prismaTx.projeto.update({
            where: { id: projeto_id },
            data: {
                tarefas_proximo_recalculo: now,
            },
        });
    }

    async remove(projeto_id: number, id: number, user: PessoaFromJwt) {
        await this.prisma.projetoAcompanhamento.findFirstOrThrow({
            where: {
                id,
                removido_em: null,
                projeto_id: projeto_id,
            },
            select: { id: true },
        });

        return await this.prisma.projetoAcompanhamento.updateMany({
            where: {
                id,
                projeto_id: projeto_id,
            },
            data: {
                removido_em: new Date(Date.now()),
                removido_por: user.id,
            },
        });
    }
}
