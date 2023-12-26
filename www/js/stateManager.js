const appState = {
  fromAirport: null,
  toAirport: null,
  numTravelers: 1,
  flightPathToggle: 'from',
  waypoints: [],
  flights: [], 
};

function updateState(key, value) {
  switch (key) {
      case 'addWaypoint':
          appState.waypoints.push(value);
          break;
      case 'removeWaypoint':
          appState.waypoints = appState.waypoints.filter(waypoint => waypoint.iata_code !== value);
          break;
      case 'addFlight':
          appState.flights.push(value);
          break;
      default:
          appState[key] = value;
          break;
  }
  document.dispatchEvent(new CustomEvent('stateChange', { detail: { key, value } }));
}

export { appState, updateState };
