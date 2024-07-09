import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CreateRelObrasDto } from './dto/create-obras.dto';
import { PPObrasRelatorioDto } from './entities/obras.entity';
import { PPObrasService } from './pp-obras.service';

@ApiTags('Relatórios - API')
@Controller('relatorio/projetos')
export class PPObrasController {
    constructor(private readonly obras: PPObrasService) {}

    @Post()
    @ApiBearerAuth('access-token')
    @Roles(['Reports.executar.Projetos'])
    async create(@Body() createObrasDto: CreateRelObrasDto): Promise<PPObrasRelatorioDto> {
        return await this.obras.asJSON(createObrasDto);
    }
}
