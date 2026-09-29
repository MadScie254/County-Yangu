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
