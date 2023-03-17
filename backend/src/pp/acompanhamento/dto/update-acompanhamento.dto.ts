import { OmitType, PartialType } from "@nestjs/mapped-types";
import { CreateProjetoAcompanhamentoDto } from "./create-acompanhamento.dto";

export class UpdateProjetoAcompanhamentoDto extends OmitType(PartialType(CreateProjetoAcompanhamentoDto), []) {}