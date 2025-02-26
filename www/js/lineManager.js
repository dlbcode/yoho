import { map } from './map.js';
import { pathDrawing, Line } from './pathDrawing.js';

const lineManager = {
    popups: {
        route: new Set(),
        hover: new Set()
    },
    hoveredLine: null,
    linesWithPopups: new Set(),

    getLinesByTags(tags, cache = 'all') {
        const cacheMap = {
            route: [pathDrawing.routePathCache],
            dashed: [pathDrawing.dashedRoutePathCache],
            hover: [{ hover: pathDrawing.hoverLines }],
            all: [pathDrawing.routePathCache, pathDrawing.dashedRoutePathCache, 
                  { hover: pathDrawing.hoverLines }]
        };

        const lines = [];
        (cacheMap[cache] || cacheMap.all).forEach(cacheObj => {
            Object.values(cacheObj).forEach(lineSet => 
                lines.push(...(Array.isArray(lineSet) ? lineSet : [lineSet])));
        });

        return lines.filter(line => tags.every(tag => line.tags.has(tag)));
    },

    clearPopups(type = 'all') {
        const popupTypes = type === 'all' ? ['route', 'hover'] : [type];
        popupTypes.forEach(t => {
            this.popups[t].forEach(popup => map.closePopup(popup));
            this.popups[t].clear();
        });
    },

    clearLinesByTags(tags, options = {}) {
        console.log('Clearing lines by tags:', tags);
        // First, get all lines matching the tag criteria
        const lines = this.getLinesByTags(tags);
        
        // Log the number of lines found for debugging
        console.log(`Found ${lines.length} lines to clear`);
        
        // Remove lines and clean up caches
        lines.forEach(line => {
            if (!line.tags.has('filterExempt')) {
                // Remove the line from the map
                line.remove();
                
                // Also remove from route path cache
                if (line.routeId && pathDrawing.routePathCache[line.routeId]) {
                    pathDrawing.routePathCache[line.routeId] = 
                        pathDrawing.routePathCache[line.routeId].filter(l => l !== line);
                }
            }
        });
    },

    clearLines(type) {
        console.log('Clearing lines:', type);
        const clearTypes = {
            all: () => this.clearLinesByTags(['type:route', 'type:hover'], 
                        { excludeTags: ['type:deck', 'status:selected'] }),
            hover: () => this.clearLinesByTags(['type:hover']),
            route: () => this.clearLinesByTags(['type:route'], 
                        { excludeTags: ['type:deck', 'status:selected'] })
        };

        (clearTypes[type] || clearTypes.all)();
        map.closePopup();
    },

    clearLinesByRouteNumber(routeNumber) {
        console.log('Clearing lines by route number:', routeNumber);
        const tags = [`group:${routeNumber}`];
        return this.clearLinesByTags(tags);
    },

    createPopup(latlng, content, options = {}) {
        return L.popup({
            autoClose: false,
            closeOnClick: false,
            ...options
        })
        .setLatLng(latlng)
        .setContent(content);
    },

    showRoutePopup(event, routeData, visibleLine, invisibleLine) {
        // Use the full route information instead of segment info
        const { originAirport, destinationAirport, price, date, fullRoute } = routeData.routeInfo;
        
        const formattedDate = date ? new Date(date).toLocaleDateString("en-US", {
            year: 'numeric', month: 'long', day: 'numeric'
        }) : '';

        // Add layover information if it exists
        const layovers = fullRoute.length > 1 
            ? fullRoute.slice(1, -1).map(segment => 
                `<br><strong>Layover:</strong> ${segment.cityFrom} (${segment.flyFrom})`)
            : '';

        const content = `
            <div style="line-height: 1.5;">
                <strong>Route Information</strong><br>
                <strong>From:</strong> ${originAirport.cityFrom} (${originAirport.flyFrom})<br>
                <strong>To:</strong> ${destinationAirport.cityTo} (${destinationAirport.flyTo})
                ${layovers}
                <br><strong>Price:</strong> $${price}<br>
                ${formattedDate ? `<strong>Date:</strong> ${formattedDate}<br>` : ''}
            </div>`;

        this.clearPopups('route');
        const popup = this.createPopup(event.latlng, content)
            .on('remove', () => {
                console.log('Popup removed');
                this.linesWithPopups.delete(visibleLine);
                pathDrawing.popupFromClick = false;
                document.removeEventListener('click', this.outsideClickListener);
                
                if (routeData?.cardId) {
                    // Reset all lines with the same cardId
                    const routeLines = Object.values(pathDrawing.routePathCache)
                        .flat()
                        .filter(l => l.routeData?.cardId === routeData.cardId);
                        
                    routeLines.forEach(routeLine => {
                        routeLine instanceof Line && routeLine.reset();
                    });
                }
            })
            .on('add', () => {
                [visibleLine, invisibleLine].forEach(line => 
                    line && !map.hasLayer(line) && line.addTo(map));
                this.linesWithPopups.add(visibleLine);
                pathDrawing.popupFromClick = true;
                document.addEventListener('click', this.outsideClickListener);
            });

        setTimeout(() => popup.openOn(map), 100);
        this.popups.route.add(popup);
    },

    onMouseOver(e, line) {
        if (pathDrawing.popupFromClick) return;

        if (this.hoveredLine && this.hoveredLine !== line) {
            this.hoveredLine instanceof Line && this.hoveredLine.reset();
            this.clearPopups('hover');
        }

        this.hoveredLine = line;

        // Find and highlight all lines in the same route
        if (line.routeData?.cardId) {
            // Get all lines with the same cardId
            const routeLines = Object.values(pathDrawing.routePathCache)
                .flat()
                .filter(l => l.routeData?.cardId === line.routeData.cardId);
                
            routeLines.forEach(routeLine => {
                if (routeLine instanceof Line) {
                    routeLine.highlight(); // This now includes bringing to front
                } else if (routeLine.visibleLine) {
                    routeLine.visibleLine.setStyle({ color: 'white', weight: 2, opacity: 1 });
                    routeLine.visibleLine.setZIndexOffset(1000);
                    routeLine.visibleLine.bringToFront();
                }
            });
        } else {
            // Single line highlight
            if (line instanceof Line) {
                line.highlight(); // This now includes bringing to front
            } else if (line.visibleLine) {
                line.visibleLine.setStyle({ color: 'white', weight: 2, opacity: 1 });
                line.visibleLine.setZIndexOffset(1000);
                line.visibleLine.bringToFront();
            }
        }

        // Extract price from tags
        const priceTag = Array.from(line.tags).find(tag => tag.startsWith('price:'));
        const price = priceTag ? priceTag.split(':')[1] : 'N/A';

        const content = `
            <div style="line-height: 1.2; margin: 0;">
                ${line.destination?.city || 'Unknown City'}<br>
                <span><strong><span style="color: #ccc; font-size: 14px;">
                    $${price}
                </span></strong></span>
            </div>`;

        const popup = this.createPopup(e.latlng, content, { closeOnClick: true });
        popup.openOn(map);
        this.popups.hover.add(popup);
    },

    onMouseOut(line) {
        if (pathDrawing.popupFromClick || this.linesWithPopups.has(line.visibleLine)) return;
        
        if (line.routeData?.cardId) {
            // Reset all lines with the same cardId
            const routeLines = Object.values(pathDrawing.routePathCache)
                .flat()
                .filter(l => l.routeData?.cardId === line.routeData.cardId);
                
            routeLines.forEach(routeLine => {
                routeLine instanceof Line && routeLine.reset();
            });
        } else {
            // Single line reset (existing behavior)
            line instanceof Line && line.reset();
        }
        
        this.clearPopups('hover');
        this.hoveredLine = null;
    },

    onClickHandler(e, line) {
        this.clearPopups('hover');
        pathDrawing.popupFromClick = true;

        // Reset previously highlighted lines
        const allDeckLines = Object.values(pathDrawing.routePathCache)
            .flat()
            .filter(l => l instanceof Line && l.tags.has('status:highlighted'));
        
        allDeckLines.forEach(previousLine => {
            previousLine.tags.delete('status:highlighted');
            previousLine.reset();
        });

        // Find and highlight all lines with the same cardId
        if (line.routeData?.cardId) {
            const routeLines = Object.values(pathDrawing.routePathCache)
                .flat()
                .filter(l => l.routeData?.cardId === line.routeData.cardId);
                
            routeLines.forEach(routeLine => {
                routeLine.addTag('status:highlighted');
                routeLine.highlight();
            });
        }

        // Handle deck route expansion when clicking a line
        if (line.routeData?.cardId) {
            const card = document.querySelector(`div.route-card[data-card-id="${line.routeData.cardId}"]`);
            if (card) {
                // Trigger the click event on the card to open it
                card.click();
                // Scroll card into view
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }

        // Show route popup
        if (line.routeData) {
            this.showRoutePopup(e, line.routeData, line.visibleLine, line.invisibleLine);
        } else {
            console.error('Route data is undefined for the clicked line.');
        }
    }
};

export { lineManager };