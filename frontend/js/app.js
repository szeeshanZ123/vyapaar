/**
 * app.js - VYAPAR Street Vendor Intelligence Platform
 * Global Application Shell, Navigation & Shared Utilities
 * 
 * Responsibilities:
 * - Active navigation item sync across desktop sidebar, mobile drawer, and bottom navigation
 * - Mobile drawer hamburger toggle
 * - Global notification / toast system
 * - Global modal controllers
 * - URL parameter resolution
 * - Route navigation helpers
 */

(function () {
  "use strict";

  // Navigation route mapping
  const ROUTES = {
    dashboard: "index.html",
    places: "recommendations.html",
    "check-in": "checkin.html",
    alerts: "alerts.html",
    "discover-vendors": "discover.html",
    profile: "#profile",
    settings: "#settings",
    logout: "#logout",
  };

  /**
   * Determine the current logical page
   */
  function getCurrentPage() {
    const bodyPage = document.body.getAttribute("data-page");
    if (bodyPage) return bodyPage;

    const path = window.location.pathname.toLowerCase();
    if (path.endsWith("recommendations.html") || path.includes("recommendations")) {
      return "recommendations";
    }
    if (path.endsWith("spot.html") || path.includes("spot")) {
      return "spot";
    }
    if (path.endsWith("checkin.html") || path.includes("checkin")) {
      return "checkin";
    }
    if (path.endsWith("alerts.html") || path.includes("alerts")) {
      return "alerts";
    }
    if (path.endsWith("alert-detail.html") || path.includes("alert-detail")) {
      return "alert-detail";
    }
    if (path.endsWith("discover.html") || path.includes("discover")) {
      return "discover";
    }
    return "home";
  }

  /**
   * Map page identifier to its active navigation category
   */
  function getActiveNavKey(page) {
    switch (page) {
      case "home":
        return "dashboard";
      case "recommendations":
      case "spot":
        return "places";
      case "checkin":
        return "check-in";
      case "alerts":
      case "alert-detail":
        return "alerts";
      case "discover":
        return "discover-vendors";
      default:
        return "dashboard";
    }
  }

  /**
   * Sync active navigation states across desktop sidebar and mobile navigation
   */
  function syncNavigation() {
    const page = getCurrentPage();
    const activeKey = getActiveNavKey(page);

    // 1. Sync Desktop Sidebar Links
    const sidebarLinks = document.querySelectorAll("aside nav a");
    sidebarLinks.forEach((link) => {
      const dataPath = link.getAttribute("data-path");
      if (ROUTES[dataPath]) {
        link.setAttribute("href", ROUTES[dataPath]);
      }

      if (dataPath === activeKey) {
        link.setAttribute("aria-current", "page");
        link.className =
          "w-12 h-12 rounded-xl flex items-center justify-center transition-all bg-primary-container text-on-primary-container font-headline-sm shadow-sm";
        const icon = link.querySelector(".material-symbols-outlined");
        if (icon) icon.style.fontVariationSettings = "'FILL' 1";
      } else {
        link.removeAttribute("aria-current");
        link.className =
          "w-12 h-12 rounded-xl flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all";
        const icon = link.querySelector(".material-symbols-outlined");
        if (icon) icon.style.fontVariationSettings = "'FILL' 0";
      }
    });

    // 2. Sync Mobile Bottom Navigation
    const bottomNavItems = document.querySelectorAll(
      ".mobile-bottom-nav a, [data-bottom-nav] a"
    );
    bottomNavItems.forEach((item) => {
      const navKey = item.getAttribute("data-nav-key");
      if (navKey === activeKey) {
        item.classList.add("text-primary", "font-bold");
        item.classList.remove("text-on-surface-variant");
        const icon = item.querySelector(".material-symbols-outlined");
        if (icon) icon.style.fontVariationSettings = "'FILL' 1";
      } else {
        item.classList.remove("text-primary", "font-bold");
        item.classList.add("text-on-surface-variant");
        const icon = item.querySelector(".material-symbols-outlined");
        if (icon) icon.style.fontVariationSettings = "'FILL' 0";
      }
    });

    // 3. Sync Mobile Drawer Links
    const drawerLinks = document.querySelectorAll("#mobile-drawer nav a");
    drawerLinks.forEach((link) => {
      const dataPath = link.getAttribute("data-path");
      if (dataPath === activeKey) {
        link.classList.add("bg-primary-container", "text-on-primary-container");
        link.classList.remove("text-on-surface");
      } else {
        link.classList.remove("bg-primary-container", "text-on-primary-container");
        link.classList.add("text-on-surface");
      }
    });
  }

  /**
   * Mobile Drawer Toggle
   */
  function setupMobileDrawer() {
    const hamburgerBtn = document.getElementById("vyapar-mobile-hamburger");
    const drawer = document.getElementById("mobile-drawer");
    const drawerOverlay = document.getElementById("mobile-drawer-overlay");
    const drawerCloseBtn = document.getElementById("mobile-drawer-close");

    if (!drawer) return;

    function openDrawer() {
      drawer.classList.remove("-translate-x-full");
      if (drawerOverlay) drawerOverlay.classList.remove("hidden");
      document.body.classList.add("overflow-hidden");
    }

    function closeDrawer() {
      drawer.classList.add("-translate-x-full");
      if (drawerOverlay) drawerOverlay.classList.add("hidden");
      document.body.classList.remove("overflow-hidden");
    }

    if (hamburgerBtn) hamburgerBtn.addEventListener("click", openDrawer);
    if (drawerCloseBtn) drawerCloseBtn.addEventListener("click", closeDrawer);
    if (drawerOverlay) drawerOverlay.addEventListener("click", closeDrawer);
  }

  /**
   * Global Toast Notification Manager
   */
  let toastTimer = null;
  window.showToast = function (message) {
    let toast =
      document.getElementById("live-toast") ||
      document.getElementById("toast-notification");
    let toastMsg =
      document.getElementById("toast-message") ||
      (toast ? toast.querySelector("#toast-message, p, span") : null);

    if (!toast) {
      // Create global toast container dynamically if not present in markup
      toast = document.createElement("div");
      toast.id = "live-toast";
      toast.className =
        "fixed bottom-24 right-4 sm:bottom-6 sm:right-6 z-50 flex items-center gap-3 bg-inverse-surface text-inverse-on-surface px-4 py-3 rounded-xl shadow-xl transition-all duration-300 transform translate-y-0 opacity-100 max-w-sm";
      toast.innerHTML = `
        <span class="material-symbols-outlined text-primary text-[20px]">info</span>
        <span id="toast-message" class="font-body-sm text-[13px]">${message}</span>
        <button type="button" onclick="dismissToast()" class="ml-2 text-inverse-on-surface/70 hover:text-inverse-on-surface">
          <span class="material-symbols-outlined text-[16px]">close</span>
        </button>
      `;
      document.body.appendChild(toast);
    } else {
      if (toastMsg) toastMsg.textContent = message;
      toast.classList.remove("hidden", "opacity-0", "translate-y-24", "pointer-events-none");
      toast.classList.add("flex", "opacity-100", "translate-y-0");
    }

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      window.dismissToast();
    }, 4500);
  };

  window.dismissToast = function () {
    const toast =
      document.getElementById("live-toast") ||
      document.getElementById("toast-notification");
    if (!toast) return;

    toast.classList.add("hidden", "opacity-0", "translate-y-24", "pointer-events-none");
    toast.classList.remove("flex", "opacity-100", "translate-y-0");
  };

  /**
   * Modal Management Helpers
   */
  window.openModal = function (modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove("hidden");
      document.body.classList.add("overflow-hidden");
    }
  };

  window.closeModal = function (modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add("hidden");
      document.body.classList.remove("overflow-hidden");
    }
  };

  /**
   * Safe URL Parameter Reader
   * @param {string} param
   * @param {string|null} fallback
   */
  window.getUrlParam = function (param, fallback = null) {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const val = urlParams.get(param);
      return val !== null && val.trim() !== "" ? val.trim() : fallback;
    } catch (e) {
      return fallback;
    }
  };

  /**
   * Initialize on DOM Ready
   */
  document.addEventListener("DOMContentLoaded", () => {
    syncNavigation();
    setupMobileDrawer();

    // Global profile action simulation
    document.querySelectorAll('[data-path="profile"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        window.showToast("Vendor Profile: Verified Tier 1 • Active in Kurla West");
      });
    });

    // Global notification bell simulation
    document.querySelectorAll('[data-action="notifications"]').forEach((bell) => {
      bell.addEventListener("click", () => {
        window.location.href = "alerts.html";
      });
    });
  });
})();
