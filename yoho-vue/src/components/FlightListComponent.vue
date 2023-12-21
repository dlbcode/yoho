<template>
  <div>
    <div id="flightDetailsList">
      <ul>
        <li v-for="flight in flights" :key="flight.id">
          {{ flight.originAirport.iata_code }} to {{ flight.destinationAirport.iata_code }} - ${{ flight.price }}
          <button @click="removeFlight(flight)">X</button>
        </li>
      </ul>
    </div>
    <div>Total Trip Cost: ${{ totalCost.toFixed(2) }}</div>
  </div>
</template>

<script>
export default {
  name: 'FlightListComponent',
  data() {
    return {
      flights: [],
      numTravelers: 1,
      totalCost: 0,
    };
  },
  methods: {
    addFlight(flight) {
      // Logic to add flight to the list
    },
    removeFlight(flight) {
      // Logic to remove flight from the list
    },
    updateTotalCost() {
      // Logic to update the total cost
    },
    updateTravelers(increment) {
      // Logic to update the number of travelers
    },
  },
};
</script>
