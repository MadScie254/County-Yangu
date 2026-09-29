// Shared, resettable state for the fake Supabase client: what the functions asked the database for, what was stored, who is signed in.
// deno-lint-ignore-file no-explicit-any
export type Call = { name: string; args: any; as: 'service' | 'user' };

export const state = {
  rpc: {} as Record<string, (args: any) => unknown>,
  calls: [] as Call[],
  tables: {} as Record<string, any[]>,
  uploads: [] as { bucket: string; path: string; bytes: Uint8Array; type: string }[],
  removed: [] as string[][],
  uploadError: null as { message: string } | null,
  users: {} as Record<string, { id: string; email: string }>,
  createdUsers: [] as any[],
  deletedUsers: [] as string[],
  fetches: [] as { url: string; init: RequestInit }[],
};

export function reset() {
  state.rpc = {};
  state.calls = [];
  state.uploads = [];
  state.removed = [];
  state.uploadError = null;
  state.users = {};
  state.createdUsers = [];
  state.deletedUsers = [];
  state.fetches = [];
}

export const called = (name: string) => state.calls.filter((c) => c.name === name);
