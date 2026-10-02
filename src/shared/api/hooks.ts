import { useQuery } from '@tanstack/react-query';
import { getChampionChecks, getChampionQueue, getChampions, getConcerns, getCountyFinance, getDisclosureInbox, getFixedGallery, getModerationQueue, getMyChampion, getMyPollVotes, getMyStatementVotes, getPollResults, getPolls, getStatementResults } from './civic2';
import { getLegalDeadlines, getConsultationComments, getConsultations, getConsultationTally, getErasureQueue, getInfoRequest, getInfoRequests, getMyInfoRequests } from './rights';
import { getCommitments, getNotices, getOpenCases, getProjectChecks, getMeetings, getAssembly, getBudgetResults, getFixStats, getOcds, getWardScorecard, listFollows, verifyDocument } from './loop';
import { getProcurementWatch } from './procurement';
import { getEvents, getLiveActivity, getMcaScoreboard, getMyQuestionVotes, getMyRsvps, getQuestions, getWardLeague } from './engage';
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
export const useNotices = () => useQuery({ queryKey: ['notices'], queryFn: getNotices, staleTime: minute });
export const useCommitments = () => useQuery({ queryKey: ['commitments'], queryFn: getCommitments, staleTime: 5 * minute });
export const useInfoRequests = () => useQuery({ queryKey: ['info-requests'], queryFn: getInfoRequests, staleTime: minute });
export const useInfoRequest = (ref: string | null) => useQuery({ queryKey: ['info-request', ref], queryFn: () => getInfoRequest(ref!), enabled: Boolean(ref), staleTime: minute });
export const useMyInfoRequests = (enabled: boolean) => useQuery({ queryKey: ['my-info-requests'], queryFn: getMyInfoRequests, enabled, staleTime: minute });
export const useConsultations = () => useQuery({ queryKey: ['consultations'], queryFn: getConsultations, staleTime: 5 * minute });
export const useConsultationComments = (id: string | null) => useQuery({ queryKey: ['consultation-comments', id], queryFn: () => getConsultationComments(id!), enabled: Boolean(id), staleTime: minute });
export const useConsultationTally = (slug: string | null) => useQuery({ queryKey: ['consultation-tally', slug], queryFn: () => getConsultationTally(slug!), enabled: Boolean(slug), staleTime: minute });
export const useErasureQueue = (enabled: boolean) => useQuery({ queryKey: ['erasure-queue'], queryFn: getErasureQueue, enabled, staleTime: minute });
export const useLegalDeadlines = () => useQuery({ queryKey: ['legal-deadlines'], queryFn: getLegalDeadlines, staleTime: 5 * minute });
export const useFixedGallery = (limit = 24) => useQuery({ queryKey: ['fixed', limit], queryFn: () => getFixedGallery(limit), staleTime: 5 * minute });
export const useChampions = () => useQuery({ queryKey: ['champions'], queryFn: getChampions, staleTime: 5 * minute });
export const useMyChampion = (userId: string | undefined) => useQuery({ queryKey: ['my-champion', userId], queryFn: () => getMyChampion(userId), enabled: Boolean(userId), staleTime: minute });
export const useChampionQueue = () => useQuery({ queryKey: ['champion-queue'], queryFn: getChampionQueue, staleTime: minute });
export const useChampionChecks = (slug: string | null) => useQuery({ queryKey: ['champion-checks', slug], queryFn: () => getChampionChecks(slug!), enabled: Boolean(slug), staleTime: minute });
export const useConcerns = () => useQuery({ queryKey: ['concerns'], queryFn: getConcerns, staleTime: minute });
export const useCountyFinance = () => useQuery({ queryKey: ['county-finance'], queryFn: getCountyFinance, staleTime: 10 * minute });
export const useStatementResults = (slug: string | null) => useQuery({ queryKey: ['statements', slug], queryFn: () => getStatementResults(slug!), enabled: Boolean(slug), staleTime: 30_000 });
export const useMyStatementVotes = (enabled: boolean) => useQuery({ queryKey: ['my-statement-votes'], queryFn: getMyStatementVotes, enabled, staleTime: minute });
export const usePolls = () => useQuery({ queryKey: ['polls'], queryFn: getPolls, staleTime: minute });
export const usePollResults = (slug: string | null) => useQuery({ queryKey: ['poll-results', slug], queryFn: () => getPollResults(slug!), enabled: Boolean(slug), staleTime: 30_000 });
export const useMyPollVotes = (enabled: boolean) => useQuery({ queryKey: ['my-poll-votes'], queryFn: getMyPollVotes, enabled, staleTime: minute });
export const useModerationQueue = () => useQuery({ queryKey: ['moderation'], queryFn: getModerationQueue, staleTime: 30_000 });
export const useDisclosureInbox = () => useQuery({ queryKey: ['disclosures'], queryFn: getDisclosureInbox, staleTime: 30_000 });
export const useMeetings = () => useQuery({ queryKey: ['meetings'], queryFn: getMeetings, staleTime: 5 * minute });
export const useOpenCases = (ward: string | null, category: string | null) => useQuery({ queryKey: ['open-cases', ward, category], queryFn: () => getOpenCases(ward!, category), enabled: Boolean(ward), staleTime: minute });
export const useProjectChecks = (slug: string | null) => useQuery({ queryKey: ['project-checks', slug], queryFn: () => getProjectChecks(slug!), enabled: Boolean(slug), staleTime: minute });

// migration 0023
export const useWardLeague = (days = 30) => useQuery({ queryKey: ['league', days], queryFn: () => getWardLeague(days), staleTime: 5 * minute });
export const useLiveActivity = (limit = 30) => useQuery({ queryKey: ['live', limit], queryFn: () => getLiveActivity(limit), staleTime: 20_000, refetchInterval: 30_000 });
export const useEvents = () => useQuery({ queryKey: ['events'], queryFn: getEvents, staleTime: minute });
export const useMyRsvps = (enabled: boolean) => useQuery({ queryKey: ['my-rsvps'], queryFn: getMyRsvps, enabled, staleTime: minute });
export const useQuestions = (wardId: string | null) => useQuery({ queryKey: ['questions', wardId], queryFn: () => getQuestions(wardId), staleTime: minute });
export const useMyQuestionVotes = (enabled: boolean) => useQuery({ queryKey: ['my-question-votes'], queryFn: getMyQuestionVotes, enabled, staleTime: minute });
export const useMcaScoreboard = () => useQuery({ queryKey: ['mca-scoreboard'], queryFn: getMcaScoreboard, staleTime: 5 * minute });
