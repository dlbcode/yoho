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
    routeDecksData: {},
    currentView: 'trip',
    currentGroupID: 0,
    highestGroupId: 0,
    routeDates: {
        0: { depart: new Date().toISOString().split('T')[0], return: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
    },
    routeLines: [],
    invisibleRouteLines: [],
    filterStates: {},
    filterThresholds: {},
};

function updateState(key, value, calledFrom) {
    console.log(`updateState called from: ${calledFrom}, key: ${key}, value:`, value);
    let shouldUpdateUrl = true;
    let shouldContinue = true;

    // Special handling for waypoint removal (moved from wrapper function)
    if (key === 'removeWaypoint') {
        const waypointIndex = value;
        const waypoint = appState.waypoints[waypointIndex];
        
        // Check for "Any" destination markers - update to handle both origin and destination
        const isAnyWaypoint = 
            (waypoint && (waypoint.iata_code === 'Any' || waypoint.isAnyDestination === true)) ||
            window.preserveAnyDestination ||
            document.getElementById(`waypoint-input-${waypointIndex + 1}`)?.getAttribute('data-is-any-destination') === 'true';
        
        // Skip the removal for "Any" waypoints (both origin and destination)
        if (isAnyWaypoint) {
            console.log(`Preserving "Any" waypoint at index ${waypointIndex}`);
            shouldContinue = false; // Don't proceed with the state change
        }
    }

    // Only proceed with state changes if we should continue
    if (shouldContinue) {
        switch (key) {
            case 'routeDirection':
                appState.routeDirection = value;
                break;

            case 'updateRouteDate':
                const { routeNumber, depart, return: returnDate } = value;
                const routeDate = appState.routeDates[routeNumber] || { depart: null, return: null };
                if (routeDate.depart !== depart || routeDate.return !== returnDate) {
                    appState.routeDates[routeNumber] = { depart: depart || routeDate.depart, return: returnDate ?? routeDate.return };
                    Object.keys(appState.selectedRoutes).forEach(key => {
                        if (parseInt(key) >= routeNumber && appState.selectedRoutes[key]) {
                            appState.selectedRoutes[key].routeDates = { depart, return: returnDate ?? null };
                        }
                    });
                }
                break;

            case 'tripType':
                appState.routes[value.routeNumber] = { ...appState.routes[value.routeNumber], tripType: value.tripType };
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
                appState.waypoints.push(...(Array.isArray(value) ? value : [value]));
                appState.isEditingWaypoint = true;
                break;

            case 'removeWaypoint':
                if (value >= 0 && value < appState.waypoints.length) {
                    appState.waypoints.splice(value, 1);
                }
                appState.isEditingWaypoint = false;
                break;

            case 'removeWaypoints':
                appState.waypoints.splice(value.routeNumber * 2, 2);
                break;

            case 'updateRoutes':
                appState.routes = value.map((route, index) => ({
                    ...appState.routes[index],
                    ...route,
                    travelers: route.travelers || 1,
                    tripType: route.tripType || appState.routes[index]?.tripType || 'oneWay'
                }));
                break;

            case 'clearData':
                Object.assign(appState, {
                    waypoints: [],
                    routes: [],
                    trips: [],
                    selectedRoutes: {},
                    routeDates: {}
                });
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

        if (shouldUpdateUrl) {
            updateUrl();
        }
    }
}

window.updateState = updateState;

function updateUrl() {
    const params = new URLSearchParams(window.location.search);
    
    // Preserve "Any" waypoints in URL
    const waypointIatas = appState.waypoints.map(wp => wp?.iata_code || '').join(',');
    
    // Don't remove "Any" from the URL
    waypointIatas ? params.set('waypoints', waypointIatas) : params.delete('waypoints');
    
    const dates = Object.entries(appState.routeDates).map(([key, value]) => `${key}:depart:${value.depart},${key}:return:${value.return ?? 'null'}`).join(',');
    const types = appState.routes.map((route, index) => `${index}:${route.tripType}`).join(',');

    dates ? params.set('dates', dates) : params.delete('dates');
    types ? params.set('types', types) : params.delete('types');
    appState.routeDirection !== defaultDirection ? params.set('direction', appState.routeDirection) : params.delete('direction');

    const newUrl = params.toString() ? `${window.location.pathname}?${params}` : window.location.pathname;
    if (window.location.search !== `?${params}`) {
        window.history.pushState({}, '', newUrl);
    }
}

export { appState, updateState, updateUrl };