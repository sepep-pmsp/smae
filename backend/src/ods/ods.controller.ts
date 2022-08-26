import { Controller, Get, Post, Body, Patch, Param, Delete, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { PessoaFromJwt } from 'src/auth/models/PessoaFromJwt';
import { OdsService } from './ods.service';
import { CreateOdsDto } from './dto/create-ods.dto';
import { UpdateOdsDto } from './dto/update-ods.dto';
import { ListOdsDto } from 'src/ods/dto/list-ods.dto';
import { FindOneParams } from 'src/common/decorators/find-one-params';

@ApiTags('ODS')
@Controller('ods')
export class OdsController {
    constructor(private readonly odsService: OdsService) { }

    @Post()
    @ApiBearerAuth('access-token')
    @ApiUnauthorizedResponse()
    @Roles('CadastroOds.inserir')
    async create(@Body() createOdsDto: CreateOdsDto, @CurrentUser() user: PessoaFromJwt) {
        return await this.odsService.create(createOdsDto, user);
    }

    @ApiBearerAuth('access-token')
    @Get()
    async findAll(): Promise<ListOdsDto> {
        return { 'linhas': await this.odsService.findAll() };
    }

    @Patch(':id')
    @ApiBearerAuth('access-token')
    @ApiUnauthorizedResponse()
    @Roles('CadastroOds.editar')
    async update(@Param() params: FindOneParams, @Body() updateOdsDto: UpdateOdsDto, @CurrentUser() user: PessoaFromJwt) {
        return await this.odsService.update(+params.id, updateOdsDto, user);
    }

    @Delete(':id')
    @ApiBearerAuth('access-token')
    @ApiUnauthorizedResponse()
    @Roles('CadastroOds.remover')
    @ApiNoContentResponse()
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(@Param() params: FindOneParams, @CurrentUser() user: PessoaFromJwt) {
        await this.odsService.remove(+params.id, user);
        return '';
    }
}
