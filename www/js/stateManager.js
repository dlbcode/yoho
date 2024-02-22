const params = new URLSearchParams(window.location.search);
const defaultDirection = params.get('direction') || 'from';

const appState = {
    selectedAirport: null,
    oneWay: true,
    numTravelers: 1,
    routeDirection: defaultDirection,
    waypoints: [],
    routes: [],
    startDate: null,
    directRoutes: [],
    selectedRoutes: {},
    tripTableData: null,
    routeTablesData: {},
    currentView: 'trip'
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
            updateUrlWithWaypoints();
            break;

        case 'oneWay':
            appState.oneWay = value;
            updateUrlWithWaypoints();
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

        case 'updateSelectedRoute':
            const { routeIndex, routeDetails } = value;
            appState.selectedRoutes[routeIndex] = routeDetails;
            break;

        case 'removeSelectedRoute':
            delete appState.selectedRoutes[value];
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
    const routeDirection = appState.routeDirection;
    const encodedRouteDirection = encodeURIComponent(routeDirection);
    const encodedOneWay = encodeURIComponent(appState.oneWay);

    const newUrl = `?oneWay=${encodedOneWay}&direction=${encodedRouteDirection}&waypoints=${encodedUri}`;
    if (window.location.search !== newUrl) {
        window.history.pushState({}, '', newUrl);
    }
}
 
export { appState, updateState };
  