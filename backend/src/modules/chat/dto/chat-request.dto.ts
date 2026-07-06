import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class ChatRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  message!: string;

  @IsOptional()
  @IsUUID('4')
  chatSessionId?: string;
}
