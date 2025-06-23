// Import Leaflet and PapaParse libraries
const L = window.L
const Papa = window.Papa

document.addEventListener("DOMContentLoaded", () => {
  const map = L.map("map", {
    center: [14.6603124, 101.017269],
    zoom: 6,
    zoomControl: false, // We can add a custom one if we want
  })

  // Add a modern, light-themed tile layer from CartoDB
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 19,
  }).addTo(map)

  // Add scale control to show map scale
  L.control
    .scale({
      position: "bottomright",
      metric: true,
      imperial: false,
      maxWidth: 200,
    })
    .addTo(map)

  // Add a zoom control to a different position
  L.control
    .zoom({
      position: "bottomright",
    })
    .addTo(map)

  // Updated color scale based on 3-level S4C classification
  function getColor(s4c) {
    if (s4c <= 0.25) return "#22c55e" // Green (S4C ≤ 0.25)
    if (s4c <= 0.4) return "#fbbf24" // Yellow (0.25 < S4C ≤ 0.4)
    return "#ef4444" // Red (S4C > 0.4)
  }

  // S4C level classification function
  function getS4CLevel(s4c) {
    if (s4c <= 0.25) return "good"
    if (s4c <= 0.4) return "medium"
    return "bad"
  }

  // Filter state
  const s4cFilter = {
    good: true,
    medium: true,
    bad: true,
  }

  // Alert system state
  const alertSystem = {
    criticalAlerts: [],
    alertThreshold: 0.4, // Changed condition: S4C > 0.4 for bad level
    isMonitoring: true,
  }

  // Initialize UI controls
  function initializeControls() {
    // Satellite monitor toggle
    const satelliteToggleBtn = document.getElementById("satellite-toggle-btn")
    const satellitePanel = document.getElementById("satellite-panel")
    
    if (satelliteToggleBtn && satellitePanel) {
      satelliteToggleBtn.addEventListener("click", () => {
        satellitePanel.classList.toggle("hidden")
      })
    }

    // Filter controls
    ;["good", "medium", "bad"].forEach((level) => {
      const checkbox = document.getElementById(`filter-${level}`)
      if (checkbox) {
        checkbox.addEventListener("change", (e) => {
          s4cFilter[level] = e.target.checked
          animateTrajectory()
        })
      }
    })

    // Panel close buttons
    const panelControls = [
      { btnId: "close-status-btn", panelId: "status-panel" },
      { btnId: "close-satellite-btn", panelId: "satellite-panel" },
      { btnId: "close-alert-btn", panelId: "alert-panel" },
      { btnId: "close-legend-btn", panelId: "legend" },
    ]

    panelControls.forEach(({ btnId, panelId }) => {
      const btn = document.getElementById(btnId)
      const panel = document.getElementById(panelId)
      if (btn && panel) {
        btn.addEventListener("click", () => {
          panel.classList.add("hidden")
        })
      }
    })
  }

  // Update satellite count display
  function updateSatelliteCount(activeSatellites) {
    const counts = {
      total: activeSatellites.length,
      good: 0,
      medium: 0,
      bad: 0,
    }

    activeSatellites.forEach((satellite) => {
      const level = getS4CLevel(satellite.s4c)
      counts[level]++
    })

    // Update UI
    ;["total", "good", "medium", "bad"].forEach((type) => {
      const element = document.getElementById(`${type}-count`)
      if (element) {
        element.textContent = counts[type]
        // Add animation effect
        element.style.transform = "scale(1.1)"
        setTimeout(() => {
          element.style.transform = "scale(1)"
        }, 200)
      }
    })
  }

  // Enhanced alert system - only show alerts when conditions are met
  function updateAlertSystem(activeSatellites) {
    const criticalSatellites = activeSatellites.filter((sat) => sat.s4c > alertSystem.alertThreshold)

    // Only update if there are critical satellites or if we had alerts before
    if (criticalSatellites.length > 0 || alertSystem.criticalAlerts.length > 0) {
      alertSystem.criticalAlerts = criticalSatellites
      updateAlertPanel(criticalSatellites)
    }
  }

  // Update alert panel with critical satellites
  async function updateAlertPanel(criticalSatellites) {
    const alertPanel = document.getElementById("alert-panel")
    const alertList = document.getElementById("alert-list")
    const alertBadge = document.getElementById("alert-badge")

    if (!alertPanel || !alertList) return

    // Show/hide panel based on alerts
    if (criticalSatellites.length > 0) {
      alertPanel.classList.remove("hidden")

      // Update badge
      if (alertBadge) {
        alertBadge.textContent = criticalSatellites.length
        alertBadge.classList.remove("hidden")
      }

      // Clear existing alerts
      alertList.innerHTML = ""

      // Add each critical satellite
      for (let i = 0; i < criticalSatellites.length; i++) {
        const satellite = criticalSatellites[i]
        const alertItem = document.createElement("div")
        alertItem.className = "alert-item p-3 border border-red-200 rounded-lg bg-red-50"

        alertItem.innerHTML = `
                    <div class="flex items-start justify-between mb-2">
                        <div class="flex items-center">
                            <span class="w-3 h-3 rounded-full mr-2 bg-red-500 animate-pulse"></span>
                            <strong class="text-red-800">Satellite ${satellite.satellite}</strong>
                        </div>
                        <span class="text-xs bg-red-500 text-white px-2 py-1 rounded-full">CRITICAL</span>
                    </div>
                    <div class="text-sm text-gray-700 space-y-1">
                        <div><strong>S4C Level:</strong> <span class="text-red-600 font-bold">${satellite.s4c.toFixed(4)}</span></div>
                        <div><strong>Position:</strong> ${satellite.lat?.toFixed(4) || "N/A"}, ${satellite.lon?.toFixed(4) || "N/A"}</div>
                        <div id="location-${i}" class="text-xs text-gray-500">📍 Resolving location...</div>
                    </div>
                `

        alertList.appendChild(alertItem)

        // Get location with delay to avoid API rate limits
        if (satellite.lat && satellite.lon) {
          setTimeout(() => {
            reverseGeocodeWithLongdo(satellite.lat, satellite.lon).then((location) => {
              const locationEl = document.getElementById(`location-${i}`)
              if (locationEl) {
                locationEl.innerHTML = `📍 ${location}`
              }
            })
          }, i * 300)
        }
      }
    } else {
      // Hide panel when no critical alerts
      alertPanel.classList.add("hidden")
      if (alertBadge) {
        alertBadge.classList.add("hidden")
      }
    }
  }

  // Longdo Maps API integration
  const LONGDO_API_KEY = "bb63c1e194eee172959526ee16502669"

  async function reverseGeocodeWithLongdo(lat, lon) {
    try {
      const url = "https://api.longdo.com/map/services/address"
      const params = new URLSearchParams({
        lat: lat.toString(),
        lon: lon.toString(),
        key: LONGDO_API_KEY,
      })

      const response = await fetch(`${url}?${params}`, {
        method: "GET",
        timeout: 10000,
      })

      if (response.ok) {
        const data = await response.json()
        if (data && data.aoi) {
          return data.aoi
        }
      }
      return "Location not available"
    } catch (error) {
      console.error("Geocoding error:", error)
      return "Location lookup failed"
    }
  }

  // Load and process CSV data
  fetch("data.csv")
    .then((response) => response.text())
    .then((csvText) => {
      Papa.parse(csvText, {
        header: true,
        dynamicTyping: true,
        complete: (results) => {
          const data = results.data.filter((row) => row.Lat && row.Lon && row.S4C && row.Time)

          // Group data by satellite
          const satelliteGroups = {}
          data.forEach((row) => {
            if (!satelliteGroups[row.Satellite]) {
              satelliteGroups[row.Satellite] = []
            }
            satelliteGroups[row.Satellite].push(row)
          })

          // Sort by time
          Object.keys(satelliteGroups).forEach((satellite) => {
            satelliteGroups[satellite].sort((a, b) => new Date(a.Time) - new Date(b.Time))
          })

          // Create map layers
          const trajectoryLayer = L.layerGroup().addTo(map)
          const currentPointLayer = L.layerGroup().addTo(map)
          const pathLayer = L.layerGroup().addTo(map)

          // Create full trajectory lines
          Object.keys(satelliteGroups).forEach((satellite) => {
            const satelliteData = satelliteGroups[satellite]
            const coordinates = satelliteData.map((row) => [row.Lat, row.Lon])

            const fullTrajectory = L.polyline(coordinates, {
              color: "#dc2626",
              weight: 2,
              opacity: 0.3,
              smoothFactor: 1,
            }).addTo(trajectoryLayer)

            const popupContent = `
                            <div style="font-family: 'Inter', sans-serif; font-size: 14px;">
                                <b>Satellite:</b> ${satellite}<br>
                                <b>Data Points:</b> ${satelliteData.length}<br>
                                <b>Time Range:</b> ${satelliteData[0].Time} to ${satelliteData[satelliteData.length - 1].Time}<br>
                                <b>S4C Range:</b> ${Math.min(...satelliteData.map((d) => d.S4C)).toFixed(3)} - ${Math.max(...satelliteData.map((d) => d.S4C)).toFixed(3)}
                            </div>
                        `
            fullTrajectory.bindPopup(popupContent)
          })

          // Animation setup
          const allTimes = [...new Set(data.map((row) => row.Time))].sort()
          let currentTimeIndex = 0
          let isPlaying = true
          let animationInterval
          const totalDuration = 20000 // 20 seconds
          const frameInterval = totalDuration / allTimes.length

          // Initialize time control
          function initializeTimeControl() {
            const slider = document.getElementById("time-slider")
            const playPauseBtn = document.getElementById("play-pause-btn")
            const resetBtn = document.getElementById("reset-btn")
            const startTimeEl = document.getElementById("start-time")
            const endTimeEl = document.getElementById("end-time")

            if (slider) {
              slider.max = allTimes.length - 1
              slider.value = 0
              slider.addEventListener("input", (e) => {
                currentTimeIndex = Number.parseInt(e.target.value)
                animateTrajectory()
                updateProgress()
              })
            }

            if (startTimeEl && allTimes.length > 0) {
              startTimeEl.textContent = new Date(allTimes[0]).toLocaleTimeString("en-US", { hour12: false })
            }

            if (endTimeEl && allTimes.length > 0) {
              endTimeEl.textContent = new Date(allTimes[allTimes.length - 1]).toLocaleTimeString("en-US", {
                hour12: false,
              })
            }

            if (playPauseBtn) {
              playPauseBtn.addEventListener("click", togglePlayPause)
            }

            if (resetBtn) {
              resetBtn.addEventListener("click", resetAnimation)
            }
          }

          function updateProgress() {
            const slider = document.getElementById("time-slider")
            const progressEl = document.getElementById("current-progress")

            if (slider) slider.value = currentTimeIndex
            if (progressEl) {
              const progress = Math.round((currentTimeIndex / (allTimes.length - 1)) * 100)
              progressEl.textContent = `${progress}%`
            }
          }

          function togglePlayPause() {
            const playPauseBtn = document.getElementById("play-pause-btn")
            isPlaying = !isPlaying

            if (isPlaying) {
              playPauseBtn.innerHTML = "⏸️ Pause"
              startAnimation()
            } else {
              playPauseBtn.innerHTML = "▶️ Play"
              if (animationInterval) clearInterval(animationInterval)
            }
          }

          function resetAnimation() {
            currentTimeIndex = 0
            animateTrajectory()
            updateProgress()
          }

          function startAnimation() {
            if (animationInterval) clearInterval(animationInterval)

            animationInterval = setInterval(() => {
              if (isPlaying) {
                currentTimeIndex = (currentTimeIndex + 1) % allTimes.length
                animateTrajectory()
                updateProgress()
              }
            }, frameInterval)
          }

          // Main animation function
          function animateTrajectory() {
            currentPointLayer.clearLayers()
            pathLayer.clearLayers()

            const currentTime = allTimes[currentTimeIndex]

            // Update time display
            const timeDisplay = document.getElementById("current-time")
            if (timeDisplay) {
              const formattedTime = new Date(currentTime).toLocaleString("en-US", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
              })
              timeDisplay.textContent = formattedTime + " UTC"
            }

            const activeSatellites = []

            // Process each satellite
            Object.keys(satelliteGroups).forEach((satellite) => {
              const satelliteData = satelliteGroups[satellite]
              const currentData = satelliteData.filter((row) => new Date(row.Time) <= new Date(currentTime))

              if (currentData.length > 0) {
                const currentPoint = currentData[currentData.length - 1]
                const s4cLevel = getS4CLevel(currentPoint.S4C)

                activeSatellites.push({
                  satellite: currentPoint.Satellite,
                  s4c: currentPoint.S4C,
                  level: s4cLevel,
                  lat: currentPoint.Lat,
                  lon: currentPoint.Lon,
                })

                // Apply filter
                if (!s4cFilter[s4cLevel]) return

                // Draw trajectory path
                if (currentData.length > 1) {
                  const currentCoordinates = currentData.map((row) => [row.Lat, row.Lon])
                  L.polyline(currentCoordinates, {
                    color: "#dc2626",
                    weight: 4,
                    opacity: 0.9,
                    smoothFactor: 1,
                  }).addTo(pathLayer)
                }

                // Create satellite marker
                const circleIcon = L.divIcon({
                  className: "satellite-circle",
                  html: `
                                        <div style="
                                            width: 44px;
                                            height: 44px;
                                            border-radius: 50%;
                                            background: linear-gradient(135deg, ${getColor(currentPoint.S4C)}, ${getColor(currentPoint.S4C)}dd);
                                            border: 3px solid #ffffff;
                                            display: flex;
                                            align-items: center;
                                            justify-content: center;
                                            font-family: 'Inter', sans-serif;
                                            font-size: 12px;
                                            font-weight: 700;
                                            color: white;
                                            text-shadow: 1px 1px 2px rgba(0,0,0,0.7);
                                            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                                            transition: all 0.3s ease;
                                        ">
                                            ${currentPoint.Satellite}
                                        </div>
                                    `,
                  iconSize: [50, 50],
                  iconAnchor: [25, 25],
                })

                const currentMarker = L.marker([currentPoint.Lat, currentPoint.Lon], {
                  icon: circleIcon,
                }).addTo(currentPointLayer)

                // Enhanced popup
                const pointPopup = `
                                    <div style="font-family: 'Inter', sans-serif; font-size: 14px; min-width: 200px;">
                                        <div style="background: linear-gradient(135deg, ${getColor(currentPoint.S4C)}, ${getColor(currentPoint.S4C)}dd); color: white; padding: 8px; margin: -8px -8px 8px -8px; border-radius: 4px;">
                                            <b>Satellite ${currentPoint.Satellite}</b>
                                        </div>
                                        <div style="margin: 8px 0;"><b>Time:</b> ${currentPoint.Time}</div>
                                        <div style="margin: 8px 0;"><b>S4C Index:</b> <span style="color: ${getColor(currentPoint.S4C)}; font-weight: bold;">${currentPoint.S4C.toFixed(4)}</span></div>
                                        <div style="margin: 8px 0;"><b>Level:</b> <span style="text-transform: capitalize; font-weight: 600;">${s4cLevel}</span></div>
                                        <div style="margin: 8px 0;"><b>Position:</b> ${currentPoint.Lat.toFixed(4)}, ${currentPoint.Lon.toFixed(4)}</div>
                                    </div>
                                `
                currentMarker.bindPopup(pointPopup)
              }
            })

            // Update displays
            updateSatelliteCount(activeSatellites)
            updateAlertSystem(activeSatellites) // Wait for conditions to be met
          }

          // Initialize everything
          initializeControls()
          initializeTimeControl()

          // Start animation
          animateTrajectory()
          startAnimation()
        },
      })
    })
    .catch((error) => {
      console.error("Error loading data:", error)
    })
})
