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
    SUPABASE_URL: "",
    SUPABASE_ANON_KEY: "",
    API_BASE_URL: "http://localhost:8000",
    isConfigured: () => false
  };

  // Initialize Supabase Client
  let client = null;
  if (typeof supabase !== "undefined" && config.SUPABASE_URL && config.SUPABASE_ANON_KEY && !config.SUPABASE_URL.includes("your-project")) {
    client = supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  }

  function ensureClient() {
    if (!client) {
      if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY || config.SUPABASE_URL.includes("your-project")) {
        throw new Error("Supabase is not configured yet. Please enter your Supabase Project URL and Anon Key.");
      }
      if (typeof supabase !== "undefined") {
        client = supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
      } else {
        throw new Error("Supabase library is not loaded. Check internet connection.");
      }
    }
    return client;
  }

  async function getSession() {
    if (!client && (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY)) return null;
    try {
      const c = ensureClient();
      const { data: { session }, error } = await c.auth.getSession();
      if (error) {
        console.warn("Error fetching Supabase session:", error.message);
        return null;
      }
      return session;
    } catch (err) {
      return null;
    }
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
    const c = ensureClient();
    // Dynamic redirect back to the current domain's login handler
    const redirectTo = window.location.origin + "/login.html";
    const { error } = await c.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectTo
      }
    });
    if (error) throw error;
  }

  async function loginWithEmail(email, password) {
    const c = ensureClient();
    const { data, error } = await c.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  }

  async function signupWithEmail(email, password) {
    const c = ensureClient();
    const { data, error } = await c.auth.signUp({
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

  async function saveUserProfile(name, role = "user") {
    // 1. Update in Supabase Auth Metadata (works seamlessly on Vercel static & cloud)
    if (client) {
      try {
        await client.auth.updateUser({
          data: { name: name, role: role }
        });
      } catch (err) {
        console.warn("Supabase user metadata update error:", err);
      }
    }

    // 2. Try FastAPI Backend if available
    try {
      await callBackendAPI("/api/users/profile", {
        method: "POST",
        body: JSON.stringify({ name, role })
      });
    } catch (err) {
      if (err.status === 409) {
        try {
          await callBackendAPI("/api/users/profile", {
            method: "PATCH",
            body: JSON.stringify({ name, role })
          });
        } catch (e) {
          console.warn("FastAPI backend PATCH error:", e);
        }
      } else {
        console.warn("FastAPI backend not reachable at /api (using Supabase & local storage):", err.message);
      }
    }

    // 3. Save to localStorage
    const profile = { name, role };
    localStorage.setItem("vyapar_user_profile", JSON.stringify(profile));
    return profile;
  }

  async function saveVendorProfile(vendorData) {
    const displayName = vendorData.display_name || vendorData.name || "Vendor";
    const businessName = vendorData.business_name || displayName;

    // 1. Update in Supabase Auth Metadata
    if (client) {
      try {
        await client.auth.updateUser({
          data: {
            name: displayName,
            role: "vendor",
            business_name: businessName,
            category: vendorData.category,
            vendor_profile: vendorData
          }
        });
      } catch (err) {
        console.warn("Supabase user metadata update error:", err);
      }
    }

    // 2. Try FastAPI Backend
    try {
      // User Profile
      try {
        await callBackendAPI("/api/users/profile", {
          method: "POST",
          body: JSON.stringify({ name: displayName, role: "vendor" })
        });
      } catch (uErr) {
        if (uErr.status === 409) {
          await callBackendAPI("/api/users/profile", {
            method: "PATCH",
            body: JSON.stringify({ name: displayName, role: "vendor" })
          }).catch(() => {});
        }
      }

      // Vendor Onboarding
      await callBackendAPI("/api/vendors/onboarding", {
        method: "POST",
        body: JSON.stringify(vendorData)
      });
    } catch (err) {
      console.warn("FastAPI backend not reachable at /api (using Supabase & local storage):", err.message);
    }

    // 3. Save to localStorage
    localStorage.setItem("vyapar_user_profile", JSON.stringify({ name: displayName, role: "vendor" }));
    localStorage.setItem("vyapar_vendor_profile", JSON.stringify(vendorData));
    return vendorData;
  }

  async function fetchUserProfile() {
    // 1. Try FastAPI Backend
    try {
      const res = await callBackendAPI("/api/users/profile");
      if (res?.data) return res.data;
    } catch (err) {
      // fallback
    }

    // 2. Try Supabase Auth user_metadata
    try {
      const user = await getUser();
      if (user?.user_metadata?.role) {
        return {
          name: user.user_metadata.name || user.email?.split("@")[0] || "User",
          role: user.user_metadata.role
        };
      }
    } catch (err) {
      // fallback
    }

    // 3. Try LocalStorage
    try {
      const local = localStorage.getItem("vyapar_user_profile");
      if (local) return JSON.parse(local);
    } catch (e) {}

    return null;
  }

  async function fetchVendorProfile() {
    // 1. Try FastAPI Backend
    try {
      const res = await callBackendAPI("/api/vendors/me");
      if (res?.data) return res.data;
    } catch (err) {
      // fallback
    }

    // 2. Try Supabase Auth user_metadata
    try {
      const user = await getUser();
      if (user?.user_metadata?.vendor_profile) {
        return user.user_metadata.vendor_profile;
      }
    } catch (err) {
      // fallback
    }

    // 3. Try LocalStorage
    try {
      const local = localStorage.getItem("vyapar_vendor_profile");
      if (local) return JSON.parse(local);
    } catch (e) {}

    return null;
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
    saveUserProfile,
    saveVendorProfile,
    fetchUserProfile,
    fetchVendorProfile,
    requireAuthOrRedirect,
    redirectIfAuthenticated
  };
});
