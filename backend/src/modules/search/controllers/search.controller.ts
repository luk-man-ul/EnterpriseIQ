import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { SearchService } from '../services/search.service';
import { SearchRequestDto } from '../dto/search-request.dto';
import { SearchResponseDto } from '../dto/search-response.dto';

interface IExpressUser {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  roleId: string;
  departmentId: string;
  roleName: string;
}

@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async search(
    @Body() dto: SearchRequestDto,
    @Req() req: Request,
  ): Promise<{
    success: boolean;
    message: string;
    data: SearchResponseDto;
    timestamp: string;
  }> {
    const user = req.user as IExpressUser;

    const result = await this.searchService.search(dto, {
      userRoleId: user.roleId,
      userDepartmentId: user.departmentId,
      roleName: user.roleName,
    });

    return {
      success: true,
      message: 'Semantic search executed successfully.',
      data: result,
      timestamp: new Date().toISOString(),
    };
  }
}
