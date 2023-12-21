<template>
  <div>
    <input type="text" v-model="inputValue" @input="fetchAirports" />
    <div v-if="suggestions.length">
      <div v-for="airport in suggestions" :key="airport.iata_code" @click="selectAirport(airport)">
        {{ airport.name }} ({{ airport.iata_code }}) - {{ airport.city }}, {{ airport.country }}
      </div>
    </div>
  </div>
</template>

<script>
import AirportAutocomplete from './components/AirportAutocomplete.vue';

export default {
  name: 'AirportAutocomplete',
  props: {
    inputId: String,
  },
  data() {
    return {
      inputValue: '',
      suggestions: [],
    };
  },
  methods: {
    async fetchAirports() {
      // Logic to fetch airports based on this.inputValue
    },
    selectAirport(airport) {
      // Logic to handle airport selection
      this.inputValue = `${airport.city} (${airport.iata_code})`;
      this.suggestions = [];
      // Emit an event if needed
      this.$emit('airportSelected', airport.iata_code);
    },
    handleFromAirportSelected(iataCode) {
      // Logic when an airport is selected in the 'from' field
    },
    handleToAirportSelected(iataCode) {
      // Logic when an airport is selected in the 'to' field
    },
  },
};
</script>
