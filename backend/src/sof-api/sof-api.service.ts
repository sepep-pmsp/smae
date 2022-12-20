import { HttpException, Injectable, Logger } from '@nestjs/common';
import got, { Got } from 'got';
import { DateTime } from 'luxon';

export class SofError extends Error {
    constructor(msg: string) {
        console.log(`SOF ERROR: ${msg}`)
        super(msg);
        Object.setPrototypeOf(this, SofError.prototype);
    }
}

type RetornoEmpenho = {
    empenho_liquido: number
    val_liquidado: number
    dotacao: string
    processo: string
}

type RetornoOrcado = {
    val_orcado_inicial: number
    val_orcado_atualizado: number
    saldo_disponivel: number
}

type MetaDados = {
    sucess: boolean
    message: string
}

type Entidade = {
    codigo: string
    descricao: string
}

type EntidadeUnidade = {
    codigo: string
    descricao: string
    cod_orgao: string
}

type SuccessEmpenhosResponse = {
    data: RetornoEmpenho[]
    metadados: MetaDados
};

type SuccessEntidadesResponse = {
    metadados: MetaDados
    orgaos: Entidade[],
    unidades: EntidadeUnidade[],
    funcoes: Entidade[]
    subfuncoes: Entidade[]
    programas: Entidade[]
    projetos_atividades: Entidade[]
    categorias: Entidade[]
    grupos: Entidade[]
    modalidades: Entidade[]
    elementos: Entidade[]
    fonte_recursos: Entidade[]
};

type SuccessOrcadoResponse = {
    data: RetornoOrcado[]
    metadados: MetaDados
};

type ErrorHttpResponse = {
    detail: string
};

type ApiResponse = SuccessEmpenhosResponse | ErrorHttpResponse | SuccessEntidadesResponse | SuccessOrcadoResponse;

export type InputOrcadoProjeto = {
    ano: number
    mes: number
    orgao: string
    unidade: string
    proj_atividade: string
    fonte: string
};

export type InputDotacao = {
    ano: number
    mes: number
    dotacao: string
};

export type InputNotaEmpenho = {
    ano: number
    mes: number
    nota_empenho: string
};

export type InputProcesso = {
    ano: number
    mes: number
    processo: string
};


@Injectable()
export class SofApiService {
    private got: Got
    private readonly logger = new Logger(SofApiService.name);
    SOF_API_PREFIX: string;

    constructor() {
        this.SOF_API_PREFIX = process.env.SOF_API_PREFIX || 'http://smae_orcamento:80/'
    }

    /**
     * recebe um ano, retorna o mês mais recente, desde q não esteja no futuro
    **/
    mesMaisRecenteDoAno(ano: number): number {
        const nowSp = DateTime.local({ zone: "America/Sao_Paulo" });

        const anoCorrente = nowSp.year;
        if (anoCorrente == +ano)
            return nowSp.month;

        if (+ano > anoCorrente)
            throw new HttpException('Não é possível buscar por realizado ou planejado no futuro', 400);

        return 12; // mes mais recente do ano pesquisado
    }


    onModuleInit() {
        this.got = got.extend({
            prefixUrl: this.SOF_API_PREFIX,
            retry: {
                methods: [
                    'GET',
                    'PUT',
                    'HEAD',
                    'DELETE',
                    'OPTIONS',
                    'TRACE',
                    'POST',
                ],
                statusCodes: [
                    408,
                    413,
                    429,
                    500,
                    502,
                    503,
                    521,
                    522,
                    524,
                ],

            }
        });
        this.logger.debug(`API SOF configurada para usar endereço ${this.SOF_API_PREFIX}`);
    }

    async orcadoProjeto(input: InputOrcadoProjeto): Promise<SuccessOrcadoResponse> {
        return await this.doGetOrcadoRequest(input);
    }

    async empenhoDotacao(input: InputDotacao): Promise<SuccessEmpenhosResponse> {
        const endpoint = 'v1/empenhos/dotacao';
        return await this.doEmpenhoRequest(endpoint, input);
    }

    async empenhoNotaEmpenho(input: InputNotaEmpenho): Promise<SuccessEmpenhosResponse> {
        const endpoint = 'v1/empenhos/nota_empenho';
        return await this.doEmpenhoRequest(endpoint, input);
    }

    async empenhoProcesso(input: InputProcesso): Promise<SuccessEmpenhosResponse> {
        const endpoint = 'v1/empenhos/processo';
        return await this.doEmpenhoRequest(endpoint, input);
    }

    async entidades(ano: number): Promise<SuccessEntidadesResponse> {
        const endpoint = 'v1/itens_dotacao/all_items?ano=' + encodeURIComponent(ano);
        return await this.doGetEntidadeRequest(endpoint) as SuccessEntidadesResponse;
    }

    private async doGetEntidadeRequest(endpoint: string): Promise<SuccessEntidadesResponse> {

        this.logger.debug(`chamando GET ${endpoint}`);
        try {
            const response: ApiResponse = await this.got.get<ApiResponse>(endpoint).json();
            this.logger.debug(`resposta: ${JSON.stringify(response)}`);
            if ("metadados" in response && response.metadados.sucess && endpoint.includes('v1/itens_dotacao/')) {
                return response as SuccessEntidadesResponse;
            }

            throw new Error(`Serviço SOF retornou dados desconhecidos: ${JSON.stringify(response)}`);
        } catch (error: any) {
            this.logger.debug(`${endpoint} falhou: ${error}`);
            let body = '';
            if (error instanceof got.HTTPError) {
                body = String(error.response.body);
                this.logger.debug(`${endpoint}.res.body: ${body}`);
            }

            throw new SofError(`Serviço SOF: falha ao acessar serviço: ${error}\n\nResponse.Body: ${body}`)
        }
    }

    private async doGetOrcadoRequest(input: InputOrcadoProjeto): Promise<SuccessOrcadoResponse> {
        let endpoint = 'v1/orcado/orcado_projeto';

        endpoint += '?ano=' + encodeURIComponent(input.ano);
        endpoint += '&mes=' + encodeURIComponent(input.mes);
        endpoint += '&orgao=' + encodeURIComponent(input.orgao);
        if (input.unidade != '*')
            endpoint += '&unidade=' + encodeURIComponent(input.unidade);
        endpoint += '&proj_atividade=' + encodeURIComponent(input.proj_atividade);
        endpoint += '&fonte=' + encodeURIComponent(input.fonte);

        this.logger.debug(`chamando GET ${endpoint}`);
        try {
            const response: ApiResponse = await this.got.get<ApiResponse>(endpoint).json();
            this.logger.debug(`resposta: ${JSON.stringify(response)}`);
            if ("metadados" in response && response.metadados.sucess) {

                return {
                    metadados: response.metadados,
                    data: (response as SuccessOrcadoResponse).data.map((r) => {
                        return {
                            val_orcado_atualizado: Number(r.val_orcado_atualizado),
                            val_orcado_inicial: Number(r.val_orcado_inicial),
                            saldo_disponivel: Number(r.saldo_disponivel),
                        }
                    }),
                };
            }

            throw new Error(`Serviço SOF retornou dados desconhecidos: ${JSON.stringify(response)}`);
        } catch (error: any) {
            this.logger.debug(`${endpoint} falhou: ${error}`);
            let body = '';
            if (error instanceof got.HTTPError) {
                body = String(error.response.body);
                this.logger.debug(`${endpoint}.res.body: ${body}`);

                if (error.response.statusCode == 404) {
                    throw new HttpException('Não há resultados para a pesquisa, confira os valores informados.', 400);
                } else if (error.response.statusCode == 422) {
                    throw new HttpException(`Confira os valores informados: ${body}`, 400);
                }
            }

            throw new SofError(`Serviço SOF: falha ao acessar serviço: ${error}\n\nResponse.Body: ${body}`)
        }
    }

    private async doEmpenhoRequest(endpoint: string, input: InputDotacao | InputProcesso | InputNotaEmpenho): Promise<SuccessEmpenhosResponse> {

        this.logger.debug(`chamando ${endpoint} com ${JSON.stringify(input)}`);
        try {
            const response: ApiResponse = await this.got.post<ApiResponse>(endpoint, {
                json: input
            }).json();
            this.logger.debug(`resposta: ${JSON.stringify(response)}`);
            if ("metadados" in response && response.metadados.sucess && endpoint.includes('v1/empenhos/')) {
                return {
                    data: (response as SuccessEmpenhosResponse).data.map((d) => {
                        return {
                            dotacao: d.dotacao,
                            processo: String(d.processo),
                            empenho_liquido: Number(d.empenho_liquido),
                            val_liquidado: Number(d.val_liquidado),
                        }
                    }),
                    metadados: response.metadados
                };
            }

            throw new Error(`Serviço SOF retornou dados desconhecidos: ${JSON.stringify(response)}`);
        } catch (error: any) {
            this.logger.debug(`${endpoint} falhou: ${error}`);
            let body = '';
            if (error instanceof got.HTTPError) {
                body = String(error.response.body);
                this.logger.debug(`${endpoint}.res.body: ${body}`);
                if (error.response.statusCode == 404) {
                    throw new HttpException('Dotação/Processo ou Nota de Empenho não foi encontrada, confira os valores informados.', 400);
                } else if (error.response.statusCode == 422) {
                    throw new HttpException(`Confira os valores informados: ${body}`, 400);
                }
            }

            throw new SofError(`Serviço SOF: falha ao acessar serviço: ${error}\n\nResponse.Body: ${body}`)
        }
    }

}

