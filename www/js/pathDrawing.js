import { map } from './map.js';
import { appState, updateState } from './stateManager.js';
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
        const tagMap = {
            [`route:${this.routeId}`]: true,
            [`routeId:${this.routeId}`]: true,
            [`type:${this.type}`]: true,
            'type:route': ['route', 'dashed'].includes(this.type),
            'type:deck': options.isDeckRoute,
            [`group:${options.group}`]: options.group,
            [`price:${options.price}`]: options.price !== undefined,
            [`price-range:${this.getPriceRange(options.price)}`]: options.price !== undefined,
            [`departure-range:${this.getTimeRange(options.departureTime)}`]: options.departureTime !== undefined,
            [`arrival-range:${this.getTimeRange(options.arrivalTime)}`]: options.arrivalTime !== undefined,
            [`direct:${options.isDirect ? 'true' : 'false'}`]: true,
            [`group:${options.groupNumber}`]: options.groupNumber
        };

        Object.entries(tagMap)
            .filter(([_, shouldAdd]) => shouldAdd)
            .forEach(([tag]) => this.tags.add(tag));
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
        const latLngOne = L.latLng(this.origin.latitude, this.origin.longitude);
        const latLngTwo = L.latLng(this.destination.latitude, this.destination.longitude);

        // Store all three line copies for event handling and styling
        this.lineOffsetCopies = [];

        // Draw identical lines at offsets -360, 0, +360 so one stays visible as you pan
        [-360, 0, 360].forEach(offset => {
            const shiftedOne = L.latLng(latLngOne.lat, latLngOne.lng + offset);
            const shiftedTwo = L.latLng(latLngTwo.lat, latLngTwo.lng + offset);
            const lineAtOffset = new L.Geodesic([shiftedOne, shiftedTwo], this.getBaseLineOptions()).addTo(this.map);
            this.lineOffsetCopies.push(lineAtOffset);
        });

        // Return the "base" line (0° offset) if you need to reference it later
        return this.lineOffsetCopies[1]; // The middle element (0 offset)
    }

    createInvisibleLine() {
        const coords = [
            L.latLng(this.origin.latitude, this.origin.longitude),
            L.latLng(this.destination.latitude, this.destination.longitude)
        ];
        return new L.Geodesic(coords, this.getBaseLineOptions(true)).addTo(this.map);
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
        const bindLineEvents = (line) => {
            if (line) {
                line.on('click', (e) => lineManager.onClickHandler(e, this));
                line.on('mouseover', (e) => lineManager.onMouseOver(e, this));
                line.on('mouseout', () => lineManager.onMouseOut(this));
            }
        };

        // Bind events to all visible line copies
        this.lineOffsetCopies.forEach(line => bindLineEvents(line));
        
        // Bind events to invisible line
        bindLineEvents(this.invisibleLine);
        
        if (this.decoratedLine) {
            bindLineEvents(this.decoratedLine);
        }
    }

    updateLineStyles(lines, style) {
        lines.forEach(line => {
            if (!line) return;
            if (line === this.invisibleLine) {
                line.setStyle({ opacity: 0.1 });
                return;
            }
            line.setStyle(style);
        });
    }

    highlight() {
        const style = { 
            color: 'white',
            weight: 2,
            opacity: 1,
            zIndex: 1000  // Use zIndex instead of setZIndexOffset
        };
        
        // Bring all copies to front and apply style
        this.lineOffsetCopies.forEach(line => {
            line.bringToFront();
        });
        
        this.updateLineStyles([...this.lineOffsetCopies, this.invisibleLine, this.decoratedLine], style);
    }

    reset() {
        const style = {
            color: this.color,
            weight: this.weight,
            opacity: 1
        };
        this.updateLineStyles([...this.lineOffsetCopies, this.invisibleLine, this.decoratedLine], style);
    }

    remove() {
        this.lineOffsetCopies.forEach(line => {
            this.map.removeLayer(line);
        });
        
        if (this.invisibleLine) this.map.removeLayer(this.invisibleLine);
        if (this.decoratedLine) this.map.removeLayer(this.decoratedLine);
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
        const promises = Array.from(this.drawQueue).map(({ routeId, type, options }) =>
            this.drawLine(routeId, type, options)
        );

        await Promise.all(promises);
        this.drawQueue.clear();
        this.isDrawing = false;
    },

    async getAirportPair(originIata, destinationIata) {
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
        const directRoutes = appState.directRoutes;
        Object.keys(directRoutes).forEach(iata => {
            directRoutes[iata].forEach(route => {
                const routeId = `${route.originAirport.iata_code}-${route.destinationAirport.iata_code}`;
                this.queueDraw(routeId, 'route', {
                    price: route.price,
                    date: route.date,
                    isDirect: true
                });
            });
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    pathDrawing.preloadDirectLines();
    pathDrawing.drawLines();
});

export { pathDrawing, Line };