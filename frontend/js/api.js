/**
 * api.js - VYAPAR Street Vendor Intelligence Platform
 * Unified Backend Communication & Decoupled Telemetry Layer
 * 
 * Architecture:
 * Backend API (REST/WebSocket) <---> api.js <---> Page JS <---> HTML UI
 * 
 * In offline/mock mode, this file provides synchronous/asynchronous domain data.
 * When a backend API is available, replace internal implementations here without
 * modifying page-specific JavaScript.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.VyaparAPI = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Configuration (ready for backend endpoints)
  const API_CONFIG = {
    baseUrl: "/api/v1",
    mockMode: true,
    simulateDelayMs: 60,
  };

  /**
   * Mock Data Stores
   */
  const MOCK_SPOTS = [
    {
      id: "kurla-station-west",
      aliasIds: ["kurla", "kurla-station"],
      rank: 1,
      name: "Kurla Station West",
      displayName: "Kurla Station (West Exit)",
      category: "High Density Transit Hub",
      area: "Kurla, Mumbai",
      status: "very-busy",
      statusLabel: "🔥 VERY BUSY",
      customerRush: {
        score: 91,
        status: "VERY BUSY",
        trend: 22,
        trendLabel: "+22% vs 1 hour ago",
      },
      footfall: "9.4k/hr",
      transit: "+22%",
      vendorDensity: "Moderate",
      distanceKm: 0.8,
      distanceMeters: 800,
      trend: "+22% activity vs 1 hr ago",
      crowdLevel: "High crowd volume",
      bestTime: "Best: NOW",
      bestWindow: "NOW (Next 45 mins)",
      keyDriver: "Transit Peak (local train rush)",
      targetZone: "Main Auto Stand, Station Road",
      isWithinZone: true,
      description:
        "Prime commuter convergence node connecting central & harbour lines. Extreme foot traffic for chai, snacks, and mobile treats.",
      insight:
        "Evening transit interchange rush is accelerating. High impulse snacking traffic active.",
      targetUrl: "spot.html?id=kurla-station-west",
      pinCoords: { x: 165, y: 185 },
      coordinates: { lat: 19.0657, lng: 72.8793 },
      hotspots: [
        {
          name: "Station West Exit",
          rush: 91,
          status: "Very Busy",
          color: "red",
        },
        {
          name: "Auto Stand Queue",
          rush: 84,
          status: "Busy",
          color: "orange",
        },
        {
          name: "Skywalk Footbridge",
          rush: 68,
          status: "Moderate",
          color: "yellow",
        },
      ],
      timeline: [
        { hour: "12 PM", score: 45, label: "Moderate" },
        { hour: "03 PM", score: 72, label: "High" },
        { hour: "06 PM", score: 91, label: "Very Busy", active: true },
        { hour: "09 PM", score: 52, label: "Moderate" },
      ],
    },
    {
      id: "phoenix-marketcity",
      aliasIds: ["phoenix"],
      rank: 2,
      name: "Phoenix Marketcity",
      displayName: "Phoenix Marketcity (South Gate Plaza)",
      category: "Retail & Commercial Hub",
      area: "Kurla West, Mumbai",
      status: "very-busy",
      statusLabel: "🔥 VERY BUSY",
      customerRush: {
        score: 86,
        status: "VERY BUSY",
        trend: 18,
        trendLabel: "+18% activity",
      },
      footfall: "6.8k/hr",
      transit: "+18%",
      vendorDensity: "High",
      distanceKm: 1.4,
      distanceMeters: 1400,
      trend: "+18% activity",
      crowdLevel: "Strong customer movement",
      bestTime: "Best: Next 45 min",
      bestWindow: "Next 45 mins",
      keyDriver: "Retail shift change & evening rush",
      targetZone: "South Gate Concourse & LBS Marg",
      isWithinZone: false,
      description:
        "High retail shopper density plus office shifts exiting corporate towers across LBS Marg.",
      insight:
        "Mall shoppers and transit commuters converging for evening snacks and refreshments.",
      targetUrl: "spot.html?id=phoenix-marketcity",
      pinCoords: { x: 340, y: 130 },
      coordinates: { lat: 19.0863, lng: 72.889 },
      hotspots: [
        {
          name: "South Gate Plaza",
          rush: 86,
          status: "Very Busy",
          color: "red",
        },
        {
          name: "LBS Marg Bus Stop",
          rush: 78,
          status: "Busy",
          color: "orange",
        },
      ],
      timeline: [
        { hour: "12 PM", score: 50, label: "Moderate" },
        { hour: "03 PM", score: 65, label: "High" },
        { hour: "06 PM", score: 86, label: "Very Busy", active: true },
        { hour: "09 PM", score: 70, label: "High" },
      ],
    },
    {
      id: "bkc-hub",
      aliasIds: ["bkc"],
      rank: 3,
      name: "BKC Hub",
      displayName: "BKC Diamond Bourse Lane",
      category: "Corporate Financial Corridor",
      area: "Bandra Kurla Complex, Mumbai",
      status: "busy",
      statusLabel: "🟠 BUSY",
      customerRush: {
        score: 82,
        status: "BUSY",
        trend: 12,
        trendLabel: "+12% activity",
      },
      footfall: "5.4k/hr",
      transit: "+12%",
      vendorDensity: "Low",
      distanceKm: 2.1,
      distanceMeters: 2100,
      trend: "+12% activity",
      crowdLevel: "Growing movement",
      bestTime: "Best: Rising Soon",
      bestWindow: "Rising Soon (Next 60 mins)",
      keyDriver: "Evening dining & commuter corridor",
      targetZone: "G-Block Concourse",
      isWithinZone: false,
      description:
        "Financial district executive lunch and evening snack corridor. Higher average order value.",
      insight:
        "Corporate professionals streaming into transit points with high demand for premium snacks & tea.",
      targetUrl: "spot.html?id=bkc-hub",
      pinCoords: { x: 140, y: 355 },
      coordinates: { lat: 19.0664, lng: 72.8688 },
      hotspots: [
        {
          name: "Bourse Gate 3",
          rush: 82,
          status: "Busy",
          color: "orange",
        },
        {
          name: "G-Block Food Lane",
          rush: 79,
          status: "Busy",
          color: "orange",
        },
      ],
      timeline: [
        { hour: "12 PM", score: 85, label: "Very Busy" },
        { hour: "03 PM", score: 55, label: "Moderate" },
        { hour: "06 PM", score: 82, label: "Busy", active: true },
        { hour: "09 PM", score: 35, label: "Low" },
      ],
    },
    {
      id: "dadar-market",
      aliasIds: ["dadar"],
      rank: 4,
      name: "Dadar Market Arcade",
      displayName: "Dadar Flower Market — Platform 1",
      category: "Wholesale & Transit Arcade",
      area: "Dadar West, Mumbai",
      status: "very-busy",
      statusLabel: "🔥 VERY BUSY",
      customerRush: {
        score: 88,
        status: "VERY BUSY",
        trend: 19,
        trendLabel: "+19% surge",
      },
      footfall: "8.1k/hr",
      transit: "+19%",
      vendorDensity: "High",
      distanceKm: 0.4,
      distanceMeters: 400,
      trend: "+19% surge vs 1 hr ago",
      crowdLevel: "Very High Movement",
      bestTime: "Best: NOW",
      bestWindow: "60–90 minutes",
      keyDriver: "Market footfall & commuter transfer",
      targetZone: "North Pedestrian Arcade",
      isWithinZone: true,
      description:
        "Heavy commuter interchange heading towards central arterial hubs.",
      insight:
        "Fast turnaround spot opened along pedestrian walkway. High impulse purchase velocity.",
      targetUrl: "spot.html?id=dadar-market",
      pinCoords: { x: 210, y: 240 },
      coordinates: { lat: 19.0178, lng: 72.8478 },
      hotspots: [
        {
          name: "Platform 1 Arcade",
          rush: 88,
          status: "Very Busy",
          color: "red",
        },
      ],
      timeline: [
        { hour: "12 PM", score: 60, label: "High" },
        { hour: "03 PM", score: 75, label: "High" },
        { hour: "06 PM", score: 88, label: "Very Busy", active: true },
        { hour: "09 PM", score: 62, label: "High" },
      ],
    },
    {
      id: "andheri-east-metro",
      aliasIds: ["andheri"],
      rank: 5,
      name: "Andheri Metro Interchange",
      displayName: "Andheri Metro — Pier 4 Entrance",
      category: "Metro Transit Node",
      area: "Andheri East, Mumbai",
      status: "very-busy",
      statusLabel: "🔥 VERY BUSY",
      customerRush: {
        score: 84,
        status: "VERY BUSY",
        trend: 15,
        trendLabel: "+15% surge",
      },
      footfall: "7.2k/hr",
      transit: "+15%",
      vendorDensity: "Moderate",
      distanceKm: 0.9,
      distanceMeters: 900,
      trend: "+15% activity",
      crowdLevel: "Continuous Stream",
      bestTime: "Best: Next 30 min",
      bestWindow: "45 minutes",
      keyDriver: "Metro shift & evening office egress",
      targetZone: "Underpass Concourse",
      isWithinZone: true,
      description:
        "Rapid corporate transit stream peaking for evening refreshments.",
      insight:
        "Underpass concourse sees continuous commuter flow between railway station and metro line 1.",
      targetUrl: "spot.html?id=andheri-east-metro",
      pinCoords: { x: 280, y: 190 },
      coordinates: { lat: 19.1197, lng: 72.8464 },
      hotspots: [
        {
          name: "Pier 4 Entrance",
          rush: 84,
          status: "Very Busy",
          color: "red",
        },
      ],
      timeline: [
        { hour: "12 PM", score: 55, label: "Moderate" },
        { hour: "03 PM", score: 70, label: "High" },
        { hour: "06 PM", score: 84, label: "Very Busy", active: true },
        { hour: "09 PM", score: 58, label: "Moderate" },
      ],
    },
  ];

  const MOCK_SIGNALS = [
    {
      id: "sig-001",
      type: "DEMAND",
      title: "+24% foot traffic surge in West Kurla commuter corridor.",
      time: "3m ago",
    },
    {
      id: "sig-002",
      type: "EVENT",
      title: "Corporate exhibition ending at BKC Convention Centre.",
      time: "11m ago",
    },
    {
      id: "sig-003",
      type: "WEATHER",
      title:
        "Clear evening (28°C) — Outdoor snack & chai demand trending +19%.",
      time: "24m ago",
    },
  ];

  let MOCK_ALERTS = [
    {
      id: "alert-001",
      type: "demand_spike",
      priority: "high",
      title: "Kurla Station West Exit — Surge Alert",
      headline:
        "Kurla West Station Exit: Customer Rush surged to 91 (+22%)",
      spotId: "kurla-station-west",
      spotName: "Kurla Station West Exit",
      distanceKm: 0.8,
      time: "2m ago",
      timestamp: "Telemetry: Live • Updated 2m ago",
      batchNumber: "KL-882",
      customerRush: {
        score: 91,
        status: "🔥 VERY BUSY",
        trend: 22,
        trendLabel: "+22% in 20m",
      },
      categories: ["high-priority", "demand"],
      categoriesString: "high-priority demand",
      keywords:
        "kurla station west exit demand spike train arrival 0.8km very busy chai snacks",
      badgeText: "High Urgency Alert",
      summary:
        "Peak commuter flow detected heading toward auto stand. High snack & chai opportunity.",
      zone: "West Exit Main Concourse Zone",
      zoneSubtext:
        "Ideal deployment for fast snacks, hot tea, and beverages",
      recommendation:
        "Position cart along North pedestrian concourse perimeter before next Central Railway express arrives.",
      coordinates: { lat: 19.0657, lng: 72.8793 },
      isDismissed: false,
    },
    {
      id: "alert-002",
      type: "event",
      priority: "high",
      title: "BKC Convention Center — Corporate Shift Exit",
      headline:
        "BKC Trade Corridor: Evening shift release underway (+31%)",
      spotId: "bkc-hub",
      spotName: "BKC Hub / Trade Centre",
      distanceKm: 2.1,
      time: "11m ago",
      timestamp: "Telemetry: Live • Updated 11m ago",
      batchNumber: "BKC-409",
      customerRush: {
        score: 82,
        status: "🟠 BUSY",
        trend: 31,
        trendLabel: "+31% in 30m",
      },
      categories: ["high-priority", "event"],
      categoriesString: "high-priority event",
      keywords:
        "bkc convention exhibition corporate exit evening dinner 2.1km busy",
      badgeText: "High Urgency Alert",
      summary:
        "Exhibition session closing. 2,000+ professionals exiting onto G-Block avenue.",
      zone: "BKC G-Block Avenue",
      zoneSubtext: "High average order value snack & beverage demand",
      recommendation:
        "Stall placement along Avenue 3 perimeter near shuttle pickup points.",
      coordinates: { lat: 19.0664, lng: 72.8688 },
      isDismissed: false,
    },
    {
      id: "alert-003",
      type: "retail_surge",
      priority: "normal",
      title: "Phoenix Marketcity — Evening Retail Shift",
      headline:
        "Phoenix Marketcity South Plaza: Steady inflow rising (+18%)",
      spotId: "phoenix-marketcity",
      spotName: "Phoenix Marketcity",
      distanceKm: 1.4,
      time: "24m ago",
      timestamp: "Telemetry: Live • Updated 24m ago",
      batchNumber: "PHX-112",
      customerRush: {
        score: 86,
        status: "🔥 VERY BUSY",
        trend: 18,
        trendLabel: "+18% in 45m",
      },
      categories: ["demand"],
      categoriesString: "demand",
      keywords:
        "phoenix marketcity mall shoppers retail evening rush 1.4km very busy",
      badgeText: "Moderate Urgency Alert",
      summary:
        "Retail mall shoppers plus LBS Marg corporate towers shift change.",
      zone: "South Gate Plaza & LBS Marg",
      zoneSubtext: "Steady foot traffic towards transit connection points",
      recommendation:
        "Setup on South Gate pedestrian crossing for fast turnover items.",
      coordinates: { lat: 19.0863, lng: 72.889 },
      isDismissed: false,
    },
  ];

  const MOCK_VENDORS = [
    {
      id: "vendor-001",
      name: "RAJ'S TEA STALL",
      categoryKey: "FOOD",
      categoryName: "☕ Food & Beverage",
      distanceKm: 0.4,
      area: "Kurla West",
      spot: "Kurla Station West Exit",
      spotId: "kurla-station-west",
      products: ["Tea", "Samosas", "Bun Maska"],
      status: {
        code: "SELLING_NOW",
        label: "SELLING NOW",
        pillClass:
          "bg-emerald-100 text-emerald-900 border border-emerald-300",
        dotColor: "bg-emerald-600",
      },
      customerRush: {
        score: 88,
        statusLabel: "High Customer Activity",
        colorClass: "bg-primary text-on-primary",
        barColor: "bg-primary",
      },
      avatarImage:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuDvisN5NJL57RB3l5qnYVbpLkreiLabrf4G-i9Ozx6mw-lzAf4ylG4CA9xB1CjpobMFzk_lfGOKdw-hGH_Dj7r1_82mAW-JpLz148pU9mBSt_ISeHiRMTFNWrtZUhDYDOIxoUQ2nSZpZdjSvfJl2GA63buxQhw8LTYqW8WyYseJzWILnnjW9my6Qdn7G2qqM7kyXV0kM8K8PKrX0NI3GFhp2f9DDjBXeEbroqXd010JkHLA895TnrmK",
      mapCoords: { x: "42%", y: "48%" },
    },
    {
      id: "vendor-002",
      name: "FRESH BASKET",
      categoryKey: "PRODUCE",
      categoryName: "🥬 Fresh Produce",
      distanceKm: 0.7,
      area: "Kurla West",
      spot: "Market Road Concourse",
      spotId: "kurla-station-west",
      products: ["Seasonal Fruits", "Leafy Greens"],
      status: {
        code: "SELLING_NOW",
        label: "SELLING NOW",
        pillClass:
          "bg-emerald-100 text-emerald-900 border border-emerald-300",
        dotColor: "bg-emerald-600",
      },
      customerRush: {
        score: 82,
        statusLabel: "High Demand Zone",
        colorClass: "bg-primary text-on-primary",
        barColor: "bg-primary",
      },
      avatarImage:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuDvisN5NJL57RB3l5qnYVbpLkreiLabrf4G-i9Ozx6mw-lzAf4ylG4CA9xB1CjpobMFzk_lfGOKdw-hGH_Dj7r1_82mAW-JpLz148pU9mBSt_ISeHiRMTFNWrtZUhDYDOIxoUQ2nSZpZdjSvfJl2GA63buxQhw8LTYqW8WyYseJzWILnnjW9my6Qdn7G2qqM7kyXV0kM8K8PKrX0NI3GFhp2f9DDjBXeEbroqXd010JkHLA895TnrmK",
      mapCoords: { x: "64%", y: "36%" },
    },
    {
      id: "vendor-003",
      name: "STYLE STREET CART",
      categoryKey: "CLOTHING",
      categoryName: "👕 Clothing",
      distanceKm: 1.1,
      area: "Phoenix Marketcity",
      spot: "Near Gate 2 Footway",
      spotId: "phoenix-marketcity",
      products: ["Cotton T-Shirts", "Accessories"],
      status: {
        code: "STARTING_SOON",
        label: "STARTING SOON (10m)",
        pillClass:
          "bg-amber-100 text-amber-900 border border-amber-300",
        dotColor: "bg-amber-500",
        note: "⏳ Setting up stall",
      },
      customerRush: {
        score: 64,
        statusLabel: "Moderate Activity",
        colorClass: "bg-tertiary-container text-on-tertiary-container",
        barColor: "bg-amber-500",
      },
      avatarImage:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuDvisN5NJL57RB3l5qnYVbpLkreiLabrf4G-i9Ozx6mw-lzAf4ylG4CA9xB1CjpobMFzk_lfGOKdw-hGH_Dj7r1_82mAW-JpLz148pU9mBSt_ISeHiRMTFNWrtZUhDYDOIxoUQ2nSZpZdjSvfJl2GA63buxQhw8LTYqW8WyYseJzWILnnjW9my6Qdn7G2qqM7kyXV0kM8K8PKrX0NI3GFhp2f9DDjBXeEbroqXd010JkHLA895TnrmK",
      mapCoords: { x: "72%", y: "68%" },
    },
    {
      id: "vendor-004",
      name: "MUMBAI SNACKS CORNER",
      categoryKey: "FOOD",
      categoryName: "🍔 Food & Snacks",
      distanceKm: 1.2,
      area: "Kurla Central",
      spot: "Station Approach Road",
      spotId: "kurla-station-west",
      products: ["Vada Pav", "Pav Bhaji", "Bhelpuri"],
      status: {
        code: "SELLING_NOW",
        label: "SELLING NOW",
        pillClass:
          "bg-emerald-100 text-emerald-900 border border-emerald-300",
        dotColor: "bg-emerald-600",
      },
      customerRush: {
        score: 79,
        statusLabel: "Busy Rush",
        colorClass: "bg-primary text-on-primary",
        barColor: "bg-primary",
      },
      avatarImage:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuDvisN5NJL57RB3l5qnYVbpLkreiLabrf4G-i9Ozx6mw-lzAf4ylG4CA9xB1CjpobMFzk_lfGOKdw-hGH_Dj7r1_82mAW-JpLz148pU9mBSt_ISeHiRMTFNWrtZUhDYDOIxoUQ2nSZpZdjSvfJl2GA63buxQhw8LTYqW8WyYseJzWILnnjW9my6Qdn7G2qqM7kyXV0kM8K8PKrX0NI3GFhp2f9DDjBXeEbroqXd010JkHLA895TnrmK",
      mapCoords: { x: "28%", y: "62%" },
    },
  ];

  let activeSession = null;

  /**
   * Helper utility to wrap responses in async Promise
   */
  function asyncWrap(data, delay = API_CONFIG.simulateDelayMs) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(JSON.parse(JSON.stringify(data)));
      }, delay);
    });
  }

  // ==========================================
  // Public API Interface
  // ==========================================
  return {
    /**
     * Get Main Dashboard Telemetry Data
     */
    getDashboardData: function () {
      return asyncWrap({
        customerRush: {
          score: 87,
          status: "VERY BUSY",
          trend: "+18% vs 1 hour ago",
          footfall: "9.4k/hr",
          transit: "+22%",
          vendorDensity: "Moderate",
        },
        hotspots: MOCK_SPOTS.map((s) => ({
          id: s.id,
          name: s.displayName || s.name,
          score: s.customerRush.score,
          status: s.customerRush.status === "VERY BUSY" ? "Very Busy" : "Busy",
          dist: s.distanceKm + " km",
          trend: "↑ " + s.customerRush.trend + "%",
          description: s.description,
          pinCoords: s.pinCoords,
        })),
        signals: MOCK_SIGNALS,
      });
    },

    /**
     * Get Recommended Places
     * @param {string} filter - 'all', 'very-busy', 'busy', 'nearby'
     * @param {string} search - text query
     */
    getRecommendations: function (filter = "all", search = "") {
      let result = [...MOCK_SPOTS];

      if (filter === "very-busy") {
        result = result.filter((s) => s.status === "very-busy");
      } else if (filter === "busy") {
        result = result.filter((s) => s.status === "busy");
      } else if (filter === "nearby") {
        result = result.filter((s) => s.distanceKm <= 1.0);
      }

      if (search && search.trim() !== "") {
        const q = search.toLowerCase().trim();
        result = result.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.area.toLowerCase().includes(q) ||
            s.keyDriver.toLowerCase().includes(q) ||
            s.category.toLowerCase().includes(q)
        );
      }

      return asyncWrap(result);
    },

    /**
     * Get Individual Spot Details
     * @param {string} spotId
     */
    getSpot: function (spotId) {
      if (!spotId) {
        return Promise.reject(new Error("Spot ID is required"));
      }

      const cleanId = String(spotId).toLowerCase().trim();
      const spot = MOCK_SPOTS.find(
        (s) =>
          s.id === cleanId ||
          (s.aliasIds && s.aliasIds.includes(cleanId))
      );

      if (!spot) {
        // Fallback to first spot if unknown or return null
        return asyncWrap(null);
      }

      return asyncWrap(spot);
    },

    /**
     * Get User GPS / Telemetry Location
     */
    getCurrentLocation: function () {
      return asyncWrap({
        latitude: 19.0657,
        longitude: 72.8793,
        accuracyMeters: 4,
        area: "Kurla, Mumbai",
        timestamp: new Date().toISOString(),
      });
    },

    /**
     * Verify Vendor Presence in Spot Geofence
     * @param {string} spotId
     * @param {object} coords
     */
    verifyLocation: function (spotId, coords) {
      return asyncWrap(
        {
          verified: true,
          spotId: spotId,
          distanceMeters: 8,
          accuracy: "high",
          timestamp: new Date().toISOString(),
          formattedPingTime: "Just now (Accurate to 2m)",
        },
        300
      );
    },

    /**
     * Start a Selling Session
     * @param {object} payload - { spotId, duration, focus }
     */
    startSellingSession: function (payload) {
      const sessionId =
        "SES_" + Math.random().toString(36).substr(2, 9).toUpperCase();
      const startTime = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      activeSession = {
        sessionId,
        startTime,
        spotId: payload.spotId || "kurla-station-west",
        duration: payload.duration || "2_hours",
        focus: payload.focus || "beverages",
        active: true,
      };

      return asyncWrap({
        success: true,
        session: activeSession,
        startTime: startTime,
      });
    },

    /**
     * End an Active Selling Session
     * @param {string} sessionId
     */
    endSellingSession: function (sessionId) {
      activeSession = null;
      return asyncWrap({
        success: true,
        endedAt: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      });
    },

    /**
     * Get Active Selling Session if any
     */
    getActiveSession: function () {
      return asyncWrap(activeSession);
    },

    /**
     * Get Live Alerts List
     * @param {string} filter - 'all', 'high-priority', 'demand', etc.
     * @param {string} search - text query
     */
    getAlerts: function (filter = "all", search = "") {
      let result = MOCK_ALERTS.filter((a) => !a.isDismissed);

      if (filter && filter !== "all") {
        result = result.filter(
          (a) =>
            (a.categories && a.categories.includes(filter)) ||
            a.priority === filter
        );
      }

      if (search && search.trim() !== "") {
        const q = search.toLowerCase().trim();
        result = result.filter(
          (a) =>
            a.title.toLowerCase().includes(q) ||
            a.headline.toLowerCase().includes(q) ||
            a.keywords.toLowerCase().includes(q) ||
            a.summary.toLowerCase().includes(q)
        );
      }

      return asyncWrap(result);
    },

    /**
     * Get Single Alert Details
     * @param {string} alertId
     */
    getAlert: function (alertId) {
      if (!alertId) {
        return Promise.reject(new Error("Alert ID is required"));
      }

      const alert = MOCK_ALERTS.find((a) => a.id === String(alertId).trim());
      return asyncWrap(alert || null);
    },

    /**
     * Dismiss an Alert
     * @param {string} alertId
     */
    dismissAlert: function (alertId) {
      const idx = MOCK_ALERTS.findIndex((a) => a.id === String(alertId).trim());
      if (idx !== -1) {
        MOCK_ALERTS[idx].isDismissed = true;
      }
      return asyncWrap({ success: true, alertId });
    },

    /**
     * Restore All Alerts (for testing/demo)
     */
    restoreAllAlerts: function () {
      MOCK_ALERTS.forEach((a) => {
        a.isDismissed = false;
      });
      return asyncWrap({ success: true, count: MOCK_ALERTS.length });
    },

    /**
     * Get Nearby Vendors
     * @param {string} category - 'ALL', 'FOOD', 'PRODUCE', 'CLOTHING'
     * @param {string} search - query
     */
    getVendors: function (category = "ALL", search = "") {
      let result = [...MOCK_VENDORS];

      if (category && category !== "ALL") {
        result = result.filter((v) => v.categoryKey === category);
      }

      if (search && search.trim() !== "") {
        const q = search.toLowerCase().trim();
        result = result.filter(
          (v) =>
            v.name.toLowerCase().includes(q) ||
            v.area.toLowerCase().includes(q) ||
            v.spot.toLowerCase().includes(q) ||
            (v.products && v.products.some((p) => p.toLowerCase().includes(q)))
        );
      }

      return asyncWrap(result);
    },

    /**
     * Get Single Vendor Details
     * @param {string} vendorId
     */
    getVendor: function (vendorId) {
      if (!vendorId) {
        return Promise.reject(new Error("Vendor ID is required"));
      }

      const vendor = MOCK_VENDORS.find(
        (v) => v.id === String(vendorId).trim()
      );
      return asyncWrap(vendor || null);
    },

    /**
     * Connect / Co-locate with Vendor
     * @param {string} vendorId
     */
    connectVendor: function (vendorId) {
      const vendor = MOCK_VENDORS.find((v) => v.id === String(vendorId).trim());
      const vendorName = vendor ? vendor.name : "Selected Vendor";
      return asyncWrap({
        success: true,
        vendorId,
        vendorName,
        message: `Collaboration invite queued for ${vendorName}.`,
      });
    },
  };
});
