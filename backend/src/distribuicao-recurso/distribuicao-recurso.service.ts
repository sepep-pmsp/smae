import { HttpException, Injectable } from '@nestjs/common';
import { Prisma, WorkflowResponsabilidade } from '@prisma/client';
import { CreateDistribuicaoRecursoDto } from './dto/create-distribuicao-recurso.dto';
import { PessoaFromJwt } from 'src/auth/models/PessoaFromJwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { RecordWithId } from 'src/common/dto/record-with-id.dto';
import { DistribuicaoRecursoDto } from './entities/distribuicao-recurso.entity';
import { UpdateDistribuicaoRecursoDto } from './dto/update-distribuicao-recurso.dto';
import { FilterDistribuicaoRecursoDto } from './dto/filter-distribuicao-recurso.dto';
import { formataSEI } from 'src/common/formata-sei';

type OperationsRegistroSEI = {
    id?: number;
    nome: string | null;
    processo_sei: string;
}[];

@Injectable()
export class DistribuicaoRecursoService {
    constructor(private readonly prisma: PrismaService) {}

    async create(dto: CreateDistribuicaoRecursoDto, user: PessoaFromJwt): Promise<RecordWithId> {
        const orgaoGestorExiste = await this.prisma.orgao.count({
            where: {
                id: dto.orgao_gestor_id,
                removido_em: null,
            },
        });
        if (!orgaoGestorExiste) throw new HttpException('orgao_gestor_id| Órgão gestor inválido', 400);

        const transferenciaExiste = await this.prisma.transferencia.count({
            where: {
                id: dto.transferencia_id,
                removido_em: null,
            },
        });
        if (!transferenciaExiste) throw new HttpException('transferencia_id| Transferência não encontrada.', 400);

        const created = await this.prisma.$transaction(
            async (prismaTx: Prisma.TransactionClient): Promise<RecordWithId> => {
                if (dto.nome) {
                    const similarExists = await prismaTx.distribuicaoRecurso.count({
                        where: {
                            nome: { endsWith: dto.nome, mode: 'insensitive' },
                            removido_em: null,
                        },
                    });
                    if (similarExists > 0)
                        throw new HttpException(
                            'nome| Nome de distribuição, igual ou semelhante já existe em outro registro ativo',
                            400
                        );
                }

                const distribuicaoRecurso = await prismaTx.distribuicaoRecurso.create({
                    data: {
                        transferencia_id: dto.transferencia_id,
                        orgao_gestor_id: dto.orgao_gestor_id,
                        nome: dto.nome,
                        objeto: dto.objeto,
                        valor: dto.valor,
                        valor_total: dto.valor_total,
                        valor_contrapartida: dto.valor_contrapartida,
                        empenho: dto.empenho,
                        data_empenho: dto.data_empenho,
                        programa_orcamentario_estadual: dto.programa_orcamentario_estadual,
                        programa_orcamentario_municipal: dto.programa_orcamentario_municipal,
                        dotacao: dto.dotacao,
                        proposta: dto.proposta,
                        contrato: dto.contrato,
                        convenio: dto.convenio,
                        assinatura_termo_aceite: dto.assinatura_termo_aceite,
                        assinatura_municipio: dto.assinatura_municipio,
                        assinatura_estado: dto.assinatura_estado,
                        vigencia: dto.vigencia,
                        conclusao_suspensiva: dto.conclusao_suspensiva,
                        criado_em: new Date(Date.now()),
                        criado_por: user.id,
                        registros_sei: {
                            createMany: {
                                data:
                                    dto.registros_sei != undefined && dto.registros_sei.length > 0
                                        ? dto.registros_sei!.map((r) => {
                                              return {
                                                  processo_sei: r.processo_sei.replace(/\D/g, ''),
                                                  nome: r.nome,
                                                  registro_sei_info: '{}',
                                                  criado_em: new Date(Date.now()),
                                                  criado_por: user.id,
                                              };
                                          })
                                        : [],
                            },
                        },
                    },
                    select: {
                        id: true,
                        transferencia: {
                            select: {
                                workflow_id: true,
                            },
                        },
                    },
                });

                // Caso seja a primeira row de distribuição de recurso.
                // É necessário verificar as fases e tarefas do workflow
                // Cuja responsabilidade é "OutroOrgao" e setar o orgao_id da tarefa do cronograma.
                const countLinhas = await prismaTx.distribuicaoRecurso.count({
                    where: {
                        transferencia_id: dto.transferencia_id,
                        removido_em: null,
                    },
                });

                if (countLinhas == 1 && distribuicaoRecurso.transferencia.workflow_id != null) {
                    const rows = await prismaTx.transferenciaAndamento.findMany({
                        where: {
                            transferencia_id: dto.transferencia_id,
                            transferencia: {
                                workflow_id: distribuicaoRecurso.transferencia.workflow_id,
                            },

                            workflow_fase: {
                                fluxos: {
                                    some: {
                                        responsabilidade: WorkflowResponsabilidade.OutroOrgao,
                                    },
                                },
                            },
                        },
                        select: {
                            tarefaEspelhada: {
                                select: { id: true },
                            },

                            tarefas: {
                                where: {
                                    workflow_tarefa: {
                                        fluxoTarefas: {
                                            some: { responsabilidade: WorkflowResponsabilidade.OutroOrgao },
                                        },
                                    },
                                },
                                select: {
                                    tarefaEspelhada: {
                                        select: { id: true },
                                    },
                                },
                            },
                        },
                    });

                    const operations = [];
                    for (const fase of rows) {
                        for (const tarefaEspelhada of fase.tarefaEspelhada) {
                            operations.push(
                                prismaTx.tarefa.update({
                                    where: { id: tarefaEspelhada.id },
                                    data: {
                                        orgao_id: dto.orgao_gestor_id,
                                        atualizado_em: new Date(Date.now()),
                                    },
                                })
                            );
                        }

                        for (const tarefa of fase.tarefas) {
                            for (const tarefaEspelhada of tarefa.tarefaEspelhada) {
                                operations.push(
                                    prismaTx.tarefa.update({
                                        where: { id: tarefaEspelhada.id },
                                        data: {
                                            orgao_id: dto.orgao_gestor_id,
                                            atualizado_em: new Date(Date.now()),
                                        },
                                    })
                                );
                            }
                        }
                    }

                    await Promise.all(operations);
                }

                return { id: distribuicaoRecurso.id };
            }
        );

        return { id: created.id };
    }

    async findAll(filters: FilterDistribuicaoRecursoDto): Promise<DistribuicaoRecursoDto[]> {
        const rows = await this.prisma.distribuicaoRecurso.findMany({
            where: {
                removido_em: null,
                transferencia_id: filters.transferencia_id,
            },
            select: {
                id: true,
                transferencia_id: true,
                nome: true,
                objeto: true,
                valor: true,
                valor_total: true,
                valor_contrapartida: true,
                empenho: true,
                data_empenho: true,
                programa_orcamentario_estadual: true,
                programa_orcamentario_municipal: true,
                dotacao: true,
                proposta: true,
                contrato: true,
                convenio: true,
                assinatura_termo_aceite: true,
                assinatura_municipio: true,
                assinatura_estado: true,
                vigencia: true,
                conclusao_suspensiva: true,
                orgao_gestor: {
                    select: {
                        id: true,
                        sigla: true,
                        descricao: true,
                    },
                },
                registros_sei: {
                    where: { removido_em: null },
                    select: {
                        id: true,
                        nome: true,
                        processo_sei: true,
                    },
                },
                aditamentos: {
                    orderBy: { criado_em: 'desc' },
                    select: {
                        data_vigencia: true,
                        justificativa: true,
                    },
                },
            },
        });

        return rows.map((r) => {
            return {
                ...r,
                aditamentos_vigencia: r.aditamentos.map((aditamento) => {
                    return {
                        data_vigencia: aditamento.data_vigencia,
                        justificativa: aditamento.justificativa,
                    };
                }),
                registros_sei: r.registros_sei.map((s) => {
                    return {
                        id: s.id,
                        nome: s.nome,
                        processo_sei: formataSEI(s.processo_sei),
                    };
                }),
            };
        });
    }

    async findOne(id: number, user: PessoaFromJwt): Promise<DistribuicaoRecursoDto> {
        const row = await this.prisma.distribuicaoRecurso.findFirst({
            where: {
                id,
                removido_em: null,
            },
            select: {
                id: true,
                transferencia_id: true,
                nome: true,
                objeto: true,
                valor: true,
                valor_total: true,
                valor_contrapartida: true,
                empenho: true,
                data_empenho: true,
                programa_orcamentario_estadual: true,
                programa_orcamentario_municipal: true,
                dotacao: true,
                proposta: true,
                contrato: true,
                convenio: true,
                assinatura_termo_aceite: true,
                assinatura_municipio: true,
                assinatura_estado: true,
                vigencia: true,
                conclusao_suspensiva: true,
                orgao_gestor: {
                    select: {
                        id: true,
                        sigla: true,
                        descricao: true,
                    },
                },
                registros_sei: {
                    where: { removido_em: null },
                    select: {
                        id: true,
                        nome: true,
                        processo_sei: true,
                    },
                },

                aditamentos: {
                    orderBy: { criado_em: 'desc' },
                    select: {
                        data_vigencia: true,
                        justificativa: true,
                    },
                },
            },
        });
        if (!row) throw new HttpException('id| Distribuição de recurso não encontrada.', 404);

        return {
            ...row,
            aditamentos_vigencia: row.aditamentos.map((aditamento) => {
                return {
                    data_vigencia: aditamento.data_vigencia,
                    justificativa: aditamento.justificativa,
                };
            }),
            registros_sei: row.registros_sei.map((s) => {
                return {
                    id: s.id,
                    nome: s.nome,
                    processo_sei: formataSEI(s.processo_sei),
                };
            }),
        };
    }

    async update(id: number, dto: UpdateDistribuicaoRecursoDto, user: PessoaFromJwt): Promise<RecordWithId> {
        const self = await this.findOne(id, user);

        if (dto.orgao_gestor_id != undefined && dto.orgao_gestor_id != self.orgao_gestor.id) {
            const orgaoGestorExiste = await this.prisma.orgao.count({
                where: {
                    id: dto.orgao_gestor_id,
                    removido_em: null,
                },
            });
            if (!orgaoGestorExiste) throw new HttpException('orgao_gestor_id| Órgão gestor inválido', 400);
        }

        await this.prisma.$transaction(async (prismaTx: Prisma.TransactionClient): Promise<RecordWithId> => {
            if (dto.registros_sei != undefined) {
                const currRegistrosSei = self.registros_sei ?? [];
                await this.checkDiffSei(id, dto.registros_sei, currRegistrosSei, prismaTx, user);
            } else {
                // Front não envia o param quando tiver vazio.
                await prismaTx.distribuicaoRecursoSei.updateMany({
                    where: {
                        distribuicao_recurso_id: id,
                        removido_em: null,
                    },
                    data: {
                        removido_em: new Date(Date.now()),
                        removido_por: user.id,
                    },
                });
            }
            delete dto.registros_sei;

            if (dto.nome && dto.nome != self.nome) {
                const similarExists = await prismaTx.distribuicaoRecurso.count({
                    where: {
                        nome: { endsWith: dto.nome, mode: 'insensitive' },
                        removido_em: null,
                        id: { not: id },
                    },
                });
                if (similarExists > 0)
                    throw new HttpException('nome| Nome igual ou semelhante já existe em outro registro ativo', 400);
            }

            if (dto.vigencia && self.vigencia != null && dto.vigencia != self.vigencia) {
                if (!dto.justificativa_aditamento)
                    throw new HttpException('justificativa_aditamento| Deve ser enviada.', 400);

                await prismaTx.distribuicaoRecursoAditamento.create({
                    data: {
                        distribuicao_recurso_id: id,
                        data_vigencia: self.vigencia!,
                        justificativa: dto.justificativa_aditamento,
                        criado_por: user.id,
                        criado_em: new Date(Date.now()),
                    },
                });
            }

            await prismaTx.distribuicaoRecurso.update({
                where: { id },
                data: {
                    orgao_gestor_id: dto.orgao_gestor_id,
                    nome: dto.nome,
                    objeto: dto.objeto,
                    valor: dto.valor,
                    valor_total: dto.valor_total,
                    valor_contrapartida: dto.valor_contrapartida,
                    empenho: dto.empenho,
                    data_empenho: dto.data_empenho,
                    programa_orcamentario_estadual: dto.programa_orcamentario_estadual,
                    programa_orcamentario_municipal: dto.programa_orcamentario_municipal,
                    dotacao: dto.dotacao,
                    proposta: dto.proposta,
                    contrato: dto.contrato,
                    convenio: dto.convenio,
                    assinatura_termo_aceite: dto.assinatura_termo_aceite,
                    assinatura_municipio: dto.assinatura_municipio,
                    assinatura_estado: dto.assinatura_estado,
                    vigencia: dto.vigencia,
                    conclusao_suspensiva: dto.conclusao_suspensiva,
                    atualizado_em: new Date(Date.now()),
                    atualizado_por: user.id,
                },
                select: {
                    id: true,
                },
            });

            // Caso seja a única distribuição.
            // E o órgão for atualizado, a atualização deve refletir no cronograma.
            const countDistribuicoes = await prismaTx.distribuicaoRecurso.count({
                where: {
                    removido_em: null,
                    transferencia_id: self.transferencia_id,
                },
            });

            if (self.orgao_gestor.id != dto.orgao_gestor_id && countDistribuicoes == 1) {
                await prismaTx.tarefa.updateMany({
                    where: {
                        tarefa_cronograma: {
                            transferencia_id: self.transferencia_id,
                            removido_em: null,
                        },
                        removido_em: null,
                    },
                    data: {
                        orgao_id: dto.orgao_gestor_id,
                    },
                });
            }

            return { id };
        });

        return { id };
    }

    async remove(id: number, user: PessoaFromJwt) {
        const exists = await this.prisma.distribuicaoRecurso.findFirst({
            where: {
                id,
                removido_em: null,
            },
            select: { id: true },
        });
        if (!exists) return;

        await this.prisma.distribuicaoRecurso.updateMany({
            where: {
                id,
                removido_em: null,
            },
            data: {
                removido_em: new Date(Date.now()),
                removido_por: user.id,
            },
        });

        return;
    }

    private async checkDiffSei(
        distribuicaoRecursoId: number,
        sentRegistrosSei: OperationsRegistroSEI,
        currRegistrosSei: OperationsRegistroSEI,
        prismaTx: Prisma.TransactionClient,
        user: PessoaFromJwt
    ) {
        const updated: OperationsRegistroSEI = sentRegistrosSei
            .filter((r) => r.id != undefined)
            .filter((rNew) => {
                const rOld = currRegistrosSei.find((r) => r.id == rNew.id);

                return rNew.processo_sei !== rOld!.processo_sei || rNew.nome !== rOld!.nome;
            });

        const created: OperationsRegistroSEI = sentRegistrosSei.filter((r) => r.id == undefined);

        const deleted: number[] = currRegistrosSei
            .filter((r) => {
                return !sentRegistrosSei.filter((rNew) => rNew.id != undefined).find((rNew) => rNew.id == r.id);
            })
            .map((r) => {
                return r.id!;
            });

        const operations = [];

        for (const updatedRow of updated) {
            operations.push(
                prismaTx.distribuicaoRecursoSei.update({
                    where: {
                        id: updatedRow.id,
                        removido_em: null,
                    },
                    data: {
                        nome: updatedRow.nome,
                        processo_sei: updatedRow.processo_sei.replace(/\D/g, ''),
                        atualizado_em: new Date(Date.now()),
                        atualizado_por: user.id,
                    },
                })
            );
        }

        for (const createdRow of created) {
            operations.push(
                prismaTx.distribuicaoRecursoSei.create({
                    data: {
                        distribuicao_recurso_id: distribuicaoRecursoId,
                        nome: createdRow.nome,
                        processo_sei: createdRow.processo_sei.replace(/\D/g, ''),
                        registro_sei_info: '{}',
                        criado_em: new Date(Date.now()),
                        criado_por: user.id,
                    },
                })
            );
        }

        if (deleted.length > 0) {
            operations.push(
                prismaTx.distribuicaoRecursoSei.deleteMany({
                    where: {
                        id: { in: deleted },
                        distribuicao_recurso_id: distribuicaoRecursoId,
                        removido_em: null,
                    },
                })
            );
        }

        await Promise.all(operations);
    }
}
