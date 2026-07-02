import {
  IsOptional,
  IsInt,
  Min,
  IsString,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class ListDocumentsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit = 20;

  @IsOptional()
  @IsString()
  sort = 'createdAt';

  @IsOptional()
  @IsEnum(SortOrder)
  order: SortOrder = SortOrder.DESC;

  @IsOptional()
  @IsUUID('4')
  departmentId?: string;
}
