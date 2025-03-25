const params = new URLSearchParams(window.location.search);
const defaultDirection = params.get('direction') || 'from';

const appState = {
    eurToUsd: 1.13,
    selectedAirport: null,
    travelers: 1,
    routeDirection: defaultDirection,
    // Route data is the primary source of truth for routes
    routeData: [],
    // Legacy arrays maintained for backward compatibility during transition
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
    // routeDates to be phased out - dates are now in routeData
    routeDates: {}, 
    routeLines: [],
    invisibleRouteLines: [],
    filterStates: {},
    filterThresholds: {},
};

function updateState(key, value, calledFrom) {
    console.log(`updateState called from: ${calledFrom}, key: ${key}, value:`, value);
    let shouldUpdateUrl = true;
    let shouldContinue = true;

    // Special handling for waypoint removal
    if (key === 'removeWaypoint') {
        const waypointIndex = value;
        const routeNumber = Math.floor(waypointIndex / 2);
        const isOrigin = waypointIndex % 2 === 0;
        
        // Get waypoint from routeData if available
        const routeData = appState.routeData[routeNumber];
        const waypoint = isOrigin ? routeData?.origin : routeData?.destination;
        
        const isAnyWaypoint = 
            (waypoint && (waypoint.iata_code === 'Any' || waypoint.isAnyDestination === true || waypoint.isAnyOrigin === true)) ||
            window.preserveAnyDestination ||
            document.getElementById(`waypoint-input-${waypointIndex + 1}`)?.getAttribute('data-is-any-destination') === 'true';
        
        if (isAnyWaypoint) {
            console.log(`Preserving "Any" waypoint in route ${routeNumber}`);
            shouldContinue = false;
        }
    }

    if (shouldContinue) {
        switch (key) {
            case 'routeDirection':
                appState.routeDirection = value;
                break;

            case 'updateRouteDate':
                const { routeNumber, depart, return: returnDate } = value;
                
                // Update in routeData structure
                if (!appState.routeData[routeNumber]) {
                    appState.routeData[routeNumber] = {
                        tripType: 'oneWay',
                        travelers: 1,
                        departDate: depart,
                        returnDate: returnDate ?? null
                    };
                } else {
                    appState.routeData[routeNumber].departDate = depart || appState.routeData[routeNumber].departDate;
                    appState.routeData[routeNumber].returnDate = returnDate ?? appState.routeData[routeNumber].returnDate;
                }
                
                // Update selectedRoutes if present
                if (appState.selectedRoutes[routeNumber]) {
                    appState.selectedRoutes[routeNumber].routeDates = { 
                        depart, 
                        return: returnDate ?? null
                    };
                }
                
                // Update legacy routeDates for compatibility during transition
                appState.routeDates[routeNumber] = { 
                    depart: depart || appState.routeDates[routeNumber]?.depart, 
                    return: returnDate ?? appState.routeDates[routeNumber]?.return 
                };
                break;

            case 'tripType':
                const routeNum = value.routeNumber;
                
                // Ensure routeData exists
                if (!appState.routeData[routeNum]) {
                    appState.routeData[routeNum] = {
                        tripType: value.tripType,
                        travelers: 1,
                        departDate: null,
                        returnDate: null
                    };
                } else {
                    appState.routeData[routeNum].tripType = value.tripType;
                }
                
                // Update legacy structure
                if (!appState.routes[routeNum]) appState.routes[routeNum] = {};
                appState.routes[routeNum].tripType = value.tripType;
                break;

            case 'updateTravelers':
                if (value.routeNumber != null) {
                    const routeNum = value.routeNumber;
                    const travelers = parseInt(value.travelers);
                    
                    // Update in routeData
                    if (!appState.routeData[routeNum]) {
                        appState.routeData[routeNum] = {
                            tripType: 'oneWay',
                            travelers: travelers,
                            departDate: null,
                            returnDate: null
                        };
                    } else {
                        appState.routeData[routeNum].travelers = travelers;
                    }
                    
                    // Update legacy structure
                    if (!appState.routes[routeNum]) appState.routes[routeNum] = {};
                    appState.routes[routeNum].travelers = travelers;
                }
                shouldUpdateUrl = false;
                break;

            case 'updateWaypoint':
                if (value.index >= 0) {
                    const routeNumber = Math.floor(value.index / 2);
                    const isOrigin = value.index % 2 === 0;
                    
                    // Ensure routeData exists
                    if (!appState.routeData[routeNumber]) {
                        appState.routeData[routeNumber] = {
                            tripType: 'oneWay',
                            travelers: 1,
                            departDate: appState.routeDates[routeNumber]?.depart || null,
                            returnDate: appState.routeDates[routeNumber]?.return || null
                        };
                    }
                    
                    // Update origin or destination
                    if (isOrigin) {
                        appState.routeData[routeNumber].origin = value.data;
                    } else {
                        appState.routeData[routeNumber].destination = value.data;
                    }
                    
                    // Update legacy structure for compatibility
                    if (value.index < appState.waypoints.length) {
                        appState.waypoints[value.index] = value.data;
                    } else {
                        while (appState.waypoints.length <= value.index) {
                            appState.waypoints.push(null);
                        }
                        appState.waypoints[value.index] = value.data;
                    }
                }
                break;

            case 'addWaypoint':
                const newWaypoint = Array.isArray(value) ? value[0] : value;
                const newWaypointIndex = appState.waypoints.length;
                const newRouteNumber = Math.floor(newWaypointIndex / 2);
                const isNewOrigin = newWaypointIndex % 2 === 0;
                
                // Update in new routeData structure
                if (!appState.routeData[newRouteNumber]) {
                    appState.routeData[newRouteNumber] = {
                        tripType: 'oneWay',
                        travelers: 1,
                        departDate: appState.routeDates[newRouteNumber]?.depart || null,
                        returnDate: appState.routeDates[newRouteNumber]?.return || null
                    };
                }
                
                if (isNewOrigin) {
                    appState.routeData[newRouteNumber].origin = newWaypoint;
                } else {
                    appState.routeData[newRouteNumber].destination = newWaypoint;
                }
                
                // Update legacy structure for compatibility
                appState.waypoints.push(newWaypoint);
                appState.isEditingWaypoint = true;
                break;

            case 'removeWaypoint':
                if (value >= 0 && value < appState.waypoints.length) {
                    const routeNumber = Math.floor(value / 2);
                    const isOrigin = value % 2 === 0;
                    
                    // Update routeData structure
                    if (appState.routeData[routeNumber]) {
                        if (isOrigin) {
                            // Remove origin or set to null
                            delete appState.routeData[routeNumber].origin;
                        } else {
                            // Remove destination or set to null
                            delete appState.routeData[routeNumber].destination;
                        }
                        
                        // If both origin and destination are now gone, mark route as empty
                        if (!appState.routeData[routeNumber].origin && 
                            !appState.routeData[routeNumber].destination) {
                            appState.routeData[routeNumber] = { isEmpty: true };
                        }
                    }
                    
                    // Update legacy structure
                    appState.waypoints.splice(value, 1);
                    appState.isEditingWaypoint = false;
                }
                break;

            case 'removeWaypoints':
                const routeToRemove = value.routeNumber;
                
                // Remove from routeData 
                appState.routeData[routeToRemove] = { isEmpty: true };
                
                // Remove associated dates
                delete appState.routeDates[routeToRemove];
                
                // Update legacy structure
                appState.waypoints.splice(routeToRemove * 2, 2);
                break;

            case 'updateRoutes':
                // Update routeData structure with new routes
                value.forEach((route, index) => {
                    if (!appState.routeData[index] || appState.routeData[index].isEmpty) {
                        // Create new route data
                        appState.routeData[index] = {
                            tripType: route.tripType || 'oneWay',
                            travelers: route.travelers || 1,
                            departDate: appState.routeDates[index]?.depart || null,
                            returnDate: appState.routeDates[index]?.return || null,
                            origin: route.origin ? { iata_code: route.origin } : null,
                            destination: route.destination ? { iata_code: route.destination } : null,
                            isDirect: route.isDirect,
                            isSelected: route.isSelected,
                            price: route.price
                        };
                    } else {
                        // Update existing route
                        const existingRoute = appState.routeData[index];
                        
                        // Only update fields that were provided
                        if (route.tripType) existingRoute.tripType = route.tripType;
                        if (route.travelers) existingRoute.travelers = route.travelers;
                        if (route.origin) {
                            if (!existingRoute.origin) {
                                existingRoute.origin = { iata_code: route.origin };
                            } else {
                                existingRoute.origin.iata_code = route.origin;
                            }
                        }
                        if (route.destination) {
                            if (!existingRoute.destination) {
                                existingRoute.destination = { iata_code: route.destination };
                            } else {
                                existingRoute.destination.iata_code = route.destination;
                            }
                        }
                        existingRoute.isDirect = route.isDirect;
                        existingRoute.isSelected = route.isSelected;
                        existingRoute.price = route.price;
                    }
                });
                
                // Update legacy routes array
                appState.routes = value.map((route, index) => ({
                    ...appState.routes[index],
                    ...route,
                    travelers: route.travelers || 1,
                    tripType: route.tripType || appState.routes[index]?.tripType || 'oneWay'
                }));
                break;

            case 'clearData':
                // Clear all route-related data
                appState.routeData = [];
                appState.waypoints = [];
                appState.routes = [];
                appState.trips = [];
                appState.selectedRoutes = {};
                appState.routeDates = {};
                break;

            case 'updateSelectedRoute':
                // Store selected route
                appState.selectedRoutes[value.routeIndex] = value.routeDetails;
                
                // Update routeData as well
                if (appState.routeData[value.routeIndex]) {
                    appState.routeData[value.routeIndex].selectedRoute = value.routeDetails;
                    appState.routeData[value.routeIndex].departDate = value.routeDetails.routeDates?.depart;
                    appState.routeData[value.routeIndex].returnDate = value.routeDetails.routeDates?.return;
                }
                
                // Update legacy routeDates
                if (value.routeDetails.routeDates) {
                    appState.routeDates[value.routeIndex] = value.routeDetails.routeDates;
                }
                break;

            case 'selectedAirport':
                appState.selectedAirport = value;
                shouldUpdateUrl = false;
                break;

            case 'removeSelectedRoute':
                // Remove from selectedRoutes map
                delete appState.selectedRoutes[value];
                
                // Update routeData to reflect the removal
                if (appState.routeData[value]) {
                    delete appState.routeData[value].selectedRoute;
                }
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
    const params = new URLSearchParams();
    
    // Use an entirely URL-safe format without any characters that need encoding
    const validRoutes = appState.routeData.filter(r => r && !r.isEmpty &&
        (r.origin?.iata_code || r.destination?.iata_code));
    
    if (validRoutes.length > 0) {
        // Create a format with only alphanumeric characters, dash and tilde
        // r0-oDEN-dSYD-dd20250325~r1-oSYD-dLAX...
        const routeParts = validRoutes.map((route, index) => {
            let parts = [];
            
            // Start with route index identifier - no separator needed
            parts.push(`r${index}`);
            
            // Add origin and destination - no separators between key and value
            if (route.origin?.iata_code) 
                parts.push(`o${route.origin.iata_code}`);
            if (route.destination?.iata_code) 
                parts.push(`d${route.destination.iata_code}`);
            
            // Only add these if they have non-default values
            // For dates, remove dashes to make them more compact
            if (route.departDate) 
                parts.push(`dd${route.departDate.replace(/-/g, '')}`);
            if (route.returnDate) 
                parts.push(`rd${route.returnDate.replace(/-/g, '')}`);
            if (route.travelers && route.travelers !== 1) 
                parts.push(`t${route.travelers}`);
            if (route.tripType && route.tripType !== 'oneWay') 
                parts.push(`tt${route.tripType}`);
            
            return parts.join('-');
        }).join('~');
        
        params.set('routes', routeParts);
    } else {
        params.delete('routes');
    }
    
    // Add direction parameter if not default
    if (appState.routeDirection !== defaultDirection) {
        params.set('direction', appState.routeDirection);
    } else {
        params.delete('direction');
    }
    
    // Remove legacy parameters
    params.delete('waypoints');
    params.delete('dates');
    params.delete('types');

    const newUrl = params.toString() ? `${window.location.pathname}?${params}` : window.location.pathname;
    if (window.location.search !== `?${params}`) {
        window.history.pushState({}, '', newUrl);
    }
}

// Update the parseUrlRoutes function to handle our improved URL-safe format
function parseUrlRoutes() {
    const params = new URLSearchParams(window.location.search);
    
    // Clear existing route data
    appState.routeData = [];
    appState.waypoints = [];
    appState.routes = [];
    appState.routeDates = {};
    
    // Parse route direction if present
    if (params.has('direction')) {
        appState.routeDirection = params.get('direction');
    }
    
    // Parse routes from URL
    if (params.has('routes')) {
        try {
            // Parse our custom format: r0-oDEN-dSYD-dd20250325~r1-oSYD-dLAX...
            const routesParam = params.get('routes');
            // Split by ~ to get each route section
            const routeSections = routesParam.split('~');
            
            routeSections.forEach(section => {
                // Split by - to get properties
                const properties = section.split('-');
                
                // Initialize route data with default values
                const routeData = {
                    tripType: 'oneWay',
                    travelers: 1
                };
                
                // Get route index from first property (r0)
                let routeIndex = null;
                const indexProperty = properties.shift(); // Remove and process first item
                if (indexProperty && indexProperty.startsWith('r')) {
                    routeIndex = parseInt(indexProperty.substring(1));
                }
                
                if (routeIndex === null || isNaN(routeIndex)) {
                    console.error('Invalid route index in URL');
                    return;
                }
                
                // Process each property
                properties.forEach(prop => {
                    // Each property starts with its identifier letter(s) followed by the value
                    // Extract key and value based on known prefixes
                    let key, value;
                    
                    if (prop.startsWith('o')) {
                        key = 'o';
                        value = prop.substring(1);
                    } else if (prop.startsWith('d')) {
                        key = 'd';
                        value = prop.substring(1);
                    } else if (prop.startsWith('dd')) {
                        key = 'dd';
                        // Convert YYYYMMDD format back to YYYY-MM-DD
                        value = prop.substring(2);
                        if (value.length === 8) {
                            value = `${value.substring(0, 4)}-${value.substring(4, 6)}-${value.substring(6, 8)}`;
                        }
                    } else if (prop.startsWith('rd')) {
                        key = 'rd';
                        // Convert YYYYMMDD format back to YYYY-MM-DD
                        value = prop.substring(2);
                        if (value.length === 8) {
                            value = `${value.substring(0, 4)}-${value.substring(4, 6)}-${value.substring(6, 8)}`;
                        }
                    } else if (prop.startsWith('t')) {
                        key = 't';
                        value = prop.substring(1);
                    } else if (prop.startsWith('tt')) {
                        key = 'tt';
                        value = prop.substring(2);
                    }
                    
                    // Process the extracted key/value
                    switch (key) {
                        case 'o':
                            if (value === 'Any') {
                                routeData.origin = {
                                    iata_code: 'Any',
                                    name: 'Any Origin',
                                    city: 'Anywhere',
                                    isAnyOrigin: true,
                                    isAnyDestination: false
                                };
                            } else {
                                routeData.origin = { iata_code: value };
                            }
                            break;
                        case 'd':
                            if (value === 'Any') {
                                routeData.destination = {
                                    iata_code: 'Any',
                                    name: 'Any Destination',
                                    city: 'Anywhere',
                                    isAnyDestination: true,
                                    isAnyOrigin: false
                                };
                            } else {
                                routeData.destination = { iata_code: value };
                            }
                            break;
                        case 'dd': routeData.departDate = value; break;
                        case 'rd': routeData.returnDate = value; break;
                        case 't': routeData.travelers = parseInt(value); break;
                        case 'tt': routeData.tripType = value; break;
                    }
                });
                
                // Store in routeData array
                appState.routeData[routeIndex] = routeData;
                
                // Update legacy structures for compatibility
                // Update waypoints array
                while (appState.waypoints.length <= (routeIndex * 2 + 1)) {
                    appState.waypoints.push(null);
                }
                appState.waypoints[routeIndex * 2] = routeData.origin;
                appState.waypoints[routeIndex * 2 + 1] = routeData.destination;
                
                // Update routes array
                appState.routes[routeIndex] = {
                    tripType: routeData.tripType,
                    travelers: routeData.travelers
                };
                
                // Update route dates
                appState.routeDates[routeIndex] = {
                    depart: routeData.departDate || null,
                    return: routeData.returnDate || null
                };
            });
            
            console.log("Loaded routes from URL:", appState.routeData);
            return true;
        } catch (e) {
            console.error('Error parsing routes from URL:', e);
            return false;
        }
    }
    
    return false;
}

// Initialize from URL on page load
document.addEventListener('DOMContentLoaded', () => {
    window.isLoadingFromUrl = true;
    parseUrlRoutes();
    // Allow other modules to know we've finished loading from URL
    setTimeout(() => { window.isLoadingFromUrl = false; }, 500);
});

export { appState, updateState, updateUrl, parseUrlRoutes };