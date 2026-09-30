import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, BellRing } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/shared/i18n';
import { useFollows } from '@/shared/api/hooks';
import { follow, unfollow } from '@/shared/api/loop';
import type { FollowKind } from '@/shared/api/types';
import { useAuth } from '@/shared/state/auth';
import { Button } from './Button';
import { toast } from './Toast';

/** Follow or unfollow one supplier, project, ward or sector. Signed-out visitors are sent to sign in first. */
export function FollowButton({ kind, id, label, size = 'sm' }: { kind: FollowKind; id: string; label: string; size?: 'sm' | 'md' }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const nav = useNavigate();
  const status = useAuth((s) => s.status);
  const follows = useFollows();
  const on = (follows.data ?? []).some((f) => f.kind === kind && f.key === id);
  const toggle = useMutation({
    mutationFn: () => (on ? unfollow(kind, id) : follow(kind, id, label)),
    onSuccess: () => { toast({ tone: 'good', title: t(on ? 'loop.follow.removed' : 'loop.follow.added') }); void qc.invalidateQueries({ queryKey: ['follows'] }); },
    onError: (e) => toast({ tone: 'bad', title: (e as Error).message.includes('40') ? t('loop.follow.limit') : t('loop.feedback.error') }),
  });
  return (
    <Button
      size={size}
      variant={on ? 'soft' : 'secondary'}
      aria-pressed={on}
      loading={toggle.isPending}
      icon={on ? <BellRing className="size-4" aria-hidden /> : <Bell className="size-4" aria-hidden />}
      onClick={() => (status === 'anon' ? nav(`/services/account?next=${encodeURIComponent(window.location.pathname)}`) : toggle.mutate())}
    >
      {on ? t('loop.follow.following') : status === 'anon' ? t('loop.follow.signIn') : t('loop.follow.follow')}
    </Button>
  );
}
