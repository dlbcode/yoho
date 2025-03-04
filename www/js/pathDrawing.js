import { map } from './map.js';
import { appState } from './stateManager.js';
import { flightMap } from './flightMap.js';
import { lineManager } from './lineManager.js';

class Line {
    constructor(originAirport, destinationAirport, routeId, type, options = {}) {
        this.iata = options.iata;
        this.origin = originAirport;
        this.destination = destinationAirport;
        this.routeId = routeId;
        this.type = type;
        this.map = map;
        this.defaultWeight = 1;
        this.defaultColor = this.getColorBasedOnPrice(options.price);
        this.color = options.color || this.defaultColor;
        this.weight = options.weight || this.defaultWeight;
        this.visibleLine = this.createVisibleLine();
        this.invisibleLine = this.createInvisibleLine();
        this.decoratedLine = options.showPlane ? this.createDecoratedLine() : null;
        this.bindEvents();
        this.tags = new Set();
        this.addTags(options);
        this.routeData = options.routeData; // Store routeData
    }

    addTag(tag) {
        this.tags.add(tag);
    }

    addTags(options) {
        // Create tags only once and then add them in bulk
        const tags = [];
        
        if (true) tags.push(`route:${this.routeId}`);
        if (true) tags.push(`routeId:${this.routeId}`);
        if (true) tags.push(`type:${this.type}`);
        if (['route', 'dashed'].includes(this.type)) tags.push('type:route');
        if (options.isDeckRoute) tags.push('type:deck');
        if (options.group) tags.push(`group:${options.group}`);
        if (options.price !== undefined) {
            tags.push(`price:${options.price}`);
            tags.push(`price-range:${this.getPriceRange(options.price)}`);
        }
        if (options.departureTime !== undefined) tags.push(`departure-range:${this.getTimeRange(options.departureTime)}`);
        if (options.arrivalTime !== undefined) tags.push(`arrival-range:${this.getTimeRange(options.arrivalTime)}`);
        if (true) tags.push(`direct:${options.isDirect ? 'true' : 'false'}`);
        if (options.groupNumber) tags.push(`group:${options.groupNumber}`);
        
        // Add all tags at once to minimize Set operations
        tags.forEach(tag => this.tags.add(tag));
    }

    getPriceRange(price) {
        if (price < 100) return '0-100';
        if (price < 200) return '100-200';
        if (price < 300) return '200-300';
        if (price < 400) return '300-400';
        if (price < 500) return '400-500';
        return '500+';
    }

    getTimeRange(time) {
        if (time < 6) return '00-06';
        if (time < 12) return '06-12';
        if (time < 18) return '12-18';
        return '18-24';
    }

    getColorBasedOnPrice(price) {
        if (price === null || price === undefined || isNaN(parseFloat(price))) return 'grey';
        price = parseFloat(price);
        return price < 100 ? '#0099ff' : price < 200 ? 'green' : price < 300 ? '#abb740' : price < 400 ? 'orange' : price < 500 ? '#da4500' : '#c32929';
    }

    getBaseLineOptions(isInvisible = false) {
        return {
            weight: isInvisible ? 10 : this.weight,
            opacity: isInvisible ? 0.1 : 1,
            color: this.color,
            wrap: false,
            noClip: true, // Prevent clipping
            ...(this.type === 'dashed' ? { dashArray: '5, 10' } : {})
        };
    }

    adjustForAntimeridian(latLng1, latLng2) {
        const lonDiff = latLng2.lng - latLng1.lng;
        if (Math.abs(lonDiff) > 180) {
            if (lonDiff > 0) {
                latLng2.lng -= 360;
            } else {
                latLng2.lng += 360;
            }
        }
    }

    createVisibleLine() {
        // Create a single line and clone it for different offsets instead of creating 3 separate geodesic lines
        const latLngOne = L.latLng(this.origin.latitude, this.origin.longitude);
        const latLngTwo = L.latLng(this.destination.latitude, this.destination.longitude);
        
        const baseLine = new L.Geodesic([latLngOne, latLngTwo], this.getBaseLineOptions());
        this.lineOffsetCopies = [-360, 0, 360].map(offset => {
            if (offset === 0) {
                return baseLine.addTo(this.map);
            } else {
                const shiftedOne = L.latLng(latLngOne.lat, latLngOne.lng + offset);
                const shiftedTwo = L.latLng(latLngTwo.lat, latLngTwo.lng + offset);
                return new L.Geodesic([shiftedOne, shiftedTwo], this.getBaseLineOptions()).addTo(this.map);
            }
        });
        
        return this.lineOffsetCopies[1];
    }

    createInvisibleLine() {
        const latLngOne = L.latLng(this.origin.latitude, this.origin.longitude);
        const latLngTwo = L.latLng(this.destination.latitude, this.destination.longitude);
        
        // Store all three invisible line copies
        this.invisibleLineOffsetCopies = [];
        
        // Create identical invisible lines at the same offsets as visible lines
        [-360, 0, 360].forEach(offset => {
            const shiftedOne = L.latLng(latLngOne.lat, latLngOne.lng + offset);
            const shiftedTwo = L.latLng(latLngTwo.lat, latLngTwo.lng + offset);
            const invisibleLineAtOffset = new L.Geodesic([shiftedOne, shiftedTwo], 
                this.getBaseLineOptions(true)).addTo(this.map);
            this.invisibleLineOffsetCopies.push(invisibleLineAtOffset);
        });
        
        // Return the "base" invisible line (0° offset)
        return this.invisibleLineOffsetCopies[1];
    }

    createDecoratedLine() {
        const planeIcon = L.icon({
            iconUrl: '../assets/plane_icon.png',
            iconSize: [16, 16],
            iconAnchor: [8, 12]
        });

        const planeSymbol = L.Symbol.marker({
            rotate: true,
            markerOptions: {
                icon: planeIcon
            }
        });

        return L.polylineDecorator(this.visibleLine, {
            patterns: [
                { offset: '50%', repeat: 0, symbol: planeSymbol }
            ]
        }).addTo(this.map);
    }

    bindEvents() {
        // Use a single event handler function for each event type to reduce closures
        const clickHandler = (e) => lineManager.onClickHandler(e, this);
        const mouseOverHandler = (e) => lineManager.onMouseOver(e, this);
        const mouseOutHandler = () => lineManager.onMouseOut(this);
        
        const bindToLine = (line) => {
            if (!line) return;
            line.on('click', clickHandler);
            line.on('mouseover', mouseOverHandler);
            line.on('mouseout', mouseOutHandler);
        };
        
        // Bind to all visible line copies
        this.lineOffsetCopies?.forEach(bindToLine);
        
        // Bind to all invisible line copies
        this.invisibleLineOffsetCopies?.forEach(bindToLine);
        
        // For backward compatibility, also bind to these properties directly
        bindToLine(this.invisibleLine);
        bindToLine(this.decoratedLine);
    }

    updateLineStyles(lines, style) {
        // Filter out null values once before iterating
        const validLines = lines.filter(Boolean);
        
        // Process invisible line separately
        const invisibleLine = this.invisibleLine;
        
        validLines.forEach(line => {
            if (line === invisibleLine) {
                line.setStyle({ opacity: 0.1 });
            } else {
                line.setStyle(style);
            }
        });
    }

    highlight() {
        const style = { 
            color: 'white',
            weight: 2,
            opacity: 1,
            zIndex: 1000
        };
        
        // Reuse array to avoid creating new arrays on every call
        if (!this._lineArray) {
            this._lineArray = [...this.lineOffsetCopies];
            if (this.invisibleLine) this._lineArray.push(this.invisibleLine);
            if (this.decoratedLine) this._lineArray.push(this.decoratedLine);
        }
        
        // Bring to front before style update to reduce repaints
        this.lineOffsetCopies.forEach(line => line?.bringToFront());
        
        this.updateLineStyles(this._lineArray, style);
    }

    reset() {
        const style = {
            color: this.color,
            weight: this.weight,
            opacity: 1
        };
        
        // Use the cached line array from highlight()
        this.updateLineStyles(this._lineArray || [...this.lineOffsetCopies, this.invisibleLine, this.decoratedLine], style);
    }

    remove() {
        // Remove all visible line copies
        this.lineOffsetCopies.forEach(line => {
            if (line && this.map) this.map.removeLayer(line);
        });
        
        // Remove all invisible line copies
        this.invisibleLineOffsetCopies.forEach(line => {
            if (line && this.map) this.map.removeLayer(line);
        });
        
        // Remove decorated line if it exists
        if (this.decoratedLine && this.map) this.map.removeLayer(this.decoratedLine);
    }
}

const pathDrawing = {
    currentLines: [],
    routePathCache: {},
    dashedRoutePathCache: {},
    hoverLines: [],
    drawQueue: new Set(),
    isDrawing: false,

    // Add a map to track current line states
    lineStates: new Map(),
    hoverTimeout: null,

    queueDraw(routeId, type, options) {
        this.drawQueue.add({ routeId, type, options });
        this.scheduleDraw();
    },

    scheduleDraw() {
        if (!this.isDrawing) {
            this.isDrawing = true;
            requestAnimationFrame(() => this.processDrawQueue());
        }
    },

    async processDrawQueue() {
        // Process in batches to avoid UI freezing with large queues
        const BATCH_SIZE = 10;
        const queueItems = Array.from(this.drawQueue);
        
        for (let i = 0; i < queueItems.length; i += BATCH_SIZE) {
            const batch = queueItems.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(({ routeId, type, options }) => 
                this.drawLine(routeId, type, options)
            ));
            
            // Allow UI to breathe between batches
            if (i + BATCH_SIZE < queueItems.length) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
        
        this.drawQueue.clear();
        this.isDrawing = false;
    },

    async getAirportPair(originIata, destinationIata) {
        // Add memoization for frequently accessed airport pairs
        const cacheKey = `${originIata}-${destinationIata}`;
        
        if (this.airportPairCache?.[cacheKey]) {
            return this.airportPairCache[cacheKey];
        }
        
        if (!originIata || destinationIata === 'Any') {
            return [null, null];
        }

        const [origin, destination] = await Promise.all([
            flightMap.getAirportDataByIata(originIata),
            destinationIata !== 'Any' ? flightMap.getAirportDataByIata(destinationIata) : null
        ]);

        if (!origin || (destinationIata !== 'Any' && !destination)) {
            console.error('Airport data not found:', !origin ? originIata : destinationIata);
            return [null, null];
        }
        
        // Cache the result
        if (!this.airportPairCache) this.airportPairCache = {};
        this.airportPairCache[cacheKey] = [origin, destination];
        
        return [origin, destination];
    },

    async drawLine(routeId, type, options) {
        const [originIata, destinationIata] = routeId.split('-');
        const [originAirport, destinationAirport] = await this.getAirportPair(originIata, destinationIata);
        if (!originAirport) return;

        // Construct routeData based on the line type and available information
        const routeData = {
            // For deck routes, preserve existing deck-specific data
            ...(options.routeData || {}),
            cardId: options.cardId || options.routeData?.cardId,
            // Add common route information
            routeInfo: {
                originAirport: {
                    cityFrom: originAirport.city,
                    flyFrom: originAirport.iata_code,
                    name: originAirport.name
                },
                destinationAirport: {
                    cityTo: destinationAirport.city,
                    flyTo: destinationAirport.iata_code,
                    name: destinationAirport.name
                },
                price: options.price,
                date: options.date,
                isDirect: options.isDirect || false,
                fullRoute: [{
                    cityFrom: originAirport.city,
                    flyFrom: originAirport.iata_code
                }, {
                    cityTo: destinationAirport.city,
                    flyTo: destinationAirport.iata_code
                }]
            }
        };

        // Create line with complete route data
        const line = new Line(originAirport, destinationAirport, routeId, type, {
            ...options,
            routeData
        });
        
        this.routePathCache[routeId] = this.routePathCache[routeId] || [];
        this.routePathCache[routeId].push(line);

        // Add the line to the map
        line.visibleLine.addTo(map);
        if (line.invisibleLine) line.invisibleLine.addTo(map);
        if (line.decoratedLine) line.decoratedLine.addTo(map);
    },

    getCacheForType(type) {
        const cacheMap = {
            'route': this.routePathCache,
            'dashed': this.dashedRoutePathCache,
            'hover': this.hoverLines
        };
        return cacheMap[type];
    },

    cacheLine(routeId, type, line) {
        const cache = this.getCacheForType(type);
        if (Array.isArray(cache)) {
            cache.push(line);
        } else if (cache) {
            cache[routeId] = cache[routeId] || [];
            cache[routeId].push(line);
        }
    },

    drawRoutePaths(iata, directRoutes, type = 'route') {
        directRoutes[iata]?.forEach(route => {
            const routeId = `${route.originAirport.iata_code}-${route.destinationAirport.iata_code}`;
            if (!route.originAirport || !route.destinationAirport) return console.error('Invalid route data:', route);
            this.drawLine(routeId, type, {
                price: route.price,
                iata: iata,
                isDeckRoute: type === 'route'
            });
        });
    },

    drawDashedLine(origin, destination) {
        if (!origin || !destination) return console.error('Invalid airport data for dashed line:', origin, destination);
        this.drawLine(`${origin}-${destination}`, 'dashed', {});
    },

    adjustLatLng(latLng) {
        var currentBounds = map.getBounds();
        var newLng = latLng.lng;
        while (newLng < currentBounds.getWest()) newLng += 360;
        while (newLng > currentBounds.getEast()) newLng -= 360;
        return L.latLng(latLng.lat, newLng);
    },

    async drawLines() {
        // Clear all existing lines first
        lineManager.clearLines('all');
        
        const promises = appState.routes.map((route, index) => {
            if (!route.origin || !route.destination) return Promise.resolve();
            
            const routeId = `${route.origin}-${route.destination}`;
            
            // Check if this is a selected route
            const isSelected = route.isSelected || !!appState.selectedRoutes[index];
            
            // Always use 'route' type (solid line) for selected routes, regardless of isDirect
            // Otherwise, use the line type based on whether it's a direct route
            const type = isSelected ? 'route' : (route.isDirect ? 'route' : 'dashed');
            
            return this.drawLine(routeId, type, {
                price: route.price,
                group: appState.selectedRoutes[index]?.group,
                isDeckRoute: false,
                showPlane: type === 'route',
                status: isSelected ? 'selected' : undefined
            });
        });

        await Promise.all(promises);
    },

    isSameLineState(state1, state2) {
        return state1.type === state2.type &&
            state1.price === state2.price &&
            state1.group === state2.group;
    },

    removeLine(routeId) {
        const lines = this.routePathCache[routeId] || [];
        lines.forEach(line => line.remove());
    },

    onClick(e, visibleLine, invisibleLine) {
        this.popupFromClick = true;
        if (visibleLine.routeData) {
            lineManager.showRoutePopup(e, visibleLine.routeData, visibleLine, invisibleLine);
        } else {
            console.error('Route data is undefined for the clicked line.');
        }
    },

    onHoverMarker: function (marker) {
        if (this.hoverTimeout) {
            clearTimeout(this.hoverTimeout);
        }
        this.hoverTimeout = setTimeout(() => {
            // Perform the hover action here
            if (marker) {
                // Example hover action: show a popup or highlight the marker
                marker.openPopup();
            }
        }, 100); // Debounce hover events by 100ms
    },

    preloadDirectLines() {
        // Process direct routes in batches to avoid UI freezing
        const directRoutes = appState.directRoutes;
        const iataKeys = Object.keys(directRoutes);
        
        // Use requestAnimationFrame for better performance
        const processNextBatch = (index) => {
            if (index >= iataKeys.length) return;
            
            const iata = iataKeys[index];
            const routes = directRoutes[iata] || [];
            
            routes.forEach(route => {
                const routeId = `${route.originAirport.iata_code}-${route.destinationAirport.iata_code}`;
                this.queueDraw(routeId, 'route', {
                    price: route.price,
                    date: route.date,
                    isDirect: true
                });
            });
            
            requestAnimationFrame(() => processNextBatch(index + 1));
        };
        
        requestAnimationFrame(() => processNextBatch(0));
    }
};

document.addEventListener('DOMContentLoaded', () => {
    pathDrawing.preloadDirectLines();
    pathDrawing.drawLines();
});

export { pathDrawing, Line };