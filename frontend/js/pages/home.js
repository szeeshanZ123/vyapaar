/**
 * home.js - Dashboard Controller
 * Page: index.html (body data-page="home")
 * 
 * Responsibilities:
 * - Load dashboard telemetry data (Customer Rush score, trends, hotspots, signals)
 * - Map interactions (zoom, center, heatmap toggle)
 * - Hotspot details modal
 * - Direction simulation & toast triggers
 * - Periodic telemetry clock ticker
 */

(function () {
  "use strict";

  let currentZoom = 1;
  let currentSelectedHotspot = "phoenix-marketcity";
  let dashboardData = null;

  function initHome() {
    if (typeof VyaparAPI === "undefined") {
      console.error("[home.js] VyaparAPI not loaded.");
      return;
    }

    // Load Dashboard Data
    VyaparAPI.getDashboardData().then((data) => {
      dashboardData = data;
      renderDashboardUI(data);
    });

    setupEventListeners();
    setupTelemetryTicker();
  }

  function renderDashboardUI(data) {
    // Populate Customer Rush if dynamic element exists
    const rushScoreEl = document.getElementById("customer-rush-score");
    if (rushScoreEl && data.customerRush) {
      rushScoreEl.textContent = data.customerRush.score;
    }

    const rushStatusEl = document.getElementById("customer-rush-status");
    if (rushStatusEl && data.customerRush) {
      rushStatusEl.textContent = data.customerRush.status;
    }

    const rushTrendEl = document.getElementById("customer-rush-trend");
    if (rushTrendEl && data.customerRush) {
      rushTrendEl.textContent = data.customerRush.trend;
    }
  }

  function selectHotspot(hotspotId) {
    currentSelectedHotspot = hotspotId;
    const cleanId = hotspotId === "phoenix" ? "phoenix-marketcity" : hotspotId === "kurla" ? "kurla-station-west" : hotspotId;

    if (!dashboardData) {
      VyaparAPI.getSpot(cleanId).then((spot) => {
        if (!spot) return;
        populateModalWithSpot(spot);
      });
      return;
    }

    const spot =
      dashboardData.hotspots.find(
        (h) => h.id === hotspotId || h.id === cleanId
      ) || dashboardData.hotspots[0];

    if (!spot) return;
    populateModalWithSpot(spot);
  }

  function populateModalWithSpot(spot) {
    const titleEl = document.getElementById("modal-title");
    const scoreEl = document.getElementById("modal-score");
    const descEl = document.getElementById("modal-description");
    const ctaSpotEl = document.getElementById("modal-view-spot-btn");

    if (titleEl) titleEl.innerText = spot.name;
    if (scoreEl) {
      const score = spot.score || (spot.customerRush ? spot.customerRush.score : 91);
      scoreEl.innerText = score + " / 100";
    }
    if (descEl) descEl.innerText = spot.description;

    if (ctaSpotEl) {
      const spotId = spot.id || "kurla-station-west";
      ctaSpotEl.setAttribute("href", `spot.html?id=${spotId}`);
    }

    const modal = document.getElementById("details-modal");
    if (modal) modal.classList.remove("hidden");
  }

  function closeDetailsModal() {
    const modal = document.getElementById("details-modal");
    if (modal) modal.classList.add("hidden");
  }

  function openDirectionsModal(locationName) {
    if (typeof window.showToast === "function") {
      window.showToast(`Calculating fastest e-cart route to ${locationName}...`);
    }
    setTimeout(() => {
      selectHotspot("phoenix");
    }, 400);
  }

  function startNavigationFromModal() {
    closeDetailsModal();
    if (typeof window.showToast === "function") {
      window.showToast("GPS Guidance Active: Turn right on LBS Marg in 120m.");
    }
  }

  function zoomMap(delta) {
    if (typeof VyaparMap !== "undefined") {
      currentZoom = VyaparMap.zoomMap("map-viewport", delta);
    } else {
      const viewport = document.getElementById("map-viewport");
      if (!viewport) return;
      currentZoom = Math.min(Math.max(0.85, currentZoom + delta * 0.15), 1.4);
      viewport.style.transform = `scale(${currentZoom})`;
    }
  }

  function centerMap() {
    if (typeof VyaparMap !== "undefined") {
      VyaparMap.centerMap("map-viewport");
    } else {
      const viewport = document.getElementById("map-viewport");
      if (!viewport) return;
      currentZoom = 1;
      viewport.style.transform = `scale(1)`;
      if (typeof window.showToast === "function") {
        window.showToast("Map re-centered to your active location.");
      }
    }
  }

  function toggleHeatmap() {
    if (typeof window.showToast === "function") {
      window.showToast(
        "Heatmap spectrum adjusted for high-contrast sunlight readability."
      );
    }
  }

  function setupEventListeners() {
    // Expose handlers needed by inline onclicks if any remain during transition
    window.selectHotspot = selectHotspot;
    window.viewSpotDetails = function (id) {
      selectHotspot(id || "phoenix");
    };
    window.closeDetailsModal = closeDetailsModal;
    window.openDirectionsModal = openDirectionsModal;
    window.startNavigationFromModal = startNavigationFromModal;
    window.zoomMap = zoomMap;
    window.centerMap = centerMap;
    window.toggleHeatmap = toggleHeatmap;

    // Attach listeners to map controls
    const zoomInBtn = document.getElementById("btn-zoom-in");
    const zoomOutBtn = document.getElementById("btn-zoom-out");
    const centerBtn = document.getElementById("btn-center-map");
    const heatmapBtn = document.getElementById("btn-toggle-heatmap");

    if (zoomInBtn) zoomInBtn.addEventListener("click", () => zoomMap(1));
    if (zoomOutBtn) zoomOutBtn.addEventListener("click", () => zoomMap(-1));
    if (centerBtn) centerBtn.addEventListener("click", centerMap);
    if (heatmapBtn) heatmapBtn.addEventListener("click", toggleHeatmap);

    // Modal close button
    const modalCloseBtn = document.getElementById("btn-close-modal");
    if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeDetailsModal);
  }

  function setupTelemetryTicker() {
    setInterval(() => {
      const timestampEl = document.getElementById("map-refresh-timestamp");
      if (timestampEl) {
        const seconds = Math.floor(Math.random() * 20) + 10;
        timestampEl.innerText = `Telemetry synced ${seconds}s ago`;
      }
    }, 12000);
  }

  // Self-initialize if on Home/Dashboard
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      if (document.body.dataset.page === "home") initHome();
    });
  } else {
    if (document.body.dataset.page === "home") initHome();
  }
})();
