import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  IsStrongPassword,
} from 'class-validator';

export class UpdateUserDto {
  @IsEmail({}, { message: 'email must be a valid email address' })
  @IsOptional()
  email?: string;

  @IsStrongPassword(
    {
      minLength: 12,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1,
    },
    {
      message:
        'password must be at least 12 characters and contain uppercase, lowercase, numbers, and special characters.',
    },
  )
  @IsOptional()
  password?: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsUUID('4')
  @IsOptional()
  roleId?: string;

  @IsUUID('4')
  @IsOptional()
  departmentId?: string;
}
