<template>
  <div>
    <l-map 
      style="height: 400px; width: 100%;" 
      :zoom="zoom" 
      :center="center"
    >
      <l-tile-layer :url="url" :attribution="attribution"></l-tile-layer>
      <l-marker 
        v-for="airport in filteredAirports" 
        :key="airport.iata_code" 
        :lat-lng="[airport.latitude, airport.longitude]"
      >
        <l-popup>{{ airport.name }}</l-popup>
      </l-marker>
    </l-map>
    <h1>Flight Data</h1>
    <ul v-if="filteredAirports.length">
      <li v-for="airport in filteredAirports" :key="airport.iata_code">
        {{ airport.iata_code }} - Latitude: {{ airport.latitude }}, Longitude: {{ airport.longitude }}
      </li>
    </ul>
    <p v-if="loading">Loading airports data...</p>
    <p v-else-if="!filteredAirports.length">No airports data available.</p>
  </div>
</template>

<script>
import { LMap, LTileLayer, LMarker, LPopup } from '@vue-leaflet/vue-leaflet';
import 'leaflet/dist/leaflet.css';

export default {
  name: 'FlightData',
  components: {
    LMap,
    LTileLayer,
    LMarker,
    LPopup
  },
  data() {
    return {
      flights: [],
      airports: [],
      filteredAirports: [],
      loading: false,
      center: [51.505, -0.09], // Default center of the map
      zoom: 4, // Default zoom level
      url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png',
      attribution: 'Map data © <a href="https://openstreetmap.org">OpenStreetMap</a> contributors', // Define attribution here
    };
  },
  mounted() {
    this.fetchFlights();
  },
  methods: {
    fetchFlights() {
      this.loading = true;
      fetch('http://localhost:3000/flights')
        .then(response => response.json())
        .then(data => {
          this.flights = data;
          this.fetchAirports();
        })
        .catch(error => {
          console.error('Error fetching flights:', error);
          this.loading = false;
        });
    },
    async fetchAirports() {
      const uniqueIataCodes = new Set(this.flights.flatMap(flight => [flight.origin, flight.destination]));
      const iataCodesArray = Array.from(uniqueIataCodes);
      const batchSize = 50; // Adjust based on your server's capability

      for (let i = 0; i < iataCodesArray.length; i += batchSize) {
        const batch = iataCodesArray.slice(i, i + batchSize);
        await this.fetchAirportBatch(batch);
      }
      this.loading = false;
    },
    fetchAirportBatch(batch) {
      return Promise.all(batch.map(iata => 
        fetch(`http://localhost:3000/airports?iata=${iata}`)
          .then(response => response.json())
          .then(data => {
            if (data && data.length > 0) {
              this.filteredAirports.push(data[0]);
            }
          })
          .catch(error => console.error(`Error fetching airport data for ${iata}:`, error))
      ));
    }
  },
};
</script>
