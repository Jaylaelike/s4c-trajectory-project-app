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
        if (s4c <= 0.10) return '#ffffcc'; // Low
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

                    // Group data by unique time values and sort chronologically
                    const timeGroups = {};
                    data.forEach(row => {
                        if (!timeGroups[row.Time]) {
                            timeGroups[row.Time] = [];
                        }
                        timeGroups[row.Time].push(row);
                    });
                    const sortedTimes = Object.keys(timeGroups).sort();

                    // Create layer groups: one for full trajectory and one for highlighted current points
                    const trajectoryLayer = L.layerGroup().addTo(map);
                    const highlightLayer = L.layerGroup().addTo(map);

                    let idx = 0;
                    const totalDuration = 15000; // 15 seconds
                    const frameInterval = totalDuration / sortedTimes.length; // ms per frame

                    // Keep track of which time frames have been drawn into the trajectory layer
                    const drawnTimes = new Set();

                    function renderFrame() {
                        // Clear previous highlights but keep trajectory history
                        highlightLayer.clearLayers();
                        const currentTime = sortedTimes[idx];
                        const rows = timeGroups[currentTime];
                        rows.forEach(row => {
                            // Add to trajectory layer once (smaller point)
                            if (!drawnTimes.has(currentTime)) {
                                L.circleMarker([row.Lat, row.Lon], {
                                    radius: 10,
                                    fillColor: getColor(row.S4C),
                                    color: '#666',
                                    weight: 0.5,
                                    opacity: 0.7,
                                    fillOpacity: 0.7
                                }).addTo(trajectoryLayer);
                            }

                            // Highlight current points with bigger radius
                            const circleMarker = L.circleMarker([row.Lat, row.Lon], {
                                radius: 10, // Bigger icon point for current frame
                                fillColor: getColor(row.S4C),
                                color: '#333',
                                weight: 1,
                                opacity: 1,
                                fillOpacity: 0.9
                            }).addTo(highlightLayer);

                            const popupContent = `
                                <div style="font-family: 'Poppins', sans-serif; font-size: 14px;">
                                    <b>Satellite:</b> ${row.Satellite}<br>
                                    <b>Time:</b> ${row.Time}<br>
                                    <b>S4C Index:</b> <span style="color: black; font-weight: bold;">${row.S4C}</span>
                                </div>
                            `;
                            circleMarker.bindPopup(popupContent);
                        });

                        // Mark this time frame as drawn to avoid duplicate small markers
                        drawnTimes.add(currentTime);

                        idx = (idx + 1) % sortedTimes.length; // loop
                    }

                    // Initial render
                    renderFrame();
                    setInterval(renderFrame, frameInterval);
                }
            });
        });
});
