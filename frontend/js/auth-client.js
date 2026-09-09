/**
 * auth-client.js - Centralized Supabase Auth & FastAPI Client
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.VyaparAuth = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Check if supabase SDK is loaded
  if (typeof supabase === "undefined") {
    console.error("Supabase SDK is not loaded. Please include supabase-js CDN.");
  }

  const config = window.VYAPAR_CONFIG || {
    SUPABASE_URL: "https://your-project.supabase.co",
    SUPABASE_ANON_KEY: "your-anon-key",
    API_BASE_URL: "http://localhost:8000"
  };

  // Initialize Supabase Client
  const client = (typeof supabase !== "undefined" && config.SUPABASE_URL && config.SUPABASE_ANON_KEY)
    ? supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY)
    : null;

  async function getSession() {
    if (!client) return null;
    const { data: { session }, error } = await client.auth.getSession();
    if (error) {
      console.warn("Error fetching session:", error.message);
      return null;
    }
    return session;
  }

  async function getUser() {
    const session = await getSession();
    return session ? session.user : null;
  }

  async function getAccessToken() {
    const session = await getSession();
    return session ? session.access_token : null;
  }

  async function loginWithGoogle() {
    if (!client) throw new Error("Supabase client is not initialized.");
    const redirectTo = window.location.origin + "/role-selection.html";
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectTo
      }
    });
    if (error) throw error;
  }

  async function loginWithEmail(email, password) {
    if (!client) throw new Error("Supabase client is not initialized.");
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  }

  async function signupWithEmail(email, password) {
    if (!client) throw new Error("Supabase client is not initialized.");
    const { data, error } = await client.auth.signUp({
      email,
      password
    });
    if (error) throw error;
    return data;
  }

  async function logout() {
    if (client) {
      await client.auth.signOut();
    }
    window.location.href = "landing.html";
  }

  async function requireAuth(redirectPath = "login.html") {
    const session = await getSession();
    if (!session) {
      window.location.href = redirectPath;
      return null;
    }
    return session;
  }

  async function redirectIfAuthenticated(targetPath = "auth-home.html") {
    const session = await getSession();
    if (session) {
      window.location.href = targetPath;
    }
  }

  async function callBackendAPI(endpoint, options = {}) {
    const token = await getAccessToken();
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const url = endpoint.startsWith("http") 
      ? endpoint 
      : `${config.API_BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers
    });

    const responseData = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMsg = responseData?.error?.message || responseData?.detail || `Request failed with status ${response.status}`;
      const err = new Error(errorMsg);
      err.status = response.status;
      err.data = responseData;
      throw err;
    }

    return responseData;
  }

  return {
    client,
    getSession,
    getUser,
    getAccessToken,
    loginWithGoogle,
    loginWithEmail,
    signupWithEmail,
    logout,
    requireAuth,
    redirectIfAuthenticated,
    callBackendAPI
  };
});
