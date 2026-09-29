// A stand-in for @supabase/supabase-js: records what the Edge Functions ask for and answers from `state`.
// deno-lint-ignore-file no-explicit-any
import { state } from './state.ts';

function chain(table: string): any {
  const rows = () => state.tables[table] ?? [];
  const p: any = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === 'then') return (res: (v: unknown) => void) => res({ data: rows(), error: null });
      if (prop === 'maybeSingle') return () => Promise.resolve({ data: rows()[0] ?? null, error: null });
      return () => p;
    },
  });
  return p;
}

export function createClient(_url: string, _key: string, opts?: any) {
  const acting: 'service' | 'user' = opts?.global?.headers?.Authorization ? 'user' : 'service';
  return {
    rpc: async (name: string, args: any = {}) => {
      state.calls.push({ name, args, as: acting });
      const h = state.rpc[name];
      if (!h) return { data: null, error: { code: 'XX000', message: `no fake for ${name}` } };
      try {
        return { data: await h(args), error: null };
      } catch (e) {
        return { data: null, error: { code: (e as any).code ?? 'XX000', message: (e as Error).message } };
      }
    },
    from: (table: string) => chain(table),
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, bytes: Uint8Array, o: { contentType: string }) => {
          if (state.uploadError) return { error: state.uploadError };
          state.uploads.push({ bucket, path, bytes, type: o.contentType });
          return { error: null };
        },
        remove: async (paths: string[]) => {
          state.removed.push(paths);
          return { error: null };
        },
      }),
    },
    auth: {
      getUser: async (jwt: string) => {
        const u = state.users[jwt];
        return u ? { data: { user: u }, error: null } : { data: { user: null }, error: { message: 'invalid JWT' } };
      },
      admin: {
        createUser: async (a: any) => {
          state.createdUsers.push(a);
          return { data: { user: { id: 'new-user-id', email: a.email } }, error: null };
        },
        deleteUser: async (id: string) => {
          state.deletedUsers.push(id);
          return { error: null };
        },
      },
    },
  };
}
export type SupabaseClient = ReturnType<typeof createClient>;
