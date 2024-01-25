import { map } from './map.js';
import { appState, updateState } from './stateManager.js';

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

                // Function to handle mouseover event
                const onMouseOver = (e) => {
                    geodesicLine.setStyle({ color: 'white' });
                    L.popup()
                        .setLatLng(e.latlng)
                        .setContent(`${destination.city}<br><strong>Price: $${route.price}</strong>`)
                        .openOn(map);
                };

                // Function to handle mouseout event
                const onMouseOut = () => {
                    geodesicLine.setStyle({ color: this.getColorBasedOnPrice(route.price) });
                    map.closePopup();
                };

                // Function to handle click event
                const onClick = () => {
                    updateState('addWaypoint', destination);
                    map.closePopup();
                };

                // Attach event handlers to both visible and invisible lines
                geodesicLine.on('mouseover', onMouseOver);
                geodesicLine.on('mouseout', onMouseOut);
                geodesicLine.on('click', onClick);
                invisibleLine.on('mouseover', onMouseOver);
                invisibleLine.on('mouseout', onMouseOut);
                invisibleLine.on('click', onClick);

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

    drawLines() {
        // Iterate through the routes in appState.routes
        appState.routes.forEach(route => {
            // Determine the origin and destination based on routeDirection
            const origin = appState.routeDirection === 'to' ? route.destinationAirport : route.originAirport;
            const destination = appState.routeDirection === 'to' ? route.originAirport : route.destinationAirport;
    
            // Draw the route path
            if (route.isDirect) {
                this.createRoutePath(origin, destination, route);
            } else {
                this.drawDashedLine(origin, destination);
            }
        });
    
        // Additional logic if needed for selectedAirport
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
