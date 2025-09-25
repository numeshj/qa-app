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

  // lookup values (dynamic dropdowns)
  const lookups: { category: string; code: string; sortOrder: number }[] = [
    // severities
    { category: 'defect_severity', code: 'highest', sortOrder: 1 },
    { category: 'defect_severity', code: 'high', sortOrder: 2 },
    { category: 'defect_severity', code: 'medium', sortOrder: 3 },
    { category: 'defect_severity', code: 'low', sortOrder: 4 },
    { category: 'priority', code: 'highest', sortOrder: 1 },
    { category: 'priority', code: 'high', sortOrder: 2 },
    { category: 'priority', code: 'medium', sortOrder: 3 },
    { category: 'priority', code: 'low', sortOrder: 4 },
    { category: 'testcase_severity', code: 'High', sortOrder: 1 },
    { category: 'testcase_severity', code: 'Medium', sortOrder: 2 },
    { category: 'testcase_severity', code: 'Low', sortOrder: 3 },
    { category: 'testcase_complexity', code: 'High', sortOrder: 1 },
    { category: 'testcase_complexity', code: 'Medium', sortOrder: 2 },
    { category: 'testcase_complexity', code: 'Low', sortOrder: 3 },
    { category: 'project_status', code: 'active', sortOrder: 1 },
    { category: 'project_status', code: 'completed', sortOrder: 2 },
    { category: 'project_status', code: 'on_hold', sortOrder: 3 },
    { category: 'defect_status', code: 'open', sortOrder: 1 },
    { category: 'defect_status', code: 'inprogress', sortOrder: 2 },
    { category: 'defect_status', code: 'resolved', sortOrder: 3 },
    { category: 'defect_status', code: 'reopened', sortOrder: 4 },
    { category: 'defect_status', code: 'rejected', sortOrder: 5 },
    { category: 'testcase_status', code: 'Pass', sortOrder: 1 },
    { category: 'testcase_status', code: 'Fail', sortOrder: 2 },
    { category: 'testcase_status', code: 'On_Hold', sortOrder: 3 },
    { category: 'testcase_status', code: 'Not_Applicable', sortOrder: 4 },
    { category: 'testcase_status', code: 'Cannot_be_Executed', sortOrder: 5 },
    { category: 'testcase_status', code: 'Blocked', sortOrder: 6 }
  ];

  for (const l of lookups) {
    await prisma.lookupValue.upsert({ where: { category_code: { category: l.category, code: l.code } }, update: {}, create: { category: l.category, code: l.code, sortOrder: l.sortOrder } });
  }

  console.log('Seed complete');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
