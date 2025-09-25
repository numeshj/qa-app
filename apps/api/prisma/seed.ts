import { prisma } from '../src/lib/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  const roleNames = ['Admin','QA','Developer','PM','BA'];
  const roles = await Promise.all(roleNames.map(name => prisma.role.upsert({ where: { name }, update: {}, create: { name } })));

  const adminEmail = 'admin@example.com';
  const passwordHash = await bcrypt.hash('TempPass123!', 10);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: { email: adminEmail, passwordHash, firstName: 'Admin', lastName: 'User' }
  });

  // link admin to Admin role
  const adminRole = roles.find(r => r.name === 'Admin')!;
  await prisma.userRole.upsert({ where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } }, update: {}, create: { userId: admin.id, roleId: adminRole.id } });

  // sample project
  const project = await prisma.project.upsert({ where: { code: 'PRJ1' }, update: {}, create: { code: 'PRJ1', name: 'Sample Project', description: 'Demo project', ownerId: admin.id } });

  await prisma.testCase.upsert({
    where: { projectId_testCaseIdCode: { projectId: project.id, testCaseIdCode: 'TC-1' } },
    update: {},
    create: { projectId: project.id, testCaseIdCode: 'TC-1', description: 'Login works', severity: 'High', complexity: 'Low', createdById: admin.id }
  });

  await prisma.defect.upsert({
    where: { projectId_defectIdCode: { projectId: project.id, defectIdCode: 'DEF-1' } },
    update: {},
    create: { projectId: project.id, defectIdCode: 'DEF-1', title: 'Login button misaligned', severity: 'medium', priority: 'medium', reportedById: admin.id }
  });

  console.log('Seed complete');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
