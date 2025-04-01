const params = new URLSearchParams(window.location.search);
const defaultDirection = params.get('direction') || 'from';

const appState = {
    eurToUsd: 1.13,
    selectedAirport: null,
    travelers: 1,
    routeDirection: defaultDirection,
    // Primary source of truth
    routeData: [],
    // Legacy arrays - maintained with minimal data for compatibility
    waypoints: [],  // Keep but minimize synchronization
    routes: [],     // Keep but minimize synchronization
    trips: [],      // Keep but minimize synchronization
    directRoutes: {},
    selectedRoutes: {},
    tripTableData: null,
    routeDecksData: {},
    currentView: 'trip',
    currentGroupID: 0,
    highestGroupId: 0,
    routeDates: {}, // To be phased out - dates are now in routeData
    filterStates: {},
    filterThresholds: {},
};

function updateState(key, value, calledFrom) {
    console.log(`updateState called from: ${calledFrom}, key: ${key}, value:`, value);
    
    let shouldUpdateUrl = true;
    let shouldContinue = true;

    // Special handling for waypoint removal
    if (key === 'removeWaypoint') {
        // Simplified check directly using routeData
        const waypointIndex = value;
        const routeNumber = Math.floor(waypointIndex / 2);
        const isOrigin = waypointIndex % 2 === 0;
        
        // Check directly in routeData first - this is more reliable
        const routeData = appState.routeData[routeNumber];
        const waypoint = isOrigin ? routeData?.origin : routeData?.destination;
        
        const isAnyWaypoint = 
            (waypoint && (waypoint.iata_code === 'Any' || waypoint.isAnyDestination === true || waypoint.isAnyOrigin === true)) ||
            window.preserveAnyDestination;
        
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
                const { routeNumber: dateRouteNumber, depart, return: returnDate } = value;
                
                // Update in routeData structure
                if (!appState.routeData[dateRouteNumber]) {
                    appState.routeData[dateRouteNumber] = {
                        tripType: 'oneWay',
                        travelers: 1,
                        departDate: depart,
                        returnDate: returnDate ?? null
                    };
                } else {
                    appState.routeData[dateRouteNumber].departDate = depart || appState.routeData[dateRouteNumber].departDate;
                    appState.routeData[dateRouteNumber].returnDate = returnDate ?? appState.routeData[dateRouteNumber].returnDate;
                }
                
                // Update selectedRoutes if present
                if (appState.selectedRoutes[dateRouteNumber]) {
                    appState.selectedRoutes[dateRouteNumber].routeDates = { 
                        depart, 
                        return: returnDate ?? null
                    };
                }
                
                // Minimal legacy update - only if routeDates already exists for this route
                if (appState.routeDates[dateRouteNumber]) {
                    appState.routeDates[dateRouteNumber] = { 
                        depart: depart || appState.routeDates[dateRouteNumber]?.depart, 
                        return: returnDate ?? appState.routeDates[dateRouteNumber]?.return 
                    };
                }
                break;

            case 'tripType':
            case 'updateTravelers':
                const routeNum = key === 'tripType' ? value.routeNumber : value.routeNumber;
                const attrName = key === 'tripType' ? 'tripType' : 'travelers';
                const attrValue = key === 'tripType' ? value.tripType : parseInt(value.travelers);
                
                // Ensure routeData exists
                if (!appState.routeData[routeNum]) {
                    appState.routeData[routeNum] = {
                        tripType: key === 'tripType' ? attrValue : 'oneWay',
                        travelers: key === 'updateTravelers' ? attrValue : 1,
                        departDate: null,
                        returnDate: null
                    };
                } else {
                    appState.routeData[routeNum][attrName] = attrValue;
                }
                
                // Only update URL for tripType changes
                if (key === 'updateTravelers') {
                    shouldUpdateUrl = false;
                }
                break;

            case 'updateWaypoint':
                if (value.index >= 0) {
                    const routeNumber = Math.floor(value.index / 2);
                    const isOrigin = value.index % 2 === 0;
                    
                    // Ensure routeData exists - this is our source of truth
                    if (!appState.routeData[routeNumber]) {
                        appState.routeData[routeNumber] = {
                            tripType: 'oneWay',
                            travelers: 1,
                            departDate: appState.routeDates[routeNumber]?.depart || null,
                            returnDate: appState.routeDates[routeNumber]?.return || null
                        };
                    }
                    
                    // Update origin or destination in routeData
                    if (isOrigin) {
                        appState.routeData[routeNumber].origin = value.data;
                    } else {
                        appState.routeData[routeNumber].destination = value.data;
                    }
                }
                break;

            case 'addWaypoint':
                const newWaypoint = Array.isArray(value) ? value[0] : value;
                const newWaypointIndex = appState.waypoints.length;
                const newRouteNumber = Math.floor(newWaypointIndex / 2);
                const isNewOrigin = newWaypointIndex % 2 === 0;
                
                // Update in routeData structure - our primary source of truth
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
                
                appState.isEditingWaypoint = true;
                break;

            case 'removeWaypoint':
                if (value >= 0) {
                    const routeNumber = Math.floor(value / 2);
                    const isOrigin = value % 2 === 0;
                    
                    // Update routeData structure first
                    if (appState.routeData[routeNumber]) {
                        if (isOrigin) {
                            // Remove origin
                            delete appState.routeData[routeNumber].origin;
                        } else {
                            // Remove destination
                            delete appState.routeData[routeNumber].destination;
                        }
                        
                        // If both origin and destination are now gone, mark route as empty
                        if (!appState.routeData[routeNumber].origin && 
                            !appState.routeData[routeNumber].destination) {
                            appState.routeData[routeNumber] = { isEmpty: true };
                        }
                    }
                }
                break;

            case 'removeWaypoints':
                const routeToRemove = value.routeNumber;
                
                // Remove route from routeData completely
                delete appState.routeData[routeToRemove];
                
                // Remove associated dates
                delete appState.routeDates[routeToRemove];
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
                
                // Minimal update to legacy routes array
                appState.routes = value;
                break;

            case 'updateRouteData':
                const { routeNumber, data } = value;
                
                // Create or update route data
                if (!appState.routeData[routeNumber]) {
                    appState.routeData[routeNumber] = {
                        tripType: 'oneWay',
                        travelers: 1,
                        departDate: null,
                        returnDate: null,
                        ...data
                    };
                } else {
                    // Update existing route with new data
                    appState.routeData[routeNumber] = {
                        ...appState.routeData[routeNumber],
                        ...data
                    };
                    
                    // If data is empty or has isEmpty flag, mark as empty
                    if (data.isEmpty) {
                        appState.routeData[routeNumber] = { isEmpty: true };
                    }
                }
                break;

            case 'removeRoute':
                const routeNumberToDelete = value.routeNumber;
                
                // Remove route from routeData
                if (appState.routeData[routeNumberToDelete]) {
                    delete appState.routeData[routeNumberToDelete];
                }
                
                // Remove associated dates
                delete appState.routeDates[routeNumberToDelete];
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
    const validRoutes = appState.routeData.filter(r => r && !r.isEmpty);
    
    if (validRoutes.length > 0) {
        // Create a format with only alphanumeric characters, dash and tilde
        // r0-oDEN-dSYD-dd20250325~r1-oSYD-dLAX...
        const routeParts = validRoutes.map((route, index) => {
            let parts = [];
            
            // Start with route index identifier - no separator needed
            parts.push(`r${index}`);
            
            // Important: Only include waypoints that actually have a valid IATA code
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
    const currentUrl = window.location.pathname + window.location.search;
    
    if (currentUrl !== newUrl && currentUrl !== `${newUrl}?`) {
        console.log("Updating URL from:", currentUrl);
        console.log("Updating URL to:", newUrl);
        console.log("Route data being used:", validRoutes);
        window.history.pushState({}, '', newUrl);
    }
}

// Update the parseUrlRoutes function to handle our improved URL-safe format
function parseUrlRoutes() {
    const params = new URLSearchParams(window.location.search);
    console.log("Parsing URL routes:", params.toString());
    
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
            console.log("Routes param:", routesParam);
            
            if (!routesParam || routesParam === 'undefined' || routesParam === 'null') {
                console.warn("Empty or invalid routes parameter");
                return false;
            }
            
            // Split by ~ to get each route section
            const routeSections = routesParam.split('~');
            console.log("Route sections:", routeSections);
            
            routeSections.forEach(section => {
                // Split by - to get properties
                const properties = section.split('-');
                console.log("Processing section properties:", properties);
                
                if (properties.length < 2) {
                    console.warn("Invalid route section, not enough properties:", section);
                    return; // Skip this invalid section
                }
                
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
                    console.error('Invalid route index in URL:', indexProperty);
                    return;
                }
                
                console.log(`Processing route ${routeIndex} with properties:`, properties);
                
                // Process each property
                properties.forEach(prop => {
                    // Each property starts with its identifier letter(s) followed by the value
                    if (!prop || prop.length < 2) {
                        console.warn("Skipping invalid property:", prop);
                        return;
                    }
                    
                    let key, value;
                    
                    // More robust property parsing based on the first character(s)
                    if (prop.startsWith('o')) {
                        key = 'o';
                        value = prop.substring(1);
                    } else if (prop.startsWith('d')) {
                        // Special handling for 'd' vs 'dd'
                        if (prop.startsWith('dd')) {
                            key = 'dd';
                            // Convert YYYYMMDD format back to YYYY-MM-DD
                            value = prop.substring(2);
                            if (value.length === 8) {
                                value = `${value.substring(0, 4)}-${value.substring(4, 6)}-${value.substring(6, 8)}`;
                            }
                        } else {
                            key = 'd';
                            value = prop.substring(1);
                        }
                    } else if (prop.startsWith('rd')) {
                        key = 'rd';
                        // Convert YYYYMMDD format back to YYYY-MM-DD
                        value = prop.substring(2);
                        if (value.length === 8) {
                            value = `${value.substring(0, 4)}-${value.substring(4, 6)}-${value.substring(6, 8)}`;
                        }
                    } else if (prop.startsWith('tt')) {
                        key = 'tt';
                        value = prop.substring(2);
                    } else if (prop.startsWith('t')) {
                        key = 't';
                        value = prop.substring(1);
                    } else {
                        console.warn("Unknown property type:", prop);
                        return;
                    }
                    
                    console.log(`Parsed property: ${key}=${value}`);
                    
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
                
                console.log(`Final route ${routeIndex} data:`, routeData);
                
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
            console.log("Updated waypoints:", appState.waypoints);
            return true;
        } catch (e) {
            console.error('Error parsing routes from URL:', e);
            return false;
        }
    } else {
        console.log("No routes parameter in URL");
    }
    
    return false;
}

// Initialize from URL on page load
document.addEventListener('DOMContentLoaded', () => {
    window.isLoadingFromUrl = true;
    
    console.log("DOM Content Loaded - Parsing URL routes");
    const parsed = parseUrlRoutes();
    console.log("URL routes parsed:", parsed);
    
    // If we have routes data, let's draw the routes
    if (appState.routeData.length > 0) {
        console.log("Updating routes array from DOM Content Loaded");
        
        // Allow modules to load before updating routes
        setTimeout(() => {
            // Import routeHandling dynamically to avoid circular dependencies
            import('./routeHandling.js').then(({ routeHandling }) => {
                routeHandling.updateRoutesArray();
                console.log("Routes updated from URL data");
            });
        }, 500);
    }
    
    // Allow other modules to know we've finished loading from URL
    setTimeout(() => { 
        window.isLoadingFromUrl = false;
        console.log("URL loading complete");
    }, 800);
});

// Enhanced popstate handler to properly handle back/forward navigation
window.addEventListener('popstate', () => {
    console.log("Navigation detected - Parsing URL routes");
    window.isLoadingFromUrl = true;
    
    const parsed = parseUrlRoutes();
    console.log("URL routes parsed on navigation:", parsed);
    
    // If we have routes data, update the UI
    if (appState.routeData.length > 0) {
        // Import necessary modules dynamically
        Promise.all([
            import('./routeHandling.js'),
            import('./mapHandling.js')
        ]).then(([{ routeHandling }, { mapHandling }]) => {
            mapHandling.updateMarkerIcons();
            routeHandling.updateRoutesArray();
            console.log("Routes updated from navigation");
            
            // Dispatch custom event for other modules to react to
            document.dispatchEvent(new CustomEvent('stateChange', { 
                detail: { key: 'urlChanged', value: location.href } 
            }));
        });
    }
    
    // Reset the flag after a reasonable delay
    setTimeout(() => { 
        window.isLoadingFromUrl = false;
        console.log("Navigation loading complete");
    }, 1000);
});

export { appState, updateState, updateUrl, parseUrlRoutes };