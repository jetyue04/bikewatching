import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
console.log("Mapbox GL JS Loaded:", mapboxgl);

 // Set your Mapbox access token here
 mapboxgl.accessToken = 'pk.eyJ1Ijoianl1ZTA0IiwiYSI6ImNtN2xkMWhnZzBhZGcycm9lbmJicTlnZnIifQ.wDd_4W9wXLVHqKLTk-yHuA';

 const bikeLanePaint = {
    'line-color': 'green', 
    'line-width': 3,     
    'line-opacity': 0.6
};

let timeSlider;
let selectedTime;
let anyTimeLabel;
let departuresByMinute = Array.from({ length: 1440 }, () => []);
let arrivalsByMinute = Array.from({ length: 1440 }, () => []);
// let departuresByMinute = Array.from({ length: 1440 }, () => []);
// let arrivalsByMinute = Array.from({ length: 1440 }, () => []);

 // Initialize the map
 const map = new mapboxgl.Map({
   container: 'map', // ID of the div where the map will render
   style: 'mapbox://styles/mapbox/streets-v12', // Map style
   center: [-71.09415, 42.36027], // [longitude, latitude]
   zoom: 12, // Initial zoom level
   minZoom: 5, // Minimum allowed zoom
   maxZoom: 18 // Maximum allowed zoom
 });

 map.on('load', async () => {
    function updateScatterPlot(timeFilter) {
        // Get only the trips that match the selected time filter
        timeFilter === -1 ? radiusScale.range([0, 25]) : radiusScale.range([3, 50]);
        // Recompute station traffic based on the filtered trips
        const filteredStations = computeStationTraffic(stations, timeFilter);
        
        // Update the scatterplot by adjusting the radius of circles
        circles
            .data(filteredStations, (d) => d.short_name)  // Ensure D3 tracks elements correctly
            .join('circle')
            .attr('r', (d) => radiusScale(d.totalTraffic))
            .style('--departure-ratio', (d) =>
                stationFlow(d.departures / d.totalTraffic));
    }

    function updateTimeDisplay() {
        const timeFilter = Number(timeSlider.value);  // Get slider value
      
        if (timeFilter === -1) {
          selectedTime.textContent = '';  // Clear time display
          anyTimeLabel.style.display = 'block';  // Show "(any time)"
        } else {
          selectedTime.textContent = formatTime(timeFilter);  // Display formatted time
          anyTimeLabel.style.display = 'none';  // Hide "(any time)"
        }
        // Trigger filtering logic which will be implemented in the next step
        updateScatterPlot(timeFilter);
    }

    //code 
    map.addSource('boston_route', {
        type: 'geojson',
        data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson'
      });

    map.addLayer({
        id: 'bike-lanes',
        type: 'line',
        source: 'boston_route',
        paint: bikeLanePaint
      });

    map.addSource('cambridge_route', {
        type: 'geojson',
        data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson'
      });

    map.addLayer({
        id: 'cambridge-bike-lanes',
        type: 'line',
        source: 'cambridge_route',
        paint: bikeLanePaint
      });
    
    let jsonData;
    try {
        const jsonurl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
        
        // Await JSON fetch
        jsonData = await d3.json(jsonurl);
        
        console.log('Loaded JSON Data:', jsonData); // Log to verify structure
    } catch (error) {
        console.error('Error loading JSON:', error); // Handle errors
    }

    let trips = await d3.csv(
        'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv',
        (trip) => {
          trip.started_at = new Date(trip.started_at);
          trip.ended_at = new Date(trip.ended_at);
          return trip;
        },
      );
    
    departuresByMinute = Array.from({ length: 1440 }, () => []);
    arrivalsByMinute = Array.from({ length: 1440 }, () => []);
  
      // Process each trip
      trips.forEach(trip => {
          let startedMinutes = minutesSinceMidnight(trip.started_at);
          departuresByMinute[startedMinutes].push(trip); // Categorize by departure time
  
          let endedMinutes = minutesSinceMidnight(trip.ended_at);
          arrivalsByMinute[endedMinutes].push(trip); // Categorize by arrival time
      });
  
      // Now you can efficiently filter trips based on their departure/arrival time
      console.log(departuresByMinute);
      console.log(arrivalsByMinute);
    const stations = computeStationTraffic(jsonData.data.stations);
    console.log('Stations Array:', stations);

      const radiusScale = d3
      .scaleSqrt()
      .domain([0, d3.max(stations, (d) => d.totalTraffic)])
      .range([0, 25]);
    
      let stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);

    const svg = d3.select('#map').select('svg');

    const circles = svg.selectAll('circle')
        .data(stations, (d) => d.short_name) 
        .enter()
        .append('circle')
        .attr('r', (d) => radiusScale(d.totalTraffic))               // Radius of the circle
        .attr('fill', 'steelblue')  // Circle fill color
        .attr('stroke', 'white')    // Circle border color
        .attr('stroke-width', 1)    // Circle border thickness
        .attr('opacity', 0.6)      // Circle opacity
        .each(function(d) {
            // Add <title> for browser tooltips
            d3.select(this)
              .append('title')
              .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
          })
        .style("--departure-ratio", d => stationFlow(d.departures / d.totalTraffic));

    function updatePositions() {
      circles
        .attr('cx', d => getCoords(d).cx)  // Set the x-position using projected coordinates
        .attr('cy', d => getCoords(d).cy); // Set the y-position using projected coordinates
    }

    // Initial position update when map loads
    updatePositions();

    map.on('move', updatePositions);     // Update during map movement
    map.on('zoom', updatePositions);     // Update during zooming
    map.on('resize', updatePositions);   // Update on window resize
    map.on('moveend', updatePositions);  // Final adjustment after movement ends

    timeSlider = document.getElementById('time-slider');
    selectedTime = document.getElementById('selected-time');
    anyTimeLabel = document.getElementById('any-time');

    timeSlider.addEventListener('input', updateTimeDisplay);
    updateTimeDisplay();
  });

function getCoords(station) {
    const point = new mapboxgl.LngLat(+station.lon, +station.lat);  // Convert lon/lat to Mapbox LngLat
    const { x, y } = map.project(point);  // Project to pixel coordinates
    return { cx: x, cy: y };  // Return as object for use in SVG attributes
}

function formatTime(minutes) {
    const date = new Date(0, 0, 0, 0, minutes);  // Set hours & minutes
    return date.toLocaleString('en-US', { timeStyle: 'short' }); // Format as HH:MM AM/PM
}


// function computeStationTraffic(stations, trips) {
//     // Compute departures
//     const departures = d3.rollup(
//         trips, 
//         (v) => v.length, 
//         (d) => d.start_station_id
//     );

//     const arrivals = d3.rollup(
//         trips,
//         (v) => v.length,
//         (d) => d.end_station_id,
//       );
  
//     // Update each station..
    
// }

function computeStationTraffic(stations, timeFilter = -1) {
    // Retrieve filtered trips efficiently
    const departures = d3.rollup(
      filterByMinute(departuresByMinute, timeFilter), // Efficient retrieval
      (v) => v.length,
      (d) => d.start_station_id
    );
  
    const arrivals = d3.rollup(
      filterByMinute(arrivalsByMinute, timeFilter), // Efficient retrieval
      (v) => v.length,
      (d) => d.end_station_id
    );
  
    // Update station data with filtered counts
    return stations.map((station) => {
      let id = station.short_name;
      station.arrivals = arrivals.get(id) ?? 0;
      station.departures = departures.get(id) ?? 0;
      station.totalTraffic = station.arrivals + station.departures;
      // what you updated in step 4.2
      return station;
  });
  }

function minutesSinceMidnight(date) {
    return date.getHours() * 60 + date.getMinutes();
}

function filterByMinute(tripsByMinute, minute) {
    if (minute === -1) {
      return tripsByMinute.flat(); // No filtering, return all trips
    }
  
    // Normalize both min and max minutes to the valid range [0, 1439]
    let minMinute = (minute - 60 + 1440) % 1440;
    let maxMinute = (minute + 60) % 1440;
  
    // Handle time filtering across midnight
    if (minMinute > maxMinute) {
      let beforeMidnight = tripsByMinute.slice(minMinute);
      let afterMidnight = tripsByMinute.slice(0, maxMinute);
      return beforeMidnight.concat(afterMidnight).flat();
    } else {
      return tripsByMinute.slice(minMinute, maxMinute).flat();
    }
  }