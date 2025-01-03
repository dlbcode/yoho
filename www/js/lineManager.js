import { map } from './map.js';
import { pathDrawing, Line } from './pathDrawing.js';

const lineManager = {
    routePopups: [],
    hoverPopups: [],
    hoveredLine: null,
    linesWithPopups: new Set(),

    getLinesByTags: function (tags, cache) {
        let lines = [];
        if (cache === 'route') {
            Object.values(pathDrawing.routePathCache).forEach(lineSetArray => {
                lines.push(...lineSetArray);
            });
        } else if (cache === 'dashed') {
            Object.values(pathDrawing.dashedRoutePathCache).forEach(lineSetArray => {
                lines.push(...lineSetArray);
            });
        } else if (cache === 'hover') {
            lines.push(...pathDrawing.hoverLines);
        } else { // default to all lines if cache is not specified or invalid
            Object.values(pathDrawing.routePathCache).forEach(lineSetArray => {
                lines.push(...lineSetArray);
            });
            Object.values(pathDrawing.dashedRoutePathCache).forEach(lineSetArray => {
                lines.push(...lineSetArray);
            });
            lines.push(...pathDrawing.hoverLines);
        }

        return lines.filter(line => tags.every(tag => line.tags.has(tag)));
    },

    clearPopups: function (type) {
        let popups;
        switch (type) {
            case 'route':
                popups = this.routePopups;
                break;
            case 'hover':
                popups = this.hoverPopups;
                break;
            case 'all':
                popups = [...this.routePopups, ...this.hoverPopups];
                break;
            default:
                popups = [];
        }
        popups.forEach(popup => map.closePopup(popup));
        if (type !== 'all') {
            this[type + 'Popups'] = [];
        } else {
            this.routePopups = [];
            this.hoverPopups = [];
        }
    },

    clearLinesByTags: function (tags) {
        const linesToClear = this.getLinesByTags(tags);
        linesToClear.forEach(line => {
            if (line instanceof Line) {
                line.remove();
            }
        });

        // Remove cleared lines from the cache
        Object.keys(pathDrawing.routePathCache).forEach(routeId => {
            pathDrawing.routePathCache[routeId] = pathDrawing.routePathCache[routeId].filter(line => !linesToClear.includes(line));
            if (pathDrawing.routePathCache[routeId].length === 0) {
                delete pathDrawing.routePathCache[routeId]; // Remove the entry if it's empty
            }
        });

        Object.keys(pathDrawing.dashedRoutePathCache).forEach(routeId => {
            pathDrawing.dashedRoutePathCache[routeId] = pathDrawing.dashedRoutePathCache[routeId].filter(line => !linesToClear.includes(line));
            if (pathDrawing.dashedRoutePathCache[routeId].length === 0) {
                delete pathDrawing.dashedRoutePathCache[routeId];
            }
        });

        pathDrawing.hoverLines = pathDrawing.hoverLines.filter(line => !linesToClear.includes(line));
    },

    clearLines: function (type, specificLines) {
        switch (type) {
            case 'all':
                this.clearLinesByTags(['type:route']);
                this.clearLinesByTags(['type:dashed']);
                this.clearLinesByTags(['type:hover']);
                break;
            case 'hover':
                this.clearLinesByTags(['type:hover']);
                break;
            case 'route':
                this.clearLinesByTags(['type:route']);
                break;
            case 'specific':
                if (specificLines) {
                    specificLines.forEach(line => {
                        if (line instanceof Line) {
                            line.remove();
                        }
                    });
                }
                break;
        }
        map.closePopup();
    },

    // Define outsideClickListener outside of showRoutePopup
    outsideClickListener: function (event) {
        if (!event.target.closest('.leaflet-popup')) {
            lineManager.clearPopups('route');
        }
    },

    showRoutePopup: function (event, routeData, visibleLine, invisibleLine) {
        const { originAirport, destinationAirport, price, date } = routeData;

        let content = `<div style="line-height: 1.5;">
            <strong>Route Information</strong><br>
            <strong>From:</strong> ${originAirport.name} (${originAirport.iata_code})<br>
            <strong>To:</strong> ${destinationAirport.name} (${destinationAirport.iata_code})<br>
            <strong>Price:</strong> $${price}<br>`;

        if (date) {
            let formattedDate = new Date(date).toLocaleDateString("en-US", {
                year: 'numeric', month: 'long', day: 'numeric'
            });
            content += `<strong>Date:</strong> ${formattedDate}<br>`;
        }

        content += `</div>`;

        this.clearPopups('route');

        const popup = L.popup({ autoClose: false, closeOnClick: false })
            .setLatLng(event.latlng)
            .setContent(content)
            .on('remove', function () {
                this.linesWithPopups.delete(visibleLine);
                pathDrawing.popupFromClick = false;
                document.removeEventListener('click', lineManager.outsideClickListener);

                if (!visibleLine.options.isTableRoute) {
                    this.clearLines('specific', [{ visibleLine, invisibleLine }]);
                } else {
                    const highlightedRouteSegments = pathDrawing.routePathCache[visibleLine.routeData.tableRouteId];
                    if (highlightedRouteSegments) {
                        highlightedRouteSegments.forEach(segment => {
                            if (segment instanceof Line) {
                                segment.visibleLine.setStyle({ color: segment.visibleLine.originalColor });
                            }
                        });
                    }
                }
            }.bind(this))
            .on('add', function () {
                if (visibleLine && !map.hasLayer(visibleLine)) {
                    visibleLine.addTo(map);
                }
                if (invisibleLine && !map.hasLayer(invisibleLine)) {
                    invisibleLine.addTo(map);
                }
                this.linesWithPopups.add(visibleLine);
                pathDrawing.popupFromClick = true;
                // Attach the event listener using the correct reference
                document.addEventListener('click', lineManager.outsideClickListener);
            }.bind(this));

        setTimeout(() => {
            popup.openOn(map);
        }, 100);

        this.routePopups.push(popup);
    },

    onMouseOver: function (e, line) {
        console.log("onMouseOver triggered");
        console.log("Received line:", line);

        if (pathDrawing.popupFromClick) return;

        if (this.hoveredLine && this.hoveredLine !== line) {
            console.log("Resetting previously hovered line:", this.hoveredLine);
            if (this.hoveredLine instanceof Line) {
                this.hoveredLine.reset();
            }
            map.closePopup(this.hoverPopup);
            this.hoverPopups = this.hoverPopups.filter(p => p !== this.hoverPopup);
        }

        this.hoveredLine = line;
        if (line.visibleLine) {
            console.log("Applying style to visibleLine");
            line.visibleLine.setStyle({ color: 'white', weight: 2, opacity: 1 });
        } else {
            console.error("visibleLine is not defined on the line object");
        }

        // Use the highlight method from the Line prototype
        if (line instanceof Line) {
            line.highlight();
        } else {
            console.error('Line is not an instance of Line class:', line);
            console.log('Line prototype:', Object.getPrototypeOf(line));
        }

        const displayPrice = line.routeData?.price ? Math.round(line.routeData.price) : 'N/A';
        const city = line.routeData?.destinationAirport?.city || 'Unknown City';
        const dateContent = line.routeData?.date ? `<br><span style="line-height: 1; display: block; color: #666">on ${new Date(line.routeData.date).toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' })}</span>` : '';
        const content = `<div style="line-height: 1.2; margin: 0;">${city}<br><span><strong><span style="color: #ccc; font-size: 14px;">$${displayPrice}</span></strong></span>${dateContent}</div>`;

        this.hoverPopup = L.popup({ autoClose: false, closeOnClick: true })
            .setLatLng(e.latlng)
            .setContent(content)
            .openOn(map);

        this.hoverPopups.push(this.hoverPopup);
    },

    onMouseOut: function (line) {
        if (pathDrawing.popupFromClick || this.linesWithPopups.has(line.visibleLine)) return;

        console.log('Resetting hovered line:', line);

        if (line instanceof Line) {
            line.reset(); // Now line is a Line instance
        } else {
            console.error('The line is not an instance of Line class:', line);
        }

        map.closePopup(this.hoverPopup);
        this.hoverPopups = this.hoverPopups.filter(p => p !== this.hoverPopup);
        this.hoveredLine = null;
        this.hoverPopup = null;
    },

    onClickHandler: function (e, line) {
        lineManager.clearPopups('hover'); // Use lineManager here
        pathDrawing.popupFromClick = true;
        line.addTag('status:highlighted')
        if (line.routeData) {
            lineManager.showRoutePopup(e, line.routeData, line.visibleLine, line.invisibleLine); // Use lineManager here
        } else {
            console.error('Route data is undefined for the clicked line.');
        }
    },
};

export { lineManager };