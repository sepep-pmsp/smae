import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PessoaFromJwt } from '../auth/models/PessoaFromJwt';
import { FindOneParams } from '../common/decorators/find-params';
import { RecordWithId } from '../common/dto/record-with-id.dto';
import { CreateOrcamentoPlanejadoDto, FilterOrcamentoPlanejadoDto, ListOrcamentoPlanejadoDto, UpdateOrcamentoPlanejadoDto, UpdateOrcamentoPlanejadoZeradoDto } from './dto/orcamento-planejado.dto';
import { OrcamentoPlanejadoService } from './orcamento-planejado.service';

@ApiTags('Orçamento - Planejado')
@Controller('orcamento-planejado')
export class OrcamentoPlanejadoController {
    constructor(private readonly orcamentoPlanejadoService: OrcamentoPlanejadoService) { }

    @Post()
    @ApiBearerAuth('access-token')
    @ApiUnauthorizedResponse()
    @Roles('CadastroMeta.orcamento', 'PDM.tecnico_cp', 'PDM.admin_cp')
    async create(@Body() createMetaDto: CreateOrcamentoPlanejadoDto, @CurrentUser() user: PessoaFromJwt): Promise<RecordWithId> {
        return await this.orcamentoPlanejadoService.create(createMetaDto, user);
    }

    @Patch('zerado')
    @ApiBearerAuth('access-token')
    @ApiUnauthorizedResponse()
    @Roles('CadastroMeta.orcamento', 'PDM.tecnico_cp', 'PDM.admin_cp')
    @HttpCode(HttpStatus.ACCEPTED)
    @ApiNoContentResponse()
    async patchZerado(@Body() updateZeradoDto: UpdateOrcamentoPlanejadoZeradoDto, @CurrentUser() user: PessoaFromJwt) {
        await this.orcamentoPlanejadoService.patchZerado(updateZeradoDto, user);
        return '';
    }

    @Patch(':id')
    @ApiBearerAuth('access-token')
    @ApiUnauthorizedResponse()
    @Roles('CadastroMeta.orcamento', 'PDM.tecnico_cp', 'PDM.admin_cp')
    async update(@Param() params: FindOneParams, @Body() createMetaDto: UpdateOrcamentoPlanejadoDto, @CurrentUser() user: PessoaFromJwt): Promise<RecordWithId> {
        return await this.orcamentoPlanejadoService.update(+params.id, createMetaDto, user);
    }

    @ApiBearerAuth('access-token')
    @Get()
    @Roles('CadastroMeta.orcamento', 'PDM.tecnico_cp', 'PDM.admin_cp')
    async findAll(@Query() filters: FilterOrcamentoPlanejadoDto, @CurrentUser() user: PessoaFromJwt): Promise<ListOrcamentoPlanejadoDto> {
        return {
            linhas: await this.orcamentoPlanejadoService.findAll(filters, user),
            ...(await this.orcamentoPlanejadoService.orcamento_planejado_zero(filters.meta_id, filters.ano_referencia))
        };
    }

    @Delete(':id')
    @ApiBearerAuth('access-token')
    @ApiUnauthorizedResponse()
    @Roles('CadastroMeta.orcamento', 'PDM.tecnico_cp', 'PDM.admin_cp')
    @ApiNoContentResponse()
    @HttpCode(HttpStatus.ACCEPTED)
    async remove(@Param() params: FindOneParams, @CurrentUser() user: PessoaFromJwt) {
        await this.orcamentoPlanejadoService.remove(+params.id, user);
        return '';
    }
}
