/**
 * auth-client.js - Centralized Supabase Auth & FastAPI Client Layer
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.VyaparAuth = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const config = window.VYAPAR_CONFIG || {
    SUPABASE_URL: "https://your-project.supabase.co",
    SUPABASE_ANON_KEY: "your-anon-key",
    API_BASE_URL: "http://localhost:8000"
  };

  // Initialize Supabase Client
  let client = null;
  if (typeof supabase !== "undefined" && config.SUPABASE_URL && config.SUPABASE_ANON_KEY) {
    client = supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  }

  async function getSession() {
    if (!client) return null;
    const { data: { session }, error } = await client.auth.getSession();
    if (error) {
      console.warn("Error fetching Supabase session:", error.message);
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
    // Dynamic redirect back to the current domain's login handler
    const redirectTo = window.location.origin + "/login.html";
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
    window.location.href = "/";
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

  async function fetchUserProfile() {
    try {
      const res = await callBackendAPI("/api/users/profile");
      return res?.data || null;
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  }

  async function fetchVendorProfile() {
    try {
      const res = await callBackendAPI("/api/vendors/me");
      return res?.data || null;
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
  }

  /**
   * Auth Guard for Protected Pages (Dashboard, Discover, Recommendations, etc.)
   * Redirects unauthenticated visitors to Landing Page (/).
   * If profile is missing, redirects to /onboarding/role.
   */
  async function requireAuthOrRedirect() {
    const session = await getSession();
    if (!session) {
      window.location.href = "/";
      return null;
    }

    try {
      const profile = await fetchUserProfile();
      if (!profile) {
        window.location.href = "/onboarding/role.html";
        return null;
      }

      let vendor = null;
      if (profile.role === "vendor") {
        vendor = await fetchVendorProfile().catch(() => null);
      }

      return { session, user: session.user, profile, vendor };
    } catch (err) {
      console.warn("Failed checking user profile:", err);
      return { session, user: session.user, profile: null, vendor: null };
    }
  }

  /**
   * Auth Guard for Landing / Login / Signup Pages.
   * If user is already logged in:
   * - If profile exists -> redirect to /dashboard.html
   * - If no profile -> redirect to /onboarding/role.html
   */
  async function redirectIfAuthenticated() {
    const session = await getSession();
    if (!session) return;

    try {
      const profile = await fetchUserProfile();
      if (profile) {
        window.location.href = "/dashboard.html";
      } else {
        window.location.href = "/onboarding/role.html";
      }
    } catch (err) {
      window.location.href = "/dashboard.html";
    }
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
    callBackendAPI,
    fetchUserProfile,
    fetchVendorProfile,
    requireAuthOrRedirect,
    redirectIfAuthenticated
  };
});
