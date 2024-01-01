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
      // Assuming value contains the index and the updated waypoint data
      if (value.index >= 0 && value.index < appState.waypoints.length) {
        appState.waypoints[value.index] = {...appState.waypoints[value.index], ...value.data};
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
      appState.waypoints.splice(value, 1);
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
