document.addEventListener('DOMContentLoaded', () => {
    const map = L.map('map', {
        center: [14.6603124, 101.017269],
        zoom: 8,
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

    // Updated color scale for better visual appeal (YlOrRd from ColorBrewer)
    function getColor(s4c) {
        if (s4c <= 0.10) return '#ffec1c'; // Low
        if (s4c <= 0.18) return '#fd8d3c'; // Medium
        if (s4c <= 0.26) return '#f03b20'; // High
        return '#bd0026'; // Very High
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
                    const totalDuration = 15000; // 15 seconds
                    const frameInterval = totalDuration / allTimes.length;

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
                            timeDisplay.textContent = formattedTime;
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

                        // Move to next time frame
                        currentTimeIndex = (currentTimeIndex + 1) % allTimes.length;
                    }

                    // Start animation
                    animateTrajectory();
                    setInterval(animateTrajectory, frameInterval);
                }
            });
        });
});
