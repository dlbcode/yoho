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
    let shouldUpdateUrl = true;
    switch (key) {
        case 'routeDirection':
            appState.routeDirection = value;
            break;

        case 'updateRouteDate':
            if (!appState.routeDates[value.routeNumber] || appState.routeDates[value.routeNumber].depart !== value.depart || appState.routeDates[value.routeNumber].return !== value.return) {
                if (!appState.routeDates[value.routeNumber]) {
                    appState.routeDates[value.routeNumber] = { depart: null, return: null };
                }
                appState.routeDates[value.routeNumber] = {
                    depart: value.depart || appState.routeDates[value.routeNumber].depart,
                    return: (value.return === null || value.return === 'undefined') ? null : value.return || appState.routeDates[value.routeNumber].return
                };
                Object.keys(appState.selectedRoutes).forEach(key => {
                    if (parseInt(key) >= value.routeNumber && appState.selectedRoutes[key]) {
                        appState.selectedRoutes[key].routeDates = { 
                            depart: value.depart, 
                            return: (value.return === null || value.return === 'undefined') ? null : value.return 
                        };
                    }
                });
            }
            break;

        case 'tripType':
            if (!appState.routes[value.routeNumber]) {
                appState.routes[value.routeNumber] = {};
            }
            appState.routes[value.routeNumber].tripType = value.tripType;
            break;

        case 'updateTravelers':
            if (value.routeNumber != null && appState.routes[value.routeNumber]) {
                appState.routes[value.routeNumber].travelers = parseInt(value.travelers);
            }
            shouldUpdateUrl = false;
            break;

        case 'updateWaypoint':
            if (value.index >= 0 && value.index < appState.waypoints.length) {
                appState.waypoints[value.index] = { ...appState.waypoints[value.index], ...value.data };
            }
            break;

        case 'addWaypoint':
            if (Array.isArray(value)) {
                value.forEach(waypoint => appState.waypoints.push(waypoint));
            } else {
                appState.waypoints.push(value);
            }
            appState.isEditingWaypoint = true;
            break;

        case 'removeWaypoint':
            if (value >= 0 && value < appState.waypoints.length) {
                appState.waypoints.splice(value, 1);
            }
            appState.isEditingWaypoint = false;
            break;

        case 'removeWaypoints':
            const startIndex = value.routeNumber * 2;
            if (startIndex < appState.waypoints.length) {
                appState.waypoints.splice(startIndex, 2);
            }
            break;

        case 'updateRoutes':
            appState.routes = value.map((route, index) => {
                const existingRoute = appState.routes[index] || {};
                return {
                    ...existingRoute,
                    ...route,
                    travelers: route.travelers || 1,
                    tripType: route.tripType || existingRoute.tripType || 'oneWay'
                };
            });
            break;

        case 'clearData':
            appState.waypoints = [];
            appState.routes = [];
            appState.trips = [];
            appState.selectedRoutes = {};
            appState.routeDates = {};
            break;

        case 'updateSelectedRoute':
            appState.selectedRoutes[value.routeIndex] = value.routeDetails;
            appState.routeDates[value.routeIndex] = value.routeDetails.routeDates;
            break;

        case 'selectedAirport':
            appState.selectedAirport = value;
            shouldUpdateUrl = false;
            break;

        case 'removeSelectedRoute':
            delete appState.selectedRoutes[value];
            break;

        case 'changeView':
            appState.currentView = value;
            break;

        default:
            appState[key] = value;
            break;
    }
    document.dispatchEvent(new CustomEvent('stateChange', { detail: { key, value } }));
    console.log('State updated:', key, value, calledFrom);
    console.log('appState:', appState);

    if (shouldUpdateUrl) {
        updateUrl();
    }
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
}

export { appState, updateState, updateUrl };
