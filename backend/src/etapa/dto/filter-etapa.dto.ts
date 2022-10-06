import { ApiHideProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsOptional, IsPositive } from "class-validator";

export class FilterEtapaDto {
    /**
   * Filtrar por etapa_pai_id?
   * @example "1"
    */
    @IsOptional()
    @IsPositive({ message: '$property| etapa_pai_id' })
    @Type(() => Number)
    etapa_pai_id?: number;

    /**
    * Filtrar por regiao_id?
    * @example "1"
    */
    @IsOptional()
    @IsPositive({ message: '$property| regiao_id' })
    @Type(() => Number)
    regiao_id?: number;

    /**
    * Filtrar por cronograma_id?
    * @example "1"
    */
    @IsOptional()
    @IsPositive({ message: '$property| cronograma_id' })
    @Type(() => Number)
    cronograma_id?: number;

    /**
  * Filtrar por cronograma_id?
  * @example "1"
   */
    @IsOptional()
    @IsPositive({ message: '$property| cronograma_pai_id' })
    @Type(() => Number)
    cronograma_pai_id?: number;

}

export class FilterCronogramaEtapaDto {
    /**
   * Filtrar por etapa_pai_id?
   * @example "1"
    */
    @IsOptional()
    @IsPositive({ message: '$property| etapa_pai_id' })
    @Type(() => Number)
    etapa_pai_id?: number;

    /**
    * Filtrar por regiao_id?
    * @example "1"
    */
    @IsOptional()
    @IsPositive({ message: '$property| regiao_id' })
    @Type(() => Number)
    regiao_id?: number;

    /**
    * Filtrar por cronograma_id?
    * @example "1"
    */
    @IsOptional()
    @ApiHideProperty()
    @IsPositive({ message: '$property| cronograma_id' })
    @Type(() => Number)
    cronograma_id: number;
}