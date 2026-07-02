import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsUUID,
  IsStrongPassword,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail({}, { message: 'email must be a valid email address' })
  @IsNotEmpty()
  email!: string;

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
  @IsNotEmpty()
  password!: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsUUID('4')
  @IsNotEmpty()
  roleId!: string;

  @IsUUID('4')
  @IsNotEmpty()
  departmentId!: string;
}
