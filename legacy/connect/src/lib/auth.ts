import { supabase } from "./supabase";

export async function logout() {
  await supabase.auth.signOut();
  if (typeof window !== "undefined") {
    // Keep county selection if needed, but remove any legacy mock tokens
    localStorage.removeItem("countyconnect:session");
  }
}

// Note: Other auth logic like getting current session or roles is now handled 
// reactively via supabase.auth.onAuthStateChange in components like ProtectedRoute.
