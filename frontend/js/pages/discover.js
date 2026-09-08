/**
 * discover.js - Discover Nearby Vendors Page Controller
 * Page: discover.html (body data-page="discover")
 * 
 * Responsibilities:
 * - Load vendors via VyaparAPI.getVendors()
 * - Category filter pills (ALL, FOOD, PRODUCE, CLOTHING)
 * - Text search filtering
 * - View switcher (List vs Map) on responsive screens
 * - Radar map marker rendering & synchronization
 * - View vendor profile route (vendor.html?id={vendorId})
 * - Co-locate / Connect invite via VyaparAPI.connectVendor()
 */

(function () {
  "use strict";

  let allVendors = [];
  let currentCategory = "ALL";
  let searchQuery = "";
  let currentViewMode = "LIST";

  function initDiscover() {
    if (typeof VyaparAPI === "undefined") {
      console.error("[discover.js] VyaparAPI not loaded.");
      return;
    }

    loadVendors();
    setupEventListeners();
    setupTelemetryClock();
  }

  function loadVendors() {
    VyaparAPI.getVendors(currentCategory, searchQuery).then((vendors) => {
      allVendors = vendors;
      renderVendorsUI();
    });
  }

  function renderVendorCard(vendor) {
    const productsHtml = (vendor.products || [])
      .map(
        (p) =>
          `<span class="px-2 py-0.5 rounded-md bg-surface-container text-on-surface font-body-sm text-[12px]">${p}</span>`
      )
      .join(" ");

    const setupNotice =
      vendor.status && vendor.status.note
        ? `<span class="inline-flex items-center gap-1 font-body-sm text-[11px] text-tertiary font-semibold bg-tertiary-fixed px-2 py-0.5 rounded-full">${vendor.status.note}</span>`
        : "";

    const rushScore =
      vendor.customerRush && typeof vendor.customerRush === "object"
        ? vendor.customerRush.score
        : 80;
    const rushStatus =
      vendor.customerRush && vendor.customerRush.statusLabel
        ? vendor.customerRush.statusLabel
        : "Active Activity";
    const rushBar =
      vendor.customerRush && vendor.customerRush.barColor
        ? vendor.customerRush.barColor
        : "bg-primary";

    return `
      <article data-vendor-id="${vendor.id}" class="vendor-card group relative bg-surface-container-lowest rounded-2xl p-space-md md:p-space-lg shadow-sm hover:shadow-md transition-all duration-200">
        <div class="flex flex-col md:flex-row md:items-start justify-between gap-space-md">
          
          <!-- Vendor Identity & Meta -->
          <div class="flex items-start gap-space-sm flex-1 min-w-0">
            <div class="relative shrink-0">
              <div class="w-14 h-14 rounded-2xl bg-surface-container-high overflow-hidden shadow-inner flex items-center justify-center font-headline-sm text-primary font-bold">
                ${vendor.name.substring(0, 2)}
              </div>
              <span class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full ${vendor.status ? vendor.status.dotColor : 'bg-emerald-600'} border-2 border-surface-container-lowest"></span>
            </div>

            <div class="flex flex-col min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="font-headline-sm text-headline-sm font-bold text-on-surface tracking-tight group-hover:text-primary transition-colors truncate">
                  ${vendor.name}
                </h3>
                <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${vendor.status ? vendor.status.pillClass : 'bg-emerald-100 text-emerald-900'}">
                  <span class="w-1.5 h-1.5 rounded-full ${vendor.status ? vendor.status.dotColor : 'bg-emerald-600'} animate-pulse"></span>
                  ${vendor.status ? vendor.status.label : 'SELLING NOW'}
                </span>
                ${setupNotice}
              </div>

              <!-- Category & Distance Strip -->
              <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-on-surface-variant font-body-sm text-body-sm">
                <span class="font-medium text-on-surface">${vendor.categoryName}</span>
                <span>•</span>
                <span class="flex items-center gap-0.5">
                  <span class="material-symbols-outlined text-[15px] text-primary">location_on</span>
                  <strong>${vendor.distanceKm} km</strong> away (${vendor.area})
                </span>
              </div>

              <!-- Spot Association -->
              <div class="flex items-center gap-1.5 mt-2 text-on-surface-variant font-body-sm text-[12px]">
                <span class="material-symbols-outlined text-[15px] text-tertiary">storefront</span>
                <span>Spot: <strong class="text-on-surface">${vendor.spot}</strong></span>
              </div>

              <!-- Product Chips -->
              <div class="flex flex-wrap items-center gap-1.5 mt-3">
                <span class="text-[11px] font-label-caps text-on-surface-variant uppercase mr-1">OFFERS:</span>
                ${productsHtml}
              </div>
            </div>
          </div>

          <!-- Customer Rush Score Gauge Module -->
          <div class="bg-surface-container-low rounded-xl p-3 md:w-56 shrink-0 flex flex-col justify-between">
            <div class="flex items-center justify-between">
              <span class="font-label-caps text-label-caps uppercase text-on-surface-variant flex items-center gap-1">
                <span class="material-symbols-outlined text-[14px] text-primary">local_fire_department</span>
                CUSTOMER RUSH
              </span>
              <span class="font-label-numeric-lg text-[18px] font-extrabold text-on-surface">
                ${rushScore}<span class="text-[11px] font-normal text-on-surface-variant">/100</span>
              </span>
            </div>

            <!-- Rush Bar -->
            <div class="w-full h-2 rounded-full bg-surface-container-high overflow-hidden my-2">
              <div class="h-full rounded-full ${rushBar}" style="width: ${rushScore}%;"></div>
            </div>

            <div class="flex items-center justify-between text-[11px] font-body-sm text-on-surface-variant">
              <span class="font-semibold text-primary">${rushStatus}</span>
              <span class="material-symbols-outlined text-[14px]">insights</span>
            </div>
          </div>
        </div>

        <!-- Card Foot Action Bar -->
        <div class="mt-space-md pt-space-sm border-t border-surface-container flex flex-col sm:flex-row items-center justify-between gap-space-sm">
          <div class="flex items-center gap-2 text-on-surface-variant text-[11px] font-body-sm self-start sm:self-auto">
            <span class="material-symbols-outlined text-[16px] text-emerald-700">verified</span>
            <span>Verified merchant coordinates</span>
          </div>

          <div class="flex items-center gap-2.5 w-full sm:w-auto">
            <button 
              type="button"
              data-action="connect" 
              data-vendor-id="${vendor.id}" 
              data-vendor-name="${vendor.name.replace(/"/g, "&quot;")}"
              class="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md transition-all font-semibold"
            >
              <span class="material-symbols-outlined text-[18px] text-primary">handshake</span>
              <span>CO-LOCATE / CONNECT</span>
            </button>

            <a 
              href="vendor.html?id=${vendor.id}"
              class="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md transition-all font-semibold shadow-sm"
            >
              <span>VIEW PROFILE</span>
              <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
            </a>
          </div>
        </div>
      </article>
    `;
  }

  function renderMapMarkers(vendors) {
    const markersContainer = document.getElementById("map-markers-layer");
    if (!markersContainer) return;

    markersContainer.innerHTML = vendors
      .map((v) => {
        const isOnline = v.status && v.status.code === "SELLING_NOW";
        const markerColor = isOnline ? "bg-emerald-600" : "bg-amber-500";
        const x = v.mapCoords ? v.mapCoords.x : "50%";
        const y = v.mapCoords ? v.mapCoords.y : "50%";

        return `
          <div 
            style="left: ${x}; top: ${y};" 
            class="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
            data-marker-id="${v.id}"
          >
            <div class="relative flex items-center justify-center">
              <span class="w-7 h-7 rounded-full ${markerColor} text-white shadow-lg flex items-center justify-center text-[10px] font-bold ring-2 ring-surface-container-lowest transform group-hover:scale-125 transition-transform">
                ${v.name.substring(0, 1)}
              </span>
            </div>
            <!-- Tooltip on hover -->
            <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex flex-col items-center pointer-events-none z-40 whitespace-nowrap">
              <div class="bg-inverse-surface text-inverse-on-surface px-2 py-1 rounded-md shadow-lg text-[10px] font-semibold">
                ${v.name} (${v.distanceKm}km)
              </div>
              <div class="w-1.5 h-1.5 bg-inverse-surface rotate-45 -mt-1"></div>
            </div>
          </div>
        `;
      })
      .join("");

    markersContainer.querySelectorAll("[data-marker-id]").forEach((marker) => {
      marker.addEventListener("click", () => {
        const id = marker.getAttribute("data-marker-id");
        const card = document.querySelector(`[data-vendor-id="${id}"]`);
        if (card) {
          card.scrollIntoView({ behavior: "smooth", block: "center" });
          card.classList.add("ring-2", "ring-primary");
          setTimeout(() => card.classList.remove("ring-2", "ring-primary"), 2000);
        }
      });
    });
  }

  function renderVendorsUI() {
    const container = document.getElementById("vendors-list-container");
    const emptyState = document.getElementById("empty-state-view");
    const activeSummaryBadge = document.getElementById("active-summary-badge");
    const resultStatusText = document.getElementById("result-status-text");

    if (!container) return;

    if (allVendors.length === 0) {
      container.innerHTML = "";
      if (emptyState) {
        emptyState.classList.remove("hidden");
        emptyState.classList.add("flex");
      }
    } else {
      if (emptyState) {
        emptyState.classList.add("hidden");
        emptyState.classList.remove("flex");
      }
      container.innerHTML = allVendors.map(renderVendorCard).join("");
    }

    renderMapMarkers(allVendors);

    if (activeSummaryBadge) {
      activeSummaryBadge.textContent = `${allVendors.length} ACTIVE WITHIN 1.5 KM`;
    }

    if (resultStatusText) {
      if (searchQuery) {
        resultStatusText.textContent = `Matching "${searchQuery}" (${allVendors.length})`;
      } else if (currentCategory !== "ALL") {
        resultStatusText.textContent = `Filtered by ${currentCategory} (${allVendors.length})`;
      } else {
        resultStatusText.textContent = `Showing all active`;
      }
    }

    bindCardActions();
  }

  function bindCardActions() {
    const connectButtons = document.querySelectorAll('[data-action="connect"]');
    connectButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const vendorId = btn.getAttribute("data-vendor-id");
        VyaparAPI.connectVendor(vendorId).then((res) => {
          if (typeof window.showToast === "function") {
            window.showToast(res.message);
          }
        });
      });
    });
  }

  function setViewMode(mode) {
    currentViewMode = mode;
    const viewListBtn = document.getElementById("view-list-btn");
    const viewMapBtn = document.getElementById("view-map-btn");
    const vendorDirectoryPane = document.getElementById("vendor-directory-pane");
    const vendorMapPane = document.getElementById("vendor-map-pane");

    if (!viewListBtn || !viewMapBtn || !vendorMapPane || !vendorDirectoryPane) return;

    if (mode === "MAP") {
      viewMapBtn.classList.add("bg-surface-container-lowest", "text-primary", "shadow-sm", "font-semibold");
      viewMapBtn.classList.remove("text-on-surface-variant");
      viewListBtn.classList.remove("bg-surface-container-lowest", "text-primary", "shadow-sm", "font-semibold");
      viewListBtn.classList.add("text-on-surface-variant");

      vendorMapPane.classList.remove("hidden");
      vendorDirectoryPane.classList.add("hidden", "lg:flex");
    } else {
      viewListBtn.classList.add("bg-surface-container-lowest", "text-primary", "shadow-sm", "font-semibold");
      viewListBtn.classList.remove("text-on-surface-variant");
      viewMapBtn.classList.remove("bg-surface-container-lowest", "text-primary", "shadow-sm", "font-semibold");
      viewMapBtn.classList.add("text-on-surface-variant");

      vendorDirectoryPane.classList.remove("hidden");
      vendorMapPane.classList.remove("hidden");
    }
  }

  function setupEventListeners() {
    const searchInput = document.getElementById("vendor-search-input");
    const clearSearchBtn = document.getElementById("clear-search-btn");
    const categoryPills = document.querySelectorAll(".filter-pill");
    const resetFiltersBtn = document.getElementById("reset-filters-btn");
    const viewListBtn = document.getElementById("view-list-btn");
    const viewMapBtn = document.getElementById("view-map-btn");

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
        loadVendors();
      });
    }

    if (clearSearchBtn) {
      clearSearchBtn.addEventListener("click", () => {
        if (searchInput) {
          searchInput.value = "";
          searchQuery = "";
          clearSearchBtn.classList.add("hidden");
          loadVendors();
          searchInput.focus();
        }
      });
    }

    categoryPills.forEach((pill) => {
      pill.addEventListener("click", () => {
        categoryPills.forEach((p) => {
          p.classList.remove("bg-primary", "text-on-primary", "shadow-sm", "font-semibold");
          p.classList.add("text-on-surface-variant");
        });
        pill.classList.add("bg-primary", "text-on-primary", "shadow-sm", "font-semibold");
        pill.classList.remove("text-on-surface-variant");

        currentCategory = pill.getAttribute("data-category") || "ALL";
        loadVendors();
      });
    });

    if (resetFiltersBtn) {
      resetFiltersBtn.addEventListener("click", () => {
        currentCategory = "ALL";
        searchQuery = "";
        if (searchInput) searchInput.value = "";
        if (clearSearchBtn) clearSearchBtn.classList.add("hidden");

        categoryPills.forEach((p) => {
          if (p.getAttribute("data-category") === "ALL") {
            p.classList.add("bg-primary", "text-on-primary", "shadow-sm", "font-semibold");
            p.classList.remove("text-on-surface-variant");
          } else {
            p.classList.remove("bg-primary", "text-on-primary", "shadow-sm", "font-semibold");
            p.classList.add("text-on-surface-variant");
          }
        });
        loadVendors();
      });
    }

    if (viewListBtn) viewListBtn.addEventListener("click", () => setViewMode("LIST"));
    if (viewMapBtn) viewMapBtn.addEventListener("click", () => setViewMode("MAP"));
  }

  function setupTelemetryClock() {
    const telemetryTime = document.getElementById("telemetry-time");
    if (telemetryTime) {
      let secondsAgo = 10;
      setInterval(() => {
        secondsAgo += 15;
        if (secondsAgo < 60) {
          telemetryTime.textContent = `Updated ${secondsAgo}s ago`;
        } else {
          const mins = Math.floor(secondsAgo / 60);
          telemetryTime.textContent = `Updated ${mins}m ago`;
        }
      }, 15000);
    }
  }

  // Self-initialize if on Discover page
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      if (document.body.dataset.page === "discover") initDiscover();
    });
  } else {
    if (document.body.dataset.page === "discover") initDiscover();
  }
})();
