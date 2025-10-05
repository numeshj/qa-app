import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middlewares/auth';

const router = Router();

const projectStatusOptions = ['ongoing', 'completed', 'yet_to_start', 'other'] as const;

const normalize = (value?: string | null) =>
  value?.trim().toLowerCase().replace(/[\s-]+/g, '_') ?? 'unknown';

const humanize = (value: string) =>
  value === 'unknown'
    ? 'Unknown'
    : value
        .split('_')
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' ');

const sumValues = (record: Record<string, number>) =>
  Object.values(record).reduce((acc, value) => acc + value, 0);

const pickCounts = (record: Record<string, number>, keys: string[]) =>
  keys.reduce((acc, key) => acc + (record[key] ?? 0), 0);

const makeCountMap = (
  rows: Array<{ [key: string]: any; _count: { _all: number } }>,
  field: string
) =>
  rows.reduce<Record<string, number>>((acc, row) => {
    const key = normalize(row[field]);
    acc[key] = (acc[key] ?? 0) + row._count._all;
    return acc;
  }, {});

const makeDistribution = (record: Record<string, number>) =>
  Object.entries(record)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => ({ key, label: humanize(key), value }));

const severityWeights: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
  unknown: 0
};

const resolvedStatuses = ['resolved', 'closed'];
const openStatuses = ['open', 'in_progress'];
const reopenedStatuses = ['reopened', 're_opened'];
const deferredStatuses = ['deferred'];
const rejectedStatuses = ['rejected', 'invalid'];
const inProgressStatuses = ['in_progress'];

const passStatuses = ['pass', 'passed', 'success'];
const failStatuses = ['fail', 'failed'];
const blockedStatuses = ['blocked'];
const onHoldStatuses = ['on_hold', 'hold'];
const notExecutedStatuses = ['not_executed', 'not_run', 'pending'];
const notApplicableStatuses = ['not_applicable', 'na'];

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const requestedStatus = typeof req.query.status === 'string' ? normalize(req.query.status) : null;
  const statusFilter = projectStatusOptions.includes(requestedStatus as typeof projectStatusOptions[number])
    ? (requestedStatus as typeof projectStatusOptions[number])
    : null;

  const projectIdParam = typeof req.query.projectId === 'string' ? Number(req.query.projectId) : Array.isArray(req.query.projectId) ? Number(req.query.projectId[0]) : undefined;
  const projectIdFilter = Number.isFinite(projectIdParam) && projectIdParam! > 0 ? projectIdParam! : null;

  const projectWhere: Prisma.ProjectWhereInput = {};
  if (statusFilter) projectWhere.status = statusFilter;
  if (projectIdFilter) projectWhere.id = projectIdFilter;

  const testCaseWhere: Prisma.TestCaseWhereInput = {};
  if (projectIdFilter) testCaseWhere.projectId = projectIdFilter;
  if (statusFilter) testCaseWhere.project = { status: statusFilter };

  const testCaseFileWhere: Prisma.TestCaseFileWhereInput = {};
  if (projectIdFilter) testCaseFileWhere.projectId = projectIdFilter;
  if (statusFilter) testCaseFileWhere.project = { status: statusFilter };

  const defectWhere: Prisma.DefectWhereInput = {};
  if (projectIdFilter) defectWhere.projectId = projectIdFilter;
  if (statusFilter) defectWhere.project = { status: statusFilter };

  const defectFileWhere: Prisma.DefectFileWhereInput = {};
  if (projectIdFilter) defectFileWhere.projectId = projectIdFilter;
  if (statusFilter) defectFileWhere.project = { status: statusFilter };

  const [
    statusCountsAll,
    projectStatusGroup,
    latestProject,
    currentUser,
    testCaseStatusGroup,
    testCaseSeverityGroup,
    latestTestCaseFile,
    defectStatusGroup,
    defectSeverityGroup,
    defectPriorityGroup,
    resolvedBySeverityGroup,
    defectLifecycleDates,
    severityStatusGroup,
    projectsAvailable,
    testCaseFiles,
    defectFiles
  ] = await Promise.all([
    prisma.project.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.project.groupBy({ by: ['status'], _count: { _all: true }, where: projectWhere }),
    prisma.project.findFirst({
      where: projectWhere,
      orderBy: { updatedAt: 'desc' },
      include: { owner: true }
    }),
    req.auth
      ? prisma.user.findUnique({
          where: { id: req.auth.userId },
          select: { firstName: true, lastName: true }
        })
      : null,
    prisma.testCase.groupBy({ by: ['status'], _count: { _all: true }, where: testCaseWhere }),
    prisma.testCase.groupBy({ by: ['severity'], _count: { _all: true }, where: testCaseWhere }),
    prisma.testCaseFile.findFirst({
      where: testCaseFileWhere,
      orderBy: { updatedAt: 'desc' },
      include: { author: true, project: true }
    }),
    prisma.defect.groupBy({ by: ['status'], _count: { _all: true }, where: defectWhere }),
    prisma.defect.groupBy({ by: ['severity'], _count: { _all: true }, where: defectWhere }),
    prisma.defect.groupBy({ by: ['priority'], _count: { _all: true }, where: defectWhere }),
    prisma.defect.groupBy({
      by: ['severity'],
      where: {
        ...defectWhere,
        status: { in: ['resolved', 'closed', 'Resolved', 'Closed'] }
      },
      _count: { _all: true }
    }),
    prisma.defect.findMany({
      where: {
        ...defectWhere,
        reportedDate: { not: null },
        closedDate: { not: null }
      },
      select: { reportedDate: true, closedDate: true }
    }),
    prisma.defect.groupBy({ by: ['severity', 'status'], _count: { _all: true }, where: defectWhere }),
    prisma.project.findMany({
      where: projectWhere,
      orderBy: [{ name: 'asc' }, { code: 'asc' }],
      select: { id: true, name: true, code: true, status: true }
    }),
    prisma.testCaseFile.findMany({
      where: testCaseFileWhere,
      orderBy: [{ updatedAt: 'desc' }],
      include: { project: { select: { id: true, name: true, status: true } } }
    }),
    prisma.defectFile.findMany({
      where: defectFileWhere,
      orderBy: [{ updatedAt: 'desc' }],
      include: { project: { select: { id: true, name: true, status: true } } }
    })
  ]);

  const statusCountsMap = makeCountMap(statusCountsAll, 'status');
  const projectStatusMap = makeCountMap(projectStatusGroup, 'status');
  const testCaseStatusMap = makeCountMap(testCaseStatusGroup, 'status');
  const testCaseSeverityMap = makeCountMap(testCaseSeverityGroup, 'severity');
  const defectStatusMap = makeCountMap(defectStatusGroup, 'status');
  const defectSeverityMap = makeCountMap(defectSeverityGroup, 'severity');
  const defectPriorityMap = makeCountMap(defectPriorityGroup, 'priority');
  const resolvedSeverityMap = makeCountMap(resolvedBySeverityGroup, 'severity');

  const totalProjects = sumValues(projectStatusMap);
  const totalTestCases = sumValues(testCaseStatusMap);
  const totalDefects = sumValues(defectStatusMap);

  const ongoingProjects = pickCounts(projectStatusMap, ['ongoing']);

  const executedTestCases = pickCounts(testCaseStatusMap, [
    ...passStatuses,
    ...failStatuses,
    ...blockedStatuses,
    ...onHoldStatuses
  ]);
  const passedTestCases = pickCounts(testCaseStatusMap, passStatuses);
  const failedTestCases = pickCounts(testCaseStatusMap, failStatuses);
  const blockedTestCases = pickCounts(testCaseStatusMap, blockedStatuses);
  const onHoldTestCases = pickCounts(testCaseStatusMap, onHoldStatuses);
  const notExecutedTestCases = pickCounts(testCaseStatusMap, notExecutedStatuses);
  const notApplicableTestCases = pickCounts(testCaseStatusMap, notApplicableStatuses);

  const passRate = executedTestCases
    ? (passedTestCases / executedTestCases) * 100
    : 0;

  const openDefects = pickCounts(defectStatusMap, openStatuses);
  const resolvedDefects = pickCounts(defectStatusMap, resolvedStatuses);
  const reopenedDefects = pickCounts(defectStatusMap, reopenedStatuses);
  const inProgressDefects = pickCounts(defectStatusMap, inProgressStatuses);
  const deferredDefects = pickCounts(defectStatusMap, deferredStatuses);
  const rejectedDefects = pickCounts(defectStatusMap, rejectedStatuses);

  const severityBreakdown = Object.entries(defectSeverityMap).map(
    ([key, count]) => {
      const weight = severityWeights[key] ?? 0;
      const resolved = resolvedSeverityMap[key] ?? 0;
      const unresolved = Math.max(count - resolved, 0);
      return {
        key,
        label: humanize(key),
        total: count,
        weight,
        resolved,
        unresolved,
        unresolvedWeighted: unresolved * weight,
        totalWeighted: count * weight
      };
    }
  );

  const totalSeverityCount = severityBreakdown.reduce(
    (acc, item) => acc + item.total,
    0
  );
  const weightedSeverityTotal = severityBreakdown.reduce(
    (acc, item) => acc + item.totalWeighted,
    0
  );
  const unresolvedSeverityCount = severityBreakdown.reduce(
    (acc, item) => acc + item.unresolved,
    0
  );
  const unresolvedWeightedTotal = severityBreakdown.reduce(
    (acc, item) => acc + item.unresolvedWeighted,
    0
  );

  const finalSeverityIndex = totalSeverityCount
    ? weightedSeverityTotal / totalSeverityCount
    : 0;
  const currentSeverityIndex = unresolvedSeverityCount
    ? unresolvedWeightedTotal / unresolvedSeverityCount
    : finalSeverityIndex;

  const severityIndexValue = Number(currentSeverityIndex.toFixed(3));

  const severityInterpretation =
    severityIndexValue < 1.5
      ? 'Good – majority of defects are low severity'
      : severityIndexValue <= 2
        ? 'Acceptable – mix of medium and low defects'
        : 'Concerning – high severity defects dominate';

  const resolutionDurations = defectLifecycleDates
    .map((entry) => {
      const { closedDate, reportedDate } = entry;
      if (!closedDate || !reportedDate) return null;
      const diff =
        (closedDate.getTime() - reportedDate.getTime()) /
        (1000 * 60 * 60 * 24);
      return Math.max(diff, 0);
    })
    .filter((value): value is number => value !== null);

  const averageResolutionDays = resolutionDurations.length
    ? resolutionDurations.reduce((acc, value) => acc + value, 0) /
      resolutionDurations.length
    : 0;

  const severityStatusMatrix = severityStatusGroup.reduce(
    (acc, row) => {
      const severityKey = normalize(row.severity);
      const statusKey = normalize(row.status);
      if (!acc[severityKey]) acc[severityKey] = {};
      acc[severityKey][statusKey] =
        (acc[severityKey][statusKey] ?? 0) + row._count._all;
      return acc;
    },
    {} as Record<string, Record<string, number>>
  );

  const severityMatrix = Object.entries(severityStatusMatrix).map(
    ([severityKey, statusCounts]) => ({
      severityKey,
      severityLabel: humanize(severityKey),
      open: pickCounts(statusCounts, openStatuses),
      closed: pickCounts(statusCounts, resolvedStatuses),
      deferred: pickCounts(statusCounts, deferredStatuses)
    })
  );

  const summaryCards = [
    { key: 'projects_total', title: 'Projects', value: totalProjects },
    { key: 'projects_ongoing', title: 'Ongoing Projects', value: ongoingProjects },
    { key: 'test_cases_total', title: 'Test Cases', value: totalTestCases },
    {
      key: 'test_cases_executed',
      title: 'Executed Test Cases',
      value: executedTestCases
    },
    {
      key: 'test_case_pass_rate',
      title: 'Test Case Pass Rate',
      value: Number(passRate.toFixed(1)),
      unit: '%'
    },
    { key: 'defects_total', title: 'Defects Logged', value: totalDefects },
    { key: 'defects_open', title: 'Open Defects', value: openDefects },
    { key: 'defects_resolved', title: 'Resolved Defects', value: resolvedDefects },
    {
      key: 'defects_reopened',
      title: 'Reopened Defects',
      value: reopenedDefects
    },
    {
      key: 'defect_resolution_time',
      title: 'Avg. Resolution (days)',
      value: Number(averageResolutionDays.toFixed(1))
    }
  ];

  const preparedBy = currentUser
    ? `${currentUser.firstName} ${currentUser.lastName}`.trim()
    : null;

  const projectInfo = latestProject
    ? {
        name: latestProject.name,
        code: latestProject.code,
        pm: latestProject.owner
          ? `${latestProject.owner.firstName} ${latestProject.owner.lastName}`.trim()
          : null,
        ba: null,
        qal: null,
        preparedBy,
        dateCreated: latestProject.createdAt.toISOString(),
        accessLevel: 'Internal'
      }
    : null;

  const testCaseSummary = {
    meta: latestTestCaseFile
      ? {
          name: latestTestCaseFile.name,
          project: latestTestCaseFile.project?.name ?? null,
          author: latestTestCaseFile.author
            ? `${latestTestCaseFile.author.firstName} ${latestTestCaseFile.author.lastName}`.trim()
            : null,
          version: latestTestCaseFile.version,
          environment: latestTestCaseFile.environment,
          release: latestTestCaseFile.releaseBuild,
          refer: latestTestCaseFile.refer,
          createdAt: latestTestCaseFile.createdAt.toISOString(),
          updatedAt: latestTestCaseFile.updatedAt.toISOString()
        }
      : null,
    severityCounts: makeDistribution(testCaseSeverityMap),
    statusCounts: makeDistribution(testCaseStatusMap),
    totals: {
      total: totalTestCases,
      executed: executedTestCases,
      passed: passedTestCases,
      failed: failedTestCases,
      blocked: blockedTestCases,
      onHold: onHoldTestCases,
      notExecuted: notExecutedTestCases,
      notApplicable: notApplicableTestCases,
      passRate: Number(passRate.toFixed(1))
    }
  };

  const defectOverview = {
    statusDistribution: makeDistribution(defectStatusMap),
    priorityDistribution: makeDistribution(defectPriorityMap),
    severityDistribution: makeDistribution(defectSeverityMap),
    severityIndex: {
      value: severityIndexValue,
      interpretation: severityInterpretation,
      breakdown: severityBreakdown.map((item) => ({
        key: item.key,
        label: item.label,
        total: item.total,
        weight: item.weight,
        resolved: item.resolved,
        unresolved: item.unresolved,
        unresolvedWeighted: item.unresolvedWeighted
      }))
    },
    matrix: severityMatrix,
    totals: {
      open: openDefects,
      resolved: resolvedDefects,
      reopened: reopenedDefects,
      inProgress: inProgressDefects,
      deferred: deferredDefects,
      rejected: rejectedDefects,
      total: totalDefects
    }
  };

  const statusOptions = projectStatusOptions.map((value) => ({
    value,
    label: humanize(value),
    count: statusCountsMap[value] ?? 0
  }));

  const projectButtons = projectsAvailable.map((project) => ({
    id: project.id,
    name: project.name,
    code: project.code,
    status: project.status
  }));

  const testCaseFileButtons = testCaseFiles.map((file) => ({
    id: file.id,
    name: file.name,
    projectId: file.projectId,
    projectName: file.project?.name ?? null,
    projectStatus: file.project?.status ?? null,
    version: file.version,
    environment: file.environment,
    release: file.releaseBuild,
    updatedAt: file.updatedAt.toISOString()
  }));

  const defectFileButtons = defectFiles.map((file) => ({
    id: file.id,
    name: file.name,
    projectId: file.projectId,
    projectName: file.project?.name ?? null,
    projectStatus: file.project?.status ?? null,
    version: file.version,
    environment: file.environment,
    release: file.releaseBuild,
    updatedAt: file.updatedAt.toISOString()
  }));

  res.json({
    success: true,
    data: {
      updatedAt: new Date().toISOString(),
      filters: {
        status: statusFilter,
        projectId: projectIdFilter
      },
      statusOptions,
      projects: projectButtons,
      testCaseFiles: testCaseFileButtons,
      defectFiles: defectFileButtons,
      summaryCards,
      projectInfo,
      defectOverview,
      testCaseSummary
    }
  });
});

export default router;
