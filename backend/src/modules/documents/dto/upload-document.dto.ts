import { IsOptional, IsUUID, IsString } from 'class-validator';

export class UploadDocumentDto {
  @IsOptional()
  @IsUUID('4', { message: 'departmentId must be a valid UUID' })
  departmentId?: string;

  @IsOptional()
  @IsString({ message: 'tags must be a string' })
  tags?: string;
}
