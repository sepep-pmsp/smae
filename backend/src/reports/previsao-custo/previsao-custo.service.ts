import { HttpException, Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { Date2YMD, SYSTEM_TIMEZONE } from '../../common/date2ymd';
import { DotacaoService } from '../../dotacao/dotacao.service';
import { PrismaService } from '../../prisma/prisma.service';

import { DefaultCsvOptions, FileOutput, ReportableService, UtilsService } from '../utils/utils.service';
import { CreateRelPrevisaoCustoDto, PeriodoRelatorioPrevisaoCustoDto, SuperCreateRelPrevisaoCustoDto } from './dto/create-previsao-custo.dto';
import { ListPrevisaoCustoDto } from './entities/previsao-custo.entity';

const {
    Parser,
    transforms: { flatten },
} = require('json2csv');
const defaultTransform = [flatten({ paths: [] })];

@Injectable()
export class PrevisaoCustoService implements ReportableService {
    constructor(private readonly utils: UtilsService, private readonly prisma: PrismaService, private readonly dotacaoService: DotacaoService) { }

    async create(dto: SuperCreateRelPrevisaoCustoDto): Promise<ListPrevisaoCustoDto> {
        let ano: number;

        let filtroMetas: number[] | undefined = undefined;

        // sem portfolio_id e sem projeto_id = filtra por meta
        if (dto.portfolio_id === undefined && dto.projeto_id === undefined) {
            const { metas } = await this.utils.applyFilter(dto, { iniciativas: false, atividades: false });

            filtroMetas = metas.map(r => r.id);
        }

        if (dto.periodo_ano === PeriodoRelatorioPrevisaoCustoDto.Corrente) {
            ano = DateTime.local({ zone: SYSTEM_TIMEZONE }).year;
        } else {
            if (!dto.ano) throw new HttpException('Ano deve ser enviado', 400);

            ano = dto.ano;
        }

        const metaOrcamentos = await this.prisma.orcamentoPrevisto.findMany({
            where: {
                meta_id: filtroMetas ? { in: filtroMetas } : undefined,
                projeto_id: dto.projeto_id ? dto.projeto_id : undefined,
                ...(dto.portfolio_id ? { projeto: { portfolio_id: dto.portfolio_id } } : {}),
                ano_referencia: ano,
                removido_em: null,
            },
            select: {
                id: true,
                criador: { select: { nome_exibicao: true } },
                meta: { select: { id: true, codigo: true, titulo: true } },
                atividade: { select: { id: true, codigo: true, titulo: true } },
                iniciativa: { select: { id: true, codigo: true, titulo: true } },
                projeto: { select: { id: true, codigo: true, nome: true } },
                versao_anterior_id: true,
                criado_em: true,
                ano_referencia: true,
                custo_previsto: true,
                parte_dotacao: true,
                atualizado_em: true,
            },
            orderBy: [{ meta_id: 'asc' }, { criado_em: 'desc' }],
        });

        const list = metaOrcamentos.map(r => {
            return {
                ...r,
                custo_previsto: r.custo_previsto.toFixed(2),
                projeto_atividade: '',
                parte_dotacao: this.expandirParteDotacao(r.parte_dotacao),
            };
        });
        await this.dotacaoService.setManyProjetoAtividade(list);

        return {
            linhas: list,
        };
    }

    private expandirParteDotacao(parte_dotacao: string): string {
        const partes = parte_dotacao.split('.');
        if ((partes[1] = '*')) partes[1] = '**';
        if ((partes[4] = '*')) partes[4] = '****';
        if ((partes[7] = '*')) partes[7] = '********';
        return partes.join('.');
    }

    async getFiles(myInput: any, pdm_id: number | null, params: any): Promise<FileOutput[]> {
        const dados = myInput as ListPrevisaoCustoDto;

        const pdm = pdm_id ? await this.prisma.pdm.findUniqueOrThrow({ where: { id: pdm_id } }) : null;

        const out: FileOutput[] = [];

        const camposProjeto = [
            { value: 'projeto.codigo', label: 'Código Projeto' },
            { value: 'projeto.nome', label: 'Nome do Projeto' },
            { value: 'projeto.id', label: 'ID do Projeto' },
        ];

        const campos = pdm ? [
            { value: 'meta.codigo', label: 'Código da Meta' },
            { value: 'meta.titulo', label: 'Título da Meta' },
            { value: 'meta.id', label: 'ID da Meta' },
            { value: 'iniciativa.codigo', label: 'Código da ' + pdm.rotulo_iniciativa },
            { value: 'iniciativa.titulo', label: 'Título da ' + pdm.rotulo_iniciativa },
            { value: 'iniciativa.id', label: 'ID da ' + pdm.rotulo_iniciativa },
            { value: 'atividade.codigo', label: 'Código da ' + pdm.rotulo_atividade },
            { value: 'atividade.titulo', label: 'Título da ' + pdm.rotulo_atividade },
            { value: 'atividade.id', label: 'ID da ' + pdm.rotulo_atividade },
        ] : camposProjeto;

        if (dados.linhas.length) {
            const json2csvParser = new Parser({
                ...DefaultCsvOptions,
                transforms: defaultTransform,
                fields: [
                    ...campos,
                    'id',
                    'id_versao_anterior',
                    'projeto_atividade',
                    'criado_em',
                    'ano_referencia',
                    'custo_previsto',
                    'parte_dotacao',
                    'atualizado_em'
                ],
            });
            const linhas = json2csvParser.parse(
                dados.linhas.map(r => {
                    return { ...r };
                }),
            );
            out.push({
                name: 'previsao-custo.csv',
                buffer: Buffer.from(linhas, 'utf8'),
            });
        }

        return [
            {
                name: 'info.json',
                buffer: Buffer.from(
                    JSON.stringify({
                        params: params,
                        horario: Date2YMD.tzSp2UTC(new Date()),
                    }),
                    'utf8',
                ),
            },
            ...out,
        ];
    }
}
