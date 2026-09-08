/**
 * map.js - VYAPAR Street Vendor Intelligence Platform
 * Unified Map & Radar Telemetry Module
 * 
 * Reusable across Dashboard (index.html), Recommendations (recommendations.html),
 * Spot Details (spot.html), and Discover Vendors (discover.html).
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.VyaparMap = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  let currentZoomLevel = 1.0;

  return {
    /**
     * Zoom Map Viewport
     * @param {string} viewportId
     * @param {number} delta
     */
    zoomMap: function (viewportId = "map-viewport", delta = 0) {
      const viewport = document.getElementById(viewportId);
      if (!viewport) return currentZoomLevel;

      if (delta === 0) {
        currentZoomLevel = 1.0;
      } else {
        currentZoomLevel = Math.min(
          Math.max(0.85, currentZoomLevel + delta * 0.15),
          1.45
        );
      }
      viewport.style.transform = `scale(${currentZoomLevel})`;
      viewport.style.transformOrigin = "center center";
      viewport.style.transition = "transform 0.25s ease-out";
      return currentZoomLevel;
    },

    /**
     * Center Map to active coordinates
     * @param {string} viewportId
     */
    centerMap: function (viewportId = "map-viewport") {
      this.zoomMap(viewportId, 0);
      if (typeof window.showToast === "function") {
        window.showToast("Map re-centered to your active location.");
      }
    },

    /**
     * Select a specific marker by Spot/Zone ID
     * @param {string} markerSelector
     * @param {string} targetId
     */
    selectMarker: function (markerSelector = ".map-marker", targetId) {
      const markers = document.querySelectorAll(markerSelector);
      markers.forEach((marker) => {
        const id =
          marker.getAttribute("data-spot-id") ||
          marker.getAttribute("data-marker-id");
        const bubble = marker.querySelector(".marker-bubble") || marker;

        if (id === targetId) {
          marker.classList.add("scale-125", "z-30");
          bubble.classList.add("ring-2", "ring-primary", "bg-primary-fixed");
        } else {
          marker.classList.remove("scale-125", "z-30");
          bubble.classList.remove("ring-2", "ring-primary", "bg-primary-fixed");
        }
      });
    },

    /**
     * Synchronize card click with map marker
     * @param {string} spotId
     * @param {string} cardPrefix
     */
    syncMapAndList: function (spotId, cardPrefix = "spot-card-") {
      this.selectMarker(".map-marker", spotId);
      const card = document.getElementById(`${cardPrefix}${spotId}`);
      if (card) {
        card.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        card.classList.add("ring-2", "ring-primary");
        setTimeout(() => {
          card.classList.remove("ring-2", "ring-primary");
        }, 1800);
      }
    },

    /**
     * Generate OpenStreetMap / Google Maps directions URL
     * @param {string} locationName
     * @param {object} coords
     */
    getNavigationUrl: function (locationName, coords) {
      if (coords && coords.lat && coords.lng) {
        return `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}&travelmode=walking`;
      }
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        locationName + " Mumbai"
      )}`;
    },
  };
});
