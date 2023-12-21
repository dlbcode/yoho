<template>
  <div>
    <!-- Your template code goes here -->
  </div>
</template>

<script>
export default {
  name: 'airportAutocomplete',
  data() {
    return {
      numTravelers: 1,
      fromAirport: '',
      toAirport: '',
    };
  },
  methods: {
    // Function to fetch airports from your endpoint
    async fetchAirports(query) {
      try {
        const response = await fetch(`http://localhost:3000/airports?query=${query}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const airports = await response.json();
        return airports;
      } catch (error) {
        console.error('Fetch error:', error);
        return [];
      }
    },

    updateSuggestions(inputId, airports) {
      const suggestionBox = document.getElementById(inputId + 'Suggestions');
      suggestionBox.innerHTML = '';
      airports.forEach(airport => {
        const div = document.createElement('div');
        div.textContent = `${airport.name} (${airport.iata_code}) - ${airport.city}, ${airport.country}`;
        div.addEventListener('click', () => {
          const inputField = document.getElementById(inputId);
          inputField.value = `${airport.city} (${airport.iata_code})`;
          suggestionBox.innerHTML = '';
          const event = new CustomEvent('airportSelected', { detail: { iataCode: airport.iata_code } });
          inputField.dispatchEvent(event);
        });
        suggestionBox.appendChild(div);
      });
    },

    handleDocumentClick(event) {
      const fromSuggestions = document.getElementById('fromAirportSuggestions');
      const toSuggestions = document.getElementById('toAirportSuggestions');

      if (fromSuggestions && !fromSuggestions.contains(event.target)) {
        fromSuggestions.innerHTML = '';
      }

      if (toSuggestions && !toSuggestions.contains(event.target)) {
        toSuggestions.innerHTML = '';
      }
    },

    async handleInput(e) {
      const inputId = e.target.id;
      const airports = await this.fetchAirports(e.target.value);
      this.updateSuggestions(inputId, airports);
    },
  },
  mounted() {
    document.addEventListener('click', this.handleDocumentClick);
    document.getElementById('fromAirport').addEventListener('input', this.handleInput);
    document.getElementById('toAirport').addEventListener('input', this.handleInput);
  },
  beforeUnmount() { // Replaced beforeDestroy with beforeUnmount
    document.removeEventListener('click', this.handleDocumentClick);
    document.getElementById('fromAirport').removeEventListener('input', this.handleInput);
    document.getElementById('toAirport').removeEventListener('input', this.handleInput);
  },
};
</script>
