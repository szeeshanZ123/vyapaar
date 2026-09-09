/**
 * vendor-controller.js - Real-time Vendor Dashboard Data Layer & Check-in Controller
 * 
 * Replaces static/mock telemetry with real data from FastAPI & MongoDB:
 * - Real GPS Geolocation & Check-in (/api/checkins)
 * - Real Customer Rush Score (/api/demand/score)
 * - Real Demand Heatmap Points (/api/demand/heatmap)
 * - Real Spot Recommendations (/api/recommendations)
 * - Real Nearby Active Vendors (/api/vendors/active)
 */
(function () {
  "use strict";

  let currentVendor = null;
  let currentCoords = null; // { lat, lng }
  let currentCategory = "food";

  document.addEventListener("DOMContentLoaded", async () => {
    if (!window.VyaparAuth) return;

    // 1. Enforce Authentication & Role Guard (Role MUST be vendor)
    const authData = await window.VyaparAuth.requireAuthOrRedirect({ allowedRole: "vendor" });
    if (!authData) return;

    const { profile, vendor, user } = authData;
    currentVendor = vendor;
    currentCategory = vendor?.category || "food";

    const displayName = vendor?.display_name || profile?.name || (user?.email ? user.email.split("@")[0] : "Vendor");
    const businessName = vendor?.business_name || displayName;

    // 2. Populate Real Vendor Identity across Dashboard
    updateVendorIdentityUI(displayName, businessName, currentCategory, vendor);

    // 3. Bind Logout Handlers
    document.querySelectorAll('[data-path="logout"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        window.VyaparAuth.logout();
      });
    });

    // 4. Request Real Browser Geolocation
    initGeolocationAndTelemetry();

    // 5. Setup Live Check-in Button
    setupCheckInButton();
  });

  function updateVendorIdentityUI(displayName, businessName, category, vendor) {
    const greetingEl = document.getElementById("vendor-greeting-text");
    if (greetingEl) {
      greetingEl.textContent = `Good evening, ${displayName}`;
    }

    const businessBadgeEl = document.getElementById("vendor-business-badge");
    if (businessBadgeEl) {
      businessBadgeEl.textContent = businessName;
    }

    const categoryBadgeEl = document.getElementById("vendor-category-badge");
    if (categoryBadgeEl) {
      categoryBadgeEl.textContent = category ? (category.charAt(0).toUpperCase() + category.slice(1)) : "General";
    }

    const avatarEl = document.getElementById("vendor-avatar-letter");
    if (avatarEl) {
      avatarEl.textContent = displayName.charAt(0).toUpperCase();
    }
  }

  function initGeolocationAndTelemetry() {
    const statusEl = document.getElementById("gps-status-indicator");
    if (statusEl) statusEl.textContent = "Acquiring GPS...";

    if (!navigator.geolocation) {
      setFallbackLocation("Geolocation not supported by browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        currentCoords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };
        if (statusEl) {
          statusEl.textContent = `GPS Active: ${currentCoords.lat.toFixed(4)}, ${currentCoords.lng.toFixed(4)}`;
        }
        loadAllRealTelemetry(currentCoords.lat, currentCoords.lng);
      },
      (err) => {
        console.warn("Geolocation permission denied or error:", err);
        // If permission denied, use last known vendor location or graceful fallback
        if (currentVendor?.current_location?.coordinates) {
          const coords = currentVendor.current_location.coordinates;
          currentCoords = { lat: coords[1], lng: coords[0] };
          if (statusEl) statusEl.textContent = `Using Last Known Spot: ${currentCoords.lat.toFixed(4)}, ${currentCoords.lng.toFixed(4)}`;
          loadAllRealTelemetry(currentCoords.lat, currentCoords.lng);
        } else {
          setFallbackLocation("Location access required for real-time demand.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  function setFallbackLocation(msg) {
    const statusEl = document.getElementById("gps-status-indicator");
    if (statusEl) statusEl.textContent = msg;

    // Use default active Mumbai zone for telemetry demo if location blocked
    const defaultLat = 19.0760;
    const defaultLng = 72.8777;
    currentCoords = { lat: defaultLat, lng: defaultLng };
    loadAllRealTelemetry(defaultLat, defaultLng);
  }

  async function loadAllRealTelemetry(lat, lng) {
    // 1. Real Demand Score
    loadRealDemandScore(lat, lng);

    // 2. Real Demand Heatmap
    loadRealDemandHeatmap(lat, lng);

    // 3. Real Recommendations
    loadRealRecommendations(lat, lng);

    // 4. Real Nearby Active Vendors / Competition
    loadRealNearbyCompetition(lat, lng);
  }

  async function loadRealDemandScore(lat, lng) {
    const scoreEl = document.getElementById("rush-score-display");
    const progressEl = document.getElementById("rush-progress-bar");
    const levelBadgeEl = document.getElementById("rush-level-badge");
    const descEl = document.getElementById("rush-description-text");
    const zoneEl = document.getElementById("rush-zone-name");

    try {
      const url = `/api/demand/score?lat=${lat}&lng=${lng}&category=${encodeURIComponent(currentCategory)}&radius=1500`;
      const res = await window.VyaparAuth.callBackendAPI(url);
      const data = res?.data;

      if (data) {
        const score = Math.round(data.demand_score ?? 0);
        if (scoreEl) scoreEl.textContent = score;
        if (progressEl) progressEl.style.width = `${score}%`;

        const rushLevel = data.rush_level || (score >= 75 ? "VERY BUSY" : score >= 45 ? "MODERATE" : "QUIET");
        const badgeIcon = score >= 75 ? "🔥" : score >= 45 ? "⚡" : "🌿";

        if (levelBadgeEl) {
          levelBadgeEl.innerHTML = `<span>${badgeIcon}</span><span>${rushLevel}</span>`;
          if (score >= 75) {
            levelBadgeEl.className = "ml-auto inline-flex items-center gap-1 px-3 py-1 rounded-full bg-error-container text-error font-label-md text-label-md font-bold";
          } else if (score >= 45) {
            levelBadgeEl.className = "ml-auto inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#ffddb8] text-[#653e00] font-label-md text-label-md font-bold";
          } else {
            levelBadgeEl.className = "ml-auto inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-label-md text-label-md font-bold";
          }
        }

        if (descEl) {
          descEl.innerHTML = `Real-time demand computed from active local check-ins within 1.5 km. Category weight applied for <strong>${currentCategory}</strong>.`;
        }

        if (zoneEl) {
          zoneEl.textContent = `Active Area (${lat.toFixed(3)}, ${lng.toFixed(3)})`;
        }
      }
    } catch (err) {
      console.warn("Real demand score load failed:", err);
      if (scoreEl) scoreEl.textContent = "--";
    }
  }

  let vendorMapInstance = null;
  let vendorGpsMarker = null;
  let heatmapLayerGroup = null;
  let peerVendorsLayerGroup = null;
  let isHeatmapVisible = true;

  function initVendorLeafletMap(lat, lng) {
    if (typeof L === "undefined") {
      console.warn("Leaflet library (L) not loaded yet.");
      return;
    }
    const mapEl = document.getElementById("vendor-leaflet-map");
    if (!mapEl) return;

    if (!vendorMapInstance) {
      vendorMapInstance = L.map("vendor-leaflet-map", {
        zoomControl: false,
        attributionControl: false
      }).setView([lat, lng], 14);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OSM',
        maxZoom: 19
      }).addTo(vendorMapInstance);

      heatmapLayerGroup = L.layerGroup().addTo(vendorMapInstance);
      peerVendorsLayerGroup = L.layerGroup().addTo(vendorMapInstance);
    } else {
      vendorMapInstance.setView([lat, lng], vendorMapInstance.getZoom());
    }

    // Render or update Vendor GPS Location Marker
    if (vendorGpsMarker) {
      vendorGpsMarker.setLatLng([lat, lng]);
    } else {
      const vendorIcon = L.divIcon({
        className: "custom-vendor-gps-marker",
        html: `
          <div class="relative flex items-center justify-center">
            <span class="animate-ping absolute h-8 w-8 rounded-full bg-[#aa3000] opacity-70"></span>
            <div class="w-6 h-6 rounded-full bg-[#aa3000] border-2 border-white shadow-xl flex items-center justify-center text-white text-[11px] font-black">
              ★
            </div>
          </div>
        `,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });

      vendorGpsMarker = L.marker([lat, lng], { icon: vendorIcon })
        .addTo(vendorMapInstance)
        .bindPopup(`
          <div class="p-1 font-sans">
            <div class="font-bold text-[#aa3000] text-xs">📍 You (Current Location)</div>
            <div class="text-[11px] text-gray-600 mt-0.5">${lat.toFixed(4)}, ${lng.toFixed(4)}</div>
          </div>
        `);
    }

    // Invalidate size in case container rendered while hidden
    setTimeout(() => {
      if (vendorMapInstance) vendorMapInstance.invalidateSize();
    }, 200);
  }

  // Global Map Controls for Vendor Dashboard
  window.zoomVendorMap = function (delta) {
    if (vendorMapInstance) {
      vendorMapInstance.setZoom(vendorMapInstance.getZoom() + delta);
    }
  };

  window.centerVendorMap = function () {
    if (vendorMapInstance && currentCoords) {
      vendorMapInstance.setView([currentCoords.lat, currentCoords.lng], 15, { animate: true });
      if (typeof window.showToast === "function") {
        window.showToast("Map re-centered to your location.");
      }
    }
  };

  window.toggleVendorHeatmap = function () {
    if (!vendorMapInstance || !heatmapLayerGroup) return;
    if (isHeatmapVisible) {
      vendorMapInstance.removeLayer(heatmapLayerGroup);
      isHeatmapVisible = false;
      if (typeof window.showToast === "function") {
        window.showToast("Heatmap layer hidden.");
      }
    } else {
      vendorMapInstance.addLayer(heatmapLayerGroup);
      isHeatmapVisible = true;
      if (typeof window.showToast === "function") {
        window.showToast("Heatmap layer visible.");
      }
    }
  };

  async function loadRealDemandHeatmap(lat, lng) {
    const timestampEl = document.getElementById("map-refresh-timestamp");
    const listContainer = document.getElementById("hotspots-list-container");

    // Ensure Leaflet Map initialized
    initVendorLeafletMap(lat, lng);

    try {
      const url = `/api/demand/heatmap?lat=${lat}&lng=${lng}&radius=5000`;
      const res = await window.VyaparAuth.callBackendAPI(url);
      const heatmapData = res?.data;
      const points = heatmapData?.points || [];

      if (timestampEl) {
        timestampEl.textContent = `Telemetry synced (${points.length} live hotspots)`;
      }

      // 1. Render Real Heatmap Circles & Pins on Leaflet Map
      if (heatmapLayerGroup) {
        heatmapLayerGroup.clearLayers();

        points.forEach((spot, idx) => {
          const spotLat = spot.lat || (spot.coordinates ? spot.coordinates[1] : null);
          const spotLng = spot.lng || (spot.coordinates ? spot.coordinates[0] : null);
          if (spotLat == null || spotLng == null) return;

          const score = Math.round(spot.score || spot.demand_score || 65);
          const name = spot.name || `Hotspot #${idx + 1}`;
          const isHot = score >= 75;
          const circleColor = isHot ? "#dc2626" : score >= 50 ? "#ea580c" : "#16a34a";
          const fillColor = isHot ? "#ef4444" : score >= 50 ? "#f97316" : "#22c55e";

          // Add Demand Intensity Circle
          const circle = L.circle([spotLat, spotLng], {
            radius: Math.max(120, Math.min(450, (spot.checkin_count || 1) * 90)),
            color: circleColor,
            fillColor: fillColor,
            fillOpacity: 0.28,
            weight: 1.5
          }).addTo(heatmapLayerGroup);

          // Add Score Badge Marker Pin
          const pinIcon = L.divIcon({
            className: "custom-hotspot-badge-marker",
            html: `
              <div class="relative flex items-center justify-center cursor-pointer group">
                <span class="animate-ping absolute h-8 w-8 rounded-full ${isHot ? 'bg-red-500' : 'bg-amber-500'} opacity-30"></span>
                <div class="w-8 h-8 rounded-full ${isHot ? 'bg-red-600 text-white' : 'bg-[#aa3000] text-white'} flex items-center justify-center shadow-lg font-bold text-xs border-2 border-white">
                  ${score}
                </div>
              </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          });

          const marker = L.marker([spotLat, spotLng], { icon: pinIcon })
            .addTo(heatmapLayerGroup)
            .bindPopup(`
              <div class="p-2 font-sans min-w-[180px]">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-xs font-extrabold text-[#1f1b17]">${name}</span>
                  <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${isHot ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}">
                    ${score}/100
                  </span>
                </div>
                <p class="text-[11px] text-[#635d5c] mt-1">
                  Demand Index: <strong>${score}</strong> (${spot.checkin_count || 1} recent vendor signals)
                </p>
                <div class="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
                  <a
                    href="https://www.google.com/maps/dir/?api=1&destination=${spotLat},${spotLng}&travelmode=walking"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-[11px] font-bold text-[#aa3000] hover:underline flex items-center gap-1"
                  >
                    <span>Get Directions</span>
                    <span>&rarr;</span>
                  </a>
                </div>
              </div>
            `);
        });
      }

      // 2. Render Ranked Hotspots List Below Map
      if (listContainer) {
        if (points.length === 0) {
          listContainer.innerHTML = `
            <div class="p-4 rounded-xl bg-surface-container-low text-center text-on-surface-variant text-sm font-medium">
              No live hotspots detected in your current radius. Try checking in or updating GPS.
            </div>
          `;
        } else {
          listContainer.innerHTML = points.slice(0, 5).map((spot, idx) => {
            const score = Math.round(spot.score || spot.demand_score || 70);
            const name = spot.name || `Hotspot #${idx + 1}`;
            const isHigh = score >= 75;
            const badgeClass = isHigh ? "bg-error-container text-error" : "bg-primary-fixed text-on-primary-fixed";
            const badgeText = isHigh ? "🔥 VERY BUSY" : "🟠 BUSY";
            const distMeters = spot.distance_meters;
            const distStr = distMeters != null ? (distMeters < 1000 ? `${Math.round(distMeters)} m away` : `${(distMeters / 1000).toFixed(1)} km away`) : `${spot.checkin_count || 1} vendor signals`;

            return `
              <div class="p-space-md rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors cursor-pointer flex items-center justify-between gap-space-sm group" onclick="if(window.centerVendorMap) { if(${spot.lat != null}) { window.vendorMapInstance?.setView([${spot.lat}, ${spot.lng}], 16); } }">
                <div class="flex items-center gap-space-md min-w-0">
                  <span class="font-label-numeric-lg text-label-numeric-lg font-extrabold text-on-surface-variant group-hover:text-primary transition-colors">
                    0${idx + 1}
                  </span>
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <h4 class="font-headline-sm text-headline-sm text-on-surface font-bold truncate">
                        ${name}
                      </h4>
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-label-caps ${badgeClass} font-bold">
                        ${badgeText}
                      </span>
                    </div>
                    <div class="flex items-center gap-3 font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                      <span>${distStr}</span>
                      <span>•</span>
                      <span class="text-primary font-semibold">${spot.checkin_count || 1} Check-ins</span>
                    </div>
                  </div>
                </div>
                <div class="text-right shrink-0">
                  <div class="font-headline-md text-headline-md font-extrabold text-on-surface">
                    ${score}<span class="font-body-sm text-body-sm text-on-surface-variant font-normal">/100</span>
                  </div>
                </div>
              </div>
            `;
          }).join("");
        }
      }
    } catch (err) {
      console.warn("Real heatmap load failed:", err);
      if (listContainer) {
        listContainer.innerHTML = `
          <div class="p-4 rounded-xl bg-surface-container-low text-center text-on-surface-variant text-sm font-medium">
            No live data available. Check your internet connection or check in again.
          </div>
        `;
      }
    }
  }

  async function loadRealRecommendations(lat, lng) {
    const titleEl = document.getElementById("rec-spot-title");
    const descEl = document.getElementById("rec-spot-desc");
    const scoreEl = document.getElementById("rec-spot-score");
    const distEl = document.getElementById("rec-spot-distance");
    const shelterEl = document.getElementById("rec-spot-shelter");
    const transitEl = document.getElementById("rec-spot-transit");

    try {
      const url = `/api/recommendations?lat=${lat}&lng=${lng}&category=${encodeURIComponent(currentCategory)}&limit=1`;
      const res = await window.VyaparAuth.callBackendAPI(url);
      const recs = res?.data || [];

      if (recs.length > 0) {
        const topRec = recs[0];
        if (titleEl) titleEl.textContent = topRec.spot_name || topRec.name || "High Demand Spot";
        if (descEl) descEl.textContent = topRec.reason || `Top recommended selling spot for ${currentCategory} vendors near your location.`;
        if (scoreEl) scoreEl.textContent = `${Math.round(topRec.score || topRec.demand_score || 85)} Score`;

        const distMeters = topRec.distance_meters;
        const distStr = distMeters < 1000 ? `${Math.round(distMeters)} m` : `${(distMeters / 1000).toFixed(1)} km`;
        if (distEl) distEl.textContent = distStr;

        if (shelterEl) shelterEl.textContent = topRec.shelter ? "Covered Stall" : "Open Canopy";
        if (transitEl) transitEl.textContent = topRec.transit_access || "Metro / Bus nearby";
      } else {
        if (titleEl) titleEl.textContent = "No Spot Recommendations Nearby";
        if (descEl) descEl.textContent = "Try updating your GPS location to search within a wider area.";
        if (scoreEl) scoreEl.textContent = "--";
        if (distEl) distEl.textContent = "--";
      }
    } catch (err) {
      console.warn("Real recommendations load failed:", err);
    }
  }

  async function loadRealNearbyCompetition(lat, lng) {
    const compCountEl = document.getElementById("nearby-vendors-count");
    const compStatusEl = document.getElementById("nearby-vendors-status");

    try {
      const url = `/api/vendors/active?lat=${lat}&lng=${lng}&radius=3000`;
      const res = await window.VyaparAuth.callBackendAPI(url);
      const vendors = res?.data || [];

      if (compCountEl) {
        compCountEl.textContent = `${vendors.length} stalls nearby`;
      }
      if (compStatusEl) {
        if (vendors.length === 0) {
          compStatusEl.textContent = "Low Competition";
        } else if (vendors.length <= 5) {
          compStatusEl.textContent = "Moderate";
        } else {
          compStatusEl.textContent = "High Density";
        }
      }

      // Plot active peer vendors on Leaflet map
      if (peerVendorsLayerGroup) {
        peerVendorsLayerGroup.clearLayers();

        vendors.forEach((v) => {
          const coords = v.current_location?.coordinates;
          if (!coords || coords.length < 2) return;
          const vLng = coords[0];
          const vLat = coords[1];

          // Don't duplicate self if coordinates match exactly
          if (currentCoords && Math.abs(vLat - currentCoords.lat) < 0.0001 && Math.abs(vLng - currentCoords.lng) < 0.0001) {
            return;
          }

          const vIcon = L.divIcon({
            className: "peer-vendor-marker",
            html: `
              <div class="w-7 h-7 rounded-full bg-white border-2 border-[#635d5c] text-[#1f1b17] shadow-md flex items-center justify-center font-bold text-xs cursor-pointer hover:border-[#aa3000] hover:scale-110 transition-transform">
                🏪
              </div>
            `,
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          });

          L.marker([vLat, vLng], { icon: vIcon })
            .addTo(peerVendorsLayerGroup)
            .bindPopup(`
              <div class="p-1 font-sans">
                <div class="font-bold text-xs text-[#1f1b17]">${v.business_name || v.display_name || "Vendor Stall"}</div>
                <div class="text-[11px] text-gray-500 capitalize">${v.category || "General"} Category</div>
              </div>
            `);
        });
      }
    } catch (err) {
      console.warn("Real nearby vendors load failed:", err);
      if (compCountEl) compCountEl.textContent = "0 stalls nearby";
    }
  }

  function setupCheckInButton() {
    const checkInBtn = document.getElementById("btn-vendor-checkin");
    if (!checkInBtn) return;

    checkInBtn.addEventListener("click", async () => {
      checkInBtn.disabled = true;
      checkInBtn.innerHTML = `<span class="material-symbols-outlined text-[18px] animate-spin">refresh</span> Updating GPS...`;

      if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        checkInBtn.disabled = false;
        checkInBtn.innerHTML = `<span class="material-symbols-outlined text-[18px]">my_location</span> Check In at Current Spot`;
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          currentCoords = { lat, lng };

          try {
            // Send Check-in to Backend API
            await window.VyaparAuth.callBackendAPI("/api/checkins", {
              method: "POST",
              body: JSON.stringify({
                lat: lat,
                lng: lng,
                category: currentCategory
              })
            });

            // Refresh all real telemetry
            await loadAllRealTelemetry(lat, lng);

            const toastMsg = `Checked in successfully at [${lat.toFixed(4)}, ${lng.toFixed(4)}]`;
            if (typeof window.showToast === "function") {
              window.showToast(toastMsg);
            } else {
              alert(toastMsg);
            }
          } catch (err) {
            console.error("Check-in failed:", err);
            alert(`Check-in failed: ${err.message || "Please try again."}`);
          } finally {
            checkInBtn.disabled = false;
            checkInBtn.innerHTML = `<span class="material-symbols-outlined text-[18px]">check_circle</span> Checked In! Update GPS`;
          }
        },
        (err) => {
          alert("Location permission denied. Please allow location access to check in.");
          checkInBtn.disabled = false;
          checkInBtn.innerHTML = `<span class="material-symbols-outlined text-[18px]">my_location</span> Check In at Current Spot`;
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }
})();
