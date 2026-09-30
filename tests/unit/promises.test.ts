import { describe, expect, it } from 'vitest';
import { isOverdue } from '@/shared/api/loop';

describe('isOverdue', () => {
  const today = '2026-09-30';
  it('is past due only when the date has passed and the promise is still open', () => {
    expect(isOverdue({ due_on: '2026-09-29', status: 'in_progress' }, today)).toBe(true);
    expect(isOverdue({ due_on: '2026-09-29', status: 'delayed' }, today)).toBe(true);
    expect(isOverdue({ due_on: '2026-09-30', status: 'not_started' }, today)).toBe(false);
  });
  it('never counts delivered, dropped or undated promises', () => {
    expect(isOverdue({ due_on: '2020-01-01', status: 'delivered' }, today)).toBe(false);
    expect(isOverdue({ due_on: '2020-01-01', status: 'dropped' }, today)).toBe(false);
    expect(isOverdue({ due_on: null, status: 'in_progress' }, today)).toBe(false);
  });
});
