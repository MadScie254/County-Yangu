import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { ResidentShell } from './layout/ResidentShell';
import { RequireAuth } from './components/RequireAuth';
import { Skeleton } from '@/shared/ui/Card';

const Home = lazy(() => import('./pages/Home'));
const Report = lazy(() => import('./pages/Report'));
const CaseLookup = lazy(() => import('./pages/CaseLookup'));
const CaseDetail = lazy(() => import('./pages/CaseDetail'));
const Projects = lazy(() => import('./pages/Projects'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const Vote = lazy(() => import('./pages/Vote'));
const Alerts = lazy(() => import('./pages/Alerts'));
const Ideas = lazy(() => import('./pages/Ideas'));
const Tenders = lazy(() => import('./pages/Tenders'));
const Pulse = lazy(() => import('./pages/Pulse'));
const HowItWorks = lazy(() => import('./pages/HowItWorks'));
const Services = lazy(() => import('./pages/services/Services'));
const ServiceApply = lazy(() => import('./pages/services/ServiceApply'));
const Account = lazy(() => import('./pages/services/Account'));
const MyApplications = lazy(() => import('./pages/services/MyApplications'));
const ApplicationDetail = lazy(() => import('./pages/services/ApplicationDetail'));
const Notifications = lazy(() => import('./pages/services/Notifications'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Verify = lazy(() => import('./pages/Verify'));
const Results = lazy(() => import('./pages/Results'));
const Assembly = lazy(() => import('./pages/Assembly'));
const WardScorecard = lazy(() => import('./pages/WardScorecard'));
const Compare = lazy(() => import('./pages/Compare'));
const Notices = lazy(() => import('./pages/Notices'));
const Promises = lazy(() => import('./pages/Promises'));
const Information = lazy(() => import('./pages/Information'));
const InformationDetail = lazy(() => import('./pages/InformationDetail'));
const HaveYourSay = lazy(() => import('./pages/HaveYourSay'));
const ConsultationDetail = lazy(() => import('./pages/ConsultationDetail'));
const Meetings = lazy(() => import('./pages/Meetings'));
const OpenApi = lazy(() => import('./pages/OpenApi'));
const OpenCounty = lazy(() => import('./pages/OpenCounty'));
const Fixed = lazy(() => import('./pages/Fixed'));
const SpeakUp = lazy(() => import('./pages/SpeakUp'));
const Champions = lazy(() => import('./pages/Champions'));
const Counties = lazy(() => import('./pages/Counties'));
const Polls = lazy(() => import('./pages/Polls'));
const League = lazy(() => import('./pages/League'));
const Events = lazy(() => import('./pages/Events'));
const Ask = lazy(() => import('./pages/Ask'));
const Guess = lazy(() => import('./pages/Guess'));
const Wrapped = lazy(() => import('./pages/Wrapped'));
const NotFound = lazy(() => import('./pages/NotFound'));

function PageFallback() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-10">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-40" />
      <Skeleton className="h-40" />
    </div>
  );
}

export function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route element={<ResidentShell />}>
          <Route index element={<Home />} />
          <Route path="report" element={<Report />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:slug" element={<ProjectDetail />} />
          <Route path="vote" element={<Vote />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="ideas" element={<Ideas />} />
          <Route path="tenders" element={<Tenders />} />
          <Route path="pulse" element={<Pulse />} />
          <Route path="open" element={<OpenCounty />} />
          <Route path="open/api" element={<OpenApi />} />
          <Route path="verify" element={<Verify />} />
          <Route path="verify/:code" element={<Verify />} />
          <Route path="vote/results" element={<Results />} />
          <Route path="assembly" element={<Assembly />} />
          <Route path="meetings" element={<Meetings />} />
          <Route path="ward/:id" element={<WardScorecard />} />
          <Route path="compare" element={<Compare />} />
          <Route path="notices" element={<Notices />} />
          <Route path="promises" element={<Promises />} />
          <Route path="information" element={<Information />} />
          <Route path="information/:reference" element={<InformationDetail />} />
          <Route path="have-your-say" element={<HaveYourSay />} />
          <Route path="have-your-say/:slug" element={<ConsultationDetail />} />
          <Route path="fixed" element={<Fixed />} />
          <Route path="speak-up" element={<SpeakUp />} />
          <Route path="champions" element={<Champions />} />
          <Route path="counties" element={<Counties />} />
          <Route path="polls" element={<Polls />} />
          <Route path="league" element={<League />} />
          <Route path="events" element={<Events />} />
          <Route path="ask" element={<Ask />} />
          <Route path="guess" element={<Guess />} />
          <Route path="wrapped" element={<Wrapped />} />
          <Route path="me" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="how-it-works" element={<HowItWorks />} />
          <Route path="services" element={<Services />} />
          <Route path="services/account" element={<Account />} />
          <Route path="services/applications" element={<RequireAuth><MyApplications /></RequireAuth>} />
          <Route path="services/applications/:id" element={<RequireAuth><ApplicationDetail /></RequireAuth>} />
          <Route path="services/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
          <Route path="services/:slug/apply" element={<RequireAuth><ServiceApply /></RequireAuth>} />
          <Route path="case" element={<CaseLookup />} />
          <Route path="case/:reference" element={<CaseDetail />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
