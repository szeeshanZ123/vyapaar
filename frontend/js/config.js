/**
 * config.js - Supabase & Backend API Configuration for Vyapar
 */
(function() {
  const SUPABASE_URL = "https://zbnquxvjdkmtjthcuhop.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpibnF1eHZqZGttdGp0aGN1aG9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5NjIyMzAsImV4cCI6MjEwNDUzODIzMH0.5dI5tLh6hDwo6XQQnX5MFY0A7pXB-y4T95RFgNqo7NU";

  window.VYAPAR_CONFIG = {
    // Supabase Project Credentials
    SUPABASE_URL: window.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL,
    SUPABASE_ANON_KEY: window.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || SUPABASE_ANON_KEY,

    // FastAPI Backend Base URL
    API_BASE_URL: (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
      ? "http://localhost:8000"
      : (window.VYAPAR_API_URL || "/api"),

    isConfigured: function() {
      return !!(this.SUPABASE_URL && this.SUPABASE_ANON_KEY && !this.SUPABASE_URL.includes("your-project"));
    },

    saveCredentials: function(url, key) {
      if (url && key) {
        window.localStorage.setItem("VYAPAR_SUPABASE_URL", url.trim());
        window.localStorage.setItem("VYAPAR_SUPABASE_ANON_KEY", key.trim());
        window.location.reload();
      }
    }
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { SUPABASE_URL, SUPABASE_ANON_KEY };
  }
})();
