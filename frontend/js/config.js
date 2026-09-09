/**
 * config.js - Supabase & Backend API Configuration for Vyapar
 * 
 * Replace placeholders below with your Supabase Project details:
 * Project Settings -> API -> URL & anon public key.
 */
window.VYAPAR_CONFIG = {
  // Supabase Project Configuration
  SUPABASE_URL: window.localStorage.getItem("VYAPAR_SUPABASE_URL") || "https://your-project.supabase.co",
  SUPABASE_ANON_KEY: window.localStorage.getItem("VYAPAR_SUPABASE_ANON_KEY") || "your-anon-key",

  // FastAPI Backend Base URL
  // Automatically points to local FastAPI server on 8000 during local dev
  API_BASE_URL: window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:8000"
    : "/api"
};
