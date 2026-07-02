import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserRole, User } from '@prisma/client';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Administrator)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto);
    return {
      success: true,
      message: 'User created successfully.',
      data: {
        userId: user.id,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get()
  async findAll(@Query() query: ListUsersDto) {
    const { users, pagination } = await this.usersService.findMany(query);
    const mappedUsers = users.map((user) => this.mapUserResponse(user));
    return {
      success: true,
      message: 'Users list retrieved.',
      data: {
        users: mappedUsers,
        pagination,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.usersService.findOne(id);
    return {
      success: true,
      message: 'User details retrieved.',
      data: this.mapUserResponse(user),
      timestamp: new Date().toISOString(),
    };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const user = await this.usersService.update(id, updateUserDto);
    return {
      success: true,
      message: 'User updated successfully.',
      data: {
        userId: user.id,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.usersService.remove(id);
    return {
      success: true,
      message: 'User deleted successfully.',
      data: {},
      timestamp: new Date().toISOString(),
    };
  }

  private mapUserResponse(user: User) {
    return {
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roleId: user.roleId,
      departmentId: user.departmentId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
