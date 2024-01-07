import { appState } from './stateManager.js';

const getPrice = {
    init() {
        document.getElementById('getPriceBtn').addEventListener('click', this.handleGetPriceClick);
    },

    handleGetPriceClick() {
        const waypoints = appState.waypoints;
        let searchQuery = '';

        if (waypoints.length === 1) {
            // Single waypoint: Explore one-way flights from this origin
            searchQuery = `One-way flights from ${waypoints[0].iata_code}`;
        } else if (waypoints.length === 2) {
            // Two waypoints: One-way flight from origin to destination
            searchQuery = `One-way flight from ${waypoints[0].iata_code} to ${waypoints[1].iata_code}`;
        } else {
            // More than two waypoints: Construct a multi-hop flight search query
            searchQuery = 'Multi-city flight ';
            waypoints.forEach((waypoint, index) => {
                if (index < waypoints.length - 1) {
                    if (index > 0) searchQuery += ', ';
                    searchQuery += `from ${waypoint.iata_code} to ${waypoints[index + 1].iata_code}`;
                }
            });
        }

        // Construct the Google Flights URL with natural language query
        let googleFlightsUrl = `https://www.google.com/travel/flights?q=${encodeURIComponent(searchQuery)}`;

        // Open the URL
        window.open(googleFlightsUrl, '_blank');
    }
};

export { getPrice };
