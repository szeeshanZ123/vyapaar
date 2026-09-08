/**
 * recommendations.js - Places / Recommendations Page Controller
 * Page: recommendations.html (body data-page="recommendations")
 * 
 * Responsibilities:
 * - Load spots via VyaparAPI.getRecommendations()
 * - Category filter chips ("all", "very-busy", "busy", "nearby")
 * - Live search filtering
 * - Render dynamic recommendation cards with Customer Rush score
 * - Bidirectional selection between cards and map pins
 * - Routing to spot.html?id={spotId}
 */

(function () {
  "use strict";

  let currentFilter = "all";
  let searchQuery = "";
  let selectedSpotId = "kurla-station-west";
  let spotsData = [];

  function initRecommendations() {
    if (typeof VyaparAPI === "undefined") {
      console.error("[recommendations.js] VyaparAPI is missing.");
      return;
    }

    loadSpots();
    setupDOMListeners();
  }

  function loadSpots() {
    VyaparAPI.getRecommendations(currentFilter, searchQuery).then((spots) => {
      spotsData = spots;
      renderSpots();
    });
  }

  function renderSpots() {
    const spotsContainer = document.getElementById("spotsContainer");
    const emptyResultsState = document.getElementById("emptyResultsState");
    const spotCountIndicator = document.getElementById("spotCountIndicator");
    const allCountBadge = document.getElementById("allCountBadge");

    if (!spotsContainer) return;

    if (spotCountIndicator) {
      spotCountIndicator.textContent = `(${spotsData.length} spot${
        spotsData.length === 1 ? "" : "s"
      })`;
    }
    if (allCountBadge) {
      allCountBadge.textContent = spotsData.length;
    }

    if (spotsData.length === 0) {
      spotsContainer.innerHTML = "";
      if (emptyResultsState) {
        emptyResultsState.classList.remove("hidden");
        emptyResultsState.classList.add("flex");
      }
      return;
    }

    if (emptyResultsState) {
      emptyResultsState.classList.add("hidden");
      emptyResultsState.classList.remove("flex");
    }

    spotsContainer.innerHTML = spotsData
      .map((spot) => {
        const isSelected = spot.id === selectedSpotId;
        const isVeryBusy = spot.status === "very-busy";
        const statusBadgeClasses = isVeryBusy
          ? "bg-red-50 text-red-700 font-bold"
          : "bg-amber-50 text-amber-800 font-bold";

        const rushFillClass = isVeryBusy ? "bg-red-500" : "bg-amber-500";
        const selectionHighlightClasses = isSelected
          ? "ring-2 ring-primary bg-surface-container-lowest shadow-md"
          : "bg-surface-container-lowest shadow-sm hover:shadow-md";

        const rushScore =
          typeof spot.customerRush === "object"
            ? spot.customerRush.score
            : spot.customerRush || 91;

        return `
        <div 
          id="spot-card-${spot.id}"
          data-spot-id="${spot.id}"
          class="spot-recommendation-card ${selectionHighlightClasses} rounded-[20px] p-space-md lg:p-space-lg transition-all duration-200 cursor-pointer flex flex-col gap-space-md"
        >
          <!-- Top Card Meta -->
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-3">
              <span class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center font-headline-sm text-headline-sm text-on-surface font-extrabold">
                #${spot.rank}
              </span>
              <div>
                <h3 class="font-headline-md text-headline-md text-on-surface font-bold tracking-tight">${spot.name}</h3>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1">
                    <span class="material-symbols-outlined text-[15px] text-primary">near_me</span>
                    ${spot.distanceKm} km away
                  </span>
                  <span class="text-surface-dim">•</span>
                  <span class="font-label-sm text-label-sm text-tertiary font-medium">${spot.bestTime}</span>
                </div>
              </div>
            </div>

            <!-- Status Badge -->
            <span class="font-label-caps text-label-caps px-3 py-1 rounded-full ${statusBadgeClasses} tracking-wider shrink-0 flex items-center gap-1.5">
              ${spot.statusLabel}
            </span>
          </div>

          <!-- Mid Metrics Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-space-sm bg-surface-container-low/70 p-space-sm rounded-xl">
            <!-- Customer Rush Metric -->
            <div class="flex flex-col gap-1.5">
              <div class="flex items-baseline justify-between">
                <span class="font-label-sm text-label-sm text-on-surface-variant uppercase font-semibold tracking-wider">CUSTOMER RUSH</span>
                <span class="font-label-numeric-lg text-label-numeric-lg font-extrabold text-on-surface">${rushScore} <span class="text-body-sm font-normal text-on-surface-variant">/ 100</span></span>
              </div>
              <div class="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
                <div class="h-full ${rushFillClass} rounded-full" style="width: ${rushScore}%"></div>
              </div>
            </div>

            <!-- Trend & Velocity Metric -->
            <div class="flex flex-col justify-center gap-1">
              <span class="font-label-sm text-label-sm text-on-surface-variant uppercase font-semibold tracking-wider">Footfall Velocity</span>
              <div class="flex items-center gap-1 font-label-md text-label-md font-bold text-emerald-800">
                <span class="material-symbols-outlined text-[18px]">trending_up</span>
                <span>${spot.trend}</span>
              </div>
            </div>
          </div>

          <!-- Micro context detail -->
          <div class="flex flex-wrap items-center justify-between gap-y-2 text-on-surface-variant font-body-sm text-body-sm">
            <span class="flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[17px] text-on-surface-variant">groups</span>
              ${spot.crowdLevel}
            </span>
            <span class="flex items-center gap-1.5 bg-surface-container px-2.5 py-1 rounded-lg text-on-surface">
              <span>💡</span>
              <span class="font-medium">Key Driver:</span> ${spot.keyDriver}
            </span>
          </div>

          <!-- Bottom Actions Actionable Ribbon -->
          <div class="pt-2 flex items-center justify-between gap-space-sm">
            <a 
              href="spot.html?id=${spot.id}" 
              onclick="event.stopPropagation();"
              class="font-label-md text-label-md text-on-surface hover:text-primary flex items-center gap-1 font-semibold transition-colors"
            >
              <span>Inspect Spot Intelligence</span>
              <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
            </a>

            <a 
              href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(spot.name + " Mumbai")}" 
              target="_blank" 
              rel="noopener noreferrer"
              onclick="event.stopPropagation();"
              class="h-10 px-4 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-bold hover:bg-primary-container transition-all flex items-center gap-1.5 shadow-sm shadow-primary/20"
            >
              <span class="material-symbols-outlined text-[18px]">navigation</span>
              <span>NAVIGATE TO SPOT →</span>
            </a>
          </div>
        </div>
      `;
      })
      .join("");

    // Attach card click handlers for bidirectional selection
    document.querySelectorAll(".spot-recommendation-card").forEach((card) => {
      card.addEventListener("click", () => {
        const spotId = card.getAttribute("data-spot-id");
        setSelectedSpot(spotId);
      });
    });

    updateMapMarkersState();
  }

  function setSelectedSpot(id) {
    selectedSpotId = id;

    // Update card selection styles
    document.querySelectorAll(".spot-recommendation-card").forEach((c) => {
      if (c.getAttribute("data-spot-id") === id) {
        c.classList.add("ring-2", "ring-primary", "shadow-md");
        c.classList.remove("shadow-sm");
      } else {
        c.classList.remove("ring-2", "ring-primary", "shadow-md");
        c.classList.add("shadow-sm");
      }
    });

    updateMapMarkersState();
  }

  function updateMapMarkersState() {
    if (typeof VyaparMap !== "undefined") {
      VyaparMap.selectMarker(".map-marker", selectedSpotId);
    } else {
      document.querySelectorAll(".map-marker").forEach((marker) => {
        const markerSpotId = marker.getAttribute("data-spot-id");
        const bubble = marker.querySelector(".marker-bubble") || marker;
        if (markerSpotId === selectedSpotId) {
          marker.classList.add("scale-125", "z-30");
          bubble.classList.add("ring-2", "ring-primary", "bg-primary-fixed");
        } else {
          marker.classList.remove("scale-125", "z-30");
          bubble.classList.remove("ring-2", "ring-primary", "bg-primary-fixed");
        }
      });
    }
  }

  function setupDOMListeners() {
    const searchInput = document.getElementById("spotSearchInput");
    const clearSearchBtn = document.getElementById("clearSearchBtn");
    const useLocationBtn = document.getElementById("useLocationBtn");
    const filterButtons = document.querySelectorAll(".filter-chip");
    const resetSearchAction = document.getElementById("resetSearchAction");
    const recenterMapBtn = document.getElementById("recenterMapBtn");

    // Handle Map Marker Clicks
    document.querySelectorAll(".map-marker").forEach((pin) => {
      pin.addEventListener("click", () => {
        const spotId = pin.getAttribute("data-spot-id");
        setSelectedSpot(spotId);
        const cardElem = document.getElementById(`spot-card-${spotId}`);
        if (cardElem) {
          cardElem.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    });

    // Filter Chips
    filterButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        filterButtons.forEach((b) => {
          b.classList.remove("bg-primary", "text-on-primary", "shadow-sm", "shadow-primary/20");
          b.classList.add("bg-surface-container-lowest", "text-on-surface");
        });
        btn.classList.add("bg-primary", "text-on-primary", "shadow-sm", "shadow-primary/20");
        btn.classList.remove("bg-surface-container-lowest", "text-on-surface");

        currentFilter = btn.getAttribute("data-filter") || "all";
        loadSpots();
      });
    });

    // Search Input
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        searchQuery = e.target.value;
        if (clearSearchBtn) {
          if (searchQuery.length > 0) {
            clearSearchBtn.classList.remove("hidden");
          } else {
            clearSearchBtn.classList.add("hidden");
          }
        }
        loadSpots();
      });
    }

    if (clearSearchBtn) {
      clearSearchBtn.addEventListener("click", () => {
        if (searchInput) searchInput.value = "";
        searchQuery = "";
        clearSearchBtn.classList.add("hidden");
        loadSpots();
        if (searchInput) searchInput.focus();
      });
    }

    if (resetSearchAction) {
      resetSearchAction.addEventListener("click", () => {
        if (searchInput) searchInput.value = "";
        searchQuery = "";
        currentFilter = "all";
        filterButtons.forEach((b) => {
          if (b.getAttribute("data-filter") === "all") {
            b.classList.add("bg-primary", "text-on-primary");
            b.classList.remove("bg-surface-container-lowest", "text-on-surface");
          } else {
            b.classList.remove("bg-primary", "text-on-primary");
            b.classList.add("bg-surface-container-lowest", "text-on-surface");
          }
        });
        if (clearSearchBtn) clearSearchBtn.classList.add("hidden");
        loadSpots();
      });
    }

    if (useLocationBtn) {
      useLocationBtn.addEventListener("click", () => {
        const originalText = useLocationBtn.innerHTML;
        useLocationBtn.innerHTML = `
          <span class="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin"></span>
          <span>Triangulating GPS...</span>
        `;
        setTimeout(() => {
          useLocationBtn.innerHTML = originalText;
          setSelectedSpot("kurla-station-west");
        }, 600);
      });
    }

    if (recenterMapBtn) {
      recenterMapBtn.addEventListener("click", () => {
        setSelectedSpot("kurla-station-west");
        const firstCard = document.getElementById("spot-card-kurla-station-west");
        if (firstCard) {
          firstCard.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    }
  }

  // Self-initialize if on Recommendations page
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      if (document.body.dataset.page === "recommendations") initRecommendations();
    });
  } else {
    if (document.body.dataset.page === "recommendations") initRecommendations();
  }
})();
