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
                        
                        // For each satellite, show trajectory up to current time
                        Object.keys(satelliteGroups).forEach(satellite => {
                            const satelliteData = satelliteGroups[satellite];
                            
                            // Get data points up to current time
                            const currentData = satelliteData.filter(row => 
                                new Date(row.Time) <= new Date(currentTime)
                            );

                            if (currentData.length > 0) {
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

                                // Show current position with circle icon
                                const currentPoint = currentData[currentData.length - 1];
                                
                                // Add circle marker for current position
                                const currentMarker = L.circleMarker([currentPoint.Lat, currentPoint.Lon], {
                                    radius: 12, // Bigger circle
                                    fillColor: getColor(currentPoint.S4C),
                                    color: '#ffffff',
                                    weight: 3,
                                    opacity: 1,
                                    fillOpacity: 0.9
                                }).addTo(currentPointLayer);

                                // Create a custom div icon for the moving label positioned away from the circle
                                const labelIcon = L.divIcon({
                                    className: 'moving-label',
                                    html: `
                                        <div style="
                                            background: rgba(255, 255, 255, 0.95);
                                            padding: 8px 12px;
                                            border-radius: 8px;
                                            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                                            border: 2px solid ${getColor(currentPoint.S4C)};
                                            font-family: 'Poppins', sans-serif;
                                            font-size: 12px;
                                            font-weight: 600;
                                            color: #333;
                                            white-space: nowrap;
                                            transform: translate(-50%, -150%);
                                            margin-top: -20px;
                                        ">
                                            ${currentPoint.Satellite}<br>
                                            <span style="color: #333;">S4C: ${currentPoint.S4C.toFixed(4)}</span>
                                        </div>
                                    `,
                                    iconSize: [0, 0],
                                    iconAnchor: [0, 0]
                                });

                                // Add the moving label marker positioned away from the circle
                                const labelMarker = L.marker([currentPoint.Lat, currentPoint.Lon], {
                                    icon: labelIcon
                                }).addTo(currentPointLayer);

                                // Add detailed popup to both the circle marker and label
                                const pointPopup = `
                                    <div style="font-family: 'Poppins', sans-serif; font-size: 14px;">
                                        <b>Satellite:</b> ${currentPoint.Satellite}<br>
                                        <b>Time:</b> ${currentPoint.Time}<br>
                                        <b>S4C Index:</b> <span style="color: ${getColor(currentPoint.S4C)}; font-weight: bold;">${currentPoint.S4C.toFixed(4)}</span><br>
                                        <b>Position:</b> ${currentPoint.Lat.toFixed(4)}, ${currentPoint.Lon.toFixed(4)}
                                    </div>
                                `;
                                currentMarker.bindPopup(pointPopup);
                                labelMarker.bindPopup(pointPopup);
                            }
                        });

                        // Collect only satellites in moderate S4C range (0.25 < S4C ≤ 0.4) for location card
                        const moderateS4CList = [];
                        Object.keys(satelliteGroups).forEach(satellite => {
                            const satelliteData = satelliteGroups[satellite];
                            const currentData = satelliteData.filter(row => 
                                new Date(row.Time) <= new Date(currentTime)
                            );
                            
                            if (currentData.length > 0) {
                                const currentPoint = currentData[currentData.length - 1];
                                // Only include satellites in moderate S4C range
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

                        // Update location card with only moderate S4C satellites
                        updateLocationCardList(moderateS4CList);
                    }

                    // Initialize location card to show on page load
                    initializeLocationCard();

                    // Initialize time control
                    initializeTimeControl();

                    // Initialize legend controls
                    initializeLegendControls();

                    // Start animation
                    animateTrajectory();
                    startAnimation();
                }
            });
        });
});
