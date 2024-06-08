import { map } from './map.js';
import { appState, updateState } from './stateManager.js';
import { flightMap } from './flightMap.js';
import { showRoutePopup } from './routePopup.js';

const pathDrawing = {
    currentLines: [],
    invisibleLines: [],
    invisibleRouteLines: [],
    routePathCache: [],
    dashedRoutePathCache: [],
    popupFromClick: false,

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
    
    async drawPathBetweenAirports(originIata, destinationIata) {
        try {
            const [originAirportData, destinationAirportData] = await Promise.all([
                flightMap.getAirportDataByIata(originIata),
                flightMap.getAirportDataByIata(destinationIata)
            ]);

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
        if (!originAirport || !destinationAirport) {
            return;
        }
        const worldCopies = [-720, -360, 0, 360, 720];
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
    
    async createRoutePath(origin, destination, route, lineColor = null, routeLineId) {
        let routeData = route;
        let selectedRoutesArray = Array.isArray(appState.selectedRoutes) ? appState.selectedRoutes : Object.values(appState.selectedRoutes);

        const selectedRoute = selectedRoutesArray.find(sr => 
            sr.fullData.flyFrom === route.originAirport.iata_code && 
            sr.fullData.flyTo === route.destinationAirport.iata_code
        );

        if (selectedRoute) {
            routeData = {
                ...route,
                originAirport: { iata_code: selectedRoute.fullData.flyFrom, ...route.originAirport },
                destinationAirport: { iata_code: selectedRoute.fullData.flyTo, ...route.destinationAirport },
                price: parseFloat(selectedRoute.displayData.price.replace('$', ''))
            };
        }

        if (!routeData || !routeData.originAirport || !routeData.destinationAirport || 
            typeof routeData.originAirport.iata_code === 'undefined' || 
            typeof routeData.destinationAirport.iata_code === 'undefined') {
            console.error('Invalid route data:', routeData);
            return;
        }

        this.routeLines = this.routeLines || [];
        let routeId = `${routeData.originAirport.iata_code}-${routeData.destinationAirport.iata_code}`;
        let newPaths = [];

        const onClick = (e, geodesicLine) => {
            this.popupFromClick = true;
            console.log('Route line clicked', routeData);
            showRoutePopup(e, routeData, geodesicLine);
        };

        if (this.routePathCache[routeId]) {
            this.routePathCache[routeId].forEach(path => {
                if (!map.hasLayer(path)) {
                    path.addTo(map);
                }
                newPaths.push(path);
            });
        } else {
            const worldCopies = [-720, -360, 0, 360, 720];
            const promises = worldCopies.map(offset => new Promise(resolve => {
                const adjustedOrigin = L.latLng(origin.latitude, origin.longitude + offset);
                const adjustedDestination = L.latLng(destination.latitude, destination.longitude + offset);

                const determinedLineColor = lineColor || this.getColorBasedOnPrice(routeData.price);

                if (!this.routePathCache[routeId]) {
                    this.routePathCache[routeId] = [];
                }

                var geodesicLine = new L.Geodesic([adjustedOrigin, adjustedDestination], {
                    weight: 1,
                    opacity: 1,
                    color: determinedLineColor,
                    wrap: false,
                    zIndex: -1
                }).addTo(map);
                geodesicLine.routeId = routeId;
                geodesicLine.routeLineId = routeLineId;
                geodesicLine.originalColor = determinedLineColor;

                var invisibleLine = new L.Geodesic([adjustedOrigin, adjustedDestination], {
                    weight: 10,
                    opacity: 0.2,
                    wrap: false
                }).addTo(map);
                invisibleLine.routeLineId = routeLineId;

                const onMouseOver = (e) => {
                    if (!this.popupFromClick) {
                        geodesicLine.originalColor = geodesicLine.options.color;
                        geodesicLine.setStyle({ color: 'white' });

                        let displayPrice = Math.round(routeData.price);
                        let content = `<div style="line-height: 1.2; margin: 0;">${destination.city}<br><span><strong><span style="color: #ccc; font-size: 14px;">$${displayPrice}</span></strong></span>`;

                        if (routeData.date) {
                            let lowestDate = new Date(routeData.date).toLocaleDateString("en-US", {
                                year: 'numeric', month: 'long', day: 'numeric'
                            });
                            content += `<br><span style="line-height: 1; display: block; color: #666">on ${lowestDate}</span>`;
                        }

                        content += `</div>`;

                        const mouseoverPopup = L.popup({ autoClose: false, closeOnClick: false })
                            .setLatLng(e.latlng)
                            .setContent(content)
                            .openOn(map);

                        console.log('Mouseover popup created:', mouseoverPopup);
                    }
                };

                const onMouseOut = (e) => {
                    console.log('Mouse out of route line', geodesicLine);
                    if (!this.popupFromClick) {
                        geodesicLine.setStyle({ color: geodesicLine.originalColor });
                        map.closePopup();
                    }
                };

                const onRouteLineClick = (e) => {
                    onClick(e, geodesicLine);
                };

                [geodesicLine, invisibleLine].forEach(line => {
                    line.on('mouseover', onMouseOver).on('mouseout', onMouseOut);
                    line.on('click', onRouteLineClick);
                });

                if (routeLineId) {
                    appState.routeLines.push(geodesicLine);
                    appState.invisibleRouteLines.push(invisibleLine);
                } else {
                    newPaths.push(geodesicLine);
                    this.invisibleLines.push(invisibleLine);
                }

                this.routePathCache[routeId].push(geodesicLine);
                resolve();
            }));

            await Promise.all(promises);
        }

        const routeExists = appState.routes.some(r => 
            r.origin === route.originAirport.iata_code &&
            r.destination === route.destinationAirport.iata_code
        );

        const routeLineExists = appState.routeLines.some(r => r.routeId === routeId);

        if (routeExists || routeLineExists) {
            newPaths.forEach(path => {
                let decoratedLine = this.addDecoratedLine(path, route, onClick);
                this.currentLines.push(decoratedLine);
            });
        }
    },
    
    addDecoratedLine(geodesicLine, route, onClick) {
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

        decoratedLine.on('mouseover', (e) => {
            L.popup()
            .setLatLng(e.latlng)
            .setContent(`Price: $${Math.round(route.price)}`)
            .openOn(map);
        });

        decoratedLine.on('mouseout', () => {
            if (!this.popupFromClick) {
                map.closePopup();
            }
        });

        decoratedLine.on('click', onClick);

        this.currentLines.push(decoratedLine);
        return decoratedLine;
    },

    async drawLines() {
        this.clearLines();
      
        const drawPromises = appState.routes.map(route => {
          if (route.isDirect) {
            return this.createRoutePath(route.originAirport, route.destinationAirport, route);
          } else {
            return this.drawDashedLine(route.originAirport, route.destinationAirport);
          }
        });
      
        await Promise.all(drawPromises);
      
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
        [...Object.values(this.routePathCache).flat(), 
         ...Object.values(this.dashedRoutePathCache).flat()].forEach(line => {
            if (map.hasLayer(line)) {
                map.removeLayer(line);
            }
        });

        this.currentLines.forEach(decoratedLine => {
            if (map.hasLayer(decoratedLine)) {
                map.removeLayer(decoratedLine);
            }
        });

        this.invisibleLines.forEach(invisibleLine => {
            if (map.hasLayer(invisibleLine)) {
                map.removeLayer(invisibleLine);
            }
        });

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

        map.closePopup();

        this.routePathCache = {};
        this.dashedRoutePathCache = {};
        this.currentLines = [];
        this.invisibleLines = [];
        this.invisibleRouteLines = [];
    },
    
    drawRouteLines: async function() {
        const rows = document.querySelectorAll('.route-info-table tbody tr');
        let minPrice = Infinity, maxPrice = -Infinity;

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

        const getColorForPrice = (price) => {
            const relativePrice = price - minPrice;
            if (relativePrice <= quartile) return 'green';
            if (relativePrice <= quartile * 2) return 'yellow';
            if (relativePrice <= quartile * 3) return 'orange';
            return 'red';
        };

        for (const row of rows) {
            if (row.style.display === 'none') continue;

            const routeLineId = row.getAttribute('data-route-id');
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

                    pathDrawing.createRoutePath(originAirportData, destinationAirportData, {
                        originAirport: originAirportData,
                        destinationAirport: destinationAirportData,
                        price: price,
                    }, color, routeLineId);
                } catch (error) {
                    console.error('Error fetching airport data for segment:', error);
                }
            }
        }
    }
};

export { pathDrawing };
