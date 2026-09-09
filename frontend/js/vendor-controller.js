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

  async function loadRealDemandHeatmap(lat, lng) {
    const timestampEl = document.getElementById("map-refresh-timestamp");
    const container = document.getElementById("map-viewport");

    try {
      const url = `/api/demand/heatmap?lat=${lat}&lng=${lng}&radius=5000`;
      const res = await window.VyaparAuth.callBackendAPI(url);
      const hotspots = res?.data || [];

      if (timestampEl) {
        timestampEl.textContent = `Telemetry synced (${hotspots.length} live hotspots)`;
      }

      // Render Dynamic Pins on Map Viewport
      if (container && hotspots.length > 0) {
        // Clear any old dynamic pins
        container.querySelectorAll(".dynamic-hotspot-pin").forEach((p) => p.remove());

        hotspots.slice(0, 4).forEach((spot, idx) => {
          const score = Math.round(spot.demand_score || 70);
          const name = spot.name || `Hotspot #${idx + 1}`;
          const isHigh = score >= 75;
          const bgClass = isHigh ? "bg-error text-white" : "bg-primary-container text-on-primary-container";

          // Calculate offset position
          const topPercent = 25 + (idx * 18);
          const leftPercent = 20 + (idx * 22);

          const pin = document.createElement("div");
          pin.className = `dynamic-hotspot-pin absolute top-[${topPercent}%] left-[${leftPercent}%] transform -translate-x-1/2 -translate-y-1/2 cursor-pointer z-20`;
          pin.innerHTML = `
            <div class="relative flex items-center justify-center">
              <span class="animate-ping absolute h-12 w-12 rounded-full ${isHigh ? 'bg-error' : 'bg-primary'} opacity-30"></span>
              <div class="w-9 h-9 rounded-full ${bgClass} flex items-center justify-center shadow-lg font-bold text-xs">
                ${score}
              </div>
              <div class="absolute top-10 whitespace-nowrap bg-white text-[#1f1b17] px-2 py-0.5 rounded shadow text-xs font-bold border border-[#e8dfd8]">
                ${name}
              </div>
            </div>
          `;
          container.appendChild(pin);
        });
      }
    } catch (err) {
      console.warn("Real heatmap load failed:", err);
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
