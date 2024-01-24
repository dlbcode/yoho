import { map } from './map.js';
import { appState } from './stateManager.js';

const pathDrawing = {
    currentLines: [],
    invisibleLines: [],
    routePathCache: [],
    dashedRoutePathCache: [],

    drawRoutePaths(iata, directRoutes) {
        let cacheKey = appState.routeDirection + '_' + iata;
        if (this.routePathCache[cacheKey]) {
            this.routePathCache[cacheKey].forEach(path => {
                if (!map.hasLayer(path)) {
                    path.addTo(map);
                }
            });
        } else {
            this.drawRoutePathsGeneric(iata, directRoutes, appState.routeDirection);
        }
    },
    
    drawRoutePathsGeneric(iata, directRoutes, direction) {
        const routes = directRoutes[iata] || [];
        routes.forEach(route => {
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
        const worldCopies = [-720, -360, 0, 360, 720]; // Define world copies
        worldCopies.forEach(offset => {
            const adjustedOrigin = L.latLng(originAirport.latitude, originAirport.longitude + offset);
            const adjustedDestination = L.latLng(destinationAirport.latitude, destinationAirport.longitude + offset);
            const geodesicLine = new L.Geodesic([adjustedOrigin, adjustedDestination], {
                weight: 2, opacity: 1.0, color: 'grey', dashArray: '5, 10', wrap: false
            }).addTo(map);
    
            const routeId = `${originAirport.iata_code}-${destinationAirport.iata_code}`;
            this.dashedRoutePathCache[routeId] = this.dashedRoutePathCache[routeId] || [];
            this.dashedRoutePathCache[routeId].push(geodesicLine);
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
        let newPaths = [];
    
        if (this.routePathCache[routeId]) {
            this.routePathCache[routeId].forEach(path => {
                if (!map.hasLayer(path)) {
                    path.addTo(map);
                }
                newPaths.push(path);
            });
        } else {
            const worldCopies = [-720, -360, 0, 360, 720];
            worldCopies.forEach(offset => {
                const adjustedOrigin = L.latLng(origin.latitude, origin.longitude + offset);
                const adjustedDestination = L.latLng(destination.latitude, destination.longitude + offset);
    
                var geodesicLine = new L.Geodesic([adjustedOrigin, adjustedDestination], {
                    weight: 1,
                    opacity: 1,
                    color: this.getColorBasedOnPrice(route.price),
                    wrap: false,
                    zIndex: -1
                }).addTo(map);
    
                // Create an invisible, wider line for hover interactions
                var invisibleLine = new L.Geodesic([adjustedOrigin, adjustedDestination], {
                    weight: 10, // Wider line for easier hovering
                    opacity: 0, // Make the line invisible
                    wrap: false
                }).addTo(map);
    
                // Attach the same event handlers to the invisible line
                invisibleLine.on('mouseover', (e) => {
                    L.popup()
                        .setLatLng(e.latlng)
                        .setContent(`Price: $${route.price}`)
                        .openOn(map);
                });
                invisibleLine.on('mouseout', () => {
                    map.closePopup();
                });
    
                newPaths.push(geodesicLine);
                this.invisibleLines.push(invisibleLine); // Track the invisible line
            });
            this.routePathCache[routeId] = newPaths;
        }
    
        // Check if the route is direct and currently exists in appState.routes
        const routeExists = appState.routes.some(r => 
            r.origin === route.originAirport.iata_code &&
            r.destination === route.destinationAirport.iata_code
        );
    
        if (route.isDirect && routeExists) {
            newPaths.forEach(path => {
                let decoratedLine = this.addDecoratedLine(path, route);
                this.currentLines.push(decoratedLine);
            });
        }
    },       
    
    addDecoratedLine(geodesicLine, route) {
        var planeIcon = L.icon({
            iconUrl: '../assets/plane_icon.png',
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
    
        // Add mouseover event listener to the planeSymbol
        decoratedLine.on('mouseover', (e) => {
            L.popup()
            .setLatLng(e.latlng)
            .setContent(`Price: $${route.price}`)
            .openOn(map);
        });
    
        // Add mouseout event listener to close the popup
        decoratedLine.on('mouseout', () => {
            map.closePopup();
        });

        this.currentLines.push(decoratedLine); // Track the decorated line for later removal
        return decoratedLine;
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
        if (appState.selectedAirport) {
            this.drawRoutePaths(appState.selectedAirport.iata_code, appState.directRoutes, appState.routeDirection);
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
        // Clearing regular and dashed route paths
        [...Object.values(this.routePathCache).flat(), 
         ...Object.values(this.dashedRoutePathCache).flat()].forEach(line => {
            if (map.hasLayer(line)) {
                map.removeLayer(line);
            }
        });
    
        // Clearing current lines (decorated lines)
        this.currentLines.forEach(decoratedLine => {
            if (map.hasLayer(decoratedLine)) {
                map.removeLayer(decoratedLine);
            }
        });
    
        // Clearing invisible lines for hover interactions
        this.invisibleLines.forEach(invisibleLine => {
            if (map.hasLayer(invisibleLine)) {
                map.removeLayer(invisibleLine);
            }
        });
    
        // Resetting caches and current lines array
        this.routePathCache = {};
        this.dashedRoutePathCache = {};
        this.currentLines = [];
        this.invisibleLines = []; // Resetting invisible lines array
    },    
            
};

export { pathDrawing };
