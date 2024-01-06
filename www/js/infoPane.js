const infoPane = {

  init() {
    // Initialize the infoPane
    const infoPaneElement = document.getElementById('infoPane');
    infoPaneElement.innerHTML = '<h3>Info Pane</h3><p>Content goes here...</p>';
    // Add more initialization logic if needed
  },

  // New function to fetch and display flight data
  async displayFlightInfo(originIata, destIata) {
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
      flightInfoList.innerHTML = ''; // Clear existing list

      flights.forEach(flight => {
          const listItem = document.createElement('li');
          listItem.textContent = `Flight ${flight.flight_number} from ${flight.origin_iata} to ${flight.dest_iata}, Duration: ${flight.duration}`;
          flightInfoList.appendChild(listItem);
      });
  },
};

export { infoPane };