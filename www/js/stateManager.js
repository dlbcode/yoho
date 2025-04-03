const params = new URLSearchParams(window.location.search);
const defaultDirection = params.get('direction') || 'from';

const appState = {
    eurToUsd: 1.13,
    selectedAirport: null,
    travelers: 1,
    routeDirection: defaultDirection,
    // Primary source of truth - the only structure we really need
    routeData: [],
    currentView: 'trip',
    currentGroupID: 0,
    highestGroupId: 0,
    filterStates: {},
    filterThresholds: {},
    searchResultsLoading: false
};

function updateState(key, value, calledFrom) {
    console.log(`updateState called from: ${calledFrom}, key: ${key}, value:`, value);
    
    let shouldUpdateUrl = true;

    switch (key) {
        case 'routeDirection':
            appState.routeDirection = value;
            break;

        case 'updateRouteData':
            const { routeNumber, data } = value;
            
            if (!appState.routeData[routeNumber]) {
                appState.routeData[routeNumber] = {};
            }
            
            // Update the route data with the provided values
            Object.assign(appState.routeData[routeNumber], data);
            break;

        case 'removeRoute':
            const routeNumberToDelete = value.routeNumber;
            
            // Remove route from routeData
            if (appState.routeData[routeNumberToDelete]) {
                delete appState.routeData[routeNumberToDelete];
            }
            break;

        case 'clearData':
            // Clear all route-related data
            appState.routeData = [];
            break;

        case 'updateSelectedRoute':
            // Store selected route
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

    const newUrl = params.toString() ? `${window.location.pathname}?${params}` : window.location.pathname;
    const currentUrl = window.location.pathname + window.location.search;
    
    if (currentUrl !== newUrl && currentUrl !== `${newUrl}?`) {
        window.history.pushState({}, '', newUrl);
    }
}

function parseUrlRoutes() {
    const params = new URLSearchParams(window.location.search);
    // Clear existing route data
    appState.routeData = [];
    
    // Parse route direction if present
    if (params.has('direction')) {
        appState.routeDirection = params.get('direction');
    }
    
    // Parse routes from URL
    if (params.has('routes')) {
        try {
            // Parse our custom format: r0-oDEN-dSYD-dd20250325~r1-oSYD-dLAX...
            const routesParam = params.get('routes');
            
            if (!routesParam || routesParam === 'undefined' || routesParam === 'null') {
                console.warn("Empty or invalid routes parameter");
                return false;
            }
            
            // Split by ~ to get each route section
            const routeSections = routesParam.split('~');
            
            routeSections.forEach(section => {
                // Split by - to get properties
                const properties = section.split('-');
                
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
                
                // Store in routeData array - our single source of truth
                appState.routeData[routeIndex] = routeData;
            });
            
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
    const parsed = parseUrlRoutes();
    
    // If we have routes data, let's draw the routes
    if (appState.routeData.length > 0) {
        // Import routeHandling dynamically to avoid circular dependencies
        import('./routeHandling.js').then(({ routeHandling }) => {
            routeHandling.updateRoutesArray();
        });
    }
    
    // Allow other modules to know we've finished loading from URL
    setTimeout(() => { 
        window.isLoadingFromUrl = false;
    }, 100);
});

// Enhanced popstate handler to properly handle back/forward navigation
window.addEventListener('popstate', () => {
    window.isLoadingFromUrl = true;
    
    const parsed = parseUrlRoutes();
    
    // If we have routes data, update the UI
    if (appState.routeData.length > 0) {
        // Import necessary modules dynamically
        Promise.all([
            import('./routeHandling.js'),
            import('./mapHandling.js')
        ]).then(([{ routeHandling }, { mapHandling }]) => {
            mapHandling.updateMarkerIcons();
            routeHandling.updateRoutesArray();
            
            // Dispatch custom event for other modules to react to
            document.dispatchEvent(new CustomEvent('stateChange', { 
                detail: { key: 'urlChanged', value: location.href } 
            }));
        });
    }
    
    // Reset the flag after a reasonable delay
    setTimeout(() => { 
        window.isLoadingFromUrl = false;
    }, 1000);
});

export { appState, updateState, updateUrl, parseUrlRoutes };