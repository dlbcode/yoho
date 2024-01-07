import { appState } from './stateManager.js';

const infoPane = {

  init() {
    // Update only the content of infoPaneContent
    const infoPaneContent = document.getElementById('infoPaneContent');
    infoPaneContent.innerHTML = '<h3>Info Pane</h3>';

    document.addEventListener('stateChange', this.handleStateChange.bind(this));
},


  handleStateChange(event) {
    const { key, value } = event.detail;
    if (key === 'addWaypoint' || key === 'updateWaypoint' || key === 'removeWaypoint') {
      this.displayFlightsForWaypoints();
    }
  },

  async displayFlightsForWaypoints() {
    const waypoints = appState.waypoints;
    if (waypoints.length < 2) return;

    for (let i = 0; i < waypoints.length - 1; i++) {
      const originIata = waypoints[i].iata_code;
      const destIata = waypoints[i + 1].iata_code;
      await this.displayFlightInfo(originIata, destIata);
    }
  },

  // New function to fetch and display flight data
  async displayFlightInfo(originIata, destIata) {
    console.log('Fetching flight data for', originIata, destIata);
    try {
        const response = await fetch(`http://yonderhop.com:3000/flights?origin=${originIata}&destination=${destIata}`);
        const flights = await response.json();
        this.updateFlightInfoPane(flights);
    } catch (error) {
        console.error('Error fetching flight data:', error);
    }
  },

  updateFlightInfoPane(flights) {
      const flightInfoList = document.getElementById('flightInfoList');
      flightInfoList.innerHTML = '';
      // convert flight.departure and flight.arrival from YYYYMMDDHHMM to HH:MM
      flights.forEach(flight => {
          flight.departure = flight.departure.slice(8, 10) + ':' + flight.departure.slice(10, 12);
          flight.arrival = flight.arrival.slice(8, 10) + ':' + flight.arrival.slice(10, 12);
      });

      flights.forEach(flight => {
          const listItem = document.createElement('li');
          listItem.textContent = `Flight ${flight.flight_number} from ${flight.origin_iata} to ${flight.dest_iata}, Departure: ${flight.departure}, Arrival: ${flight.arrival}, Duration: ${flight.duration}`;
          flightInfoList.appendChild(listItem);
      });
  },
};

export { infoPane };