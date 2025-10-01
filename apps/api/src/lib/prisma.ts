import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

// Runtime sanity check: log a clear warning if the generated client does not include expected new models
// This helps catch cases where Prisma client was not regenerated after a schema change
// (e.g. defect_files table added but old node process still using stale @prisma/client build)
// We only log once at startup.
try {
	// @ts-ignore - dynamic access
	if (!(prisma as any).defectFile) {
		// eslint-disable-next-line no-console
		console.warn('[prisma] defectFile delegate is missing. Run: pnpm --filter @qa/api prisma:generate and restart the API process.');
	}
} catch (e) {
	// ignore - defensive
}
