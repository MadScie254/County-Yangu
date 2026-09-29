import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { ResidentShell } from './layout/ResidentShell';
import { Skeleton } from '@/shared/ui/Card';

const Home = lazy(() => import('./pages/Home'));
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
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
