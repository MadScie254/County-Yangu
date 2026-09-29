import { useQuery } from '@tanstack/react-query';
import { dataSource, getActivity, getCaseStatus, getCountySummary, getProjects, getProposals, getPulse, getTenders, getVoteData, getWardStats } from './public';

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
