<template>
  <div id="map" :style="{ height: mapHeight }"></div>
</template>

<script>
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
// Import other dependencies if needed

export default {
  name: 'MapComponent',
  data() {
    return {
      map: null,
      markers: {},
      flightsByDestination: {},
      currentLines: [],
      selectedMarker: null,
      toggleState: 'from',
      flightPathCache: {},
      clearMultiHopPaths: true,
      mapHeight: '100vh', // Adjust as needed
      // Other data properties
    };
  },
  mounted() {
    this.initializeMap();
    this.setupMapEventListeners();
  },
  methods: {
    initializeMap() {
      // Marker configurations
      const blueDotIcon = L.divIcon({
        className: 'custom-div-icon',
        html: '<div style="background-color: #3B74D5; width: 10px; height: 10px; border-radius: 50%;"></div>',
        iconSize: [10, 10],
        iconAnchor: [5, 5]
      });

      const magentaDotIcon = L.divIcon({
        className: 'custom-div-icon',
        html: '<div style="background-color: #b43bd5; width: 10px; height: 10px; border-radius: 50%;"></div>',
        iconSize: [10, 10],
        iconAnchor: [5, 5]
      });

      // Initialize map
      this.map = L.map('map', { zoomControl: false, minZoom: 2, maxZoom: 19 });

      // Default view settings
      this.map.setView([0, 0], 4);

      // Tile layer settings
      L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
      }).addTo(this.map);

      // Zoom control settings
      L.control.zoom({
        position: 'bottomright'
      }).addTo(this.map);

      // Event listener for zoom level change
      this.map.on('zoomend', () => {
        var zoomLevel = this.map.getZoom();
        console.log('Map zoom level:', zoomLevel);
        // Emit an event or handle zoom change
      });

      // Fetch client's approximate location using IP-API
      fetch('http://ip-api.com/json/')
        .then(response => response.json())
        .then(data => {
          if (data.status === 'success') {
            // Set map view to the obtained location
            this.map.setView([data.lat, data.lon], 4);
          } else {
            console.error('IP Geolocation failed:', data.message);
          }
        })
        .catch(error => {
          console.error('Error fetching IP Geolocation:', error);
        });
    },
    async plotFlightPaths() {
      const currentTime = new Date().getTime();
      if (this.cachedFlights && this.lastFetchTime && currentTime - this.lastFetchTime < this.cacheDuration) {
        this.processFlightData(this.cachedFlights);
      } else {
        try {
          const response = await fetch('http://localhost:3000/flights');
          const data = await response.json();
          this.cachedFlights = data;
          this.lastFetchTime = currentTime;
          this.processFlightData(data);
        } catch (error) {
          console.error('Error:', error);
        }
      }
    },
    processFlightData(data) {
      data.forEach(flight => {
        if (!flight.originAirport || !flight.destinationAirport) {
          console.info('Incomplete flight data:', flight);
          return;
        }

        this.addMarker(flight.originAirport);
        this.addMarker(flight.destinationAirport);

        // Additional logic to handle flight data
      });
    },
    addMarker(airport) {
      if (!airport || !airport.iata_code || !airport.weight) {
          console.error('Incomplete airport data:', airport);
          return;
      }

      let iata = airport.iata_code;
      if (this.markers[iata]) return;

      if (airport.weight <= this.map.getZoom()) {
          const latLng = L.latLng(airport.latitude, airport.longitude);
          const marker = L.marker(latLng, {icon: this.blueDotIcon}).addTo(this.map)
          .bindPopup(`<b>${airport.name}</b><br>${airport.city}, ${airport.country}`);

          // Emit custom event or handle it within Vue component
          this.markers[iata] = marker;
          L.marker([airport.lat, airport.lng], { icon: this.blueDotIcon }).addTo(this.map);
      }
    },
    handleMarkerClick(airport, clickedMarker) {
      this.selectedMarker = clickedMarker;
    },
    setupMapEventListeners() {
      this.map.on('click', () => {
        this.clearFlightPaths();
        this.selectedMarker = null;
      });

      this.map.on('moveend', () => {
        this.redrawMarkers();
        this.updateVisibleMarkers();
      });

      this.map.on('zoomend', () => {
        this.updateVisibleMarkers();
      });
    },
    async drawAllFlightPaths() {
      // Clear existing flight paths
      this.clearFlightPaths();

      // Fetch flight data (assuming an endpoint exists)
      try {
        const response = await fetch('http://your-api-endpoint/flights');
        const flights = await response.json();

        // Process each flight
        flights.forEach(flight => {
          this.addMarker(flight.originAirport);
          this.addMarker(flight.destinationAirport);

          // Assuming a method to draw a path between two airports
          this.drawFlightPath(flight.originAirport, flight.destinationAirport, flight);
        });
      } catch (error) {
        console.error('Error fetching flight data:', error);
      }
    },
    drawFlightPath(flight) {
      // Assuming flight has originAirport and destinationAirport properties
      const origin = flight.originAirport;
      const destination = flight.destinationAirport;

      // Create a geodesic line
      const geodesicLine = L.geodesic([[origin.latitude, origin.longitude], [destination.latitude, destination.longitude]], {
        weight: 1,
        opacity: 1,
        color: 'blue', // Replace with dynamic color based on your logic
        wrap: false
      }).addTo(this.map);

      // Event listeners for the geodesic line
      geodesicLine.on('click', () => {
        if (this.isFlightListed(flight)) {
          this.removeFlightFromList(flight);
        } else {
          this.addFlightToList(flight);
        }
      });

      geodesicLine.on('mouseover', (e) => {
        L.popup()
          .setLatLng(e.latlng)
          .setContent(`Flight from ${origin.name} to ${destination.name}`)
          .openOn(this.map);
      });

      geodesicLine.on('mouseout', () => {
        this.map.closePopup();
      });

      // Add plane icon as a decorator for the line
      const planeIcon = L.icon({
        iconUrl: 'path/to/plane_icon.png', // Replace with the correct path
        iconSize: [16, 16],
        iconAnchor: [8, 12]
      });

      const planeSymbol = L.Symbol.marker({
        rotate: true,
        markerOptions: {
          icon: planeIcon
        }
      });

      L.polylineDecorator(geodesicLine, {
        patterns: [
          { offset: '50%', repeat: 0, symbol: planeSymbol }
        ]
      }).addTo(this.map);
    }
    // Other map-related methods
  },
  // Other component options
};
</script>

<style>
#map {
  flex-grow: 1;
  height: 100%; 
  overflow: hidden;
}

.flight-details {
  margin-right: 20px; /* Adjust as needed */
  flex-basis: 200px; /* Adjust width as needed */
  overflow-y: auto; /* For scrollable list */
}

#flightDetailsList li {
  cursor: pointer;
  margin-bottom: 5px;
}

.leaflet-popup-content-wrapper, .leaflet-popup-tip {
  background-color: rgb(0, 0, 0) !important; /* Dark background for popup */
  color: #a0a0a0; /* Light text color */
  border: 1px solid #676767; /* Border color */
  border-radius: 5px; /* Rounded corners */
  box-shadow: 0px 0px 10px 0px rgba(0, 0, 0, 0.2); /* Box shadow for consistency */
}

/* Change background color */
.leaflet-control-zoom a {
  background-color: #555555;
  color: #bbbbbb;
  border: 1px solid #a5a5a5;
}

.leaflet-control-zoom a:hover, a:active {
  background-color: #222222;
  color: #bbbbbb;
}
</style>

