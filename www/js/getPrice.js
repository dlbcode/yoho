import { appState } from './stateManager.js';

const getPrice = {
    init() {
        document.getElementById('getPriceBtn').addEventListener('click', this.handleGetPriceClick);
    },

    handleGetPriceClick() {
        const waypoints = appState.waypoints;
        let searchQuery = '';

        if (waypoints.length === 1) {
            // Single waypoint: Explore flights from this origin
            searchQuery = `Flights from ${waypoints[0].iata_code}`;
        } else if (waypoints.length >= 2) {
            // Two or more waypoints: Construct a flight search query
            for (let i = 0; i < waypoints.length - 1; i++) {
                if (i > 0) searchQuery += ', ';
                searchQuery += `Flights from ${waypoints[i].iata_code} to ${waypoints[i + 1].iata_code}`;
            }
        }

        // Construct the Google Flights URL with natural language query
        let googleFlightsUrl = `https://www.google.com/travel/flights?q=${encodeURIComponent(searchQuery)}`;

        // Open the URL
        window.open(googleFlightsUrl, '_blank');
    }
};

export { getPrice };
