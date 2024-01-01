const appState = {
  selectedAirport: null,
  numTravelers: 1,
  flightPathToggle: 'from',
  waypoints: [],
  flights: [], 
};

function updateState(key, value) {
  switch (key) {
    case 'updateWaypoint':
      console.log('updateWaypoint');
      const waypointIndex = appState.waypoints.findIndex(w => w.fieldId === value.fieldId);
      if (waypointIndex !== -1) {
          // Update the existing waypoint entry
          appState.waypoints[waypointIndex] = {...appState.waypoints[waypointIndex], ...value};
      }
      console.table(appState.waypoints);
      break;
    case 'addWaypoint':
      console.log('addWaypoint');
      appState.waypoints.push(value);
      console.table(appState.waypoints);
      break;
    case 'removeWaypoint':
      console.log('removeWaypoint');
      appState.waypoints = appState.waypoints.filter(waypoint => waypoint.iata_code !== value);
      console.table(appState.waypoints);
      break;
    case 'addFlight':
      console.log('appState: adding flight');
      appState.flights.push(value);
      console.table(appState.flights);
      break;
    default:
      appState[key] = value;
      break;
  }
  document.dispatchEvent(new CustomEvent('stateChange', { detail: { key, value } }));
}

export { appState, updateState };
