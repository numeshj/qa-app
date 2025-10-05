import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma';

export interface AuditLogPayload {
  entity: string;
  entityId: number;
  action: string;
  before?: unknown;
  after?: unknown;
  userId?: number | null;
}

type PrismaExecutor = PrismaClient | Prisma.TransactionClient;

export async function recordAuditLog({
  entity,
  entityId,
  action,
  before,
  after,
  userId
}: AuditLogPayload, client: PrismaExecutor = prisma): Promise<void> {
  try {
    await (client as Prisma.TransactionClient | PrismaClient).auditLog.create({
      data: {
        entityType: entity,
        entityId,
        action,
        beforeJson: before as any,
        afterJson: after as any,
        userId: userId ?? undefined
      }
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[audit] failed to record log', { entity, entityId, action, error });
  }
}
