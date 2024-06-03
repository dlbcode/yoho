const params = new URLSearchParams(window.location.search);
const defaultDirection = params.get('direction') || 'from';

const appState = {
    eurToUsd: 1.13,
    selectedAirport: null,
    travelers: 1,
    routeDirection: defaultDirection,
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
        0: { depart: new Date().toISOString().split('T')[0], return: new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
    },
    routeLines: [],
    invisibleRouteLines: [],
};

function updateState(key, value, calledFrom) {
    switch (key) {
        case 'routeDirection': {
            appState.routeDirection = value;
            updateUrl();
            break;
        }

        case 'updateRouteDate': {
            const { routeNumber, depart, return: returnDate } = value;
            if (!appState.routeDates[routeNumber] || appState.routeDates[routeNumber].depart !== depart || appState.routeDates[routeNumber].return !== returnDate) {
                if (!appState.routeDates[routeNumber]) {
                    appState.routeDates[routeNumber] = { depart: null, return: null };
                }
                appState.routeDates[routeNumber] = {
                    depart: depart || appState.routeDates[routeNumber].depart,
                    return: (returnDate === null || returnDate === 'undefined') ? null : returnDate || appState.routeDates[routeNumber].return
                };
                Object.keys(appState.selectedRoutes).forEach(key => {
                    if (parseInt(key) >= routeNumber && appState.selectedRoutes[key]) {
                        appState.selectedRoutes[key].routeDates = { 
                            depart, 
                            return: (returnDate === null || returnDate === 'undefined') ? null : returnDate 
                        };
                    }
                });
                updateUrl();
            }
            break;
        }

        case 'tripType':
            const { routeNumber: tripRouteNumber, tripType } = value;
            if (!appState.routes[tripRouteNumber]) {
                appState.routes[tripRouteNumber] = {};
            }
            appState.routes[tripRouteNumber].tripType = tripType;
            updateUrl();
            break;

        case 'updateTravelers': {
            const { routeNumber, travelers } = value;
            if (routeNumber != null && appState.routes[routeNumber]) {
                appState.routes[routeNumber].travelers = parseInt(travelers);
            }
            break;
        }

        case 'updateWaypoint':
            if (value.index >= 0 && value.index < appState.waypoints.length) {
                appState.waypoints[value.index] = { ...appState.waypoints[value.index], ...value.data };
            }
            updateUrl();
            break;

        case 'addWaypoint':
            if (Array.isArray(value)) {
                value.forEach(waypoint => appState.waypoints.push(waypoint));
            } else {
                appState.waypoints.push(value);
            }
            appState.isEditingWaypoint = true;
            updateUrl();
            break;

        case 'removeWaypoint':
            if (value >= 0 && value < appState.waypoints.length) {
                appState.waypoints.splice(value, 1);
            }
            appState.isEditingWaypoint = false;
            updateUrl();
            break;

        case 'removeWaypoints':
            let startIndex = value.routeNumber * 2;
            if (startIndex < appState.waypoints.length) {
                appState.waypoints.splice(startIndex, 2);
            }
            updateUrl();
            break;

        case 'updateRoutes':
            const updatedRoutes = value.map((route, index) => {
                const existingRoute = appState.routes[index] || {};
                return {
                    ...existingRoute,
                    ...route,
                    travelers: route.travelers || 1,  // Set default travelers to 1 if not provided
                    tripType: route.tripType || existingRoute.tripType || 'oneWay' // Use provided tripType or existing tripType
                };
            });
            appState.routes = updatedRoutes;
            updateUrl();
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

        case 'changeView':
            appState.currentView = value;
            updateUrl();
            break;

        default:
            appState[key] = value;
            updateUrl();
            break;
    }
    document.dispatchEvent(new CustomEvent('stateChange', { detail: { key, value } }));
    console.log('State updated:', key, value, calledFrom);
    console.log('appState:', appState);
}

function updateUrl() {
    const params = new URLSearchParams(window.location.search);
    const waypointIatas = appState.waypoints.map(wp => wp.iata_code);
    if (waypointIatas.length > 0) {
        params.set('waypoints', waypointIatas.join(','));
    } else {
        params.delete('waypoints');
    }

    const dates = appState.routeDates
    ? Object.entries(appState.routeDates).map(([key, value]) => `${key}:depart:${value.depart},${key}:return:${value.return === null ? 'null' : value.return}`).join(',')
    : '';
    if (dates.length > 0) {
        params.set('dates', dates);
    } else {
        params.delete('dates');
    }

    const types = appState.routes
        ? appState.routes.map((route, index) => `${index}:${route.tripType}`).join(',')
        : '';
    if (types.length > 0) {
        params.set('types', types);
    } else {
        params.delete('types');
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

    console.log('URL updated:', newUrl);

    document.dispatchEvent(new CustomEvent('routeDatesUpdated'));
}

export { appState, updateState, updateUrl };
