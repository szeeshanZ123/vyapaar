/**
 * checkin.js - Vendor Check-in & Selling Session Controller
 * Page: checkin.html (body data-page="checkin")
 * 
 * Responsibilities:
 * - Read spot ID from URL (?id=...)
 * - Load spot telemetry from VyaparAPI.getSpot(spotId)
 * - Triangulate GPS location via VyaparAPI.verifyLocation()
 * - Start selling session via VyaparAPI.startSellingSession()
 * - Maintain active session banner & state
 * - End selling session via VyaparAPI.endSellingSession()
 * - Back to spot routing (spot.html?id=...)
 */

(function () {
  "use strict";

  let spotId = "kurla-station-west";
  let isSessionActive = false;

  function initCheckin() {
    if (typeof VyaparAPI === "undefined") {
      console.error("[checkin.js] VyaparAPI not loaded.");
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const idParam = urlParams.get("id");
    if (idParam && idParam.trim() !== "") {
      spotId = idParam.trim();
    }

    loadSpotData();
    setupEventListeners();
  }

  function loadSpotData() {
    VyaparAPI.getSpot(spotId)
      .then((spot) => {
        if (!spot) {
          // Fallback to default spot
          return VyaparAPI.getSpot("kurla-station-west");
        }
        return spot;
      })
      .then((spot) => {
        if (!spot) return;
        populateSpotUI(spot);
      })
      .catch((err) => {
        console.warn("[checkin.js] Failed to load spot:", err);
      });
  }

  function populateSpotUI(spot) {
    const spotNameHeader = document.getElementById("spotNameHeader");
    const targetZoneHeader = document.getElementById("targetZoneHeader");
    const spotVerifyTitle = document.getElementById("spotVerifyTitle");
    const spotVerifyZone = document.getElementById("spotVerifyZone");
    const activeSpotLabel = document.getElementById("activeSpotLabel");

    if (spotNameHeader) spotNameHeader.textContent = spot.displayName || spot.name;
    if (targetZoneHeader) targetZoneHeader.textContent = `Target Zone: ${spot.targetZone}`;
    if (spotVerifyTitle) spotVerifyTitle.textContent = spot.displayName || spot.name;
    if (spotVerifyZone) spotVerifyZone.textContent = `Target Zone: ${spot.targetZone}`;
    if (activeSpotLabel) activeSpotLabel.textContent = spot.displayName || spot.name;

    // Update Back to Spot Link
    const backToSpotLink = document.querySelector('main a[href*="spot.html"]');
    if (backToSpotLink) {
      backToSpotLink.setAttribute("href", `spot.html?id=${spot.id}`);
    }
  }

  function setupEventListeners() {
    const refreshBtn = document.getElementById("refreshLocationBtn");
    const refreshIcon = document.getElementById("refreshIcon");
    const lastPingTime = document.getElementById("lastPingTime");
    const startBtn = document.getElementById("startSessionPrimaryBtn");
    const sessionBanner = document.getElementById("activeSessionBanner");
    const endBtn = document.getElementById("endSessionBtn");
    const mockToggleBtn = document.getElementById("mockToggleStateBtn");

    // Location Verification Action
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        if (refreshIcon) refreshIcon.classList.add("animate-spin");
        refreshBtn.setAttribute("disabled", "true");

        VyaparAPI.verifyLocation(spotId)
          .then((res) => {
            if (refreshIcon) refreshIcon.classList.remove("animate-spin");
            refreshBtn.removeAttribute("disabled");
            if (lastPingTime) lastPingTime.textContent = res.formattedPingTime || "Just now (Accurate to 2m)";
            if (typeof window.showToast === "function") {
              window.showToast("GPS geofence verified: You are 8m from the primary concourse zone.");
            }
          })
          .catch(() => {
            if (refreshIcon) refreshIcon.classList.remove("animate-spin");
            refreshBtn.removeAttribute("disabled");
          });
      });
    }

    // Start Session Action
    if (startBtn) {
      startBtn.addEventListener("click", () => {
        const durationEl = document.getElementById("expectedDuration");
        const focusEl = document.getElementById("productFocus");
        const duration = durationEl ? durationEl.value : "2_hours";
        const focus = focusEl ? focusEl.value : "beverages";

        startBtn.innerHTML = `
          <span class="material-symbols-outlined text-[24px] animate-spin">refresh</span>
          <span>INITIALIZING SESSION TELEMETRY...</span>
        `;

        VyaparAPI.startSellingSession({ spotId, duration, focus }).then((res) => {
          updateSessionUI(true, res.startTime);
          if (typeof window.showToast === "function") {
            window.showToast("Selling session activated! Nearby commuters are being notified.");
          }
        });
      });
    }

    // End Session Action
    if (endBtn) {
      endBtn.addEventListener("click", () => {
        if (confirm("Are you sure you want to end this active selling session?")) {
          VyaparAPI.endSellingSession().then(() => {
            updateSessionUI(false);
            if (typeof window.showToast === "function") {
              window.showToast("Selling session ended. Performance summary saved.");
            }
          });
        }
      });
    }

    // Mock toggle state button
    if (mockToggleBtn) {
      mockToggleBtn.addEventListener("click", () => {
        const timeStr = new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        updateSessionUI(!isSessionActive, timeStr);
      });
    }
  }

  function updateSessionUI(active, time) {
    isSessionActive = active;
    const sessionBanner = document.getElementById("activeSessionBanner");
    const startBtn = document.getElementById("startSessionPrimaryBtn");
    const startTimeDisplay = document.getElementById("sessionStartTime");

    if (!sessionBanner || !startBtn) return;

    if (active) {
      sessionBanner.classList.remove("hidden");
      sessionBanner.scrollIntoView({ behavior: "smooth", block: "start" });
      if (time && startTimeDisplay) startTimeDisplay.textContent = time;

      startBtn.classList.replace("bg-primary", "bg-surface-container-highest");
      startBtn.classList.replace("text-on-primary", "text-on-surface-variant");
      startBtn.innerHTML = `
        <span class="material-symbols-outlined text-[26px] text-emerald-600">check_circle</span>
        <span>SELLING SESSION CURRENTLY ACTIVE</span>
      `;
      startBtn.setAttribute("disabled", "true");
    } else {
      sessionBanner.classList.add("hidden");
      startBtn.classList.replace("bg-surface-container-highest", "bg-primary");
      startBtn.classList.replace("text-on-surface-variant", "text-on-primary");
      startBtn.innerHTML = `
        <span class="material-symbols-outlined text-[26px]">rocket_launch</span>
        <span>CONFIRM LOCATION & START SELLING SESSION</span>
      `;
      startBtn.removeAttribute("disabled");
    }
  }

  // Self-initialize if on Check-in page
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      if (document.body.dataset.page === "checkin") initCheckin();
    });
  } else {
    if (document.body.dataset.page === "checkin") initCheckin();
  }
})();
