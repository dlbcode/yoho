const appState = {
  selectedAirport: null,
  numTravelers: 1,
  routePathToggle: 'from',
  waypoints: [],
  routes: [], 
};

function updateState(key, value) {
  switch (key) {
    case 'updateWaypoint':
      console.log('updateWaypoint');
      if (value.index >= 0 && value.index < appState.waypoints.length) {
        appState.waypoints[value.index] = {...appState.waypoints[value.index], ...value.data};
      }
      console.table(appState.waypoints);
      break;
    case 'addWaypoint':
      console.log('addWaypoint');
      if (Array.isArray(value)) {
        // If value is an array, add each waypoint in the array
        value.forEach(waypoint => appState.waypoints.push(waypoint));
      } else {
        // If value is a single waypoint, add it directly
        appState.waypoints.push(value);
      }
      console.table(appState.waypoints);
      updateUrlWithWaypoints();
      break;
    case 'removeWaypoint':
      console.log('removeWaypoint');
      appState.waypoints.splice(value, 1);
      console.table(appState.waypoints);
      updateUrlWithWaypoints();
      break;
    case 'addRoute':
      console.log('appState: adding route');
      appState.routes.push(value);
      console.table(appState.routes);
      break;
    case 'clearData':
      appState.waypoints = [];
      appState.routes = [];
      updateUrlWithWaypoints(); // This will clear the waypoints from the URL
      break;  
    default:
      appState[key] = value;
      break;
  }
  document.dispatchEvent(new CustomEvent('stateChange', { detail: { key, value } }));
}

function updateUrlWithWaypoints() {
  const waypointIatas = appState.waypoints.map(wp => wp.iata_code);
  const encodedUri = encodeURIComponent(waypointIatas.join(','));
  window.history.pushState({}, '', `?waypoints=${encodedUri}`);
}

export { appState, updateState };
