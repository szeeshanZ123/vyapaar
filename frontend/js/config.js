/**
 * config.js - Supabase & Backend API Configuration for Vyapar
 * 
 * Supports environment variables or local fallback.
 */
window.VYAPAR_CONFIG = {
  // Supabase Project Credentials
  // Replace these with your actual Supabase URL & Anon Key if not using environment injection
  SUPABASE_URL: window.NEXT_PUBLIC_SUPABASE_URL || window.localStorage.getItem("VYAPAR_SUPABASE_URL") || "https://your-project.supabase.co",
  SUPABASE_ANON_KEY: window.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || window.localStorage.getItem("VYAPAR_SUPABASE_ANON_KEY") || "your-anon-key",

  // FastAPI Backend Base URL
  // In development: points to localhost:8000
  // In production: points to backend API
  API_BASE_URL: (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:8000"
    : (window.VYAPAR_API_URL || "/api")
};
