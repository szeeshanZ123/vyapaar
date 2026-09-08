# team Vyapar 🛍️📍

### Location Intelligence & Real-Time Demand Platform for Street Vendors

Vyapar helps street vendors and micro-businesses decide **where to set up their business right now** using location-based demand signals.

## 🚀 Features

- 📊 **Footfall Score** — 0–100 demand score for a location
- 🗺️ **Demand Heatmap** — Identify high-demand areas
- 📍 **Smart Recommendations** — Ranked best spots with reasons
- 📌 **Vendor Check-In** — Mark a vendor as active at a location
- 🚨 **Crowdsourced Alerts** — Report crowds, road blocks, free spots and municipal checks
- 🎉 **Event-Based Prediction** — Nearby events boost demand predictions
- 🔎 **Vendors Near Me** — Customers can discover active vendors nearby
- 🧭 **Get Directions** — Open vendor or spot location in Google Maps

## 🧠 vyapaar Core Engines

### 1. Demand Engine

Calculates demand using recent vendor check-ins, active alerts, event boosts and recency.

### 2. Event-Based Prediction

Boosts demand scores when upcoming festivals, processions or market events are nearby.

### 3. Smart Routing Filter

Ranks suitable spots using demand score, distance, category relevance and shelter availability.

### 4. Alerts Engine

Handles crowdsourced and municipal alerts with confirmation, deduplication and expiry logic.

## 🛠️ Technology Stack

### Frontend

- Next.js
- Tailwind CSS
- Leaflet.js
- OpenStreetMap

### Backend

- Python
- FastAPI
- Pydantic
- PyMongo

### Database

- MongoDB
- GeoJSON
- 2dsphere geospatial indexes

### AI/ML

- Rule-based weighted demand scoring
- Optional scikit-learn model

## 📱 Main Screens

- Home — Footfall Score and Demand Heatmap
- Recommendations — Ranked best spots
- Spot Details — Recommendation reasons
- Check-In — Vendor location check-in
- Alerts — Nearby alerts
- Discover — Public Vendors Near Me map

## 🎯 Problem We Solve

Street vendors often decide where to operate based on habit and word-of-mouth. This can result in low-footfall locations, missed demand spikes, lack of awareness about road blocks or municipal checks, and poor vendor discoverability.

**Vyapar turns location and activity data into simple, actionable recommendations.**

## 🔮 Future Scope

- Multilingual support
- Voice input and output
- Weather and transit integrations
- Advanced ML-based demand prediction
- Offline-first PWA
- Native Android and iOS application
- Sales tracking and analytics

## ⚡ Hackathon MVP

Vyapar is designed as a **24–48 hour hackathon MVP** with a simple and explainable architecture.

Authentication, native mobile apps, live weather and transit integrations, voice features and trained ML models are outside the core MVP scope.

---

**Built for Vyapar Hackathon 🚀**
