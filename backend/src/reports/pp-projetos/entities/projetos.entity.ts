import { ApiProperty } from "@nestjs/swagger";
import { ProjetoStatus, ProjetoFase, ProjetoOrigemTipo, StatusRisco } from "@prisma/client";
import { IdSiglaDescricao } from "src/common/dto/IdSigla.dto";
import { ProjetoDetailDto, ProjetoMetaDetailDto, ProjetoPermissoesDto, ProjetoPremissa, ProjetoRecursos, ProjetoRestricoes } from "src/pp/projeto/entities/projeto.entity";
import { IdNomeExibicao } from "src/variavel/entities/variavel.entity";

export class RelProjetosDto {
    id: number;
    meta_id: number | null;
    iniciativa_id: number | null;
    atividade_id: number | null;
    nome: string;
    /**
     * @example "EmAcompanhamento"
    */
    @ApiProperty({ enum: ProjetoStatus, enumName: 'ProjetoStatus' })
    status: ProjetoStatus;
    /**
     * @example "Acompanhamento"
    */
    @ApiProperty({ enum: ProjetoFase, enumName: 'ProjetoFase' })
    fase: ProjetoFase;
    portfolio_id: number
    codigo: string | null;
    objeto: string;
    objetivo: string;
    publico_alvo: string | null;
    previsao_inicio: Date | null;
    previsao_custo: number | null;
    previsao_duracao: number | null;
    previsao_termino: Date | null;
    escopo: string | null;
    nao_escopo: string | null;

    orgao_participante: IdSiglaDescricao;
    responsavel: IdNomeExibicao | null;
    premissa: ProjetoPremissa | null;
    restricao: ProjetoRestricoes | null;
    fonte_recurso: ProjetoRecursos | null;
    
    versao: string | null
}

export class RelProjetosCronogramaDto {
    projeto_codigo: string
    numero: number
    nivel: number
    tarefa: string
    inicio_planejado: Date | null
    termino_planejado: Date | null
    custo_estimado: number | null
    inicio_real: Date | null
    termino_real: Date | null
    duracao_real: number | null
    percentual_concluido: number | null
    custo_real: number | null
    dependencias: string | null

    responsavel: IdNomeExibicao | null
    atraso: number | null
}

export class RelProjetosRiscosDto {
    projeto_codigo: string
    codigo: string
    titulo: string
    data_registro: string
    status_risco: StatusRisco
    descricao: string | null
    causa: string | null
    consequencia: string | null
    probabilidade: number | null
    impacto: number | null
    nivel: number | null
    grau: number | null
    resposta: string | null
    tarefas_afetadas: string | null
}

export class RelProjetosPlanoAcaoDto {
    projeto_codigo: string
    risco_codigo: string
    contramedida: string
    medidas_de_contingencia: string
    prazo_contramedida: Date | null
    custo: number | null
    custo_percentual: number | null
    responsavel: string | null
    data_termino: Date | null
}

export class RelProjetosPlanoAcaoMonitoramentosDto {
    projeto_codigo: string
    risco_codigo: string
    plano_acao_id: number
    data_afericao: Date
    descricao: string
}

export class RelProjetosLicoesAprendidasDto {
    projeto_codigo: string
    data_registro: Date
    responsavel: string
    descricao: string
    observacao: string | null
}

export class RelProjetosAcompanhamentosDto {
    projeto_codigo: string
    data_registro: Date
    participantes: string
    cronograma_paralizado: boolean
    prazo_encaminhamento: Date | null
    prazo_realizado: Date | null
    detalhamento: string | null
    encaminhamento: string | null
    responsavel: string | null
    observacao: string | null
    detalhamento_status: string | null
    pontos_atencao: string | null
}

export class PPProjetosRelatorioDto {
    linhas: RelProjetosDto[]
    cronograma: RelProjetosCronogramaDto[]
    riscos: RelProjetosRiscosDto[]
    planos_de_acao: RelProjetosPlanoAcaoDto[]
    monitoramento_planos_de_acao: RelProjetosPlanoAcaoMonitoramentosDto[]
    licoes_aprendidas: RelProjetosLicoesAprendidasDto[]
    acompanhamentos: RelProjetosAcompanhamentosDto[]
}