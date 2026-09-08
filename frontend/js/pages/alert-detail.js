/**
 * alert-detail.js - Alert Details Page Controller
 * Page: alert-detail.html (body data-page="alert-detail")
 * 
 * Responsibilities:
 * - Read alert ID from URL (?id=...)
 * - Load alert telemetry from VyaparAPI.getAlert(alertId)
 * - Safe error handling for missing / invalid alert IDs
 * - Wire navigation CTAs:
 *     - "BACK TO LIVE ALERTS" -> alerts.html
 *     - "VIEW SPOT" -> spot.html?id={spotId}
 *     - "I'M ALREADY HERE • CHECK IN" -> checkin.html?id={spotId}
 *     - "NAVIGATE TO SPOT" -> Maps direction launcher
 */

(function () {
  "use strict";

  function initAlertDetail() {
    if (typeof VyaparAPI === "undefined") {
      console.error("[alert-detail.js] VyaparAPI not loaded.");
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const rawAlertId = urlParams.get("id");

    if (!rawAlertId) {
      renderErrorState(
        "Missing Alert Identifier",
        "No alert ID was provided in the URL. Please select an active signal from the Live Alerts stream."
      );
      return;
    }

    const alertId = rawAlertId.trim();

    VyaparAPI.getAlert(alertId)
      .then((alert) => {
        if (!alert) {
          renderErrorState(
            "Alert Not Found",
            `We couldn't locate active telemetry for signal "${alertId}". It may have expired or been resolved.`
          );
          return;
        }

        renderAlertDetails(alert);
      })
      .catch(() => {
        renderErrorState(
          "Telemetry Sync Failed",
          "Unable to communicate with the alert intelligence service. Please try again."
        );
      });
  }

  function renderAlertDetails(alert) {
    // 1. Title & Header
    const titleEl = document.querySelector("main h1, main h2");
    if (titleEl && alert.headline) {
      titleEl.textContent = alert.headline;
    }

    // 2. Wire "Check-In" Button
    const checkinBtn = document.getElementById("checkin-button");
    if (checkinBtn && alert.spotId) {
      checkinBtn.setAttribute("href", `checkin.html?id=${alert.spotId}`);
    }

    // 3. Add or Wire "View Spot" Button
    const actionsPanel = document.getElementById("alert-actions");
    if (actionsPanel && alert.spotId) {
      let viewSpotBtn = document.getElementById("view-spot-action-btn");
      if (!viewSpotBtn) {
        viewSpotBtn = document.createElement("a");
        viewSpotBtn.id = "view-spot-action-btn";
        viewSpotBtn.className =
          "w-full bg-surface-container-lowest border border-outline-variant/40 hover:bg-surface-container text-on-surface font-headline-sm text-headline-sm py-space-md px-space-lg rounded-xl flex items-center justify-center gap-space-xs transition-all text-center";
        viewSpotBtn.innerHTML = `
          <span class="material-symbols-outlined text-primary text-[22px]">near_me</span>
          <span>VIEW SPOT INTELLIGENCE</span>
        `;
        // Insert right after checkin button
        if (checkinBtn) {
          checkinBtn.parentNode.insertBefore(viewSpotBtn, checkinBtn.nextSibling);
        } else {
          actionsPanel.appendChild(viewSpotBtn);
        }
      }
      viewSpotBtn.setAttribute("href", `spot.html?id=${alert.spotId}`);
    }

    // 4. Wire Navigation Button
    const navBtn = document.getElementById("navigate-button");
    if (navBtn) {
      const destLat = alert.coordinates ? alert.coordinates.lat : 19.0657;
      const destLng = alert.coordinates ? alert.coordinates.lng : 72.8793;
      const mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=walking`;

      navBtn.addEventListener("click", () => {
        navBtn.innerHTML = `
          <span class="material-symbols-outlined animate-spin text-[22px]">sync</span>
          <span>OPENING MAP ROUTE...</span>
        `;

        setTimeout(() => {
          window.open(mapUrl, "_blank");
          navBtn.innerHTML = `
            <span class="material-symbols-outlined text-[22px]">navigation</span>
            <span>NAVIGATE TO SPOT (${alert.distanceKm} km)</span>
            <span class="material-symbols-outlined text-[20px]">arrow_forward</span>
          `;
        }, 450);
      });
    }
  }

  function renderErrorState(title, message) {
    const mainContainer = document.querySelector("main > div > div.flex.flex-col.w-full.pb-32");
    if (!mainContainer) return;

    mainContainer.innerHTML = `
      <div class="flex flex-col items-center justify-center min-h-[50vh] text-center p-8 bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 my-8">
        <div class="w-16 h-16 rounded-2xl bg-error-container/40 text-error flex items-center justify-center mb-4">
          <span class="material-symbols-outlined text-[36px]">notifications_off</span>
        </div>
        <h2 class="font-headline-lg text-headline-lg font-bold text-on-surface mb-2">${title}</h2>
        <p class="font-body-md text-body-md text-on-surface-variant max-w-md mb-6">${message}</p>
        <div class="flex items-center gap-3">
          <a href="alerts.html" class="px-6 py-3 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-bold hover:bg-primary-container transition-all flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px]">arrow_back</span>
            <span>BACK TO LIVE ALERTS</span>
          </a>
        </div>
      </div>
    `;
  }

  // Self-initialize if on Alert Detail page
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      if (document.body.dataset.page === "alert-detail") initAlertDetail();
    });
  } else {
    if (document.body.dataset.page === "alert-detail") initAlertDetail();
  }
})();
