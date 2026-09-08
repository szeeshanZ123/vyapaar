/**
 * spot.js - Individual Spot Details Page Controller
 * Page: spot.html (body data-page="spot")
 * 
 * Responsibilities:
 * - Safe URL parameter handling (?id=spot-id)
 * - Load spot telemetry via VyaparAPI.getSpot(spotId)
 * - Handle missing / invalid spot ID with friendly UI error state
 * - Render Customer Rush score, trends, and operational metrics
 * - Wire navigation CTAs:
 *     - "BACK TO PLACES" -> recommendations.html
 *     - "CHECK IN HERE" -> checkin.html?id={spotId}
 *     - "NAVIGATE" -> Maps directions
 * - Map telemetry micro-interactions
 */

(function () {
  "use strict";

  function initSpot() {
    if (typeof VyaparAPI === "undefined") {
      console.error("[spot.js] VyaparAPI not loaded.");
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const rawSpotId = urlParams.get("id");

    if (!rawSpotId) {
      renderErrorState("Missing Spot Identifier", "No spot ID was provided in the URL. Please browse available spots from Places.");
      return;
    }

    const spotId = rawSpotId.trim();

    // Load spot data from API
    VyaparAPI.getSpot(spotId)
      .then((spot) => {
        if (!spot) {
          renderErrorState(
            "Spot Not Found",
            `We couldn't locate real-time telemetry for "${spotId}". It may have moved or expired.`
          );
          return;
        }

        renderSpotDetails(spot);
      })
      .catch((err) => {
        renderErrorState(
          "Telemetry Sync Failed",
          "Unable to communicate with the spot telemetry service. Please try again later."
        );
      });
  }

  function renderSpotDetails(spot) {
    // 1. Title & Header
    const titleEl = document.querySelector("main h1");
    if (titleEl) {
      titleEl.textContent = spot.displayName || spot.name;
    }

    // 2. Breadcrumbs / Back link
    const backBtn = document.querySelector('main a[href="recommendations.html"]');
    if (backBtn) {
      backBtn.setAttribute("href", "recommendations.html");
    }

    // 3. Customer Rush Score
    const rushScoreValEl = document.getElementById("rush-score-value");
    if (rushScoreValEl) {
      const score =
        typeof spot.customerRush === "object"
          ? spot.customerRush.score
          : spot.rush_score || 91;
      rushScoreValEl.textContent = score;
    }

    // 4. Update Check-In CTAs
    const checkinBtns = document.querySelectorAll('a[href*="checkin.html"]');
    checkinBtns.forEach((btn) => {
      btn.setAttribute("href", `checkin.html?id=${spot.id}`);
    });

    // 5. Update Navigation CTAs (Google Maps)
    const navUrl =
      spot.coordinates && spot.coordinates.lat && spot.coordinates.lng
        ? `https://www.google.com/maps/dir/?api=1&destination=${spot.coordinates.lat},${spot.coordinates.lng}&travelmode=walking`
        : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
            (spot.displayName || spot.name) + " Mumbai"
          )}`;

    const navBtns = document.querySelectorAll('a[href*="maps.google.com"]');
    navBtns.forEach((btn) => {
      btn.setAttribute("href", navUrl);
    });

    // 6. Map pin zone click interactions
    const pins = document.querySelectorAll("#spotMap .group");
    pins.forEach((pin) => {
      pin.addEventListener("click", () => {
        const zoneTitle = pin.querySelector(".font-label-sm")?.innerText;
        if (zoneTitle && typeof window.showToast === "function") {
          window.showToast(`Telemetry Zone: ${zoneTitle}`);
        }
      });
    });
  }

  function renderErrorState(title, message) {
    const mainContainer = document.querySelector("main > div > div.w-full.max-w-\\[1360px\\]");
    if (!mainContainer) return;

    mainContainer.innerHTML = `
      <div class="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 my-8">
        <div class="w-16 h-16 rounded-2xl bg-error-container/40 text-error flex items-center justify-center mb-4">
          <span class="material-symbols-outlined text-[36px]">location_off</span>
        </div>
        <h2 class="font-headline-lg text-headline-lg font-bold text-on-surface mb-2">${title}</h2>
        <p class="font-body-md text-body-md text-on-surface-variant max-w-md mb-6">${message}</p>
        <div class="flex items-center gap-3">
          <a href="recommendations.html" class="px-6 py-3 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-bold hover:bg-primary-container transition-all flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px]">arrow_back</span>
            <span>BACK TO PLACES</span>
          </a>
        </div>
      </div>
    `;
  }

  // Self-initialize if on Spot page
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      if (document.body.dataset.page === "spot") initSpot();
    });
  } else {
    if (document.body.dataset.page === "spot") initSpot();
  }
})();
