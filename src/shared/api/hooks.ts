import { useQuery } from '@tanstack/react-query';
import { getMeetings, getAssembly, getBudgetResults, getFixStats, getOcds, getWardScorecard, listFollows, verifyDocument } from './loop';
import { getProcurementWatch } from './procurement';
import { dataSource, getActivity, getCategorySla, getCaseStatus, getCountySummary, getProjects, getProposals, getPulse, getTenders, getVoteData, getWardStats } from './public';

const minute = 60_000;

export const useDataSource = () => useQuery({ queryKey: ['source'], queryFn: dataSource, staleTime: Infinity });
export const useIsDemo = () => useDataSource().data === 'demo';

export const useWardStats = () => useQuery({ queryKey: ['ward-stats'], queryFn: getWardStats, staleTime: 2 * minute });
export const useCountySummary = () => useQuery({ queryKey: ['county-summary'], queryFn: getCountySummary, staleTime: 2 * minute });
export const useProjects = () => useQuery({ queryKey: ['projects'], queryFn: getProjects, staleTime: 5 * minute });
export const useTenders = () => useQuery({ queryKey: ['tenders'], queryFn: getTenders, staleTime: 5 * minute });
export const useActivity = () => useQuery({ queryKey: ['activity'], queryFn: getActivity, staleTime: minute });
export const useCaseStatus = (reference: string | null) =>
  useQuery({ queryKey: ['case', reference], queryFn: () => getCaseStatus(reference!), enabled: Boolean(reference), staleTime: 30_000 });
export const useVoteData = (wardId: string | null) => useQuery({ queryKey: ['vote', wardId], queryFn: () => getVoteData(wardId!), enabled: Boolean(wardId), staleTime: 30_000 });
export const useProposals = () => useQuery({ queryKey: ['proposals'], queryFn: getProposals, staleTime: 2 * minute });
export const usePulse = () => useQuery({ queryKey: ['pulse'], queryFn: getPulse, staleTime: 5 * minute });
export const useProcurementWatch = () => useQuery({ queryKey: ['procurement-watch'], queryFn: getProcurementWatch, staleTime: 5 * minute });
export const useCategorySla = () => useQuery({ queryKey: ['category-sla'], queryFn: getCategorySla, staleTime: 30 * minute });
export const useFixStats = () => useQuery({ queryKey: ['fix-stats'], queryFn: getFixStats, staleTime: 5 * minute });
export const useBudgetResults = (cycle?: string | null) => useQuery({ queryKey: ['budget-results', cycle ?? 'latest'], queryFn: () => getBudgetResults(cycle), staleTime: 5 * minute });
export const useAssembly = () => useQuery({ queryKey: ['assembly'], queryFn: getAssembly, staleTime: 5 * minute });
export const useWardScorecard = (ward: string | null) => useQuery({ queryKey: ['scorecard', ward], queryFn: () => getWardScorecard(ward!), enabled: Boolean(ward), staleTime: 5 * minute });
export const useVerify = (code: string | null) => useQuery({ queryKey: ['verify', code], queryFn: () => verifyDocument(code!), enabled: Boolean(code), staleTime: 30_000, retry: false });
export const useFollows = () => useQuery({ queryKey: ['follows'], queryFn: listFollows, staleTime: minute });
export const useOcds = (limit: number) => useQuery({ queryKey: ['ocds', limit], queryFn: () => getOcds(limit), staleTime: 10 * minute });
export const useMeetings = () => useQuery({ queryKey: ['meetings'], queryFn: getMeetings, staleTime: 5 * minute });
