import {
  Injectable,
  Inject,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersDto } from './dto/list-users.dto';
import * as UserRepo from './domain/interfaces/user-repository.interface';
import * as RoleRepo from './domain/interfaces/role-repository.interface';
import * as DeptRepo from './domain/interfaces/department-repository.interface';
import { USER_REPOSITORY_TOKEN } from './domain/interfaces/user-repository.interface';
import { ROLE_REPOSITORY_TOKEN } from './domain/interfaces/role-repository.interface';
import { DEPARTMENT_REPOSITORY_TOKEN } from './domain/interfaces/department-repository.interface';
import type { IPasswordService } from '../auth/domain/interfaces/password-service.interface';
import { PASSWORD_SERVICE_TOKEN } from '../auth/domain/interfaces/password-service.interface';

@Injectable()
export class UsersService {
  constructor(
    @Inject(USER_REPOSITORY_TOKEN)
    private readonly userRepository: UserRepo.IUserRepository,
    @Inject(ROLE_REPOSITORY_TOKEN)
    private readonly roleRepository: RoleRepo.IRoleRepository,
    @Inject(DEPARTMENT_REPOSITORY_TOKEN)
    private readonly departmentRepository: DeptRepo.IDepartmentRepository,
    @Inject(PASSWORD_SERVICE_TOKEN)
    private readonly passwordService: IPasswordService,
  ) {}

  async create(dto: CreateUserDto) {
    const existingUser = await this.userRepository.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException(
        'A user with this email address already exists.',
      );
    }

    const role = await this.roleRepository.findById(dto.roleId);
    if (!role) {
      throw new BadRequestException('Role ID not found.');
    }

    const department = await this.departmentRepository.findById(
      dto.departmentId,
    );
    if (!department) {
      throw new BadRequestException('Department ID not found.');
    }

    const passwordHash = await this.passwordService.hash(dto.password);

    const user = await this.userRepository.create({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      roleId: dto.roleId,
      departmentId: dto.departmentId,
    });

    return user;
  }

  async findMany(dto: ListUsersDto) {
    const skip = (dto.page - 1) * dto.limit;
    const take = dto.limit;

    const orderBy = { [dto.sort]: dto.order };
    const where = dto.departmentId
      ? { departmentId: dto.departmentId }
      : undefined;

    const { users, totalCount } = await this.userRepository.findMany({
      skip,
      take,
      orderBy,
      where,
    });

    return {
      users,
      pagination: {
        page: dto.page,
        limit: dto.limit,
        totalCount,
      },
    };
  }

  async findOne(id: string) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }

    if (dto.email && dto.email !== user.email) {
      const existingUser = await this.userRepository.findByEmail(dto.email);
      if (existingUser) {
        throw new ConflictException(
          'A user with this email address already exists.',
        );
      }
    }

    if (dto.roleId) {
      const role = await this.roleRepository.findById(dto.roleId);
      if (!role) {
        throw new BadRequestException('Role ID not found.');
      }
    }

    if (dto.departmentId) {
      const department = await this.departmentRepository.findById(
        dto.departmentId,
      );
      if (!department) {
        throw new BadRequestException('Department ID not found.');
      }
    }

    let passwordHash = user.passwordHash;
    if (dto.password) {
      passwordHash = await this.passwordService.hash(dto.password);
    }

    const updatedUser = await this.userRepository.update(id, {
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      roleId: dto.roleId,
      departmentId: dto.departmentId,
    });

    return updatedUser;
  }

  async remove(id: string) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }
    await this.userRepository.delete(id);
  }
}
