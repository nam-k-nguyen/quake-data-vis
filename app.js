// Global variables
let map;
let earthquakeLayer;
let allEarthquakes = [];
let filteredEarthquakes = [];
let currentMapProvider = 'OpenStreetMap';
let colorBy = 'magnitude';
let sizeByMagnitude = true;
let magnitudeMin = 3.0;
let depthMin = 0;
let yearMin = 2014;
let yearMax = 2025;
let animation = { active: false, timer: null, index: 0, speed: 50 };

let magnitudeSVG = null;
let depthSVG = null;
let timelineSVG = null;


// Color scales
const colorScales = {
    magnitude: d3.scaleSequential(d3.interpolateRdYlBu)
        .domain([9, 3]),
    depth: d3.scaleSequential(d3.interpolateViridis)
        .domain([0, 700]),
    year: d3.scaleSequential(d3.interpolateRainbow)
        .domain([2014, 2025])
};

// Initialize the map
function initMap() {
    map = L.map('map').setView([20, 0], 2);

    // Add initial tile layer
    updateMapLayer(currentMapProvider);

    // Create empty layer for earthquakes
    earthquakeLayer = L.layerGroup().addTo(map);

    // Add map legend
    createMapLegend();
}

// Update map tile layer
function updateMapLayer(provider) {
    // Remove existing tile layer
    map.eachLayer(layer => {
        if (layer instanceof L.TileLayer) {
            map.removeLayer(layer);
        }
    });

    // Add new tile layer based on provider
    let tileLayer;

    switch (provider) {
        case 'OpenStreetMap':
            tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            });
            break;
        case 'Esri.WorldImagery':
            tileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            });
            break;
        case 'CartoDB.DarkMatter':
            tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                subdomains: 'abcd'
            });
            break;
        case 'CartoDB.Positron':
            tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                subdomains: 'abcd'
            });
            break;
        default:
            tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            });
    }

    tileLayer.addTo(map);
}

// Create legend for map
function createMapLegend() {
    const legend = L.control({ position: 'bottomright' });

    legend.onAdd = function (map) {
        const div = L.DomUtil.create('div', 'legend');
        updateLegendContent(div);
        return div;
    };

    legend.addTo(map);

    // Store reference to update later
    map.legend = legend;
}

// Update legend content
function updateLegendContent(legendDiv) {
    if (!legendDiv) return;

    legendDiv.innerHTML = `<h4>Earthquake ${colorBy.charAt(0).toUpperCase() + colorBy.slice(1)}</h4>`;

    let items = [];

    if (colorBy === 'magnitude') {
        items = [
            { label: '8.0+', color: colorScales.magnitude(8) },
            { label: '7.0 - 7.9', color: colorScales.magnitude(7) },
            { label: '6.0 - 6.9', color: colorScales.magnitude(6) },
            { label: '5.0 - 5.9', color: colorScales.magnitude(5) },
            { label: '4.0 - 4.9', color: colorScales.magnitude(4) },
            { label: '3.0 - 3.9', color: colorScales.magnitude(3) }
        ];
    } else if (colorBy === 'depth') {
        items = [
            { label: 'Shallow (0-70km)', color: colorScales.depth(30) },
            { label: 'Intermediate (70-300km)', color: colorScales.depth(150) },
            { label: 'Deep (300-700km)', color: colorScales.depth(500) }
        ];
    } else if (colorBy === 'year') {
        for (let year = 2014; year <= 2025; year++) {
            items.push({
                label: year.toString(),
                color: colorScales.year(year)
            });
        }
    }

    items.forEach(item => {
        legendDiv.innerHTML += `
            <div class="legend-item">
                <div class="legend-color" style="background-color: ${item.color}"></div>
                <div>${item.label}</div>
            </div>
        `;
    });
}

// Load earthquake data
function loadEarthquakeData() {

    // Load data from JSON file
    fetch('data/earthquakes.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            console.log("--data from json--", data)
            processEarthquakeData(data);
        })
        .catch(error => {
            console.log("--ERROR--")
            console.error('Error loading earthquake data:', error);

            // Fallback to sample CSV if JSON fails
            // console.log('Attempting to load sample CSV data...');
            // loadSampleCSVData();
        });
}

// Load sample CSV data as fallback
function loadSampleCSVData() {
    // console.log("load sampe CSV")

    // URL to your sample CSV file
    const sampleDataUrl = 'data/sample_earthquakes.csv';

    // Parse the CSV data
    Papa.parse(sampleDataUrl, {
        download: true,
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: function (results) {
            processEarthquakeData(results.data);
        },
        error: function (error) {
            console.error('Error loading sample earthquake data:', error);
            document.getElementById('data-stats').textContent = 'Error loading data. Please refresh and try again.';
            document.querySelector('.loading').style.display = 'none';
        }
    });
}

// Process the loaded earthquake data
function processEarthquakeData(data) {
    // Preprocess and clean the data
    allEarthquakes = data.map(d => {
        // Extract year from time string
        const date = new Date(d.time || d.date);
        const year = date.getFullYear();

        return {
            id: d.id,
            time: d.time || d.date,
            date: date,
            year: year,
            latitude: d.latitude || d.lat,
            longitude: d.longitude || d.lon,
            depth: d.depth,
            magnitude: d.magnitude || d.mag,
            place: d.place,
        };
    }).filter(d => d.magnitude && d.latitude && d.longitude);

    // Sort chronologically
    allEarthquakes.sort((a, b) => a.date - b.date);

    // Update data stats
    updateDataStats();

    // Apply initial filters
    applyFilters();

    // Initialize visualizations
    initTimelineChart();
    initMagnitudeChart();
    initDepthChart();

    // Hide loading spinner
    document.querySelector('.loading').style.display = 'none';
}

// Update data statistics
function updateDataStats() {
    const totalQuakes = allEarthquakes.length;
    const minYear = d3.min(allEarthquakes, d => d.year);
    const maxYear = d3.max(allEarthquakes, d => d.year);
    const maxMagnitude = d3.max(allEarthquakes, d => d.magnitude);

    document.getElementById('data-stats').innerHTML = `
        <strong>Total Earthquakes:</strong> ${totalQuakes.toLocaleString()}<br>
        <strong>Time Period:</strong> ${minYear} - ${maxYear}<br>
        <strong>Max Magnitude:</strong> ${maxMagnitude.toFixed(1)}
    `;
}

// Apply filters to the earthquake data
function applyFilters() {
    filteredEarthquakes = allEarthquakes.filter(quake => {
        return quake.magnitude >= magnitudeMin &&
            quake.depth >= depthMin &&
            quake.year >= yearMin &&
            quake.year <= yearMax;
    });

    // Update visualizations with filtered data
    updateMap();
    updateTimelineChart();
    updateMagnitudeChart();
    updateDepthChart();
}

// Reset all filters to default values
function resetFilters() {
    magnitudeMin = 3.0;
    depthMin = 0;
    yearMin = 2014;
    yearMax = 2025;

    // Update UI elements
    document.getElementById('magnitude-min').value = magnitudeMin;
    document.getElementById('magnitude-value').textContent = magnitudeMin.toFixed(1) + '+';
    document.getElementById('depth-min').value = depthMin;
    document.getElementById('depth-value').textContent = depthMin + '+';
    document.getElementById('year-min').value = yearMin;
    document.getElementById('year-max').value = yearMax;

    // Apply filters
    applyFilters();
}

// Update the map with filtered earthquake data
function updateMap() {
    // Clear existing earthquake markers
    earthquakeLayer.clearLayers();

    // Add markers for filtered earthquakes
    filteredEarthquakes.forEach(quake => {
        const radius = sizeByMagnitude ?
            Math.pow(2, quake.magnitude) / 2 : 5;

        let color;
        if (colorBy === 'magnitude') {
            color = colorScales.magnitude(quake.magnitude);
        } else if (colorBy === 'depth') {
            color = colorScales.depth(quake.depth);
        } else if (colorBy === 'year') {
            color = colorScales.year(quake.year);
        }

        const marker = L.circleMarker([quake.latitude, quake.longitude], {
            radius: radius,
            fillColor: color,
            color: '#000',
            weight: 1,
            opacity: 0.8,
            fillOpacity: 0.6,
            earthquake: quake // Store reference to quake data
        });

        // Add tooltip
        marker.on('mouseover', function (e) {
            showTooltip(quake, e.originalEvent);
        });

        marker.on('mouseout', function () {
            hideTooltip();
        });

        earthquakeLayer.addTo(map).addLayer(marker);
    });
}

// Show tooltip with earthquake details
function showTooltip(quake, event) {
    const tooltip = document.getElementById('tooltip');

    // Format date for display
    const date = new Date(quake.time);
    const formattedDate = date.toLocaleDateString();
    const formattedTime = date.toLocaleTimeString();

    tooltip.innerHTML = `
        <strong>${quake.place || 'Unknown Location'}</strong><br>
        <strong>Date:</strong> ${formattedDate}<br>
        <strong>Time:</strong> ${formattedTime}<br>
        <strong>Magnitude:</strong> ${quake.magnitude.toFixed(1)}<br>
        <strong>Depth:</strong> ${quake.depth.toFixed(1)} km
    `;

    // Position tooltip near mouse
    tooltip.style.left = (event.pageX + 10) + 'px';
    tooltip.style.top = (event.pageY + 10) + 'px';
    tooltip.style.opacity = 1;
}

// Hide tooltip
function hideTooltip() {
    const tooltip = document.getElementById('tooltip');
    tooltip.style.opacity = 0;
}

// Initialize timeline chart
function initTimelineChart() {
    const margin = { top: 10, right: 30, bottom: 30, left: 40 };
    const width = document.getElementById('timeline').clientWidth - margin.left - margin.right;
    const height = document.getElementById('timeline').clientHeight - margin.top - margin.bottom;

    // Create SVG
    const svg = d3.select('#timeline')
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Set up scales
    const x = d3.scaleTime()
        .domain(d3.extent(allEarthquakes, d => {
            console.log("hi", d.date.getMonth())
            return d.date
        }))
        .range([0, width]);

    console.log("x", x.range())

    // Add X axis
    svg.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x));

    // Save references for updates
    svg.x = x;
    svg.width = width;
    svg.height = height;

    // Add brush for selection
    const brush = d3.brushX()
        .extent([[0, 0], [width, height]])
        .on('end', brushed);

    svg.append('g')
        .attr('class', 'brush')
        .call(brush);

    // Save reference to svg
    timelineSVG = svg;

    // Initial update
    updateTimelineChart();
}

// Update timeline chart
function updateTimelineChart() {
    const svg = timelineSVG;
    if (!svg) return;

    const width = svg.width;
    const height = svg.height;

    // Group data by month
    const parseTime = d3.timeMonth;
    const bins = d3.group(filteredEarthquakes, d => parseTime(d.date));

    // Convert to array for histogram
    const histData = Array.from(bins, ([date, earthquakes]) => ({
        date: date,
        count: earthquakes.length
    })).sort((a, b) => a.date - b.date);

    // Update x domain
    let dateExtent = d3.extent(filteredEarthquakes, d => d.date)
    let minDate = d3.timeMonth.floor(dateExtent[0]);
    let maxDate = d3.timeMonth.ceil(dateExtent[1]);
    console.log(minDate, maxDate)
    svg.x.domain([minDate, maxDate]);
    // svg.x.domain([dateExtent[0], dateExtent[1]]);

    // Update x-axis
    svg.select('.x-axis')
        .transition()
        .duration(500)
        .call(d3.axisBottom(svg.x));

    // Set up y scale
    const y = d3.scaleLinear()
        .domain([0, d3.max(histData, d => d.count)])
        .range([height, 0]);

    // Remove previous y-axis if exists
    svg.select('.y-axis').remove();

    // Add Y axis
    svg.append('g')
        .attr('class', 'y-axis')
        .call(d3.axisLeft(y).ticks(5));

    // Remove previous bars
    svg.selectAll('.bar').remove();

    // Add bars
    svg.selectAll('.bar')
        .data(histData)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', d => svg.x(d.date))
        .attr('width', () => {
            console.log(width, histData)
            return width / histData.length - 50
        })
        .attr('y', d => y(d.count))
        .attr('height', d => height - y(d.count))
        .attr('fill', '#3498db')
        .on('mouseover', function (event, d) {
            // Show tooltip
            const tooltip = d3.select('.brush-tooltip');
            if (tooltip.empty()) {
                d3.select('#timeline')
                    .append('div')
                    .attr('class', 'brush-tooltip')
                    .style('opacity', 0);
            }

            d3.select('.brush-tooltip')
                .style('opacity', 1)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 28) + 'px')
                .html(`${d.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}: ${d.count} earthquakes`);
        })
        .on('mouseout', function () {
            d3.select('.brush-tooltip').style('opacity', 0);
        });
}

// Handle brush event on timeline
function brushed(event) {
    if (!event.selection) return;

    const svg = d3.select('#timeline').svg;
    const [x0, x1] = event.selection.map(svg.x.invert);

    // Update year range based on brush
    yearMin = x0.getFullYear();
    yearMax = x1.getFullYear();

    // Update UI
    document.getElementById('year-min').value = yearMin;
    document.getElementById('year-max').value = yearMax;

    // Apply filters
    applyFilters();
}

// Initialize magnitude distribution chart
function initMagnitudeChart() {
    console.log("initMagnitudeChart")
    const margin = { top: 10, right: 30, bottom: 30, left: 40 };
    const width = document.getElementById('magnitude-chart').clientWidth - margin.left - margin.right;
    const height = document.getElementById('magnitude-chart').clientHeight - margin.top - margin.bottom;

    // Create SVG
    const svg = d3.select('#magnitude-chart')
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Set up scales
    const x = d3.scaleBand()
        .range([0, width])
        .padding(0.1);

    const y = d3.scaleLinear()
        .range([height, 0]);

    // Add axes placeholders
    svg.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${height})`);

    svg.append('g')
        .attr('class', 'y-axis');

    // Save references for updates
    svg.x = x;
    svg.y = y;
    svg.width = width;
    svg.height = height;

    // Save reference to svg
    magnitudeSVG = svg;

    // Initial update
    updateMagnitudeChart();
}

// Update magnitude distribution chart
function updateMagnitudeChart() {
    const svg = magnitudeSVG
    if (!svg) return;

    // Define magnitude bins
    const magnitudeBins = [
        { range: '3.0-3.9', min: 3, max: 3.9 },
        { range: '4.0-4.9', min: 4, max: 4.9 },
        { range: '5.0-5.9', min: 5, max: 5.9 },
        { range: '6.0-6.9', min: 6, max: 6.9 },
        { range: '7.0-7.9', min: 7, max: 7.9 },
        { range: '8.0+', min: 8, max: 10 }
    ];

    // Count earthquakes in each bin
    const data = magnitudeBins.map(bin => {
        const count = filteredEarthquakes.filter(d =>
            d.magnitude >= bin.min && d.magnitude <= bin.max).length;
        return {
            range: bin.range,
            count: count,
            min: bin.min
        };
    });

    // Update scales
    console.log(svg)

    svg.x.domain(data.map(d => d.range));
    svg.y.domain([0, d3.max(data, d => d.count)]);


    // Update axes
    svg.select('.x-axis')
        .transition()
        .duration(500)
        .call(d3.axisBottom(svg.x));

    svg.select('.y-axis')
        .transition()
        .duration(500)
        .call(d3.axisLeft(svg.y).ticks(5));

    // Remove previous bars
    svg.selectAll('.magnitude-bar').remove();

    // Add bars
    svg.selectAll('.magnitude-bar')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'magnitude-bar')
        .attr('x', d => svg.x(d.range))
        .attr('width', svg.x.bandwidth())
        .attr('y', d => svg.y(d.count))
        .attr('height', d => svg.height - svg.y(d.count))
        .attr('fill', d => colorScales.magnitude(d.min))
        .on('mouseover', function (event, d) {
            // Highlight corresponding earthquakes on map
            earthquakeLayer.eachLayer(layer => {
                const quake = layer.options.earthquake;
                if (quake && quake.magnitude >= d.min && quake.magnitude <= (d.min === 8 ? 10 : d.min + 0.9)) {
                    layer.setStyle({ fillOpacity: 0.9, weight: 2 });
                }
            });

            // Show tooltip
            d3.select('#tooltip')
                .style('opacity', 1)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 28) + 'px')
                .html(`Magnitude ${d.range}: ${d.count} earthquakes`);
        })
        .on('mouseout', function () {
            // Reset earthquake markers
            earthquakeLayer.eachLayer(layer => {
                layer.setStyle({ fillOpacity: 0.6, weight: 1 });
            });

            // Hide tooltip
            d3.select('#tooltip').style('opacity', 0);
        })
        .on('click', function (event, d) {
            // Filter to only show this magnitude range
            magnitudeMin = d.min;
            document.getElementById('magnitude-min').value = magnitudeMin;
            document.getElementById('magnitude-value').textContent = magnitudeMin.toFixed(1) + '+';
            applyFilters();
        });
}

// Initialize depth distribution chart
function initDepthChart() {
    const margin = { top: 10, right: 30, bottom: 30, left: 40 };
    const width = document.getElementById('depth-chart').clientWidth - margin.left - margin.right;
    const height = document.getElementById('depth-chart').clientHeight - margin.top - margin.bottom;

    // Create SVG
    const svg = d3.select('#depth-chart')
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Set up scales
    const x = d3.scaleBand()
        .range([0, width])
        .padding(0.1);

    const y = d3.scaleLinear()
        .range([height, 0]);

    // Add axes placeholders
    svg.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${height})`);

    svg.append('g')
        .attr('class', 'y-axis');

    // Save references for updates
    svg.x = x;
    svg.y = y;
    svg.width = width;
    svg.height = height;

    // Save reference to svg
    depthSVG = svg;

    // Initial update
    updateDepthChart();
}

// Update depth distribution chart
function updateDepthChart() {
    const svg = depthSVG;
    if (!svg) return;

    // Define depth bins
    const depthBins = [
        { range: '0-30 km', min: 0, max: 30, type: 'Shallow' },
        { range: '31-70 km', min: 31, max: 70, type: 'Shallow' },
        { range: '71-300 km', min: 71, max: 300, type: 'Intermediate' },
        { range: '301-700 km', min: 301, max: 700, type: 'Deep' }
    ];

    // Count earthquakes in each bin
    const data = depthBins.map(bin => {
        const count = filteredEarthquakes.filter(d =>
            d.depth >= bin.min && d.depth <= bin.max).length;
        return {
            range: bin.range,
            count: count,
            min: bin.min,
            max: bin.max,
            type: bin.type
        };
    });

    // Update scales
    svg.x.domain(data.map(d => d.range));
    svg.y.domain([0, d3.max(data, d => d.count)]);

    // Update axes
    svg.select('.x-axis')
        .transition()
        .duration(500)
        .call(d3.axisBottom(svg.x));

    svg.select('.y-axis')
        .transition()
        .duration(500)
        .call(d3.axisLeft(svg.y).ticks(5));

    // Remove previous bars
    svg.selectAll('.depth-bar').remove();

    // Add bars
    svg.selectAll('.depth-bar')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'depth-bar')
        .attr('x', d => svg.x(d.range))
        .attr('width', svg.x.bandwidth())
        .attr('y', d => svg.y(d.count))
        .attr('height', d => svg.height - svg.y(d.count))
        .attr('fill', d => colorScales.depth((d.min + d.max) / 2))
        .on('mouseover', function (event, d) {
            // Highlight corresponding earthquakes on map
            earthquakeLayer.eachLayer(layer => {
                const quake = layer.options.earthquake;
                if (quake && quake.depth >= d.min && quake.depth <= d.max) {
                    layer.setStyle({ fillOpacity: 0.9, weight: 2 });
                }
            });

            // Show tooltip
            d3.select('#tooltip')
                .style('opacity', 1)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 28) + 'px')
                .html(`Depth ${d.range} (${d.type}): ${d.count} earthquakes`);
        })
        .on('mouseout', function () {
            // Reset earthquake markers
            earthquakeLayer.eachLayer(layer => {
                layer.setStyle({ fillOpacity: 0.6, weight: 1 });
            });

            // Hide tooltip
            d3.select('#tooltip').style('opacity', 0);
        })
        .on('click', function (event, d) {
            // Filter to only show this depth range
            depthMin = d.min;
            document.getElementById('depth-min').value = depthMin;
            document.getElementById('depth-value').textContent = depthMin + '+';
            applyFilters();
        });
}

// Animation functions
function toggleAnimation() {
    if (animation.active) {
        stopAnimation();
    } else {
        startAnimation();
    }
}

function startAnimation() {
    // Get earliest date in filtered data
    const dates = filteredEarthquakes.map(d => d.date);
    const startDate = d3.min(dates);
    const endDate = d3.max(dates);

    // Calculate time steps for animation
    const totalDays = (endDate - startDate) / (1000 * 60 * 60 * 24);
    const timeStep = Math.max(1, Math.ceil(totalDays / 100)); // 100 frames max

    let currentDate = new Date(startDate);
    animation.active = true;
    document.getElementById('play-animation').textContent = '⏸ Pause';

    // Clear any existing animation
    if (animation.timer) clearInterval(animation.timer);

    // Clear map
    earthquakeLayer.clearLayers();

    // Start animation timer
    animation.timer = setInterval(() => {
        // Increment date
        currentDate.setDate(currentDate.getDate() + timeStep);

        // Check if animation should end
        if (currentDate > endDate) {
            stopAnimation();
            return;
        }

        // Show earthquakes up to current date
        const visibleQuakes = filteredEarthquakes.filter(d => d.date <= currentDate);

        // Update map with visible quakes
        updateAnimationFrame(visibleQuakes, currentDate);

    }, 1000 / (animation.speed / 10)); // Adjust speed
}

function stopAnimation() {
    if (animation.timer) {
        clearInterval(animation.timer);
        animation.timer = null;
    }

    animation.active = false;
    document.getElementById('play-animation').textContent = '▶ Play Earthquake Timeline';

    // Restore map to show all filtered earthquakes
    updateMap();
}

function updateAnimationFrame(visibleQuakes, currentDate) {
    // Clear existing earthquake markers
    earthquakeLayer.clearLayers();

    // Add markers for visible earthquakes
    visibleQuakes.forEach(quake => {
        // Calculate age of quake in days (for fadeout effect)
        const ageDays = (currentDate - quake.date) / (1000 * 60 * 60 * 24);
        const opacity = Math.max(0.2, 1 - (ageDays / 30)); // Fade over 30 days

        const radius = sizeByMagnitude ?
            Math.pow(2, quake.magnitude) / 2 : 5;

        let color;
        if (colorBy === 'magnitude') {
            color = colorScales.magnitude(quake.magnitude);
        } else if (colorBy === 'depth') {
            color = colorScales.depth(quake.depth);
        } else if (colorBy === 'year') {
            color = colorScales.year(quake.year);
        }

        const marker = L.circleMarker([quake.latitude, quake.longitude], {
            radius: radius,
            fillColor: color,
            color: '#000',
            weight: 1,
            opacity: opacity * 0.8,
            fillOpacity: opacity * 0.6,
            earthquake: quake // Store reference to quake data
        });

        // Add tooltip
        marker.on('mouseover', function (e) {
            showTooltip(quake, e.originalEvent);
        });

        marker.on('mouseout', function () {
            hideTooltip();
        });

        earthquakeLayer.addTo(map).addLayer(marker);
    });

    // Update animation date display
    document.getElementById('data-stats').innerHTML = `
        <strong>Animation Date:</strong> ${currentDate.toLocaleDateString()}<br>
        <strong>Earthquakes Shown:</strong> ${visibleQuakes.length.toLocaleString()}<br>
        <strong>Total Earthquakes:</strong> ${filteredEarthquakes.length.toLocaleString()}
    `;
}

// Event listeners
function setupEventListeners() {
    // Map background selector
    document.getElementById('map-background').addEventListener('change', function () {
        currentMapProvider = this.value;
        updateMapLayer(currentMapProvider);
    });

    // Color by selector
    document.getElementById('color-by').addEventListener('change', function () {
        colorBy = this.value;
        updateMap();

        // Update legend
        if (map.legend) {
            map.legend.remove();
            createMapLegend();
        }
    });

    // Size by magnitude toggle
    document.getElementById('size-by-magnitude').addEventListener('change', function () {
        sizeByMagnitude = this.checked;
        updateMap();
    });

    // Magnitude filter
    document.getElementById('magnitude-min').addEventListener('input', function () {
        magnitudeMin = parseFloat(this.value);
        document.getElementById('magnitude-value').textContent = magnitudeMin.toFixed(1) + '+';
        applyFilters();
    });

    // Depth filter
    document.getElementById('depth-min').addEventListener('input', function () {
        depthMin = parseInt(this.value);
        document.getElementById('depth-value').textContent = depthMin + '+';
        applyFilters();
    });

    // Year range filters
    document.getElementById('year-min').addEventListener('change', function () {
        yearMin = parseInt(this.value);
        applyFilters();
    });

    document.getElementById('year-max').addEventListener('change', function () {
        yearMax = parseInt(this.value);
        applyFilters();
    });

    // Reset filters button
    document.getElementById('reset-filters').addEventListener('click', resetFilters);

    // Animation controls
    document.getElementById('play-animation').addEventListener('click', toggleAnimation);

    document.getElementById('animation-speed').addEventListener('input', function () {
        animation.speed = parseInt(this.value);
        if (animation.active) {
            stopAnimation();
            startAnimation();
        }
    });

    // Window resize handler
    window.addEventListener('resize', function () {
        // Resize visualizations
        updateTimelineChart();
        updateMagnitudeChart();
        updateDepthChart();
    });
}

// Initialize the application
function init() {
    initMap();
    setupEventListeners();
    loadEarthquakeData();
}

// Start the application when page is loaded
window.addEventListener('load', init);