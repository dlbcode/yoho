const appState = {
    selectedAirport: null,
    numTravelers: 1,
    routeDirection: 'from',
    waypoints: [],
    routes: [],
    startDate: null,
    directRoutes: [],
};
  
function updateState(key, value) {
    switch (key) {
        case 'routeDirection':
            appState.routeDirection = value;
            updateUrlWithWaypoints();
            break;
            
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

        case 'removeWaypoints':
            let startIndex = (value.routeNumber - 1) * 2;
            appState.waypoints.splice(startIndex, 2);
            updateUrlWithWaypoints();
            break;
    
        case 'addRoute':
            appState.routes.push(value);
            break;
    
        case 'updateRoutes':
            if (JSON.stringify(appState.routes) !== JSON.stringify(value)) {
                appState.routes = value;
            }
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
    const routeDirection = appState.routeDirection; // Get the routeDirection from appState
    const encodedRouteDirection = encodeURIComponent(routeDirection); // Encode the routeDirection

    window.history.pushState({}, '', `?direction=${encodedRouteDirection}&waypoints=${encodedUri}`);
}

  
export { appState, updateState };
  