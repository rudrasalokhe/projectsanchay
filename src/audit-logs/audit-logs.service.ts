import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateAuditLogParams {
  actorId?: string;
  entityType: string;
  entityId: string;
  action: string;
  previousStatus?: string;
  newStatus?: string;
  metadata?: any;
}

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(params: CreateAuditLogParams) {
    try {
      return await this.prisma.auditLog.create({
        data: {
          actorId: params.actorId || null,
          entityType: params.entityType,
          entityId: params.entityId,
          action: params.action,
          previousStatus: params.previousStatus || null,
          newStatus: params.newStatus || null,
          metadata: params.metadata || undefined,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to create audit log: ${error.message}`, error.stack);
      // Non-blocking: audit log failure should not crash core transactions, but is logged
      return null;
    }
  }

  async findAll(params?: {
    entityType?: string;
    entityId?: string;
    actorId?: string;
    skip?: number;
    take?: number;
  }) {
    const where: any = {};
    if (params?.entityType) where.entityType = params.entityType;
    if (params?.entityId) where.entityId = params.entityId;
    if (params?.actorId) where.actorId = params.actorId;

    const [total, items] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip: params?.skip || 0,
        take: params?.take || 50,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
            },
          },
        },
      }),
    ]);

    return { total, items };
  }
}

