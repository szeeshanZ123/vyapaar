/**
 * alerts.js - Live Alerts List Page Controller
 * Page: alerts.html (body data-page="alerts")
 * 
 * Responsibilities:
 * - Load live alerts from VyaparAPI.getAlerts()
 * - Category filter pills ("all", "demand", "high-priority")
 * - Text search filtering
 * - Dismiss alert via VyaparAPI.dismissAlert()
 * - Navigate to alert-detail.html?id={alertId}
 * - Direct links to spot.html?id={spotId}
 * - Maintain active alert count & empty states
 */

(function () {
  "use strict";

  let currentFilter = "all";
  let searchQuery = "";
  let alertsList = [];

  function initAlerts() {
    if (typeof VyaparAPI === "undefined") {
      console.error("[alerts.js] VyaparAPI not loaded.");
      return;
    }

    loadAlerts();
    setupEventListeners();
    setupTicker();
  }

  function loadAlerts() {
    VyaparAPI.getAlerts(currentFilter, searchQuery).then((alerts) => {
      alertsList = alerts;
      renderAlertsList();
      updateCounterDisplay();
    });
  }

  function renderAlertsList() {
    const container = document.getElementById("alerts-stream-container");
    const noResults = document.getElementById("no-search-results");
    const caughtUpCard = document.getElementById("all-caught-up-card");
    const fullEmptyState = document.getElementById("all-clear-full-empty-state");

    if (!container) return;

    if (alertsList.length === 0) {
      container.innerHTML = "";
      if (searchQuery.trim() !== "") {
        if (noResults) {
          noResults.classList.remove("hidden");
          noResults.classList.add("flex");
        }
        if (fullEmptyState) fullEmptyState.classList.add("hidden");
        if (caughtUpCard) caughtUpCard.classList.add("hidden");
      } else {
        if (noResults) noResults.classList.add("hidden");
        if (fullEmptyState) {
          fullEmptyState.classList.remove("hidden");
          fullEmptyState.classList.add("flex");
        }
        if (caughtUpCard) caughtUpCard.classList.add("hidden");
      }
      return;
    }

    if (noResults) noResults.classList.add("hidden");
    if (fullEmptyState) fullEmptyState.classList.add("hidden");
    if (caughtUpCard) caughtUpCard.classList.remove("hidden");

    container.innerHTML = alertsList
      .map((alert) => {
        const isHigh =
          alert.priority === "high" ||
          (alert.categories && alert.categories.includes("high-priority"));

        const badgeBg = isHigh ? "bg-error-container text-error" : "bg-primary-fixed text-primary";
        const urgencyLabel = isHigh ? "High Urgency Alert" : "Live Opportunity";
        const rushScore = alert.customerRush ? alert.customerRush.score : 91;
        const rushTrend = alert.customerRush ? alert.customerRush.trendLabel : "+22%";

        return `
        <article
          id="alert-card-${alert.id}"
          class="alert-card relative bg-surface-container-lowest rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col p-space-lg sm:p-space-xl cursor-pointer"
          data-alert-id="${alert.id}"
          data-categories="${alert.categoriesString || alert.categories.join(' ')}"
          data-keywords="${alert.keywords || alert.title}"
        >
          <!-- Left border accent -->
          <div class="absolute left-0 top-0 bottom-0 w-1.5 ${isHigh ? 'bg-primary' : 'bg-primary-container'}"></div>

          <!-- Top Row -->
          <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-space-sm mb-space-md">
            <div class="flex flex-wrap items-center gap-space-xs">
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${badgeBg} font-label-caps text-label-caps font-bold">
                <span class="w-2 h-2 rounded-full ${isHigh ? 'bg-primary animate-ping' : 'bg-primary'}"></span>
                ⚡ ${alert.type.toUpperCase().replace('_', ' ')} • ${urgencyLabel.toUpperCase()}
              </span>
              <span class="text-outline-variant font-body-sm select-none">•</span>
              <div class="flex items-center gap-1 text-on-surface-variant font-label-sm text-label-sm">
                <span class="material-symbols-outlined text-[15px]">schedule</span>
                <span>${alert.time}</span>
              </div>
            </div>

            <button 
              type="button" 
              onclick="event.stopPropagation(); window.dismissAlert('${alert.id}')" 
              class="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-lg transition-colors"
              title="Dismiss Alert"
            >
              <span class="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          <!-- Title -->
          <h2 class="font-headline-md text-headline-md text-on-surface tracking-tight leading-snug mb-space-md hover:text-primary transition-colors">
            ${alert.headline || alert.title}
          </h2>

          <!-- Metrics Strip -->
          <div class="flex flex-wrap items-center gap-space-sm mb-space-lg">
            <div class="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-100 text-orange-900 font-label-md text-label-md font-bold">
              <span class="w-2.5 h-2.5 rounded-full bg-orange-600"></span>
              <span>CUSTOMER RUSH: ${rushScore} / 100</span>
            </div>
            <div class="flex items-center gap-1.5 bg-surface-container-low px-3 py-2 rounded-xl font-label-md text-label-md text-on-surface">
              <span class="material-symbols-outlined text-primary text-[18px]">trending_up</span>
              <span>${rushTrend} surge</span>
            </div>
            <div class="flex items-center gap-1.5 bg-surface-container-low px-3 py-2 rounded-xl font-label-md text-label-md text-on-surface-variant">
              <span class="material-symbols-outlined text-[18px]">distance</span>
              <span>${alert.distanceKm} km away</span>
            </div>
          </div>

          <!-- Bottom Action Bar -->
          <div class="bg-surface-container-low rounded-xl p-space-md flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
            <span class="font-body-sm text-body-sm text-on-surface-variant">
              ${alert.summary || alert.zoneSubtext || 'Actionable opportunity for street food & beverage deployment.'}
            </span>
            <div class="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <button 
                type="button" 
                onclick="event.stopPropagation(); window.dismissAlert('${alert.id}')" 
                class="px-3 py-2 font-label-md text-label-md text-on-surface-variant hover:text-on-surface rounded-lg"
              >
                Dismiss
              </button>
              <a 
                href="alert-detail.html?id=${alert.id}" 
                onclick="event.stopPropagation();"
                class="px-space-md py-2 rounded-xl font-label-md text-label-md bg-primary text-on-primary font-semibold flex items-center gap-1.5 hover:bg-primary-container transition-all shadow-sm"
              >
                <span>VIEW DETAILS</span>
                <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
              </a>
            </div>
          </div>
        </article>
      `;
      })
      .join("");

    // Click card navigates to alert detail
    container.querySelectorAll(".alert-card").forEach((card) => {
      card.addEventListener("click", () => {
        const id = card.getAttribute("data-alert-id");
        if (id) {
          window.location.href = `alert-detail.html?id=${id}`;
        }
      });
    });
  }

  function updateCounterDisplay() {
    const counterDisplay = document.getElementById("active-count-num");
    const pillCount = document.getElementById("pill-count-all");
    const feedback = document.getElementById("filtered-label-feedback");

    if (counterDisplay) counterDisplay.textContent = alertsList.length;
    if (pillCount) pillCount.textContent = alertsList.length;

    if (feedback) {
      if (searchQuery) {
        feedback.textContent = `Matching "${searchQuery}" (${alertsList.length})`;
      } else if (currentFilter !== "all") {
        feedback.textContent = `Filtered by ${currentFilter.toUpperCase()} (${alertsList.length})`;
      } else {
        feedback.textContent = "Showing all actionable live signals";
      }
    }
  }

  window.dismissAlert = function (alertId) {
    const card = document.getElementById(`alert-card-${alertId}`);
    if (card) {
      card.style.transition = "all 0.3s ease-out";
      card.style.opacity = "0";
      card.style.transform = "translateY(-12px) scale(0.98)";
    }

    VyaparAPI.dismissAlert(alertId).then(() => {
      setTimeout(() => {
        loadAlerts();
        if (typeof window.showToast === "function") {
          window.showToast("Alert dismissed.");
        }
      }, 300);
    });
  };

  window.restoreAllAlerts = function () {
    VyaparAPI.restoreAllAlerts().then(() => {
      loadAlerts();
      if (typeof window.showToast === "function") {
        window.showToast("All telemetry alerts restored.");
      }
    });
  };

  function setupEventListeners() {
    const searchInput = document.getElementById("alert-search-input");
    const searchClearBtn = document.getElementById("search-clear-btn");
    const filterPills = document.querySelectorAll(".filter-pill");
    const resetSearchBtn = document.getElementById("reset-search-filters-btn");
    const restoreBtn = document.getElementById("restore-alerts-btn");

    // Filter Pills
    filterPills.forEach((pill) => {
      pill.addEventListener("click", () => {
        filterPills.forEach((p) => {
          p.classList.remove("bg-primary", "text-on-primary", "active-pill");
          p.classList.add("bg-surface-container-lowest", "text-on-surface");
        });
        pill.classList.remove("bg-surface-container-lowest", "text-on-surface");
        pill.classList.add("bg-primary", "text-on-primary", "active-pill");

        currentFilter = pill.getAttribute("data-filter") || "all";
        loadAlerts();
      });
    });

    // Search Input
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        searchQuery = e.target.value;
        if (searchClearBtn) {
          if (searchQuery.length > 0) {
            searchClearBtn.classList.remove("hidden");
            searchClearBtn.classList.add("flex");
          } else {
            searchClearBtn.classList.add("hidden");
            searchClearBtn.classList.remove("flex");
          }
        }
        loadAlerts();
      });
    }

    if (searchClearBtn) {
      searchClearBtn.addEventListener("click", () => {
        if (searchInput) searchInput.value = "";
        searchQuery = "";
        searchClearBtn.classList.add("hidden");
        searchClearBtn.classList.remove("flex");
        loadAlerts();
      });
    }

    if (resetSearchBtn) {
      resetSearchBtn.addEventListener("click", () => {
        if (searchInput) searchInput.value = "";
        searchQuery = "";
        currentFilter = "all";
        filterPills.forEach((p) => {
          if (p.getAttribute("data-filter") === "all") {
            p.classList.add("bg-primary", "text-on-primary", "active-pill");
            p.classList.remove("bg-surface-container-lowest", "text-on-surface");
          } else {
            p.classList.remove("bg-primary", "text-on-primary", "active-pill");
            p.classList.add("bg-surface-container-lowest", "text-on-surface");
          }
        });
        loadAlerts();
      });
    }

    if (restoreBtn) {
      restoreBtn.addEventListener("click", window.restoreAllAlerts);
    }
  }

  function setupTicker() {
    let seconds = 30;
    setInterval(() => {
      seconds += 1;
      const timerElem = document.getElementById("update-timer");
      if (timerElem) {
        timerElem.textContent = `Updated ${seconds}s ago`;
      }
    }, 1000);

    const refreshPulse = document.getElementById("refresh-pulse");
    if (refreshPulse) {
      refreshPulse.addEventListener("click", () => {
        seconds = 1;
        const timerElem = document.getElementById("update-timer");
        if (timerElem) timerElem.textContent = "Updated just now";
        loadAlerts();
      });
    }
  }

  // Self-initialize if on Alerts page
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      if (document.body.dataset.page === "alerts") initAlerts();
    });
  } else {
    if (document.body.dataset.page === "alerts") initAlerts();
  }
})();
