const params = new URLSearchParams(window.location.search);
const defaultDirection = params.get('direction') || 'from';

const appState = {
    selectedAirport: null,
    oneWay: true,
    numTravelers: 1,
    routeDirection: defaultDirection,
    startDate: null,
    endDate: null,
    waypoints: [],
    routes: [],
    trips: [],
    directRoutes: [],
    selectedRoutes: {},
    tripTableData: null,
    routeTablesData: {},
    currentView: 'trip',
    currentGroupID: 0,
    routeDates: {
        1: new Date().toISOString().split('T')[0], // Set today's date for route number 1
    },
};
  
function updateState(key, value) {
    switch (key) {
        case 'routeDirection':
            appState.routeDirection = value;
            updateUrl();
            break;

        case 'updateRouteDate':
            const { routeNumber, date } = value;
            appState.routeDates[routeNumber] = date;
            appState.startDate = appState.routeDates[1];
            updateUrl();
            break;
            
        case 'updateWaypoint':
            if (value.index >= 0 && value.index < appState.waypoints.length) {
            appState.waypoints[value.index] = {...appState.waypoints[value.index], ...value.data};
            }
            updateUrl();
            break;

        case 'oneWay':
            appState.oneWay = value;
            updateUrl();
            break;
  
        case 'addWaypoint':
            if (Array.isArray(value)) {
            value.forEach(waypoint => appState.waypoints.push(waypoint));
            } else {
            appState.waypoints.push(value);
            }
            updateUrl();
            break;
    
        case 'removeWaypoint':
            appState.waypoints.splice(value, 1);
            updateUrl();
            break;

        case 'removeWaypoints':
            let startIndex = (value.routeNumber - 1) * 2;
            appState.waypoints.splice(startIndex, 2);
            updateUrl();
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
            appState.trips = [];
            appState.selectedRoutes = {};
            appState.routeDates = {};
            updateUrl();
            break;

        case 'updateSelectedRoute':
            const { routeIndex, routeDetails } = value;
            appState.selectedRoutes[routeIndex] = routeDetails;
            break;

        case 'removeSelectedRoute':
            delete appState.selectedRoutes[value];
            delete appState.routeDates[value];
            updateUrl();
            break;

        default:
            appState[key] = value;
            break;
        
        case 'startDate':
            appState.startDate = value;
            break;

        case 'endDate':
            appState.endDate = value;
            break;
        
        case 'updateRouteDates':
            appState.routeDates = value;
            updateUrl();
            break;
        
        case 'changeView':
            appState.currentView = value;
            break;
    }
    document.dispatchEvent(new CustomEvent('stateChange', { detail: { key, value } }));
}
  
function updateUrl() {
    const params = new URLSearchParams(window.location.search);

    // Update waypoints
    const waypointIatas = appState.waypoints.map(wp => wp.iata_code);
    if (waypointIatas.length > 0) {
        params.set('waypoints', waypointIatas.join(','));
    } else {
        params.delete('waypoints');
    }

    // Update route dates
    const dates = Object.entries(appState.routeDates).map(([key, value]) => `${key}:${value}`).join(',');
    if (dates.length > 0) {
        params.set('dates', dates);
    } else {
        params.delete('dates');
    }

    // Update other parameters as needed
    params.set('oneWay', appState.oneWay);
    params.set('direction', appState.routeDirection);

    // Construct the new URL
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    if (window.location.search !== newUrl) {
        window.history.pushState({}, '', newUrl);
    }
    // In stateManager.js, after updating routeDates from URL
    document.dispatchEvent(new CustomEvent('routeDatesUpdated'));
}

export { appState, updateState };
  