const params = new URLSearchParams(window.location.search);
const defaultDirection = params.get('direction') || 'from';

const appState = {
    eurToUsd: 1.13,
    selectedAirport: null,
    tripType: 'roundTrip',
    roundTrip: false,
    travelers: 1,
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
        departure: null,
        return: null,
    },
    routeLines: [],
    invisibleRouteLines: [],
};

function updateState(key, value) {
    switch (key) {
        case 'routeDirection': {
            appState.routeDirection = value;
            updateUrl();
            break;
        }

        case 'updateRouteDate': {
            const { routeNumber, date } = value;
            appState.routeDates[routeNumber] = date;
            Object.keys(appState.selectedRoutes).forEach(key => {
                if (parseInt(key) >= routeNumber && appState.selectedRoutes[key]) {
                    appState.selectedRoutes[key].routeDates = date;
                }
            });
            updateUrl();
            break;
        }

        case 'updateTravelers': {
            const { routeNumber, travelers } = value;
            if (routeNumber != null && appState.routes[routeNumber]) { // Check if the route exists
                appState.routes[routeNumber].travelers = parseInt(travelers);
            }
            break;
        }

        case 'updateWaypoint':
            if (value.index >= 0 && value.index < appState.waypoints.length) {
            appState.waypoints[value.index] = {...appState.waypoints[value.index], ...value.data};
            }
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

        case 'updateRoutes':
            if (JSON.stringify(appState.routes) !== JSON.stringify(value)) {
                // Ensure each route has at least 1 traveler
                appState.routes = value.map(route => ({
                    ...route,
                    travelers: route.travelers || 1  // Set default travelers to 1 if not provided
                }));

                // Only recalculate routeDates if necessary, otherwise preserve existing dates
                const recalculatedRouteDates = { ...appState.routeDates };
                appState.routes.forEach((route, index) => {
                    if (!recalculatedRouteDates.hasOwnProperty(index)) {
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

        case 'startDate':
            appState.startDate = value;
            updateUrl();
            break;

        case 'endDate':
            appState.endDate = value;
            updateUrl();
            break;

        case 'changeView':
            appState.currentView = value;
            updateUrl();
            break;

        default:
            appState[key] = value;
            break;
    }
    document.dispatchEvent(new CustomEvent('stateChange', { detail: { key, value } }));
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

export { appState, updateState, updateUrl };
