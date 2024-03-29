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
    
    drawPathBetweenAirports: async function(originIata, destinationIata, getAirportDataByIata) {
        try {
            const originAirportData = await getAirportDataByIata(originIata);
            const destinationAirportData = await getAirportDataByIata(destinationIata);
    
            if (!originAirportData || !destinationAirportData) {
                console.error('Airport data not found for one or both IATAs:', originIata, destinationIata);
                return;
            }
    
            this.createRoutePath(originAirportData, destinationAirportData, {
                originAirport: originAirportData,
                destinationAirport: destinationAirportData,
            }, 'white');
        } catch (error) {
            console.error('Error drawing path between airports:', error);
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
    
    createRoutePath(origin, destination, route, lineColor = null, forTable = false) {
        if (!route || !route.originAirport || !route.destinationAirport || 
            typeof route.originAirport.iata_code === 'undefined' || 
            typeof route.destinationAirport.iata_code === 'undefined') {
            console.error('Invalid route data:', route);
            return route; // Return route data early in case of error
        }

        this.routeLines = this.routeLines || [];
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
                    color: lineColor || this.getColorBasedOnPrice(route.price),
                    wrap: false,
                    zIndex: -1
                }).addTo(map);
                geodesicLine.forTable = forTable; // Set the forTable flag
    
                // Create an invisible, wider line for hover interactions
                var invisibleLine = new L.Geodesic([adjustedOrigin, adjustedDestination], {
                    weight: 10, // Wider line for easier hovering
                    opacity: 0, // Make the line invisible
                    wrap: false
                }).addTo(map);
                invisibleLine.forTable = forTable; 

                // Function to handle mouseover event
                const onMouseOver = (e) => {
                    geodesicLine.setStyle({ color: 'white' });
                    route.price = Math.round(route.price);
                    L.popup()
                        .setLatLng(e.latlng)
                        .setContent(`${destination.city}<br><strong><span style="color: #ccc; font-size: 14px">$${route.price}</span></strong>`)
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
            if (forTable) {
                // If forTable is true, add to routeLines instead of invisibleLines
                this.routeLines.push(geodesicLine);
            } else {
                this.invisibleLines.push(invisibleLine); // Continue tracking the invisible line as before
            }
        });
        this.routePathCache[routeId] = newPaths;
    }

    // Direct route and existence check logic remains unchanged
    const routeExists = appState.routes.some(r => 
        r.origin === route.originAirport.iata_code &&
        r.destination === route.destinationAirport.iata_code
    );

    if (route.isDirect && routeExists) {
        newPaths.forEach(path => {
            let decoratedLine = this.addDecoratedLine(path, route);
            // Decide where to add the decorated line based on forTable flag
            if (forTable) {
                this.routeLines.push(decoratedLine);
            } else {
                this.currentLines.push(decoratedLine);
            }
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
        this.clearLines();

        appState.routes.forEach(route => {
            if (route.isDirect) {
                this.createRoutePath(route.originAirport, route.destinationAirport, route);
            } else {
                this.drawDashedLine(route.originAirport, route.destinationAirport);
            }
        });

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
     
    clearLines(all = false) {
        // Only remove lines from the map without clearing the caches
        [...Object.values(this.routePathCache).flat(), 
         ...Object.values(this.dashedRoutePathCache).flat(),
         ...this.currentLines,
         ...this.invisibleLines].forEach(line => {
            if (!line.forTable && map.hasLayer(line)) {
                map.removeLayer(line);
            }
        });  
        // Reset currentLines and invisibleLines arrays, but keep the cache intact
        this.currentLines.length = 0;
        this.invisibleLines.length = 0;
    
        // Note: routeLines are intentionally not cleared
        // if all is true, clear routeLines as well
        if (all) {
            this.routeLines.length = 0;
        }
    }     
};

export { pathDrawing };
