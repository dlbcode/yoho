import { map } from './map.js';
import { appState } from './stateManager.js';

const pathDrawing = {
    currentLines: [],
    routePathCache: {},

    drawRoutePaths(iata, directRoutes) {
        let cacheKey = appState.routePathToggle + '_' + iata;
        if (this.routePathCache[cacheKey]) {
            this.routePathCache[cacheKey].forEach(path => {
                if (!map.hasLayer(path)) {
                    path.addTo(map);
                }
            });
        } else {
            this.drawRoutePathsGeneric(iata, directRoutes, appState.routePathToggle);
        }
    },
    
    drawRoutePathsGeneric(iata, directRoutes, direction) {
        const routes = direction === 'to' ? directRoutes[iata] || [] : Object.values(directRoutes).flat();
        routes.forEach(route => {
            if (direction === 'from' && route.originAirport.iata_code !== iata) return;
            this.drawPaths(route);
        });
    },
    
    async drawRoutePathBetweenAirports(route) {
        if (!route || !Array.isArray(route.segmentCosts)) {
            console.error('Invalid route data:', route);
            return;
        }
    
        try {
            for (const segment of route.segmentCosts) {
                const [originAirport, destinationAirport] = await Promise.all([
                    getAirportDataByIata(segment.from), getAirportDataByIata(segment.to)
                ]);
            }

        } catch (error) {
            console.error('Error in drawRoutePathBetweenAirports:', error);
        }
    },

    drawDashedLine(originAirport, destinationAirport) {
        const worldCopies = [-720, -360, 0, 360, 720];
        worldCopies.forEach(offset => {
            const adjustedOrigin = L.latLng(originAirport.latitude, originAirport.longitude + offset);
            const adjustedDestination = L.latLng(destinationAirport.latitude, destinationAirport.longitude + offset);
            const geodesicLine = new L.Geodesic([adjustedOrigin, adjustedDestination], {
                weight: 2, opacity: 0.5, color: 'white', dashArray: '5, 10', wrap: false
            }).addTo(map);
            this.currentLines.push(geodesicLine);
        });
    },  

    adjustLatLng(latLng) {
        var currentBounds = map.getBounds();
        var newLng = latLng.lng;

        while (newLng < currentBounds.getWest()) newLng += 360;
        while (newLng > currentBounds.getEast()) newLng -= 360;

        return L.latLng(latLng.lat, newLng);
    },
    
    createRoutePath(origin, destination, route) {
        let routeId = `${route.originAirport.iata_code}-${route.destinationAirport.iata_code}`;
    
        const addDecoratedLine = (geodesicLine) => { // Function to create and add a decorated line
            var planeIcon = L.icon({
                iconUrl: '../assets/plane_icon.png', // Adjust the path as needed
                iconSize: [16, 16],
                iconAnchor: [8, 12]
            });
    
            var planeSymbol = L.Symbol.marker({
                rotate: true,
                markerOptions: {
                    icon: planeIcon
                }
            });
    
            var decoratedLine = L.polylineDecorator(geodesicLine, {
                patterns: [
                    {offset: '50%', repeat: 0, symbol: planeSymbol}
                ]
            }).addTo(map);
    
            return decoratedLine;
        };
    
        if (this.routePathCache[routeId]) { // Check if the route is in the cache
            this.routePathCache[routeId].forEach(path => { // Add each path in the cache to the map if it's not already there
                if (!map.hasLayer(path)) {
                    path.addTo(map);
                }
            });
    
            if (route.isDirect && this.routePathCache[routeId].length === 1) { // If the route is direct and not already decorated, add a decorated line
                let decoratedLine = addDecoratedLine(this.routePathCache[routeId][0]);
                this.routePathCache[routeId].push(decoratedLine);
            }
        } else { // Create and draw the geodesic line
            const adjustedOrigin = L.latLng(origin.latitude, origin.longitude);
            const adjustedDestination = L.latLng(destination.latitude, destination.longitude);
    
            var geodesicLine = new L.Geodesic([adjustedOrigin, adjustedDestination], {
                weight: 1,
                opacity: 1,
                color: this.getColorBasedOnPrice(route.price),
                wrap: false,
                zIndex: -1
            }).addTo(map);
    
            let newPaths = [geodesicLine]; // Store the newly created geodesic line
    
            if (route.isDirect) { // Add the decorated line for direct routes
                let decoratedLine = addDecoratedLine(geodesicLine);
                newPaths.push(decoratedLine);
            }
    
            this.routePathCache[routeId] = newPaths; // Add the newly created line(s) to the routePathCache
        }
    },             

    drawLines() { // Iterate through each pair of consecutive waypoints
        for (let i = 0; i < appState.waypoints.length - 1; i++) {
            const origin = appState.waypoints[i];
            const destination = appState.waypoints[i + 1];
    
            const route = appState.routes.find(route => // Check if there is a route between the origin and destination
                route.originAirport.iata_code === origin.iata_code && 
                route.destinationAirport.iata_code === destination.iata_code
            );
    
            if (route) {
                if (route.isDirect) { // Draw a regular line for direct routes
                    pathDrawing.createRoutePath(origin, destination, route);
                } else { // Draw a dashed line for non-direct routes
                    pathDrawing.drawDashedLine(origin, destination);
                }
            }
        }
    },        
    
    drawPaths(route) {
        this.createRoutePath(route.originAirport, route.destinationAirport, route, 0);
    },       

    getColorBasedOnPrice(price) {
        if (price === null || price === undefined || isNaN(parseFloat(price))) {
            return 'grey';
        }
        price = parseFloat(price);
        return price < 100 ? '#0099ff' : price < 200 ? 'green' : price < 300 ? '#abb740' : price < 400 ? 'orange' : price < 500 ? '#da4500' : '#c32929';
    },
        
    clearLines() {
        [...this.currentLines, ...Object.values(this.routePathCache).flat()].forEach(line => {
            if (map.hasLayer(line)) {
                map.removeLayer(line);
            }
        });
        this.currentLines = [];
    },
};

export { pathDrawing };
