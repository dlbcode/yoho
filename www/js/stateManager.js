const appState = {
    selectedAirport: null,
    numTravelers: 1,
    routePathToggle: 'from',
    waypoints: [],
    routes: [],
    startDate: null,
  };
  
  function updateState(key, value) {
    switch (key) {
      case 'updateWaypoint':
        if (value.index >= 0 && value.index < appState.waypoints.length) {
          appState.waypoints[value.index] = {...appState.waypoints[value.index], ...value.data};
        }
        break;
  
      case 'addWaypoint':
        if (Array.isArray(value)) {
          value.forEach(waypoint => appState.waypoints.push(waypoint));
        } else {
          appState.waypoints.push(value);
        }
        updateUrlWithWaypoints();
        break;
  
      case 'removeWaypoint':
        appState.waypoints.splice(value, 1);
        updateUrlWithWaypoints();
        break;
  
      case 'addRoute':
        appState.routes.push(value);
        break;
  
      case 'updateRoutes':
        appState.routes = value;
        break;
  
      case 'clearData':
        appState.waypoints = [];
        appState.routes = [];
        updateUrlWithWaypoints();
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
  