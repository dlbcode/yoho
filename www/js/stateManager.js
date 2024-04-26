const params = new URLSearchParams(window.location.search);
const defaultDirection = params.get('direction') || 'from';

const appState = {
    urlDataLoaded: false,
    selectedAirport: null,
    roundTrip: false,
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
    highestGroupId: 0,
    routeDates: {
        0: new Date().toISOString().split('T')[0],
    },
    routeLines: [],
    invisibleRouteLines: [],
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
            Object.keys(appState.selectedRoutes).forEach(key => {
                if (parseInt(key) >= routeNumber && appState.selectedRoutes[key]) {
                    appState.selectedRoutes[key].routeDates = date;
                }
            });
            updateUrl();
            break;   
            
        case 'updateWaypoint':
            if (value.index >= 0 && value.index < appState.waypoints.length) {
            appState.waypoints[value.index] = {...appState.waypoints[value.index], ...value.data};
            }
            updateUrl();
            checkAndUpdateRoundTripStatus();
            break;
            
        case 'addWaypoint':
            if (Array.isArray(value)) {
            value.forEach(waypoint => appState.waypoints.push(waypoint));
            } else {
            appState.waypoints.push(value);
            }
            updateUrl();
            checkAndUpdateRoundTripStatus();
            break;
    
        case 'removeWaypoint':
            appState.waypoints.splice(value, 1);
            updateUrl();
            checkAndUpdateRoundTripStatus();
            break;

        case 'removeWaypoints':
            let startIndex = (value.routeNumber - 1) * 2;
            appState.waypoints.splice(startIndex, 2);
            updateUrl();
            checkAndUpdateRoundTripStatus();
            break;
    
        case 'updateRoutes':
            if (JSON.stringify(appState.routes) !== JSON.stringify(value)) {
                appState.routes = value;
                // Only recalculate routeDates if necessary, otherwise preserve existing dates
                const recalculatedRouteDates = { ...appState.routeDates };
                appState.routes.forEach((route, index) => {
                    if (!recalculatedRouteDates.hasOwnProperty(index)) {
                        // Assign a default date if missing, otherwise preserve existing date
                        recalculatedRouteDates[index] = new Date().toISOString().split('T')[0];
                    }
                });
                appState.routeDates = recalculatedRouteDates;
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
        
            // Ensure the routeDates match the selectedRoutes' dates
            appState.routeDates[routeIndex] = routeDetails.routeDates;
        
            updateUrl();
            break;
            
        case 'selectedAirport':
            appState.selectedAirport = value;
            break;
        
        case 'removeSelectedRoute':
            delete appState.selectedRoutes[value];
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

        case 'changeView':
            appState.currentView = value;
            break;
    }
    document.dispatchEvent(new CustomEvent('stateChange', { detail: { key, value } }));
    //console.log('appState update key and value: ', key, value);
    //console.log('appState.routes: ', appState.routes);
    //console.log('appState.routeDates:', appState.routeDates);
    //console.log('appState.selectedRoutes: ', appState.selectedRoutes);
    //console.log('appState.waypoints:', appState.waypoints);
    //console.log('appState airportSelected: ', appState.selectedAirport);
}
  
function updateUrl() {
    const params = new URLSearchParams(window.location.search);
    const waypointIatas = appState.waypoints.map(wp => wp.iata_code);
    if (waypointIatas.length > 0) {
        params.set('waypoints', waypointIatas.join(','));
    } else {
        params.delete('waypoints');
    }

    const dates = Object.entries(appState.routeDates).map(([key, value]) => `${key}:${value}`).join(',');
    if (dates.length > 0) {
        params.set('dates', dates);
    } else {
        params.delete('dates');
    }

    if (appState.routeDirection !== defaultDirection) {
        params.set('direction', appState.routeDirection);
    } else {
        params.delete('direction');
    }

    const paramString = params.toString();
    const newUrl = paramString ? `${window.location.pathname}?${paramString}` : window.location.pathname;
    if (window.location.search !== newUrl) {
        window.history.pushState({}, '', newUrl);
    }

    document.dispatchEvent(new CustomEvent('routeDatesUpdated'));
}

function checkAndUpdateRoundTripStatus() {
    if (appState.waypoints.length >= 4) {
    const firstWaypoint = appState.waypoints[0].iata_code;
    const lastWaypoint = appState.waypoints[appState.waypoints.length - 1].iata_code;
    appState.roundTrip = firstWaypoint === lastWaypoint;
} else {
    appState.roundTrip = false;
}
}

export { appState, updateState, updateUrl };
  