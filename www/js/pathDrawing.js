import { map } from './map.js';
import { appState, updateState } from './stateManager.js';
import { flightMap } from './flightMap.js';

const pathDrawing = {
    currentLines: [],
    invisibleLines: [],
    invisibleRouteLines: [],
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
    
    createRoutePath(origin, destination, route, lineColor = null, routeLineId) {
        let routeData = route;
    
        // Convert appState.selectedRoutes to an array if it's in object form
        let selectedRoutesArray = Array.isArray(appState.selectedRoutes) 
            ? appState.selectedRoutes 
            : Object.values(appState.selectedRoutes);
    
        // Find a matching selectedRoute based on IATA codes
        const selectedRoute = selectedRoutesArray.find(sr => 
            sr.fullData.flyFrom === route.originAirport.iata_code && 
            sr.fullData.flyTo === route.destinationAirport.iata_code
        );
    
        // If a selectedRoute is found, override the routeData with selectedRoute data
        if (selectedRoute) {
            routeData = {
                ...route,
                originAirport: { iata_code: selectedRoute.fullData.flyFrom, ...route.originAirport },
                destinationAirport: { iata_code: selectedRoute.fullData.flyTo, ...route.destinationAirport },
                price: parseFloat(selectedRoute.displayData.price.replace('$', '')) // Convert price to number
            };
        }
    
        // Ensure valid route data is present
        if (!routeData || !routeData.originAirport || !routeData.destinationAirport || 
            typeof routeData.originAirport.iata_code === 'undefined' || 
            typeof routeData.destinationAirport.iata_code === 'undefined') {
            console.error('Invalid route data:', routeData);
            return; // Exit early in case of invalid data
        }
    
        // Use the routeId for caching and checking existing paths
        this.routeLines = this.routeLines || [];
        let routeId = `${routeData.originAirport.iata_code}-${routeData.destinationAirport.iata_code}`;
        let newPaths = [];
    
        // Check cache before drawing new paths
        if (this.routePathCache[routeId]) {
            this.routePathCache[routeId].forEach(path => {
                if (!map.hasLayer(path)) {
                    path.addTo(map);
                }
                newPaths.push(path);
            });
        } else {
            // Draw new paths if not cached
            const worldCopies = [-720, -360, 0, 360, 720];
            worldCopies.forEach(offset => {
                const adjustedOrigin = L.latLng(origin.latitude, origin.longitude + offset);
                const adjustedDestination = L.latLng(destination.latitude, destination.longitude + offset);
    
                // Determine line color based on price, using selectedRoute data if available
                const determinedLineColor = lineColor || this.getColorBasedOnPrice(routeData.price);
    
                var geodesicLine = new L.Geodesic([adjustedOrigin, adjustedDestination], {
                    weight: 1,
                    opacity: 1,
                    color: determinedLineColor,
                    wrap: false,
                    zIndex: -1
                }).addTo(map);
                geodesicLine.routeLineId = routeLineId;
                geodesicLine.originalColor = determinedLineColor;
    
                // Create an invisible, wider line for hover interactions
                var invisibleLine = new L.Geodesic([adjustedOrigin, adjustedDestination], {
                    weight: 10, // Wider line for easier hovering
                    opacity: 0, // Make the line invisible
                    wrap: false
                }).addTo(map);
                invisibleLine.routeLineId = routeLineId;

                const onMouseOver = (e) => {
                    geodesicLine.originalColor = geodesicLine.options.color;``
                    geodesicLine.setStyle({ color: 'white' });
                    let displayPrice = Math.round(routeData.price); // Ensure routeData is used
                    L.popup()
                        .setLatLng(e.latlng)
                        .setContent(`${destination.city}<br><strong><span style="color: #ccc; font-size: 14px">$${displayPrice}</span></strong>`)
                        .openOn(map);
                };

                const onMouseOut = () => {
                    geodesicLine.setStyle({ color: geodesicLine.originalColor }); // Restore the original color
                    map.closePopup();
                };

                const onClick = () => {
                    updateState('addWaypoint', destination);
                    map.closePopup();
                };

                const onRouteLineClick = () => {
                    document.querySelectorAll('.route-info-table tbody tr').forEach(row => {
                        const isMatchingRow = row.dataset.routeId === routeLineId;
                        row.classList.toggle('selected', isMatchingRow);
                
                        if (isMatchingRow) {
                            row.scrollIntoView({
                                behavior: 'smooth', // Smooth scroll
                                block: 'nearest',   // Vertical alignment; 'nearest' for minimal scrolling
                                inline: 'start'     // Horizontal alignment
                            });
                        }
                    });
                    updateState('removeRouteLine', routeLineId);
                };

                // Attach common event handlers to both lines
                [geodesicLine, invisibleLine].forEach(line => {
                    line.on('mouseover', onMouseOver).on('mouseout', onMouseOut);
                    // Attach the appropriate click handler based on routeLineId
                    line.on('click', routeLineId ? onRouteLineClick : onClick);
                });

                if (routeLineId) {
                    appState.routeLines.push(geodesicLine);
                    appState.invisibleRouteLines.push(invisibleLine);
                } else {
                    newPaths.push(geodesicLine);
                    this.invisibleLines.push(invisibleLine);
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
                if (routeLineId) {
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
    
        // Clearing invisible lines associated with table entries
        if (all) {
            appState.routeLines.forEach(line => {
                if (map.hasLayer(line)) {
                    map.removeLayer(line);
                }
            });
            appState.invisibleRouteLines.forEach(invisibleLine => {
                if (map.hasLayer(invisibleLine)) {
                    map.removeLayer(invisibleLine);
                }
            });
        }
    
        // Resetting caches and current lines array
        this.routePathCache = {};
        this.dashedRoutePathCache = {};
        this.currentLines = [];
        this.invisibleLines = []; // Resetting invisible lines array
        this.invisibleRouteLines = []; // Resetting invisible route lines array for table
    },    
    
    drawRouteLines: async function() {
        const rows = document.querySelectorAll('.route-info-table tbody tr');
        let minPrice = Infinity, maxPrice = -Infinity;
    
        // First, determine the min and max prices
        rows.forEach(row => {
            if (row.style.display !== 'none') {
                const priceText = row.cells[2].textContent.trim();
                const price = parseFloat(priceText.replace('$', ''));
                if (price < minPrice) minPrice = price;
                if (price > maxPrice) maxPrice = price;
            }
        });
    
        const priceRange = maxPrice - minPrice;
        const quartile = priceRange / 4;
    
        // Function to determine color based on price
        const getColorForPrice = (price) => {
            const relativePrice = price - minPrice;
            if (relativePrice <= quartile) return 'green';
            if (relativePrice <= quartile * 2) return 'yellow';
            if (relativePrice <= quartile * 3) return 'orange';
            return 'red';
        };
    
        for (const row of rows) {
            if (row.style.display === 'none') continue;
    
            const routeLineId = row.getAttribute('data-route-id'); // Get the routeLineId from the row
            const routeString = row.cells[row.cells.length - 1].textContent.trim();
            const iataCodes = routeString.split(' > ');
            if (iataCodes.length < 2) continue;
    
            const priceText = row.cells[2].textContent.trim();
            const price = parseFloat(priceText.replace('$', ''));
            const color = getColorForPrice(price);
    
            for (let i = 0; i < iataCodes.length - 1; i++) {
                const originIata = iataCodes[i];
                const destinationIata = iataCodes[i + 1];
    
                try {
                    const originAirportData = await flightMap.getAirportDataByIata(originIata);
                    const destinationAirportData = await flightMap.getAirportDataByIata(destinationIata);
                    if (!originAirportData || !destinationAirportData) continue;
    
                    // Pass the routeLineId to createRoutePath
                    pathDrawing.createRoutePath(originAirportData, destinationAirportData, {
                        originAirport: originAirportData,
                        destinationAirport: destinationAirportData,
                        price: price, // Pass the parsed numeric price
                    }, color, routeLineId); // Pass the determined color and routeLineId
                } catch (error) {
                    console.error('Error fetching airport data for segment:', error);
                }
            }
        }
    }    
};

export { pathDrawing };
