const params = new URLSearchParams(window.location.search);
const defaultDirection = params.get('direction') || 'from';

const appState = {
    eurToUsd: 1.13,
    selectedAirport: null,
    roundTrip: false,
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

function updateState(key, value) {
    switch (key) {
        case 'routeDirection': {
            appState.routeDirection = value;
            updateUrl();
            break;
        }

        case 'updateRouteDate': {
            console.log('appState.updateRouteDate:', value);
            const { routeNumber, depart, return: returnDate } = value;
            if (!appState.routeDates[routeNumber]) {
                appState.routeDates[routeNumber] = { depart: null, return: null };
            }
            appState.routeDates[routeNumber] = {
                depart: depart || appState.routeDates[routeNumber].depart,
                return: returnDate || appState.routeDates[routeNumber].return
            };
            Object.keys(appState.selectedRoutes).forEach(key => {
                if (parseInt(key) >= routeNumber && appState.selectedRoutes[key]) {
                    appState.selectedRoutes[key].routeDates = { depart, return: returnDate };
                }
            });
            updateUrl();
            break;
        }

        case 'tripType': {
            const { routeNumber, tripType } = value;
            if (appState.routes[routeNumber]) {
                appState.routes[routeNumber].tripType = tripType;
            } else {
                appState.routes[routeNumber] = { tripType };
            }
            updateUrl();
            break;
        }

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
                if (value.length === 0) {
                    break; // Do not update if value is an empty array
                }
                const updatedRoutes = value.map((route, index) => {
                    const existingRoute = appState.routes[index] || {};
                    return {
                        ...existingRoute,
                        ...route,
                        travelers: route.travelers || 1,  // Set default travelers to 1 if not provided
                        tripType: existingRoute.tripType || route.tripType || 'oneWay' // Preserve existing tripType or default to 'oneWay'
                    };
                });
                appState.routes = updatedRoutes;
                const recalculatedRouteDates = { ...appState.routeDates };
                appState.routes.forEach((route, index) => {
                    if (!recalculatedRouteDates.hasOwnProperty(index)) {
                        if (index === 0) {
                            recalculatedRouteDates[index] = {
                                depart: new Date().toISOString().split('T')[0],
                                return: new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                            };
                        } else {
                            const prevRouteDate = recalculatedRouteDates[index - 1].return || recalculatedRouteDates[index - 1].depart;
                            recalculatedRouteDates[index] = {
                                depart: prevRouteDate,
                                return: new Date(new Date(prevRouteDate).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                            };
                        }
                    }
                });
                appState.routeDates = recalculatedRouteDates;
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

        case 'changeView':
            appState.currentView = value;
            updateUrl();
            break;

        default:
            appState[key] = value;
            updateUrl(); // Ensure URL update for any other state changes
            break;
    }
    document.dispatchEvent(new CustomEvent('stateChange', { detail: { key, value } }));
    console.log('State updated:', key, value);
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
        ? Object.entries(appState.routeDates).map(([key, value]) => `${key}:depart:${value.depart},${key}:return:${value.return || 'null'}`).join(',')
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
