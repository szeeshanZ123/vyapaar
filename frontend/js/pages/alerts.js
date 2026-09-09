/**
 * alerts.js - Real-time Crowdsourced & Municipal Alerts Controller (Phase 7A)
 * Page: alerts.html
 * 
 * Powered directly by FastAPI & MongoDB:
 * - Real GPS geolocation
 * - POST /api/alerts (Create with 100m/5min deduplication & 60min expiry)
 * - GET /api/alerts/nearby (Nearby active alerts, respecting 2-confirmation municipal rule)
 * - POST /api/alerts/{id}/confirm (Single confirmation per authenticated user)
 * - POST /api/alerts/{id}/flag (Single flag per authenticated user)
 * - 8-10 second live polling interval
 */

(function () {
  "use strict";

  let currentCoords = { lat: 19.0760, lng: 72.8777 }; // Default Mumbai center
  let activeAlerts = [];
  let currentFilter = "all";
  let searchQuery = "";
  let pollTimer = null;
  let hasGps = false;

  const ALERT_TYPE_LABELS = {
    crowd: { name: "Crowd Gathering", icon: "groups", color: "bg-error-container text-error", border: "border-error" },
    spot_free: { name: "Free Spot Available", icon: "storefront", color: "bg-emerald-100 text-emerald-800", border: "border-emerald-500" },
    road_blocked: { name: "Road / Street Blocked", icon: "block", color: "bg-amber-100 text-amber-800", border: "border-amber-500" },
    municipal_check: { name: "Municipal Van / Inspection", icon: "local_police", color: "bg-purple-100 text-purple-900", border: "border-purple-600" }
  };

  document.addEventListener("DOMContentLoaded", async () => {
    // 1. Check/Init Auth session
    if (window.VyaparAuth) {
      const session = await window.VyaparAuth.getSession();
      updateAuthUI(session);
    }

    // 2. Request Real GPS
    initGeolocation();

    // 3. Bind UI Controls (Filters, Search, Create Modal)
    setupEventListeners();

    // 4. Start 8-second Polling
    startPolling();
  });

  function updateAuthUI(session) {
    const user = session?.user;
    const name = user?.user_metadata?.name || user?.email?.split("@")[0] || "User";
    const headerGreeting = document.getElementById("header-user-greeting");
    if (headerGreeting) {
      headerGreeting.textContent = `Hello, ${name}`;
    }
  }

  function initGeolocation() {
    const locationChip = document.getElementById("geo-location-chip-text");
    if (locationChip) locationChip.textContent = "Acquiring GPS...";

    if (!navigator.geolocation) {
      if (locationChip) locationChip.textContent = "GPS not supported";
      loadRealAlerts();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        hasGps = true;
        currentCoords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };
        if (locationChip) {
          locationChip.textContent = `GPS: ${currentCoords.lat.toFixed(3)}, ${currentCoords.lng.toFixed(3)}`;
        }
        loadRealAlerts();
      },
      (err) => {
        console.warn("GPS permission not granted, using active zone:", err);
        if (locationChip) locationChip.textContent = "Mumbai Zone";
        loadRealAlerts();
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }

  async function loadRealAlerts() {
    const streamContainer = document.getElementById("alerts-stream-container");
    const counterDisplay = document.getElementById("active-count-num");
    const pillCount = document.getElementById("pill-count-all");
    const timerElem = document.getElementById("update-timer");

    try {
      const url = `/api/alerts/nearby?lat=${currentCoords.lat}&lng=${currentCoords.lng}&radius=10000`;
      const res = await window.VyaparAuth.callBackendAPI(url);
      activeAlerts = res?.data || [];

      if (counterDisplay) counterDisplay.textContent = activeAlerts.length;
      if (pillCount) pillCount.textContent = activeAlerts.length;
      if (timerElem) timerElem.textContent = "Updated just now";

      renderAlertsList();
    } catch (err) {
      console.warn("Failed loading live alerts:", err);
    }
  }

  function renderAlertsList() {
    const streamContainer = document.getElementById("alerts-stream-container");
    const noResults = document.getElementById("no-search-results");
    const fullEmptyState = document.getElementById("all-clear-full-empty-state");

    if (!streamContainer) return;

    // Filter and Search logic
    let filtered = activeAlerts.filter((alert) => {
      // Type Filter
      if (currentFilter !== "all" && alert.alert_type !== currentFilter) {
        return false;
      }
      // Text Search Query
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const msg = (alert.message || "").toLowerCase();
        const type = (alert.alert_type || "").toLowerCase();
        return msg.includes(q) || type.includes(q);
      }
      return true;
    });

    if (filtered.length === 0) {
      streamContainer.innerHTML = "";
      if (searchQuery.trim() !== "") {
        if (noResults) noResults.classList.remove("hidden");
        if (fullEmptyState) fullEmptyState.classList.add("hidden");
      } else {
        if (noResults) noResults.classList.add("hidden");
        if (fullEmptyState) fullEmptyState.classList.remove("hidden");
      }
      return;
    }

    if (noResults) noResults.classList.add("hidden");
    if (fullEmptyState) fullEmptyState.classList.add("hidden");

    streamContainer.innerHTML = filtered.map((alert) => {
      const meta = ALERT_TYPE_LABELS[alert.alert_type] || ALERT_TYPE_LABELS.crowd;
      const isMunicipal = alert.alert_type === "municipal_check";
      const confirmations = alert.confirmations || 1;
      const distMeters = alert.distance_meters;
      const distStr = distMeters != null 
        ? (distMeters < 1000 ? `${Math.round(distMeters)} m away` : `${(distMeters / 1000).toFixed(1)} km away`)
        : "Nearby";

      const timeStr = formatTimeAgo(alert.created_at);
      const confBadge = isMunicipal 
        ? (confirmations >= 2 ? "✅ Verified (2/2 Confirmations)" : `⚠️ Pending Verification (${confirmations}/2 Confirmations)`)
        : `${confirmations} Confirmation${confirmations > 1 ? "s" : ""}`;

      return `
        <article
          id="alert-card-${alert.alert_id}"
          class="alert-card relative bg-surface-container-lowest rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col p-space-lg sm:p-space-xl border border-outline-variant/30"
          data-alert-id="${alert.alert_id}"
        >
          <!-- Left accent strip -->
          <div class="absolute left-0 top-0 bottom-0 w-2 ${meta.color.split(' ')[0]}"></div>

          <!-- Header -->
          <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-space-sm mb-space-sm">
            <div class="flex flex-wrap items-center gap-space-xs">
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${meta.color} font-label-caps text-label-caps font-bold">
                <span class="material-symbols-outlined text-[16px]">${meta.icon}</span>
                ${meta.name.toUpperCase()}
              </span>
              <span class="text-outline-variant font-body-sm select-none">•</span>
              <div class="flex items-center gap-1 text-on-surface-variant font-label-sm text-label-sm">
                <span class="material-symbols-outlined text-[15px]">schedule</span>
                <span>${timeStr}</span>
              </div>
            </div>

            <!-- Confirmation Pill -->
            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-container text-on-surface-variant">
              <span class="material-symbols-outlined text-[14px]">thumb_up</span>
              ${confBadge}
            </span>
          </div>

          <!-- Alert Message -->
          <h2 class="font-headline-sm text-headline-sm text-on-surface tracking-tight leading-snug mb-space-md">
            ${escapeHtml(alert.message || meta.name)}
          </h2>

          <!-- Geo and Status Metrics -->
          <div class="flex flex-wrap items-center gap-space-sm mb-space-md text-xs text-on-surface-variant">
            <div class="flex items-center gap-1 bg-surface-container-low px-3 py-1.5 rounded-xl font-medium">
              <span class="material-symbols-outlined text-primary text-[16px]">location_on</span>
              <span>${distStr}</span>
            </div>
            <div class="flex items-center gap-1 bg-surface-container-low px-3 py-1.5 rounded-xl font-medium">
              <span class="material-symbols-outlined text-[16px]">timer</span>
              <span>Expires in 60m</span>
            </div>
            ${alert.flags > 0 ? `
              <div class="flex items-center gap-1 bg-red-50 text-red-700 px-2.5 py-1.5 rounded-xl font-medium">
                <span class="material-symbols-outlined text-[14px]">flag</span>
                <span>${alert.flags} flags</span>
              </div>
            ` : ''}
          </div>

          <!-- Action Buttons (Confirm / Flag) -->
          <div class="bg-surface-container-low rounded-xl p-space-sm flex items-center justify-between gap-space-md mt-auto">
            <span class="text-xs text-on-surface-variant">Help keep your community updated:</span>
            <div class="flex items-center gap-2">
              <button
                type="button"
                onclick="window.confirmAlertAction('${alert.alert_id}')"
                id="btn-confirm-${alert.alert_id}"
                class="px-3 py-1.5 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-container transition-all flex items-center gap-1 shadow-sm active:scale-95"
              >
                <span class="material-symbols-outlined text-[15px]">check_circle</span>
                Confirm (${confirmations})
              </button>
              <button
                type="button"
                onclick="window.flagAlertAction('${alert.alert_id}')"
                id="btn-flag-${alert.alert_id}"
                class="px-2.5 py-1.5 rounded-xl text-xs font-medium text-on-surface-variant hover:bg-surface-container-high transition-colors flex items-center gap-1"
                title="Flag false alert"
              >
                <span class="material-symbols-outlined text-[15px]">flag</span>
              </button>
            </div>
          </div>
        </article>
      `;
    }).join("");
  }

  window.confirmAlertAction = async function (alertId) {
    const btn = document.getElementById(`btn-confirm-${alertId}`);
    if (btn) btn.disabled = true;

    try {
      const res = await window.VyaparAuth.callBackendAPI(`/api/alerts/${alertId}/confirm`, {
        method: "POST"
      });
      if (res?.data) {
        if (typeof window.showToast === "function") {
          window.showToast("Alert confirmed successfully!");
        } else {
          alert("Alert confirmed!");
        }
        await loadRealAlerts();
      }
    } catch (err) {
      if (err.status === 409) {
        alert("You have already confirmed this alert.");
      } else if (err.status === 401) {
        alert("Please log in to confirm alerts.");
      } else {
        alert(`Confirmation failed: ${err.message || "Please try again"}`);
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  window.flagAlertAction = async function (alertId) {
    if (!confirm("Are you sure you want to flag this alert as inaccurate or false?")) return;

    try {
      const res = await window.VyaparAuth.callBackendAPI(`/api/alerts/${alertId}/flag`, {
        method: "POST"
      });
      if (res?.data) {
        if (typeof window.showToast === "function") {
          window.showToast("Alert flagged for moderation.");
        } else {
          alert("Alert flagged.");
        }
        await loadRealAlerts();
      }
    } catch (err) {
      if (err.status === 409) {
        alert("You have already flagged this alert.");
      } else if (err.status === 401) {
        alert("Please log in to flag alerts.");
      } else {
        alert(`Flag failed: ${err.message || "Please try again"}`);
      }
    }
  };

  function setupEventListeners() {
    // 1. Filter Pills
    const filterPills = document.querySelectorAll(".filter-pill");
    filterPills.forEach((pill) => {
      pill.addEventListener("click", () => {
        filterPills.forEach((p) => {
          p.classList.remove("bg-primary", "text-on-primary", "active-pill");
          p.classList.add("bg-surface-container-lowest", "text-on-surface");
        });
        pill.classList.remove("bg-surface-container-lowest", "text-on-surface");
        pill.classList.add("bg-primary", "text-on-primary", "active-pill");

        currentFilter = pill.getAttribute("data-filter") || "all";
        renderAlertsList();
      });
    });

    // 2. Search Input
    const searchInput = document.getElementById("alert-search-input");
    const searchClearBtn = document.getElementById("search-clear-btn");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        searchQuery = e.target.value;
        if (searchClearBtn) {
          searchClearBtn.classList.toggle("hidden", searchQuery.length === 0);
        }
        renderAlertsList();
      });
    }
    if (searchClearBtn) {
      searchClearBtn.addEventListener("click", () => {
        if (searchInput) searchInput.value = "";
        searchQuery = "";
        searchClearBtn.classList.add("hidden");
        renderAlertsList();
      });
    }

    // 3. Sync Telemetry Button
    const refreshBtn = document.getElementById("refresh-pulse");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        loadRealAlerts();
      });
    }

    // 4. Report Alert Modal Handlers
    const openModalBtn = document.getElementById("btn-open-create-alert");
    const modal = document.getElementById("create-alert-modal");
    const closeModalBtn = document.getElementById("btn-close-alert-modal");
    const createForm = document.getElementById("create-alert-form");
    const submitBtn = document.getElementById("btn-submit-alert");

    if (openModalBtn && modal) {
      openModalBtn.addEventListener("click", async () => {
        const session = await window.VyaparAuth.getSession();
        if (!session) {
          alert("Please log in first to report an alert.");
          window.location.href = "login.html";
          return;
        }
        modal.classList.remove("hidden");
      });
    }

    if (closeModalBtn && modal) {
      closeModalBtn.addEventListener("click", () => {
        modal.classList.add("hidden");
      });
    }

    if (createForm) {
      createForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const alertType = document.getElementById("alert-type-select").value;
        const message = document.getElementById("alert-message-input").value.trim();

        if (!alertType) {
          alert("Please select an alert type.");
          return;
        }

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = "Acquiring GPS & Posting...";
        }

        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;

            try {
              const res = await window.VyaparAuth.callBackendAPI("/api/alerts", {
                method: "POST",
                body: JSON.stringify({
                  alert_type: alertType,
                  lat: lat,
                  lng: lng,
                  message: message || undefined
                })
              });

              if (modal) modal.classList.add("hidden");
              createForm.reset();

              if (typeof window.showToast === "function") {
                window.showToast("Alert posted successfully!");
              } else {
                alert("Alert posted successfully!");
              }

              // Refresh list immediately
              await loadRealAlerts();
            } catch (err) {
              if (err.status === 409) {
                alert(`Duplicate Alert: A similar ${alertType.replace('_', ' ')} alert was already reported at this location in the last 5 minutes.`);
              } else {
                alert(`Failed to post alert: ${err.message || "Please try again."}`);
              }
            } finally {
              if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "Broadcast Alert";
              }
            }
          },
          (geoErr) => {
            alert("Location access is required to broadcast an alert at your current spot.");
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = "Broadcast Alert";
            }
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });
    }
  }

  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    // Poll every 8-10 seconds per PRD
    pollTimer = setInterval(() => {
      loadRealAlerts();
    }, 8000);
  }

  function formatTimeAgo(isoString) {
    if (!isoString) return "Just now";
    const date = new Date(isoString.replace("Z", "+00:00"));
    const diffSec = Math.floor((new Date() - date) / 1000);
    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    return `${diffHr}h ago`;
  }

  function escapeHtml(str) {
    return (str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
