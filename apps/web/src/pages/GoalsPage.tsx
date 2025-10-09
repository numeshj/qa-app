import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  DatePicker,
  Divider,
  Empty,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Popconfirm,
  Progress,
  Row,
  Select,
  Slider,
  Space,
  Statistic,
  Tabs,
  Tag,
  Timeline,
  Tooltip,
  Typography,
  message
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  HistoryOutlined,
  LineChartOutlined,
  PlusOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { PageTestHarness, type PageTestCase } from '../testing/PageTestHarness';
import { api } from '../api/client';
import dayjs, { type Dayjs } from 'dayjs';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import isoWeek from 'dayjs/plugin/isoWeek';
import relativeTime from 'dayjs/plugin/relativeTime';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import './GoalsPage.css';

import type { SliderMarks } from 'antd/es/slider';

const { Title, Paragraph, Text } = Typography;

dayjs.extend(advancedFormat);
dayjs.extend(isoWeek);
dayjs.extend(weekOfYear);
dayjs.extend(relativeTime);

const STORAGE_KEY = 'qa-app/goals/state-v2';
const focusColorPalette = ['#0ea5e9', '#22c55e', '#f97316', '#a855f7', '#facc15', '#ef4444', '#14b8a6'];

const weeklyStatusOptions = ['planned', 'on_track', 'at_risk', 'completed', 'deferred'] as const;
type WeeklyStatus = (typeof weeklyStatusOptions)[number];

const weeklyStatusMeta: Record<WeeklyStatus, { label: string; tagColor: string }> = {
  planned: { label: 'Planned', tagColor: 'geekblue' },
  on_track: { label: 'On Track', tagColor: 'success' },
  at_risk: { label: 'At Risk', tagColor: 'volcano' },
  completed: { label: 'Completed', tagColor: 'green' },
  deferred: { label: 'Deferred', tagColor: 'magenta' }
};

const dailyStatusOptions = ['not_started', 'in_progress', 'done', 'blocked'] as const;
type DailyStatus = (typeof dailyStatusOptions)[number];

const dailyStatusMeta: Record<DailyStatus, { label: string; tagColor: string }> = {
  not_started: { label: 'Not Started', tagColor: 'default' },
  in_progress: { label: 'In Progress', tagColor: 'processing' },
  done: { label: 'Completed', tagColor: 'success' },
  blocked: { label: 'Blocked', tagColor: 'magenta' }
};

const dailyStatusScore: Record<DailyStatus, number> = {
  not_started: 0,
  in_progress: 0.5,
  done: 1,
  blocked: 0
};

type FocusArea = {
  id: string;
  name: string;
  description?: string;
  weight: number;
  color: string;
  archived?: boolean;
};

type WeeklyGoal = {
  id: string;
  focusAreaId: string | null;
  title: string;
  metric?: string;
  progress: number;
  status: WeeklyStatus;
  impact: number;
  owner?: string;
  notes?: string;
  updateSummary?: string;
  changeNotes?: string;
  reviewerNotes?: string;
  testFiles?: string[];
  defectFiles?: string[];
  updatedAt: string;
};

type WeeklyReview = {
  overallScore: number;
  morale: number;
  highlights: string;
  adjustments: string;
  updatedAt: string;
};

type WeeklyPlan = {
  weekStart: string;
  goals: WeeklyGoal[];
  theme?: string;
  review?: WeeklyReview;
  summaryNote?: string;
  updatedAt: string;
};

type DailyEntry = {
  id: string;
  focusAreaId: string | null;
  title: string;
  status: DailyStatus;
  impact: number;
  effort: number;
  notes?: string;
  updateSummary?: string;
  comment?: string;
  testFiles?: string[];
  defectFiles?: string[];
  createdAt: string;
  updatedAt: string;
};

type DailyReview = {
  energy: number;
  clarity: number;
  highlight: string;
  blockers: string;
  tomorrow: string;
  updatedAt: string;
};

type DailyPlan = {
  date: string;
  entries: DailyEntry[];
  review?: DailyReview;
  dayNote?: string;
  updatedAt: string;
};

type LinkedTestCaseFile = {
  id: number;
  name: string;
  version?: string | null;
  environment?: string | null;
  project?: { code?: string | null; name?: string | null } | null;
};

type LinkedDefectFile = {
  id: number;
  name: string;
  version?: string | null;
  environment?: string | null;
  project?: { code?: string | null; name?: string | null } | null;
};

type ListResponse<T> = {
  success: boolean;
  data: T[];
};

const formatTestCaseFileLabel = (file: LinkedTestCaseFile): string => {
  const segments = [file.name];
  if (file.version) segments.push(`v${file.version}`);
  if (file.project?.code) segments.push(`· ${file.project.code}`);
  return segments.join(' ');
};

const formatDefectFileLabel = (file: LinkedDefectFile): string => {
  const segments = [file.name];
  if (file.version) segments.push(`v${file.version}`);
  if (file.project?.code) segments.push(`· ${file.project.code}`);
  return segments.join(' ');
};

type GoalsState = {
  focusAreas: FocusArea[];
  weekly: Record<string, WeeklyPlan>;
  daily: Record<string, DailyPlan>;
  lastSavedAt?: string;
};

type FocusAreaFormValues = {
  name: string;
  description?: string;
  weight?: number;
};

type WeeklyGoalFormValues = {
  title: string;
  focusAreaId?: string;
  metric?: string;
  status: WeeklyStatus;
  progress: number;
  impact: number;
  owner?: string;
  notes?: string;
  updateSummary?: string;
  changeNotes?: string;
  reviewerNotes?: string;
  testFiles?: string[];
  defectFiles?: string[];
};

type WeeklyReviewFormValues = {
  summaryNote?: string;
};

type DailyEntryFormValues = {
  title: string;
  focusAreaId?: string;
  status: DailyStatus;
  impact: number;
  effort: number;
  notes?: string;
  updateSummary?: string;
  comment?: string;
  testFiles?: string[];
  defectFiles?: string[];
};

type DailyReviewFormValues = {
  dayNote?: string;
};

const makeId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
const nowIso = () => new Date().toISOString();

const isWeeklyStatus = (value?: unknown): value is WeeklyStatus =>
  typeof value === 'string' && weeklyStatusOptions.includes(value as WeeklyStatus);

const isDailyStatus = (value?: unknown): value is DailyStatus =>
  typeof value === 'string' && dailyStatusOptions.includes(value as DailyStatus);

const normalizeWeights = (areas: FocusArea[]): FocusArea[] => {
  if (!areas.length) return [];
  const total = areas.reduce((acc, area) => acc + (Number.isFinite(area.weight) ? area.weight : 0), 0);
  if (total === 0) {
    const evenShare = Math.floor(100 / areas.length);
    let remainder = 100;
    return areas.map((area, index) => {
      const weight = index === areas.length - 1 ? remainder : evenShare;
      remainder -= weight;
      return { ...area, weight };
    });
  }
  let remainder = 100;
  return areas.map((area, index) => {
    const ratio = area.weight / total;
    let weight = index === areas.length - 1 ? remainder : Math.max(0, Math.min(100, Math.round(ratio * 100)));
    if (weight > remainder) weight = remainder;
    remainder -= weight;
    return { ...area, weight };
  });
};

const createDefaultState = (): GoalsState => {
  const templates: Array<Pick<FocusArea, 'name' | 'description' | 'weight'>> = [
    {
      name: 'Quality Coverage',
      description: 'Regression, exploratory and automation coverage for key products.',
      weight: 40
    },
    {
      name: 'Defect Response',
      description: 'Detection, triage and closure of high-impact issues.',
      weight: 35
    },
    {
      name: 'Process Excellence',
      description: 'Reviews, documentation and continuous improvement initiatives.',
      weight: 25
    }
  ];

  const focusAreas = templates.map((template, index) => ({
    id: makeId('focus'),
    name: template.name,
    description: template.description,
    weight: template.weight,
    color: focusColorPalette[index % focusColorPalette.length]
  }));

  return {
    focusAreas: normalizeWeights(focusAreas),
    weekly: {},
    daily: {},
    lastSavedAt: nowIso()
  };
};

const migrateState = (raw: unknown): GoalsState => {
  if (!raw || typeof raw !== 'object') return createDefaultState();
  const parsed = raw as Partial<GoalsState>;

  const focusAreas = Array.isArray(parsed.focusAreas)
    ? parsed.focusAreas.map((area, index) => ({
        id: area?.id ?? makeId('focus'),
        name: typeof area?.name === 'string' ? area.name : `Focus ${index + 1}`,
        description: typeof area?.description === 'string' ? area.description : '',
        weight: typeof area?.weight === 'number' ? Math.max(0, Math.round(area.weight)) : Math.round(100 / ((parsed.focusAreas?.length || 1))),
        color: typeof area?.color === 'string' ? area.color : focusColorPalette[index % focusColorPalette.length],
        archived: Boolean(area?.archived)
      }))
    : createDefaultState().focusAreas;

  const normalizedAreas = normalizeWeights(focusAreas);

  const weekly: Record<string, WeeklyPlan> = {};
  if (parsed.weekly && typeof parsed.weekly === 'object') {
    Object.entries(parsed.weekly).forEach(([key, value]) => {
      if (!value || typeof value !== 'object') return;
      const plan = value as Partial<WeeklyPlan>;
      weekly[key] = {
        weekStart:
          typeof plan.weekStart === 'string'
            ? plan.weekStart
            : dayjs().startOf('isoWeek').toISOString(),
        goals: Array.isArray(plan.goals)
          ? plan.goals.map((goal, index) => ({
              id: goal?.id ?? makeId('wgoal'),
              focusAreaId: typeof goal?.focusAreaId === 'string' ? goal.focusAreaId : null,
              title: typeof goal?.title === 'string' ? goal.title : `Weekly goal ${index + 1}`,
              metric: typeof goal?.metric === 'string' ? goal.metric : '',
              progress: typeof goal?.progress === 'number' ? Math.max(0, Math.min(100, Math.round(goal.progress))) : 0,
              status: isWeeklyStatus(goal?.status) ? goal.status : 'planned',
              impact: typeof goal?.impact === 'number' ? Math.max(1, Math.min(5, Math.round(goal.impact))) : 3,
              owner: typeof goal?.owner === 'string' ? goal.owner : '',
              notes: typeof goal?.notes === 'string' ? goal.notes : '',
              updatedAt: typeof goal?.updatedAt === 'string' ? goal.updatedAt : nowIso()
            }))
          : [],
        theme: typeof plan.theme === 'string' ? plan.theme : '',
        review: plan.review
          ? {
              overallScore:
                typeof plan.review.overallScore === 'number'
                  ? Math.max(0, Math.min(100, Math.round(plan.review.overallScore)))
                  : 0,
              morale:
                typeof plan.review.morale === 'number'
                  ? Math.max(0, Math.min(10, Math.round(plan.review.morale)))
                  : 5,
              highlights: typeof plan.review.highlights === 'string' ? plan.review.highlights : '',
              adjustments: typeof plan.review.adjustments === 'string' ? plan.review.adjustments : '',
              updatedAt: typeof plan.review.updatedAt === 'string' ? plan.review.updatedAt : nowIso()
            }
          : undefined,
        updatedAt: typeof plan.updatedAt === 'string' ? plan.updatedAt : nowIso()
      };
    });
  }

  const daily: Record<string, DailyPlan> = {};
  if (parsed.daily && typeof parsed.daily === 'object') {
    Object.entries(parsed.daily).forEach(([key, value]) => {
      if (!value || typeof value !== 'object') return;
      const plan = value as Partial<DailyPlan>;
      daily[key] = {
        date: typeof plan.date === 'string' ? plan.date : dayjs(key).toISOString(),
        entries: Array.isArray(plan.entries)
          ? plan.entries.map((entry, index) => ({
              id: entry?.id ?? makeId('dentry'),
              focusAreaId: typeof entry?.focusAreaId === 'string' ? entry.focusAreaId : null,
              title: typeof entry?.title === 'string' ? entry.title : `Daily item ${index + 1}`,
              status: isDailyStatus(entry?.status) ? entry.status : 'not_started',
              impact: typeof entry?.impact === 'number' ? Math.max(1, Math.min(5, Math.round(entry.impact))) : 3,
              effort: typeof entry?.effort === 'number' ? Math.max(1, Math.min(5, Math.round(entry.effort))) : 2,
              notes: typeof entry?.notes === 'string' ? entry.notes : '',
              createdAt: typeof entry?.createdAt === 'string' ? entry.createdAt : nowIso(),
              updatedAt: typeof entry?.updatedAt === 'string' ? entry.updatedAt : nowIso()
            }))
          : [],
        review: plan.review
          ? {
              energy:
                typeof plan.review.energy === 'number'
                  ? Math.max(0, Math.min(10, Math.round(plan.review.energy)))
                  : 5,
              clarity:
                typeof plan.review.clarity === 'number'
                  ? Math.max(0, Math.min(10, Math.round(plan.review.clarity)))
                  : 5,
              highlight: typeof plan.review.highlight === 'string' ? plan.review.highlight : '',
              blockers: typeof plan.review.blockers === 'string' ? plan.review.blockers : '',
              tomorrow: typeof plan.review.tomorrow === 'string' ? plan.review.tomorrow : '',
              updatedAt: typeof plan.review.updatedAt === 'string' ? plan.review.updatedAt : nowIso()
            }
          : undefined,
        updatedAt: typeof plan.updatedAt === 'string' ? plan.updatedAt : nowIso()
      };
    });
  }

  return {
    focusAreas: normalizedAreas,
    weekly,
    daily,
    lastSavedAt: parsed.lastSavedAt ?? nowIso()
  };
};

const computeWeeklyWeightedScore = (focusAreas: FocusArea[], goals: WeeklyGoal[]): number => {
  if (!focusAreas.length || !goals.length) return 0;
  const totalWeight = focusAreas.reduce((acc, area) => acc + area.weight, 0) || 1;
  const weightFactor = 100 / totalWeight;
  const weighted = focusAreas.reduce((sum, area) => {
    const assigned = goals.filter((goal) => goal.focusAreaId === area.id);
    if (!assigned.length) return sum;
    const completion = assigned.reduce((acc, goal) => acc + goal.progress, 0) / (assigned.length * 100);
    return sum + completion * area.weight;
  }, 0);
  return Math.round(weighted * weightFactor);
};

const computeDailyWeightedScore = (focusAreas: FocusArea[], entries: DailyEntry[]): number => {
  if (!focusAreas.length || !entries.length) return 0;
  const totalWeight = focusAreas.reduce((acc, area) => acc + area.weight, 0) || 1;
  const weightFactor = 100 / totalWeight;
  const weighted = focusAreas.reduce((sum, area) => {
    const tasks = entries.filter((entry) => entry.focusAreaId === area.id);
    if (!tasks.length) return sum;
    const totalImpact = tasks.reduce((acc, entry) => acc + entry.impact, 0) || 1;
    const completion =
      tasks.reduce((acc, entry) => acc + dailyStatusScore[entry.status] * entry.impact, 0) / totalImpact;
    return sum + completion * area.weight;
  }, 0);
  return Math.round(weighted * weightFactor);
};

const formatWeekRange = (weekStartIso: string) => {
  const start = dayjs(weekStartIso).startOf('day');
  const end = start.add(6, 'day');
  return `${start.format('MMM D')} – ${end.format('MMM D, YYYY')}`;
};

const formatIsoDate = (iso: string) => dayjs(iso).format('dddd, MMM D, YYYY');

const getWeekKey = (week: Dayjs) => week.startOf('isoWeek').format('YYYY-[W]WW');

const usePersistentGoalsState = (): readonly [GoalsState, React.Dispatch<React.SetStateAction<GoalsState>>] => {
  const [state, setState] = useState<GoalsState>(() => {
    if (typeof window === 'undefined') return createDefaultState();
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return migrateState(parsed);
      }
    } catch (error) {
      console.warn('Unable to restore Goals state, using defaults.', error);
    }
    return createDefaultState();
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ...state,
          lastSavedAt: nowIso()
        })
      );
    } catch (error) {
      console.error('Unable to persist goals state', error);
    }
  }, [state]);

  return [state, setState] as const;
};

const GoalsPage = () => {
  const [state, setState] = usePersistentGoalsState();

  const [selectedWeek, setSelectedWeek] = useState<Dayjs>(() => dayjs().startOf('isoWeek'));
  const [selectedDate, setSelectedDate] = useState<Dayjs>(() => dayjs());
  const [activeTab, setActiveTab] = useState<string>('weekly');
  const [historySearch, setHistorySearch] = useState('');

  const [focusForm] = Form.useForm<FocusAreaFormValues>();
  const [weeklyGoalForm] = Form.useForm<WeeklyGoalFormValues>();
  const [weeklyReviewForm] = Form.useForm<WeeklyReviewFormValues>();
  const [dailyEntryForm] = Form.useForm<DailyEntryFormValues>();
  const [dailyReviewForm] = Form.useForm<DailyReviewFormValues>();

  const [weeklyGoalModal, setWeeklyGoalModal] = useState<{ open: boolean; goal?: WeeklyGoal | null }>(
    { open: false }
  );
  const [dailyEntryModal, setDailyEntryModal] = useState<{ open: boolean; entry?: DailyEntry | null }>(
    { open: false }
  );

  const enablePageTests = import.meta.env.VITE_ENABLE_PAGE_TESTS === 'true';

  const testCaseFilesQuery = useQuery<ListResponse<LinkedTestCaseFile>>({
    queryKey: ['goal-hub', 'test-case-files'],
    queryFn: async () => (await api.get('/test-case-files')).data,
    staleTime: 1000 * 60 * 5
  });

  const defectFilesQuery = useQuery<ListResponse<LinkedDefectFile>>({
    queryKey: ['goal-hub', 'defect-files'],
    queryFn: async () => (await api.get('/defect-files')).data,
    staleTime: 1000 * 60 * 5
  });

  useEffect(() => {
    if (testCaseFilesQuery.error) {
      message.error('Unable to load test case files');
    }
  }, [testCaseFilesQuery.error]);

  useEffect(() => {
    if (defectFilesQuery.error) {
      message.error('Unable to load defect files');
    }
  }, [defectFilesQuery.error]);

  const testCaseFileOptions = useMemo(
    () =>
      (testCaseFilesQuery.data?.data ?? []).map((file) => ({
        value: String(file.id),
        label: formatTestCaseFileLabel(file)
      })),
    [testCaseFilesQuery.data]
  );

  const defectFileOptions = useMemo(
    () =>
      (defectFilesQuery.data?.data ?? []).map((file) => ({
        value: String(file.id),
        label: formatDefectFileLabel(file)
      })),
    [defectFilesQuery.data]
  );

  const testCaseFileLabelLookup = useMemo(() => {
    const lookup = new Map<string, string>();
    testCaseFileOptions.forEach((option) => lookup.set(option.value, option.label));
    return lookup;
  }, [testCaseFileOptions]);

  const defectFileLabelLookup = useMemo(() => {
    const lookup = new Map<string, string>();
    defectFileOptions.forEach((option) => lookup.set(option.value, option.label));
    return lookup;
  }, [defectFileOptions]);

  const focusAreas = state.focusAreas;
  const focusAreaTotal = useMemo(
    () => focusAreas.reduce((sum, area) => sum + area.weight, 0),
    [focusAreas]
  );
  const focusAreaMap = useMemo(
    () => new Map(focusAreas.map((area) => [area.id, area])),
    [focusAreas]
  );

  const weekKey = getWeekKey(selectedWeek);
  const weekPlan: WeeklyPlan = state.weekly[weekKey] ?? {
    weekStart: selectedWeek.startOf('isoWeek').toISOString(),
    goals: [],
    updatedAt: nowIso()
  };

  const dayKey = selectedDate.format('YYYY-MM-DD');
  const dayPlan: DailyPlan = state.daily[dayKey] ?? {
    date: selectedDate.startOf('day').toISOString(),
    entries: [],
    updatedAt: nowIso()
  };

  useEffect(() => {
    weeklyReviewForm.setFieldsValue({
      summaryNote:
        weekPlan.summaryNote ??
        weekPlan.review?.highlights ??
        ''
    });
  }, [weekPlan, weeklyReviewForm, focusAreas]);

  useEffect(() => {
    dailyReviewForm.setFieldsValue({
      dayNote: dayPlan.dayNote ?? dayPlan.review?.highlight ?? ''
    });
  }, [dayPlan, dailyReviewForm]);

  const weeklyWeightedScore = useMemo(
    () => computeWeeklyWeightedScore(focusAreas, weekPlan.goals),
    [focusAreas, weekPlan.goals]
  );
  const dailyWeightedScore = useMemo(
    () => computeDailyWeightedScore(focusAreas, dayPlan.entries),
    [focusAreas, dayPlan.entries]
  );

  const weightMarks: SliderMarks = {
    0: '0%',
    25: '25%',
    50: '50%',
    75: '75%',
    100: '100%'
  };

  const weeklyAggregation = useMemo(() => {
    const totalGoals = weekPlan.goals.length;
    const withUpdates = weekPlan.goals.filter((goal) => (goal.updateSummary ?? '').trim().length > 0).length;
    const testFiles = new Map<string, number>();
    const defectFiles = new Map<string, number>();
    weekPlan.goals.forEach((goal) => {
      (goal.testFiles ?? []).forEach((file) => {
        const key = file.trim();
        if (!key) return;
        const display = testCaseFileLabelLookup.get(key) ?? key;
        testFiles.set(display, (testFiles.get(display) ?? 0) + 1);
      });
      (goal.defectFiles ?? []).forEach((file) => {
        const key = file.trim();
        if (!key) return;
        const display = defectFileLabelLookup.get(key) ?? key;
        defectFiles.set(display, (defectFiles.get(display) ?? 0) + 1);
      });
    });
    return {
      totalGoals,
      withUpdates,
      updateCompletion: totalGoals ? Math.round((withUpdates / totalGoals) * 100) : 0,
      testFiles,
      defectFiles
    };
  }, [weekPlan.goals, testCaseFileLabelLookup, defectFileLabelLookup]);

  const dailyAggregation = useMemo(() => {
    const totalEntries = dayPlan.entries.length;
    const withUpdates = dayPlan.entries.filter((entry) => (entry.updateSummary ?? '').trim().length > 0).length;
    const testFiles = new Map<string, number>();
    const defectFiles = new Map<string, number>();
    dayPlan.entries.forEach((entry) => {
      (entry.testFiles ?? []).forEach((file) => {
        const key = file.trim();
        if (!key) return;
        const display = testCaseFileLabelLookup.get(key) ?? key;
        testFiles.set(display, (testFiles.get(display) ?? 0) + 1);
      });
      (entry.defectFiles ?? []).forEach((file) => {
        const key = file.trim();
        if (!key) return;
        const display = defectFileLabelLookup.get(key) ?? key;
        defectFiles.set(display, (defectFiles.get(display) ?? 0) + 1);
      });
    });
    return {
      totalEntries,
      withUpdates,
      updateCompletion: totalEntries ? Math.round((withUpdates / totalEntries) * 100) : 0,
      testFiles,
      defectFiles
    };
  }, [dayPlan.entries, testCaseFileLabelLookup, defectFileLabelLookup]);

  const handleAddFocusArea = (values: FocusAreaFormValues) => {
    const trimmedName = values.name.trim();
    if (!trimmedName) {
      message.error('Please provide a focus area name');
      return;
    }
    setState((prev) => {
      const currentTotal = prev.focusAreas.reduce((sum, area) => sum + area.weight, 0);
      const requestedWeight =
        typeof values.weight === 'number' && !Number.isNaN(values.weight)
          ? Math.max(0, Math.min(100, Math.round(values.weight)))
          : Math.max(0, 100 - currentTotal);
      const newArea: FocusArea = {
        id: makeId('focus'),
        name: trimmedName,
        description: values.description?.trim() ?? '',
        weight: requestedWeight,
        color: focusColorPalette[prev.focusAreas.length % focusColorPalette.length]
      };
      const updated = normalizeWeights([...prev.focusAreas, newArea]);
      return {
        ...prev,
        focusAreas: updated
      };
    });
    focusForm.resetFields();
    message.success('Focus area added');
  };

  const handleWeightChange = (id: string, next: number) => {
    setState((prev) => {
      const updated = prev.focusAreas.map((area) =>
        area.id === id
          ? { ...area, weight: Math.max(0, Math.min(100, Math.round(next))) }
          : area
      );
      return {
        ...prev,
        focusAreas: normalizeWeights(updated)
      };
    });
  };

  const handleRemoveFocusArea = (id: string) => {
    setState((prev) => {
      const remaining = prev.focusAreas.filter((area) => area.id !== id);
      return {
        ...prev,
        focusAreas: normalizeWeights(remaining)
      };
    });
    message.success('Focus area removed');
  };

  const handleNormalizeWeights = () => {
    setState((prev) => ({ ...prev, focusAreas: normalizeWeights(prev.focusAreas) }));
    message.success('Weights re-balanced');
  };

  const openWeeklyGoalModal = (goal?: WeeklyGoal) => {
    setWeeklyGoalModal({ open: true, goal });
    weeklyGoalForm.setFieldsValue({
      title: goal?.title ?? '',
      focusAreaId: goal?.focusAreaId ?? undefined,
      metric: goal?.metric ?? '',
      status: goal?.status ?? 'planned',
      progress: goal?.progress ?? 0,
      impact: goal?.impact ?? 3,
      owner: goal?.owner ?? '',
      notes: goal?.notes ?? '',
      updateSummary: goal?.updateSummary ?? '',
      changeNotes: goal?.changeNotes ?? '',
      reviewerNotes: goal?.reviewerNotes ?? '',
      testFiles: (goal?.testFiles ?? []).map((value) => value.toString()),
      defectFiles: (goal?.defectFiles ?? []).map((value) => value.toString())
    });
  };

  const closeWeeklyGoalModal = () => {
    setWeeklyGoalModal({ open: false });
    weeklyGoalForm.resetFields();
  };

  const handleSaveWeeklyGoal = async () => {
    try {
      const values = await weeklyGoalForm.validateFields();
      const sanitizeStrings = (input?: string[]) => {
        if (!Array.isArray(input)) return [];
        const seen = new Set<string>();
        input.forEach((item) => {
          const trimmed = item?.toString().trim();
          if (!trimmed) return;
          seen.add(trimmed);
        });
        return Array.from(seen);
      };
      const updateSummary = values.updateSummary?.trim() ?? '';
      const changeNotes = values.changeNotes?.trim() ?? '';
      const reviewerNotes = values.reviewerNotes?.trim() ?? '';
      const testFiles = sanitizeStrings(values.testFiles);
      const defectFiles = sanitizeStrings(values.defectFiles);
      setState((prev) => {
        const existing = prev.weekly[weekKey] ?? {
          weekStart: selectedWeek.startOf('isoWeek').toISOString(),
          goals: [],
          theme: '',
          updatedAt: nowIso()
        };
        const updatedGoals = weeklyGoalModal.goal
          ? existing.goals.map((goal) =>
              goal.id === weeklyGoalModal.goal?.id
                ? {
                    ...goal,
                    title: values.title.trim(),
                    focusAreaId: values.focusAreaId ?? null,
                    metric: values.metric?.trim() ?? '',
                    status: values.status,
                    progress: values.progress,
                    impact: values.impact,
                    owner: values.owner?.trim() ?? '',
                    notes: values.notes?.trim() ?? '',
                    updateSummary,
                    changeNotes,
                    reviewerNotes,
                    testFiles,
                    defectFiles,
                    updatedAt: nowIso()
                  }
                : goal
            )
          : [
              ...existing.goals,
              {
                id: makeId('wgoal'),
                title: values.title.trim(),
                focusAreaId: values.focusAreaId ?? null,
                metric: values.metric?.trim() ?? '',
                status: values.status,
                progress: values.progress,
                impact: values.impact,
                owner: values.owner?.trim() ?? '',
                notes: values.notes?.trim() ?? '',
                updateSummary,
                changeNotes,
                reviewerNotes,
                testFiles,
                defectFiles,
                updatedAt: nowIso()
              }
            ];
        return {
          ...prev,
          weekly: {
            ...prev.weekly,
            [weekKey]: {
              ...existing,
              goals: updatedGoals,
              updatedAt: nowIso()
            }
          }
        };
      });
      message.success(weeklyGoalModal.goal ? 'Weekly goal updated' : 'Weekly goal added');
      closeWeeklyGoalModal();
    } catch (error) {
      // validation handled by antd form
    }
  };

  const updateWeeklyGoalStatus = (goalId: string, status: WeeklyStatus) => {
    setState((prev) => {
      const existing = prev.weekly[weekKey];
      if (!existing) return prev;
      return {
        ...prev,
        weekly: {
          ...prev.weekly,
          [weekKey]: {
            ...existing,
            goals: existing.goals.map((goal) =>
              goal.id === goalId ? { ...goal, status, updatedAt: nowIso() } : goal
            ),
            updatedAt: nowIso()
          }
        }
      };
    });
  };

  const updateWeeklyGoalProgress = (goalId: string, progress: number) => {
    setState((prev) => {
      const existing = prev.weekly[weekKey];
      if (!existing) return prev;
      return {
        ...prev,
        weekly: {
          ...prev.weekly,
          [weekKey]: {
            ...existing,
            goals: existing.goals.map((goal) =>
              goal.id === goalId
                ? { ...goal, progress: Math.max(0, Math.min(100, Math.round(progress))), updatedAt: nowIso() }
                : goal
            ),
            updatedAt: nowIso()
          }
        }
      };
    });
  };

  const removeWeeklyGoal = (goalId: string) => {
    setState((prev) => {
      const existing = prev.weekly[weekKey];
      if (!existing) return prev;
      return {
        ...prev,
        weekly: {
          ...prev.weekly,
          [weekKey]: {
            ...existing,
            goals: existing.goals.filter((goal) => goal.id !== goalId),
            updatedAt: nowIso()
          }
        }
      };
    });
    message.success('Weekly goal removed');
  };

  const handleSaveWeeklyReview = (values: WeeklyReviewFormValues) => {
    const summary = values.summaryNote?.trim() ?? '';
    setState((prev) => {
      const existing = prev.weekly[weekKey] ?? {
        weekStart: selectedWeek.startOf('isoWeek').toISOString(),
        goals: [],
        updatedAt: nowIso()
      };
      return {
        ...prev,
        weekly: {
          ...prev.weekly,
          [weekKey]: {
            ...existing,
            summaryNote: summary,
            updatedAt: nowIso()
          }
        }
      };
    });
    message.success('Weekly summary saved');
  };

  const openDailyEntryModal = (entry?: DailyEntry) => {
    setDailyEntryModal({ open: true, entry });
    dailyEntryForm.setFieldsValue({
      title: entry?.title ?? '',
      focusAreaId: entry?.focusAreaId ?? undefined,
      status: entry?.status ?? 'not_started',
      impact: entry?.impact ?? 3,
      effort: entry?.effort ?? 2,
      notes: entry?.notes ?? '',
      updateSummary: entry?.updateSummary ?? '',
      comment: entry?.comment ?? '',
      testFiles: (entry?.testFiles ?? []).map((value) => value.toString()),
      defectFiles: (entry?.defectFiles ?? []).map((value) => value.toString())
    });
  };

  const closeDailyEntryModal = () => {
    setDailyEntryModal({ open: false });
    dailyEntryForm.resetFields();
  };

  const handleSaveDailyEntry = async () => {
    try {
      const values = await dailyEntryForm.validateFields();
      const sanitizeStrings = (input?: string[]) => {
        if (!Array.isArray(input)) return [];
        const seen = new Set<string>();
        input.forEach((item) => {
          const trimmed = item?.toString().trim();
          if (!trimmed) return;
          seen.add(trimmed);
        });
        return Array.from(seen);
      };
      const updateSummary = values.updateSummary?.trim() ?? '';
      const comment = values.comment?.trim() ?? '';
      const testFiles = sanitizeStrings(values.testFiles);
      const defectFiles = sanitizeStrings(values.defectFiles);
      setState((prev) => {
        const existing = prev.daily[dayKey] ?? {
          date: selectedDate.startOf('day').toISOString(),
          entries: [],
          updatedAt: nowIso()
        };
        const updatedEntries = dailyEntryModal.entry
          ? existing.entries.map((entry) =>
              entry.id === dailyEntryModal.entry?.id
                ? {
                    ...entry,
                    title: values.title.trim(),
                    focusAreaId: values.focusAreaId ?? null,
                    status: values.status,
                    impact: values.impact,
                    effort: values.effort,
                    notes: values.notes?.trim() ?? '',
                    updateSummary,
                    comment,
                    testFiles,
                    defectFiles,
                    updatedAt: nowIso()
                  }
                : entry
            )
          : [
              ...existing.entries,
              {
                id: makeId('dentry'),
                title: values.title.trim(),
                focusAreaId: values.focusAreaId ?? null,
                status: values.status,
                impact: values.impact,
                effort: values.effort,
                notes: values.notes?.trim() ?? '',
                updateSummary,
                comment,
                testFiles,
                defectFiles,
                createdAt: nowIso(),
                updatedAt: nowIso()
              }
            ];
        return {
          ...prev,
          daily: {
            ...prev.daily,
            [dayKey]: {
              ...existing,
              entries: updatedEntries,
              updatedAt: nowIso()
            }
          }
        };
      });
      message.success(dailyEntryModal.entry ? 'Daily goal updated' : 'Daily goal added');
      closeDailyEntryModal();
    } catch (error) {
      // validation handled by form
    }
  };

  const updateDailyEntryStatus = (entryId: string, status: DailyStatus) => {
    setState((prev) => {
      const existing = prev.daily[dayKey];
      if (!existing) return prev;
      return {
        ...prev,
        daily: {
          ...prev.daily,
          [dayKey]: {
            ...existing,
            entries: existing.entries.map((entry) =>
              entry.id === entryId ? { ...entry, status, updatedAt: nowIso() } : entry
            ),
            updatedAt: nowIso()
          }
        }
      };
    });
  };

  const removeDailyEntry = (entryId: string) => {
    setState((prev) => {
      const existing = prev.daily[dayKey];
      if (!existing) return prev;
      return {
        ...prev,
        daily: {
          ...prev.daily,
          [dayKey]: {
            ...existing,
            entries: existing.entries.filter((entry) => entry.id !== entryId),
            updatedAt: nowIso()
          }
        }
      };
    });
    message.success('Daily goal removed');
  };

  const handleSaveDailyReview = (values: DailyReviewFormValues) => {
    const dayNote = values.dayNote?.trim() ?? '';
    setState((prev) => {
      const existing = prev.daily[dayKey] ?? {
        date: selectedDate.startOf('day').toISOString(),
        entries: [],
        updatedAt: nowIso()
      };
      return {
        ...prev,
        daily: {
          ...prev.daily,
          [dayKey]: {
            ...existing,
            dayNote,
            updatedAt: nowIso()
          }
        }
      };
    });
    message.success('Daily note saved');
  };

  const historyItems = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    const entries: Array<{
      type: 'weekly' | 'daily';
      timestamp: string;
      label: string;
      body: string;
      tags: string[];
    }> = [];

    Object.values(state.weekly).forEach((plan) => {
      const start = dayjs(plan.weekStart);
      const label = `Week ${start.format('GGGG-[W]WW')} · ${formatWeekRange(plan.weekStart)}`;
      const goalSummaries = plan.goals.map((goal) => {
        const focusName = goal.focusAreaId ? focusAreaMap.get(goal.focusAreaId)?.name ?? 'Unassigned' : 'Unassigned';
        const update = (goal.updateSummary ?? '').trim();
        return `${goal.title} (${focusName}, ${weeklyStatusMeta[goal.status].label})${update ? ` · ${update}` : ''}`;
      });
      const attachmentTags: string[] = [];
      plan.goals.forEach((goal) => {
        (goal.testFiles ?? []).forEach((file) => {
          const trimmed = file.trim();
          if (!trimmed) return;
          attachmentTags.push(`Test:${testCaseFileLabelLookup.get(trimmed) ?? trimmed}`);
        });
        (goal.defectFiles ?? []).forEach((file) => {
          const trimmed = file.trim();
          if (!trimmed) return;
          attachmentTags.push(`Defect:${defectFileLabelLookup.get(trimmed) ?? trimmed}`);
        });
      });
      const bodyParts = [
        goalSummaries.join(' • '),
        plan.summaryNote ?? '',
        plan.review?.highlights ?? '',
        plan.review?.adjustments ?? ''
      ]
        .filter((piece) => (piece ?? '').toString().trim().length > 0)
        .join(' • ');
      const tags = [...attachmentTags];
      if (plan.theme) tags.push(plan.theme);
      entries.push({
        type: 'weekly',
        timestamp: plan.updatedAt ?? plan.weekStart,
        label,
        body: bodyParts,
        tags
      });
    });

    Object.values(state.daily).forEach((plan) => {
      const label = `${dayjs(plan.date).format('ddd · MMM D, YYYY')}`;
      const entrySummaries = plan.entries.map((entry) => {
        const focusName = entry.focusAreaId ? focusAreaMap.get(entry.focusAreaId)?.name ?? 'Unassigned' : 'Unassigned';
        const update = (entry.updateSummary ?? '').trim();
        return `${entry.title} (${focusName}, ${dailyStatusMeta[entry.status].label})${update ? ` · ${update}` : ''}`;
      });
      const attachmentTags: string[] = [];
      plan.entries.forEach((entry) => {
        (entry.testFiles ?? []).forEach((file) => {
          const trimmed = file.trim();
          if (!trimmed) return;
          attachmentTags.push(`Test:${testCaseFileLabelLookup.get(trimmed) ?? trimmed}`);
        });
        (entry.defectFiles ?? []).forEach((file) => {
          const trimmed = file.trim();
          if (!trimmed) return;
          attachmentTags.push(`Defect:${defectFileLabelLookup.get(trimmed) ?? trimmed}`);
        });
      });
      const bodyParts = [
        entrySummaries.join(' • '),
        plan.dayNote ?? '',
        plan.review?.highlight ?? '',
        plan.review?.tomorrow ?? ''
      ]
        .filter((piece) => (piece ?? '').toString().trim().length > 0)
        .join(' • ');
      const tags = [...attachmentTags];
      if (plan.review?.blockers && plan.review.blockers.trim().length) {
        tags.push('Blockers noted');
      }
      entries.push({
        type: 'daily',
        timestamp: plan.updatedAt ?? plan.date,
        label,
        body: bodyParts,
        tags
      });
    });

    const filtered = query
      ? entries.filter((item) =>
          item.label.toLowerCase().includes(query) ||
          item.body.toLowerCase().includes(query) ||
          item.tags.some((tag) => tag.toLowerCase().includes(query))
        )
      : entries;

    return filtered.sort((a, b) => dayjs(b.timestamp).valueOf() - dayjs(a.timestamp).valueOf());
  }, [historySearch, state.daily, state.weekly, focusAreaMap, testCaseFileLabelLookup, defectFileLabelLookup]);

  const pageTests = useMemo<PageTestCase[]>(() => {
    if (!enablePageTests) return [];
    return [
      {
        name: 'Focus weights sum to 100',
        run: ({ assert }) => {
          const total = focusAreas.reduce((sum, area) => sum + area.weight, 0);
          assert(total === 100, `Expected weights to equal 100, received ${total}`);
        }
      },
      {
        name: 'Weighted scores within bounds',
        run: ({ assert, log }) => {
          log(`Weekly score: ${weeklyWeightedScore}`);
          log(`Daily score: ${dailyWeightedScore}`);
          assert(
            weeklyWeightedScore >= 0 && weeklyWeightedScore <= 100,
            'Weekly weighted score should be between 0 and 100'
          );
          assert(
            dailyWeightedScore >= 0 && dailyWeightedScore <= 100,
            'Daily weighted score should be between 0 and 100'
          );
        }
      }
    ];
  }, [enablePageTests, focusAreas, weeklyWeightedScore, dailyWeightedScore]);

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <div>
        <Title level={2} style={{ marginBottom: 8 }}>Goals Intelligence Hub</Title>
        <Paragraph style={{ maxWidth: 780 }}>
          Configure strategic focus areas, plan your weekly objectives, steer daily execution and capture
          review insights in one dynamic workspace. Weightings, progress and history stay synced locally so
          you and your team can iterate quickly.
        </Paragraph>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12} lg={8}>
          <Card bordered title={<Space><LineChartOutlined /> <span>Weekly weighted score</span></Space>}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Text type="secondary">Week of {formatWeekRange(weekPlan.weekStart)}</Text>
              <Progress
                type="dashboard"
                percent={weeklyWeightedScore}
                strokeColor={{ '0%': '#22d3ee', '100%': '#2563eb' }}
              />
              <Text type="secondary">
                Based on focus-area weightings and completion of weekly goals.
              </Text>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={12} lg={8}>
          <Card bordered title={<Space><LineChartOutlined /> <span>Daily weighted score</span></Space>}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Text type="secondary">{formatIsoDate(dayPlan.date)}</Text>
              <Progress
                type="circle"
                percent={dailyWeightedScore}
                strokeColor={{ '0%': '#34d399', '100%': '#15803d' }}
              />
              <Text type="secondary">
                Reflects completion of today’s focus-aligned tasks.
              </Text>
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card bordered title={<Space><HistoryOutlined /> <span>Last saved</span></Space>}>
            <Statistic
              title="Local persistence"
              value={state.lastSavedAt ? dayjs(state.lastSavedAt).format('MMM D, YYYY · HH:mm') : '—'}
              valueStyle={{ fontSize: 18 }}
            />
            <Text type="secondary">All data stays in your browser so you can iterate without backend wiring.</Text>
          </Card>
        </Col>
      </Row>

      <Card
        bordered
        title="Focus areas & weighting"
        extra={
          <Space>
            <Badge
              color={focusAreaTotal === 100 ? '#22c55e' : '#ef4444'}
              text={`Total weighting: ${focusAreaTotal}%`}
            />
            <Tooltip title="Re-balance weights proportionally">
              <Button icon={<ReloadOutlined />} onClick={handleNormalizeWeights}>
                Normalize
              </Button>
            </Tooltip>
          </Space>
        }
      >
        <Space direction="vertical" size={20} style={{ width: '100%' }}>
          {focusAreas.length === 0 ? (
            <Alert
              type="warning"
              showIcon
              message="No focus areas yet"
              description="Add strategic lenses to unlock planning and weighting features."
            />
          ) : (
            <List
              dataSource={focusAreas}
              split
              renderItem={(area) => (
                <List.Item
                  key={area.id}
                  actions={[
                    <Popconfirm
                      key="delete"
                      title="Remove focus area?"
                      okText="Remove"
                      cancelText="Cancel"
                      onConfirm={() => handleRemoveFocusArea(area.id)}
                    >
                      <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space size={8} wrap>
                        <Tag color={area.color}>{area.name}</Tag>
                        <Badge
                          color={area.color}
                          text={`${area.weight}% weight`}
                          style={{ fontSize: 12 }}
                        />
                      </Space>
                    }
                    description={
                      <Text type="secondary">
                        {area.description || 'No additional description captured yet.'}
                      </Text>
                    }
                  />
                  <div style={{ minWidth: 280 }}>
                    <Slider
                      marks={weightMarks}
                      tooltip={{ formatter: (value) => `${value}%` }}
                      min={0}
                      max={100}
                      value={area.weight}
                      onChange={(value) => handleWeightChange(area.id, value as number)}
                    />
                    <InputNumber
                      min={0}
                      max={100}
                      value={area.weight}
                      addonAfter="%"
                      onChange={(value) => handleWeightChange(area.id, Number(value ?? 0))}
                    />
                  </div>
                </List.Item>
              )}
            />
          )}

          <Divider style={{ margin: '12px 0' }} />

          <Form layout="vertical" form={focusForm} onFinish={handleAddFocusArea}>
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item
                  name="name"
                  label="Focus area"
                  rules={[{ required: true, message: 'Provide a focus area name' }]}
                >
                  <Input placeholder="eg. Automation coverage" allowClear />
                </Form.Item>
              </Col>
              <Col xs={24} md={10}>
                <Form.Item name="description" label="Description">
                  <Input placeholder="Optional supporting context" allowClear />
                </Form.Item>
              </Col>
              <Col xs={24} md={4}>
                <Form.Item
                  name="weight"
                  label="Weight"
                  tooltip="Leave blank to auto-balance"
                  rules={[
                    {
                      type: 'number',
                      min: 0,
                      max: 100,
                      message: 'Weight must be between 0 and 100'
                    }
                  ]}
                >
                  <InputNumber min={0} max={100} addonAfter="%" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={2} style={{ display: 'flex', alignItems: 'flex-end' }}>
                <Button type="primary" icon={<PlusOutlined />} htmlType="submit" block>
                  Add
                </Button>
              </Col>
            </Row>
          </Form>
        </Space>
      </Card>

      <Tabs
        rootClassName="goals-tabs"
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key)}
        items={[
          {
            key: 'weekly',
            label: 'Weekly strategy',
            children: (
              <Space direction="vertical" size={20} style={{ width: '100%' }} className="goals-history-pane">
                <Card
                  bordered
                  title={<Space> <LineChartOutlined /> <span>Weekly goal board</span> </Space>}
                  extra={
                    <Space>
                      <DatePicker
                        picker="week"
                        allowClear={false}
                        value={selectedWeek}
                        onChange={(value) => value && setSelectedWeek(value.startOf('isoWeek'))}
                      />
                      <Button type="primary" icon={<PlusOutlined />} onClick={() => openWeeklyGoalModal()}>
                        Add goal
                      </Button>
                    </Space>
                  }
                >
                  {weekPlan.goals.length === 0 ? (
                    <Empty description="No weekly goals captured yet" />
                  ) : (
                    <List
                      dataSource={weekPlan.goals}
                      rowKey={(item) => item.id}
                      renderItem={(goal) => (
                        <List.Item
                          actions={[
                            <Tooltip key="edit" title="Edit goal">
                              <Button
                                type="text"
                                icon={<EditOutlined />}
                                onClick={() => openWeeklyGoalModal(goal)}
                              />
                            </Tooltip>,
                            <Popconfirm
                              key="delete"
                              title="Remove this goal?"
                              okText="Remove"
                              cancelText="Cancel"
                              onConfirm={() => removeWeeklyGoal(goal.id)}
                            >
                              <Button type="text" danger icon={<DeleteOutlined />} />
                            </Popconfirm>
                          ]}
                        >
                          <Row gutter={16} style={{ width: '100%' }}>
                            <Col xs={24} md={13}>
                              <Space direction="vertical" size={6} style={{ width: '100%' }}>
                                <Space size={8} wrap>
                                  <Tag color={goal.focusAreaId ? focusAreaMap.get(goal.focusAreaId)?.color ?? 'default' : 'default'}>
                                    {goal.focusAreaId ? focusAreaMap.get(goal.focusAreaId)?.name ?? 'Unassigned' : 'Unassigned'}
                                  </Tag>
                                  <Tag color={weeklyStatusMeta[goal.status].tagColor}>
                                    {weeklyStatusMeta[goal.status].label}
                                  </Tag>
                                  <Tooltip title="Relative impact">
                                    <Tag color="blue">Impact {goal.impact}/5</Tag>
                                  </Tooltip>
                                </Space>
                                <Text strong>{goal.title}</Text>
                                {goal.metric ? (
                                  <Text type="secondary">Metric: {goal.metric}</Text>
                                ) : null}
                                {goal.notes ? (
                                  <Text type="secondary">Notes: {goal.notes}</Text>
                                ) : null}
                                {goal.updateSummary ? (
                                  <Text type="secondary">Update: {goal.updateSummary}</Text>
                                ) : null}
                                {goal.changeNotes ? (
                                  <Text type="secondary">Changes: {goal.changeNotes}</Text>
                                ) : null}
                                {goal.reviewerNotes ? (
                                  <Text type="secondary">Reviewer notes: {goal.reviewerNotes}</Text>
                                ) : null}
                                {(goal.testFiles?.length || 0) > 0 || (goal.defectFiles?.length || 0) > 0 ? (
                                  <Space size={4} wrap>
                                    {(goal.testFiles ?? []).map((file) => {
                                      const trimmed = file.trim();
                                      if (!trimmed) return null;
                                      const label = testCaseFileLabelLookup.get(trimmed) ?? trimmed;
                                      return (
                                        <Tag key={`${goal.id}-t-${trimmed}`} color="cyan">
                                          Test · {label}
                                        </Tag>
                                      );
                                    })}
                                    {(goal.defectFiles ?? []).map((file) => {
                                      const trimmed = file.trim();
                                      if (!trimmed) return null;
                                      const label = defectFileLabelLookup.get(trimmed) ?? trimmed;
                                      return (
                                        <Tag key={`${goal.id}-d-${trimmed}`} color="magenta">
                                          Defect · {label}
                                        </Tag>
                                      );
                                    })}
                                  </Space>
                                ) : null}
                              </Space>
                            </Col>
                            <Col xs={24} md={11}>
                              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                                <Select
                                  size="small"
                                  value={goal.status}
                                  style={{ width: 180 }}
                                  onChange={(value) => updateWeeklyGoalStatus(goal.id, value)}
                                  options={weeklyStatusOptions.map((status) => ({
                                    value: status,
                                    label: weeklyStatusMeta[status].label
                                  }))}
                                />
                                <Slider
                                  marks={{ 0: '0%', 50: '50%', 100: '100%' }}
                                  value={goal.progress}
                                  tooltip={{ formatter: (value) => `${value}% complete` }}
                                  onChange={(value) => updateWeeklyGoalProgress(goal.id, value as number)}
                                />
                                <Progress percent={goal.progress} status={goal.status === 'at_risk' ? 'exception' : goal.status === 'completed' ? 'success' : 'active'} />
                                <Text type="secondary">
                                  Updated {dayjs(goal.updatedAt).fromNow()}
                                </Text>
                              </Space>
                            </Col>
                          </Row>
                        </List.Item>
                      )}
                    />
                  )}
                </Card>

                <Card bordered title="Weekly updates & summary">
                  <Space direction="vertical" size={16} style={{ width: '100%' }}>
                    <Form layout="vertical" form={weeklyReviewForm} onFinish={handleSaveWeeklyReview}>
                      <Row gutter={16}>
                        <Col xs={24} md={18}>
                          <Form.Item name="summaryNote" label="Weekly summary note">
                            <Input.TextArea
                              rows={3}
                              placeholder="Capture the overall status, risks and next steps for this ISO week"
                              allowClear
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={6} style={{ display: 'flex', alignItems: 'flex-end' }}>
                          <Button type="primary" htmlType="submit" block>
                            Save summary
                          </Button>
                        </Col>
                      </Row>
                    </Form>

                    <Row gutter={[16, 16]}> 
                      <Col xs={24} md={8}>
                        <Statistic title="Goals this week" value={weeklyAggregation.totalGoals} />
                      </Col>
                      <Col xs={24} md={8}>
                        <Statistic title="Goals updated" value={weeklyAggregation.withUpdates} />
                      </Col>
                      <Col xs={24} md={8}>
                        <Space direction="vertical" size={4} style={{ width: '100%', alignItems: 'center' }}>
                          <Progress type="dashboard" percent={weeklyAggregation.updateCompletion} strokeColor={{ '0%': '#22d3ee', '100%': '#2563eb' }} />
                          <Text type="secondary">Goals with documented updates</Text>
                        </Space>
                      </Col>
                    </Row>

                    {(weekPlan.summaryNote ?? '').trim().length > 0 && (
                      <Alert
                        type="info"
                        showIcon
                        message="Week summary"
                        description={weekPlan.summaryNote}
                      />
                    )}

                    {(weeklyAggregation.testFiles.size > 0 || weeklyAggregation.defectFiles.size > 0) && (
                      <Space direction="vertical" size={8} style={{ width: '100%' }}>
                        <Text strong>Linked artefacts</Text>
                        <Space size={6} wrap>
                          {Array.from(weeklyAggregation.testFiles.entries()).map(([file, count]) => (
                            <Tag key={`weekly-test-${file}`} color="cyan">
                              Test · {file} ({count})
                            </Tag>
                          ))}
                          {Array.from(weeklyAggregation.defectFiles.entries()).map(([file, count]) => (
                            <Tag key={`weekly-defect-${file}`} color="magenta">
                              Defect · {file} ({count})
                            </Tag>
                          ))}
                        </Space>
                      </Space>
                    )}

                    <Divider style={{ margin: '8px 0' }} />

                    {weekPlan.goals.length === 0 ? (
                      <Empty description="No goals to summarise" />
                    ) : (
                      <Timeline
                        items={weekPlan.goals.map((goal) => ({
                          color: (goal.updateSummary ?? '').trim() ? 'blue' : 'gray',
                          children: (
                            <Space direction="vertical" size={4} style={{ width: '100%' }}>
                              <Text strong>{goal.title}</Text>
                              {goal.updateSummary ? (
                                <Text type="secondary">Update: {goal.updateSummary}</Text>
                              ) : (
                                <Text type="secondary">No update captured yet.</Text>
                              )}
                              {goal.changeNotes ? (
                                <Text type="secondary">Changes: {goal.changeNotes}</Text>
                              ) : null}
                              {goal.reviewerNotes ? (
                                <Text type="secondary">Notes: {goal.reviewerNotes}</Text>
                              ) : null}
                              {(goal.testFiles?.length || 0) > 0 || (goal.defectFiles?.length || 0) > 0 ? (
                                <Space size={4} wrap>
                                  {(goal.testFiles ?? []).map((file) => {
                                    const trimmed = file.trim();
                                    if (!trimmed) return null;
                                    const label = testCaseFileLabelLookup.get(trimmed) ?? trimmed;
                                    return (
                                      <Tag key={`timeline-${goal.id}-t-${trimmed}`} color="cyan">
                                        Test · {label}
                                      </Tag>
                                    );
                                  })}
                                  {(goal.defectFiles ?? []).map((file) => {
                                    const trimmed = file.trim();
                                    if (!trimmed) return null;
                                    const label = defectFileLabelLookup.get(trimmed) ?? trimmed;
                                    return (
                                      <Tag key={`timeline-${goal.id}-d-${trimmed}`} color="magenta">
                                        Defect · {label}
                                      </Tag>
                                    );
                                  })}
                                </Space>
                              ) : null}
                            </Space>
                          )
                        }))}
                      />
                    )}
                  </Space>
                </Card>
              </Space>
            )
          },
          {
            key: 'daily',
            label: 'Daily execution',
            children: (
              <Space direction="vertical" size={20} style={{ width: '100%' }}>
                <Card
                  bordered
                  title={<Space> <LineChartOutlined /> <span>Daily focus planner</span> </Space>}
                  extra={
                    <Space>
                      <DatePicker
                        allowClear={false}
                        value={selectedDate}
                        onChange={(value) => value && setSelectedDate(value.startOf('day'))}
                      />
                      <Button type="primary" icon={<PlusOutlined />} onClick={() => openDailyEntryModal()}>
                        Add daily goal
                      </Button>
                    </Space>
                  }
                >
                  {dayPlan.entries.length === 0 ? (
                    <Empty description="No daily goals captured for this date" />
                  ) : (
                    <List
                      dataSource={dayPlan.entries}
                      rowKey={(item) => item.id}
                      renderItem={(entry) => (
                        <List.Item
                          actions={[
                            <Tooltip key="edit" title="Edit daily goal">
                              <Button type="text" icon={<EditOutlined />} onClick={() => openDailyEntryModal(entry)} />
                            </Tooltip>,
                            <Popconfirm
                              key="delete"
                              title="Remove this daily goal?"
                              okText="Remove"
                              cancelText="Cancel"
                              onConfirm={() => removeDailyEntry(entry.id)}
                            >
                              <Button type="text" danger icon={<DeleteOutlined />} />
                            </Popconfirm>
                          ]}
                        >
                          <Row gutter={16} style={{ width: '100%' }}>
                            <Col xs={24} md={13}>
                              <Space direction="vertical" size={6} style={{ width: '100%' }}>
                                <Space size={8} wrap>
                                  <Tag color={entry.focusAreaId ? focusAreaMap.get(entry.focusAreaId)?.color ?? 'default' : 'default'}>
                                    {entry.focusAreaId ? focusAreaMap.get(entry.focusAreaId)?.name ?? 'Unassigned' : 'Unassigned'}
                                  </Tag>
                                  <Tag color={dailyStatusMeta[entry.status].tagColor}>
                                    {dailyStatusMeta[entry.status].label}
                                  </Tag>
                                  <Tag color="blue">Impact {entry.impact}/5</Tag>
                                  <Tag color="cyan">Effort {entry.effort}/5</Tag>
                                </Space>
                                <Text strong>{entry.title}</Text>
                                {entry.notes ? <Text type="secondary">Notes: {entry.notes}</Text> : null}
                                {entry.updateSummary ? (
                                  <Text type="secondary">Update: {entry.updateSummary}</Text>
                                ) : null}
                                {entry.comment ? (
                                  <Text type="secondary">Comment: {entry.comment}</Text>
                                ) : null}
                                {(entry.testFiles?.length || 0) > 0 || (entry.defectFiles?.length || 0) > 0 ? (
                                  <Space size={4} wrap>
                                    {(entry.testFiles ?? []).map((file) => {
                                      const trimmed = file.trim();
                                      if (!trimmed) return null;
                                      const label = testCaseFileLabelLookup.get(trimmed) ?? trimmed;
                                      return (
                                        <Tag key={`${entry.id}-t-${trimmed}`} color="cyan">
                                          Test · {label}
                                        </Tag>
                                      );
                                    })}
                                    {(entry.defectFiles ?? []).map((file) => {
                                      const trimmed = file.trim();
                                      if (!trimmed) return null;
                                      const label = defectFileLabelLookup.get(trimmed) ?? trimmed;
                                      return (
                                        <Tag key={`${entry.id}-d-${trimmed}`} color="magenta">
                                          Defect · {label}
                                        </Tag>
                                      );
                                    })}
                                  </Space>
                                ) : null}
                              </Space>
                            </Col>
                            <Col xs={24} md={11}>
                              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                                <Select
                                  size="small"
                                  style={{ width: 220 }}
                                  value={entry.status}
                                  onChange={(value) => updateDailyEntryStatus(entry.id, value)}
                                  options={dailyStatusOptions.map((status) => ({
                                    value: status,
                                    label: dailyStatusMeta[status].label
                                  }))}
                                />
                                <Progress percent={dailyStatusScore[entry.status] * 100} />
                                <Text type="secondary">Updated {dayjs(entry.updatedAt).fromNow()}</Text>
                              </Space>
                            </Col>
                          </Row>
                        </List.Item>
                      )}
                    />
                  )}
                </Card>

                <Card bordered title="Daily updates & summary">
                  <Space direction="vertical" size={16} style={{ width: '100%' }}>
                    <Form layout="vertical" form={dailyReviewForm} onFinish={handleSaveDailyReview}>
                      <Row gutter={16}>
                        <Col xs={24} md={18}>
                          <Form.Item name="dayNote" label="Day recap">
                            <Input.TextArea
                              rows={3}
                              placeholder="Capture how execution went, blockers cleared and what needs attention tomorrow"
                              allowClear
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={6} style={{ display: 'flex', alignItems: 'flex-end' }}>
                          <Button type="primary" htmlType="submit" block>
                            Save day note
                          </Button>
                        </Col>
                      </Row>
                    </Form>

                    <Row gutter={[16, 16]}>
                      <Col xs={24} md={8}>
                        <Statistic title="Daily goals" value={dailyAggregation.totalEntries} />
                      </Col>
                      <Col xs={24} md={8}>
                        <Statistic title="Goals updated" value={dailyAggregation.withUpdates} />
                      </Col>
                      <Col xs={24} md={8}>
                        <Space direction="vertical" size={4} style={{ width: '100%', alignItems: 'center' }}>
                          <Progress type="circle" percent={dailyAggregation.updateCompletion} strokeColor={{ '0%': '#34d399', '100%': '#15803d' }} />
                          <Text type="secondary">Daily goals with updates</Text>
                        </Space>
                      </Col>
                    </Row>

                    {(dayPlan.dayNote ?? '').trim().length > 0 && (
                      <Alert type="success" showIcon message="Team note" description={dayPlan.dayNote} />
                    )}

                    {(dailyAggregation.testFiles.size > 0 || dailyAggregation.defectFiles.size > 0) && (
                      <Space direction="vertical" size={8} style={{ width: '100%' }}>
                        <Text strong>Artefacts touched today</Text>
                        <Space size={6} wrap>
                          {Array.from(dailyAggregation.testFiles.entries()).map(([file, count]) => (
                            <Tag key={`daily-test-${file}`} color="cyan">
                              Test · {file} ({count})
                            </Tag>
                          ))}
                          {Array.from(dailyAggregation.defectFiles.entries()).map(([file, count]) => (
                            <Tag key={`daily-defect-${file}`} color="magenta">
                              Defect · {file} ({count})
                            </Tag>
                          ))}
                        </Space>
                      </Space>
                    )}

                    <Divider style={{ margin: '8px 0' }} />

                    {dayPlan.entries.length === 0 ? (
                      <Empty description="No entries captured for the selected day" />
                    ) : (
                      <Timeline
                        items={dayPlan.entries.map((entry) => ({
                          color: (entry.updateSummary ?? '').trim() ? 'green' : 'gray',
                          children: (
                            <Space direction="vertical" size={4} style={{ width: '100%' }}>
                              <Text strong>{entry.title}</Text>
                              {entry.updateSummary ? (
                                <Text type="secondary">Update: {entry.updateSummary}</Text>
                              ) : (
                                <Text type="secondary">No update captured yet.</Text>
                              )}
                              {entry.comment ? (
                                <Text type="secondary">Comment: {entry.comment}</Text>
                              ) : null}
                              {(entry.testFiles?.length || 0) > 0 || (entry.defectFiles?.length || 0) > 0 ? (
                                <Space size={4} wrap>
                                  {(entry.testFiles ?? []).map((file) => {
                                    const trimmed = file.trim();
                                    if (!trimmed) return null;
                                    const label = testCaseFileLabelLookup.get(trimmed) ?? trimmed;
                                    return (
                                      <Tag key={`daily-timeline-${entry.id}-t-${trimmed}`} color="cyan">
                                        Test · {label}
                                      </Tag>
                                    );
                                  })}
                                  {(entry.defectFiles ?? []).map((file) => {
                                    const trimmed = file.trim();
                                    if (!trimmed) return null;
                                    const label = defectFileLabelLookup.get(trimmed) ?? trimmed;
                                    return (
                                      <Tag key={`daily-timeline-${entry.id}-d-${trimmed}`} color="magenta">
                                        Defect · {label}
                                      </Tag>
                                    );
                                  })}
                                </Space>
                              ) : null}
                            </Space>
                          )
                        }))}
                      />
                    )}
                  </Space>
                </Card>
              </Space>
            )
          },
          {
            key: 'history',
            label: 'History & insights',
            children: (
              <Space direction="vertical" size={20} style={{ width: '100%' }}>
                <Input.Search
                  placeholder="Search by date, focus area, theme or keyword"
                  allowClear
                  value={historySearch}
                  onChange={(event) => setHistorySearch(event.target.value)}
                />
                {historyItems.length === 0 ? (
                  <Empty description="No history entries matched" />
                ) : (
                  <Timeline
                    items={historyItems.map((item) => ({
                      color: item.type === 'weekly' ? 'blue' : 'green',
                      children: (
                        <Space direction="vertical" size={4} style={{ width: '100%' }}>
                          <Text strong>{item.label}</Text>
                          <Text type="secondary">Logged {dayjs(item.timestamp).format('MMM D, YYYY · HH:mm')}</Text>
                          {item.body ? (
                            <Text>{item.body}</Text>
                          ) : (
                            <Text type="secondary">No narrative recorded.</Text>
                          )}
                          <Space size={4} wrap>
                            {item.tags.map((tag) => (
                              <Tag key={tag} color="geekblue">
                                {tag}
                              </Tag>
                            ))}
                          </Space>
                        </Space>
                      )
                    }))}
                  />
                )}
              </Space>
            )
          }
        ]}
      />

      <Modal
        title={weeklyGoalModal.goal ? 'Edit weekly goal' : 'Add weekly goal'}
        open={weeklyGoalModal.open}
        onCancel={closeWeeklyGoalModal}
        onOk={handleSaveWeeklyGoal}
        okText={weeklyGoalModal.goal ? 'Update' : 'Create'}
      >
        <Form layout="vertical" form={weeklyGoalForm}>
          <Form.Item
            name="title"
            label="Goal"
            rules={[{ required: true, message: 'Provide a goal summary' }]}
          >
            <Input placeholder="eg. Complete regression pack for release v4.2" />
          </Form.Item>
          <Form.Item name="focusAreaId" label="Focus area">
            <Select
              allowClear
              options={focusAreas.map((area) => ({ value: area.id, label: area.name }))}
              placeholder="Select focus area"
            />
          </Form.Item>
          <Form.Item name="metric" label="Metric / definition of done">
            <Input placeholder="eg. 100% of critical suites executed" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="status" label="Status" initialValue="planned">
                <Select options={weeklyStatusOptions.map((status) => ({ value: status, label: weeklyStatusMeta[status].label }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="progress" label="Progress" initialValue={0}>
                <Slider marks={{ 0: '0%', 50: '50%', 100: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="impact" label="Impact" initialValue={3} rules={[{ type: 'number', min: 1, max: 5 }]}> 
                <Slider min={1} max={5} marks={{ 1: '1', 3: '3', 5: '5' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="owner" label="Owner">
                <Input placeholder="Optional collaborator" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={3} placeholder="Context, dependencies or links" />
          </Form.Item>
          <Form.Item name="updateSummary" label="Weekly update">
            <Input.TextArea rows={3} placeholder="Summarise progress and outcomes for this goal" />
          </Form.Item>
          <Form.Item name="changeNotes" label="Changes & risks">
            <Input.TextArea rows={2} placeholder="Capture scope shifts, risks or adjustments" />
          </Form.Item>
          <Form.Item name="reviewerNotes" label="Reviewer notes">
            <Input.TextArea rows={2} placeholder="Any additional commentary or follow-ups" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="testFiles" label="Related test case files">
                <Select
                  mode="tags"
                  placeholder="Link one or more test case files"
                  allowClear
                  options={testCaseFileOptions}
                  loading={testCaseFilesQuery.isLoading}
                  optionFilterProp="label"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="defectFiles" label="Related defect files">
                <Select
                  mode="tags"
                  placeholder="Link relevant defect tracker files"
                  allowClear
                  options={defectFileOptions}
                  loading={defectFilesQuery.isLoading}
                  optionFilterProp="label"
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal
        title={dailyEntryModal.entry ? 'Edit daily goal' : 'Add daily goal'}
        open={dailyEntryModal.open}
        onCancel={closeDailyEntryModal}
        onOk={handleSaveDailyEntry}
        okText={dailyEntryModal.entry ? 'Update' : 'Create'}
      >
        <Form layout="vertical" form={dailyEntryForm}>
          <Form.Item
            name="title"
            label="Goal"
            rules={[{ required: true, message: 'Provide a goal summary' }]}
          >
            <Input placeholder="eg. Validate payouts API edge cases" />
          </Form.Item>
          <Form.Item name="focusAreaId" label="Focus area">
            <Select
              allowClear
              placeholder="Link to a focus area"
              options={focusAreas.map((area) => ({ value: area.id, label: area.name }))}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="status" label="Status" initialValue="not_started">
                <Select options={dailyStatusOptions.map((status) => ({ value: status, label: dailyStatusMeta[status].label }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="impact" label="Impact" initialValue={3} rules={[{ type: 'number', min: 1, max: 5 }]}> 
                <Slider min={1} max={5} marks={{ 1: '1', 3: '3', 5: '5' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="effort" label="Effort" initialValue={2} rules={[{ type: 'number', min: 1, max: 5 }]}> 
                <Slider min={1} max={5} marks={{ 1: '1', 3: '3', 5: '5' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="notes" label="Notes">
                <Input placeholder="Optional context" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="updateSummary" label="Daily update">
            <Input.TextArea rows={2} placeholder="Summarise what happened for this goal today" />
          </Form.Item>
          <Form.Item name="comment" label="Comment">
            <Input.TextArea rows={2} placeholder="Additional commentary or follow-ups" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="testFiles" label="Related test files">
                <Select
                  mode="tags"
                  placeholder="Associate test case artefacts"
                  allowClear
                  options={testCaseFileOptions}
                  loading={testCaseFilesQuery.isLoading}
                  optionFilterProp="label"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="defectFiles" label="Related defect files">
                <Select
                  mode="tags"
                  placeholder="Associate defect artefacts"
                  allowClear
                  options={defectFileOptions}
                  loading={defectFilesQuery.isLoading}
                  optionFilterProp="label"
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {enablePageTests && <PageTestHarness pageName="GoalsPage" tests={pageTests} />}
    </Space>
  );
};

export default GoalsPage;
