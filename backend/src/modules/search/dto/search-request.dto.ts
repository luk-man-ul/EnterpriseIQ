import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SearchRequestDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  query!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 5;

  @IsOptional()
  @IsNumber()
  @Min(-1)
  @Max(1)
  @Type(() => Number)
  threshold?: number;
}
