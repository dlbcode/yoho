<template>
  <div class="top-container">
    <label for="flightPathToggle">Show Flight Paths:</label>
    <select id="flightPathToggle">
      <option value="from">From Marker</option>
      <option value="to">To Marker</option>
    </select>
    <button id="allPathsBtn">Show All Paths</button>
  </div>
  <div class="container">
    <div class="left-container">
      <div class="travelers-container">
        <label for="numTravelers">Number of Travelers:</label>
        <button id="decreaseTravelers">-</button>
        <input type="number" id="numTravelers" value="1" min="1" readonly>
        <button id="increaseTravelers">+</button>
      </div>
      <div class="airport-selection">
        <input type="text" id="fromAirport" placeholder="From Anywhere">
        <div id="fromAirportSuggestions" class="suggestions"></div>
        <input type="text" id="toAirport" placeholder="To Anywhere">
        <div id="toAirportSuggestions" class="suggestions"></div>
      </div>
      <ol id="flightDetailsList" class="flight-details"></ol>
      <div id="totalCost">Total Trip Cost: $0</div>
      <div><button id="clearBtn">Clear</button></div>
    </div>
    <div class="map-container">
      <div id="map"></div>
    </div>
  </div>
</template>

<script>
import FlightMap from './components/flightMap.vue';
import FlightList from './components/flightList.vue';
import AirportAutocomplete from './components/airportAutocomplete.vue';

export default {
  name: 'App',
  components: {
    FlightMap,
    FlightList,
    AirportAutocomplete,
  },
  data() {
    return {
      map: null,
      blueDotIcon: null,
      magentaDotIcon: null,
    };
  },
  methods: {
    setupUIEventListeners() {
      // Logic for UI event listeners
    },
    drawPaths() {
      // Logic to draw paths
    },
    initializeMap() {
      // Initialize Leaflet map
      this.map = L.map('map', { zoomControl: false, minZoom: 2, maxZoom: 19 });
      this.map.setView([0, 0], 4);

      L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
      }).addTo(this.map);

      L.control.zoom({ position: 'bottomright' }).addTo(this.map);

      this.map.on('zoomend', () => {
        var zoomLevel = this.map.getZoom();
        console.log('Map zoom level:', zoomLevel);
        document.dispatchEvent(new CustomEvent('zoomChanged'));
      });

      // Initialize marker icons
      this.blueDotIcon = L.divIcon({
        className: 'custom-div-icon',
        html: '<div style="background-color: #3B74D5; width: 10px; height: 10px; border-radius: 50%;"></div>',
        iconSize: [10, 10],
        iconAnchor: [5, 5]
      });

      this.magentaDotIcon = L.divIcon({
        className: 'custom-div-icon',
        html: '<div style="background-color: #b43bd5; width: 10px; height: 10px; border-radius: 50%;"></div>',
        iconSize: [10, 10],
        iconAnchor: [5, 5]
      });

      // Fetch client's approximate location using IP-API
      fetch('http://ip-api.com/json/')
        .then(response => response.json())
        .then(data => {
          if (data.status === 'success') {
            this.map.setView([data.lat, data.lon], 4);
          } else {
            console.error('IP Geolocation failed:', data.message);
          }
        })
        .catch(error => {
          console.error('Error fetching IP Geolocation:', error);
        });
    },
  },
  mounted() {
    this.initializeMap();
    this.setupUIEventListeners();
  },
};
</script>

<style>
  /* Your CSS styles */
</style>
