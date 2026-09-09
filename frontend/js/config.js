/**
 * config.js - Supabase & Backend API Configuration for Vyapar
 */
(function() {
  const storedUrl = window.localStorage.getItem("VYAPAR_SUPABASE_URL");
  const storedKey = window.localStorage.getItem("VYAPAR_SUPABASE_ANON_KEY");
  
  // Check if credentials are set
  const supabaseUrl = window.NEXT_PUBLIC_SUPABASE_URL || storedUrl || "";
  const supabaseKey = window.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || storedKey || "";

  window.VYAPAR_CONFIG = {
    // Supabase Project Credentials
    SUPABASE_URL: supabaseUrl,
    SUPABASE_ANON_KEY: supabaseKey,

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
})();
