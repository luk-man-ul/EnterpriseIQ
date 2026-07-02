import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { IPasswordService } from '../domain/interfaces/password-service.interface';

@Injectable()
export class PasswordService implements IPasswordService {
  private readonly saltRounds = 12;

  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
