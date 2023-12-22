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
      <FlightMap></FlightMap>
    </div>
  </div>
</template>

<script>
import FlightMap from './components/FlightMap.vue';

export default {
  name: 'App',
  components: {
    FlightMap
  }
};
</script>

<style>
/* Add your CSS styles here */
</style>
