import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole, Document, DocumentPermission } from '@prisma/client';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { DocumentsService } from '../services/documents.service';
import { UploadDocumentDto } from '../dto/upload-document.dto';
import { ListDocumentsDto } from '../dto/list-documents.dto';

interface IExpressUser {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  roleId: string;
  departmentId: string;
  roleName: string;
}

interface DocumentWithPermissions extends Document {
  permissions?: DocumentPermission[];
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @Roles(UserRole.Administrator, UserRole.Manager)
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadDto: UploadDocumentDto,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded.');
    }

    const user = req.user as IExpressUser;

    const targetDeptId = uploadDto.departmentId || user.departmentId;

    const document = await this.documentsService.upload(
      file,
      user.userId,
      targetDeptId,
      uploadDto.tags,
    );

    return {
      success: true,
      message: 'File uploaded, ingestion parsing started.',
      data: {
        documentId: document.id,
        filename: document.filename,
        status: document.status,
        contentHash: document.contentHash,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get()
  async findAll(@Query() query: ListDocumentsDto) {
    const { documents, pagination } =
      await this.documentsService.findMany(query);

    const mappedDocs = documents.map((doc) => ({
      documentId: doc.id,
      filename: doc.filename,
      createdAt: doc.createdAt.toISOString(),
      status: doc.status,
    }));

    return {
      success: true,
      message: 'Documents catalog retrieved.',
      data: {
        documents: mappedDocs,
        pagination,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const doc = await this.documentsService.findOne(id);
    const docWithPerms = doc as DocumentWithPermissions;
    const permission = docWithPerms.permissions?.[0];
    const departmentId = permission?.departmentId || null;

    return {
      success: true,
      message: 'Document metadata retrieved.',
      data: {
        documentId: doc.id,
        filename: doc.filename,
        status: doc.status,
        fileSize: doc.fileSize,
        uploadedById: doc.uploadedById,
        departmentId,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id/status')
  async getStatus(@Param('id', ParseUUIDPipe) id: string) {
    const doc = await this.documentsService.findOne(id);

    return {
      success: true,
      message: 'Document status checked.',
      data: {
        documentId: doc.id,
        status: doc.status,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id')
  @Roles(UserRole.Administrator, UserRole.Manager)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.documentsService.remove(id);

    return {
      success: true,
      message: 'Document and chunks successfully deleted.',
      data: {},
      timestamp: new Date().toISOString(),
    };
  }
}
