document.addEventListener('DOMContentLoaded', () => {
    const map = L.map('map', {
        center: [14.6603124, 101.017269],
        zoom: 6,
        zoomControl: false // We can add a custom one if we want
    });

    // Add a modern, light-themed tile layer from CartoDB
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);
    
    // Add a zoom control to a different position
    L.control.zoom({
        position: 'bottomright'
    }).addTo(map);

    // Updated color scale based on 3-level S4C classification
    function getColor(s4c) {
        if (s4c <= 0.25) return '#22c55e'; // Green (S4C ≤ 0.25)
        if (s4c <= 0.4) return '#fbbf24'; // Yellow (0.25 < S4C ≤ 0.4)
        return '#ef4444'; // Red (S4C > 0.4)
    }

    // S4C level classification function
    function getS4CLevel(s4c) {
        if (s4c <= 0.25) return 'good';
        if (s4c <= 0.4) return 'medium';
        return 'bad';
    }

    // Filter state
    let s4cFilter = {
        good: true,
        medium: true,
        bad: true
    };

    // Initialize filter controls
    function initializeFilterControls() {
        const filterGood = document.getElementById('filter-good');
        const filterMedium = document.getElementById('filter-medium');
        const filterBad = document.getElementById('filter-bad');

        if (filterGood) {
            filterGood.addEventListener('change', (e) => {
                s4cFilter.good = e.target.checked;
                animateTrajectory();
            });
        }

        if (filterMedium) {
            filterMedium.addEventListener('change', (e) => {
                s4cFilter.medium = e.target.checked;
                animateTrajectory();
            });
        }

        if (filterBad) {
            filterBad.addEventListener('change', (e) => {
                s4cFilter.bad = e.target.checked;
                animateTrajectory();
            });
        }
    }

    // Initialize satellite panel controls
    function initializeSatellitePanelControls() {
        const closeBtn = document.getElementById('close-satellite-panel-btn');
        const panel = document.getElementById('satellite-panel');
        
        if (closeBtn && panel) {
            closeBtn.addEventListener('click', () => {
                panel.style.display = 'none';
            });
        }
    }

    // Update satellite count display
    function updateSatelliteCount(activeSatellites) {
        const totalCount = document.getElementById('total-count');
        const goodCount = document.getElementById('good-count');
        const mediumCount = document.getElementById('medium-count');
        const badCount = document.getElementById('bad-count');

        const counts = {
            total: activeSatellites.length,
            good: 0,
            medium: 0,
            bad: 0
        };

        activeSatellites.forEach(satellite => {
            const level = getS4CLevel(satellite.s4c);
            counts[level]++;
        });

        if (totalCount) totalCount.textContent = counts.total;
        if (goodCount) goodCount.textContent = counts.good;
        if (mediumCount) mediumCount.textContent = counts.medium;
        if (badCount) badCount.textContent = counts.bad;
    }

    // Longdo Maps API integration
    const LONGDO_API_KEY = 'bb63c1e194eee172959526ee16502669';

    async function reverseGeocodeWithLongdo(lat, lon) {
        try {
            const url = "https://api.longdo.com/map/services/address";
            const params = new URLSearchParams({
                lat: lat.toString(),
                lon: lon.toString(),
                key: LONGDO_API_KEY
            });

            const response = await fetch(`${url}?${params}`, {
                method: 'GET',
                timeout: 15000
            });

            if (response.ok) {
                const data = await response.json();
                if (data && data.aoi) {
                    return data.aoi;
                }
            }
            return 'Location not found';
        } catch (error) {
            console.error('Longdo API error:', error);
            return 'Error retrieving location';
        }
    }

    function updateLocationCardList(moderateS4CList) {
        const card = document.getElementById('location-card');
        const listContainer = document.getElementById('location-list');

        if (!card || !listContainer) return;

        // Always show the card
        card.style.display = 'block';
        
        // Clear existing list
        listContainer.innerHTML = '';

        if (moderateS4CList.length === 0) {
            // Show no alerts message when no moderate S4C satellites
            listContainer.innerHTML = '<div class="text-sm text-gray-500 italic">No moderate S4C alerts currently detected...</div>';
            return;
        }

        // Add each moderate S4C satellite to the list
        moderateS4CList.forEach((item, index) => {
            const listItem = document.createElement('div');
            listItem.className = 'mb-3 p-2 border border-yellow-200 rounded-lg bg-yellow-50';
            listItem.innerHTML = `
                <div class="mb-1">
                    <strong>Satellite:</strong> ${item.satellite}
                    <span class="inline-block w-3 h-3 rounded-full ml-2" style="background-color: #fbbf24;"></span>
                </div>
                <div class="mb-1">
                    <strong>S<sub>4C</sub> Value:</strong> ${item.s4c.toFixed(4)}
                </div>
                <div class="mb-1">
                    <strong>Coordinates:</strong><br>
                    <span class="text-xs">${item.lat.toFixed(4)}, ${item.lon.toFixed(4)}</span>
                </div>
                <div class="mb-1">
                    <strong>Location:</strong><br>
                    <span id="location-${index}" class="text-xs">Searching...</span>
                </div>
            `;
            listContainer.appendChild(listItem);

            // Get location name from API with delay
            setTimeout(() => {
                reverseGeocodeWithLongdo(item.lat, item.lon).then(location => {
                    const locationEl = document.getElementById(`location-${index}`);
                    if (locationEl) {
                        locationEl.textContent = location;
                    }
                });
            }, index * 500); // 500ms delay between each API call
        });
    }

    // Initialize the location card to show on page load
    function initializeLocationCard() {
        updateLocationCardList([]);
    }

    // Initialize legend close functionality
    function initializeLegendControls() {
        const closeBtn = document.getElementById('close-legend-btn');
        const legend = document.getElementById('legend');
        
        if (closeBtn && legend) {
            closeBtn.addEventListener('click', () => {
                legend.style.display = 'none';
            });
        }
    }

    fetch('data.csv')
        .then(response => response.text())
        .then(csvText => {
            Papa.parse(csvText, {
                header: true,
                dynamicTyping: true,
                complete: function(results) {
                    const data = results.data.filter(row => row.Lat && row.Lon && row.S4C && row.Time);

                    // Group data by satellite and sort by time for each satellite
                    const satelliteGroups = {};
                    data.forEach(row => {
                        if (!satelliteGroups[row.Satellite]) {
                            satelliteGroups[row.Satellite] = [];
                        }
                        satelliteGroups[row.Satellite].push(row);
                    });

                    // Sort each satellite's data by time
                    Object.keys(satelliteGroups).forEach(satellite => {
                        satelliteGroups[satellite].sort((a, b) => new Date(a.Time) - new Date(b.Time));
                    });

                    // Create layers for different visualization elements
                    const trajectoryLayer = L.layerGroup().addTo(map);
                    const currentPointLayer = L.layerGroup().addTo(map);
                    const pathLayer = L.layerGroup().addTo(map);

                    // Create full trajectory lines for each satellite (static background)
                    Object.keys(satelliteGroups).forEach(satellite => {
                        const satelliteData = satelliteGroups[satellite];
                        const coordinates = satelliteData.map(row => [row.Lat, row.Lon]);
                        
                        // Create a semi-transparent red polyline for the full trajectory
                        const fullTrajectory = L.polyline(coordinates, {
                            color: '#dc2626',
                            weight: 2,
                            opacity: 0.3,
                            smoothFactor: 1
                        }).addTo(trajectoryLayer);

                        // Add popup for full trajectory
                        const popupContent = `
                            <div style="font-family: 'Poppins', sans-serif; font-size: 14px;">
                                <b>Satellite:</b> ${satellite}<br>
                                <b>Data Points:</b> ${satelliteData.length}<br>
                                <b>Time Range:</b> ${satelliteData[0].Time} to ${satelliteData[satelliteData.length-1].Time}<br>
                                <b>S4C Range:</b> ${Math.min(...satelliteData.map(d => d.S4C)).toFixed(3)} - ${Math.max(...satelliteData.map(d => d.S4C)).toFixed(3)}
                            </div>
                        `;
                        fullTrajectory.bindPopup(popupContent);
                    });

                    // Get all unique time points and sort them
                    const allTimes = [...new Set(data.map(row => row.Time))].sort();
                    let currentTimeIndex = 0;
                    let isPlaying = true;
                    let animationInterval;
                    const totalDuration = 15000; // 15 seconds
                    const frameInterval = totalDuration / allTimes.length;

                    // Initialize time control UI
                    function initializeTimeControl() {
                        const slider = document.getElementById('time-slider');
                        const playPauseBtn = document.getElementById('play-pause-btn');
                        const resetBtn = document.getElementById('reset-btn');
                        const startTimeEl = document.getElementById('start-time');
                        const endTimeEl = document.getElementById('end-time');
                        const progressEl = document.getElementById('current-progress');

                        if (slider) {
                            slider.max = allTimes.length - 1;
                            slider.value = 0;
                        }

                        if (startTimeEl && allTimes.length > 0) {
                            const startTime = new Date(allTimes[0]).toLocaleString('en-US', {
                                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
                            });
                            startTimeEl.textContent = startTime;
                        }

                        if (endTimeEl && allTimes.length > 0) {
                            const endTime = new Date(allTimes[allTimes.length - 1]).toLocaleString('en-US', {
                                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
                            });
                            endTimeEl.textContent = endTime;
                        }

                        // Slider event listener
                        if (slider) {
                            slider.addEventListener('input', (e) => {
                                currentTimeIndex = parseInt(e.target.value);
                                animateTrajectory();
                                updateProgress();
                            });
                        }

                        // Play/Pause button
                        if (playPauseBtn) {
                            playPauseBtn.addEventListener('click', () => {
                                togglePlayPause();
                            });
                        }

                        // Reset button
                        if (resetBtn) {
                            resetBtn.addEventListener('click', () => {
                                resetAnimation();
                            });
                        }
                    }

                    function updateProgress() {
                        const slider = document.getElementById('time-slider');
                        const progressEl = document.getElementById('current-progress');
                        
                        if (slider) {
                            slider.value = currentTimeIndex;
                        }
                        
                        if (progressEl) {
                            const progress = Math.round((currentTimeIndex / (allTimes.length - 1)) * 100);
                            progressEl.textContent = `${progress}%`;
                        }
                    }

                    function togglePlayPause() {
                        const playPauseBtn = document.getElementById('play-pause-btn');
                        isPlaying = !isPlaying;
                        
                        if (isPlaying) {
                            playPauseBtn.textContent = 'Pause';
                            startAnimation();
                        } else {
                            playPauseBtn.textContent = 'Play';
                            if (animationInterval) {
                                clearInterval(animationInterval);
                            }
                        }
                    }

                    function resetAnimation() {
                        currentTimeIndex = 0;
                        animateTrajectory();
                        updateProgress();
                    }

                    function startAnimation() {
                        if (animationInterval) {
                            clearInterval(animationInterval);
                        }
                        
                        animationInterval = setInterval(() => {
                            if (isPlaying) {
                                currentTimeIndex = (currentTimeIndex + 1) % allTimes.length;
                                animateTrajectory();
                                updateProgress();
                            }
                        }, frameInterval);
                    }

                    // Animation function
                    function animateTrajectory() {
                        // Clear previous frame
                        currentPointLayer.clearLayers();
                        pathLayer.clearLayers();

                        const currentTime = allTimes[currentTimeIndex];
                        
                        // Update datetime display in top right
                        const timeDisplay = document.getElementById('current-time');
                        if (timeDisplay) {
                            const formattedTime = new Date(currentTime).toLocaleString('en-US', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                hour12: false
                            });
                            timeDisplay.textContent = formattedTime + ' (UTC)';
                        }
                        
                        // Collect active satellites and count by S4C level
                        const activeSatellites = [];
                        const moderateS4CList = [];
                        
                        // For each satellite, show trajectory up to current time
                        Object.keys(satelliteGroups).forEach(satellite => {
                            const satelliteData = satelliteGroups[satellite];
                            
                            // Get data points up to current time
                            const currentData = satelliteData.filter(row => 
                                new Date(row.Time) <= new Date(currentTime)
                            );

                            if (currentData.length > 0) {
                                const currentPoint = currentData[currentData.length - 1];
                                const s4cLevel = getS4CLevel(currentPoint.S4C);
                                
                                // Add to active satellites list for counting
                                activeSatellites.push({
                                    satellite: currentPoint.Satellite,
                                    s4c: currentPoint.S4C,
                                    level: s4cLevel
                                });

                                // Check if this satellite should be displayed based on filter
                                if (!s4cFilter[s4cLevel]) {
                                    return; // Skip this satellite if filtered out
                                }

                                // Create animated trajectory path (bright red)
                                if (currentData.length > 1) {
                                    const currentCoordinates = currentData.map(row => [row.Lat, row.Lon]);
                                    L.polyline(currentCoordinates, {
                                        color: '#dc2626',
                                        weight: 4,
                                        opacity: 0.9,
                                        smoothFactor: 1
                                    }).addTo(pathLayer);
                                }

                                // Create a custom div icon for the circle with satellite name
                                const circleIcon = L.divIcon({
                                    className: 'satellite-circle',
                                    html: `
                                        <div style="
                                            width: 40px;
                                            height: 40px;
                                            border-radius: 50%;
                                            background-color: ${getColor(currentPoint.S4C)};
                                            border: 4px solid #ffffff;
                                            display: flex;
                                            align-items: center;
                                            justify-content: center;
                                            font-family: 'Poppins', sans-serif;
                                            font-size: 12px;
                                            font-weight: bold;
                                            color: white;
                                            text-shadow: 1px 1px 1px rgba(0,0,0,0.5);
                                            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
                                        ">
                                            ${currentPoint.Satellite}
                                        </div>
                                    `,
                                    iconSize: [48, 48],
                                    iconAnchor: [24, 24]
                                });

                                // Add the circle marker with satellite name
                                const currentMarker = L.marker([currentPoint.Lat, currentPoint.Lon], {
                                    icon: circleIcon
                                }).addTo(currentPointLayer);

                                // Add detailed popup to the circle marker
                                const pointPopup = `
                                    <div style="font-family: 'Poppins', sans-serif; font-size: 14px;">
                                        <b>Satellite:</b> ${currentPoint.Satellite}<br>
                                        <b>Time:</b> ${currentPoint.Time}<br>
                                        <b>S4C Index:</b> <span style="color: ${getColor(currentPoint.S4C)}; font-weight: bold;">${currentPoint.S4C.toFixed(4)}</span><br>
                                        <b>Position:</b> ${currentPoint.Lat.toFixed(4)}, ${currentPoint.Lon.toFixed(4)}
                                    </div>
                                `;
                                currentMarker.bindPopup(pointPopup);

                                // Collect moderate S4C satellites for location card
                                if (currentPoint.S4C > 0.25 && currentPoint.S4C <= 0.4) {
                                    moderateS4CList.push({
                                        satellite: currentPoint.Satellite,
                                        s4c: currentPoint.S4C,
                                        lat: currentPoint.Lat,
                                        lon: currentPoint.Lon
                                    });
                                }
                            }
                        });

                        // Update satellite count display
                        updateSatelliteCount(activeSatellites);

                        // Update location card with only moderate S4C satellites
                        updateLocationCardList(moderateS4CList);
                    }

                    // Initialize location card to show on page load
                    initializeLocationCard();

                    // Initialize time control
                    initializeTimeControl();

                    // Initialize legend controls
                    initializeLegendControls();

                    // Initialize filter controls
                    initializeFilterControls();

                    // Initialize satellite panel controls
                    initializeSatellitePanelControls();

                    // Start animation
                    animateTrajectory();
                    startAnimation();
                }
            });
        });
});
