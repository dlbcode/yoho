<template>
  <div>
    <h1>Flight Data</h1>
    <ul v-if="flights.length">
      <li v-for="flight in flights" :key="flight._id">
        {{ flight.origin }} - {{ flight.destination }}
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
    };
  },
  mounted() {
    fetch('http://localhost:3000/flights')
      .then(response => response.json())
      .then(data => {
        this.flights = data;
      })
      .catch(error => console.error('Error fetching flights:', error));
  },
};
</script>
