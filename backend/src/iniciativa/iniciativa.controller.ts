import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpException,
    HttpStatus,
    Param,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiNotFoundResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PessoaFromJwt } from '../auth/models/PessoaFromJwt';
import { TipoPDM, TipoPdmType } from '../common/decorators/current-tipo-pdm';
import { FindOneParams } from '../common/decorators/find-params';
import { RecordWithId } from '../common/dto/record-with-id.dto';
import { FilterRelacionadosDTO } from '../meta/dto/filter-meta.dto';
import { MetaController, MetaSetorialController } from '../meta/meta.controller';
import { CreateIniciativaDto } from './dto/create-iniciativa.dto';
import { FilterIniciativaDto } from './dto/filter-iniciativa.dto';
import { ListIniciativaDto } from './dto/list-iniciativa.dto';
import { UpdateIniciativaDto } from './dto/update-iniciativa.dto';
import { IniciativaDto } from './entities/iniciativa.entity';
import { IniciativaService } from './iniciativa.service';
import { RelacionadosDTO } from '../meta/entities/meta.entity';

@ApiTags('Iniciativa')
@Controller('iniciativa')
export class IniciativaController {
    private tipoPdm: TipoPdmType = '_PDM';
    constructor(private readonly iniciativaService: IniciativaService) {}

    @Post()
    @ApiBearerAuth('access-token')
    @Roles(MetaController.WritePerm)
    async create(
        @Body() createIniciativaDto: CreateIniciativaDto,
        @CurrentUser() user: PessoaFromJwt
    ): Promise<RecordWithId> {
        return await this.iniciativaService.create(this.tipoPdm, createIniciativaDto, user);
    }

    @ApiBearerAuth('access-token')
    @Get()
    @Roles(MetaController.ReadPerm)
    async findAll(
        @Query() filters: FilterIniciativaDto,
        @CurrentUser() user: PessoaFromJwt
    ): Promise<ListIniciativaDto> {
        return { linhas: await this.iniciativaService.findAll(this.tipoPdm, filters, user) };
    }

    @ApiBearerAuth('access-token')
    @ApiNotFoundResponse()
    @Get(':id')
    @Roles(MetaController.ReadPerm)
    async findOne(@Param() params: FindOneParams, @CurrentUser() user: PessoaFromJwt): Promise<IniciativaDto> {
        const r = await this.iniciativaService.findAll(this.tipoPdm, { id: params.id }, user);
        if (!r.length) throw new HttpException('Iniciativa não encontrada.', 404);
        return r[0];
    }

    @Patch(':id')
    @ApiBearerAuth('access-token')
    @Roles(MetaController.WritePerm)
    async update(
        @Param() params: FindOneParams,
        @Body() updateIniciativaDto: UpdateIniciativaDto,
        @CurrentUser() user: PessoaFromJwt
    ) {
        return await this.iniciativaService.update(this.tipoPdm, +params.id, updateIniciativaDto, user);
    }

    @Delete(':id')
    @ApiBearerAuth('access-token')
    @Roles(MetaController.WritePerm)
    @ApiNoContentResponse()
    @HttpCode(HttpStatus.ACCEPTED)
    async remove(@Param() params: FindOneParams, @CurrentUser() user: PessoaFromJwt) {
        await this.iniciativaService.remove(this.tipoPdm, +params.id, user);
        return '';
    }
}

@ApiTags('Iniciativa')
@Controller('plano-setorial-iniciativa')
export class IniciativaSetorialController {
    constructor(private readonly iniciativaService: IniciativaService) {}

    @Post()
    @ApiBearerAuth('access-token')
    @Roles(MetaSetorialController.WritePerm)
    async create(
        @Body() createIniciativaDto: CreateIniciativaDto,
        @CurrentUser() user: PessoaFromJwt,
        @TipoPDM() tipo: TipoPdmType
    ): Promise<RecordWithId> {
        return await this.iniciativaService.create(tipo, createIniciativaDto, user);
    }

    @ApiBearerAuth('access-token')
    @Get()
    @Roles(MetaSetorialController.ReadPerm)
    async findAll(
        @Query() filters: FilterIniciativaDto,
        @CurrentUser() user: PessoaFromJwt,
        @TipoPDM() tipo: TipoPdmType
    ): Promise<ListIniciativaDto> {
        return { linhas: await this.iniciativaService.findAll(tipo, filters, user) };
    }

    @ApiBearerAuth('access-token')
    @ApiNotFoundResponse()
    @Get('relacionados')
    @Roles(MetaSetorialController.ReadPerm)
    async buscaRelacionados(
        @Query() dto: FilterRelacionadosDTO,
        @CurrentUser() user: PessoaFromJwt,
        @TipoPDM() tipo: TipoPdmType
    ): Promise<RelacionadosDTO> {
        return await this.iniciativaService.metaService.buscaRelacionados(tipo, dto, user);
    }

    @ApiBearerAuth('access-token')
    @ApiNotFoundResponse()
    @Get(':id')
    @Roles(MetaSetorialController.ReadPerm)
    async findOne(
        @Param() params: FindOneParams,
        @CurrentUser() user: PessoaFromJwt,
        @TipoPDM() tipo: TipoPdmType
    ): Promise<IniciativaDto> {
        const r = await this.iniciativaService.findAll(tipo, { id: params.id }, user);
        if (!r.length) throw new HttpException('Iniciativa não encontrada.', 404);
        return r[0];
    }

    @Patch(':id')
    @ApiBearerAuth('access-token')
    @Roles(MetaSetorialController.WritePerm)
    async update(
        @Param() params: FindOneParams,
        @Body() updateIniciativaDto: UpdateIniciativaDto,
        @CurrentUser() user: PessoaFromJwt,
        @TipoPDM() tipo: TipoPdmType
    ) {
        return await this.iniciativaService.update(tipo, +params.id, updateIniciativaDto, user);
    }

    @Delete(':id')
    @ApiBearerAuth('access-token')
    @Roles(MetaSetorialController.WritePerm)
    @ApiNoContentResponse()
    @HttpCode(HttpStatus.ACCEPTED)
    async remove(@Param() params: FindOneParams, @CurrentUser() user: PessoaFromJwt, @TipoPDM() tipo: TipoPdmType) {
        await this.iniciativaService.remove(tipo, +params.id, user);
        return '';
    }
}
