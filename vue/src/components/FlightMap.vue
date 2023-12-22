<template>
  <div>
    <h1>Flight Data</h1>
    <ul v-if="filteredAirports.length">
      <li v-for="airport in filteredAirports" :key="airport.iata_code">
        {{ airport.iata_code }} - Latitude: {{ airport.latitude }}, Longitude: {{ airport.longitude }}
      </li>
    </ul>
    <p v-else>Loading...</p>
  </div>
</template>

<script>
export default {
  name: 'FlightData',
  data() {
    return {
      flights: [],
      airports: [],
      filteredAirports: [],
    };
  },
  mounted() {
    this.fetchFlights();
  },
  methods: {
    fetchFlights() {
      fetch('http://localhost:3000/flights')
        .then(response => response.json())
        .then(data => {
          this.flights = data;
          this.fetchAirports();
        })
        .catch(error => console.error('Error fetching flights:', error));
    },
    fetchAirports() {
      const uniqueIataCodes = new Set(this.flights.flatMap(flight => [flight.origin, flight.destination]));
      Promise.all(Array.from(uniqueIataCodes).map(iata => 
        fetch(`http://localhost:3000/airports?iata=${iata}`)
          .then(response => response.json())
          .then(data => data[0]) // Assuming the API returns an array, and we take the first element
          .catch(error => console.error(`Error fetching airport data for ${iata}:`, error))
      ))
      .then(airports => {
        this.filteredAirports = airports.filter(airport => airport != null);
      })
      .catch(error => console.error('Error fetching airports:', error));
    }
  },
};
</script>
