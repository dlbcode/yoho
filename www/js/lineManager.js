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

    clearLinesByTags(tags, { excludeTags = [] } = {}) {
        const linesToClear = this.getLinesByTags(tags)
            .filter(line => !excludeTags.some(tag => line.tags.has(tag)));

        linesToClear.forEach(line => line instanceof Line && line.remove());

        const clearCache = cache => {
            Object.entries(cache).forEach(([routeId, lines]) => {
                cache[routeId] = lines.filter(line => !linesToClear.includes(line));
                if (!cache[routeId].length) delete cache[routeId];
            });
        };

        clearCache(pathDrawing.routePathCache);
        clearCache(pathDrawing.dashedRoutePathCache);
        pathDrawing.hoverLines = pathDrawing.hoverLines.filter(line => !linesToClear.includes(line));
    },

    clearLines(type) {
        const clearTypes = {
            all: () => this.clearLinesByTags(['type:route', 'type:hover'], 
                        { excludeTags: ['type:table', 'status:selected'] }),
            hover: () => this.clearLinesByTags(['type:hover']),
            route: () => this.clearLinesByTags(['type:route'], 
                        { excludeTags: ['type:table', 'status:selected'] })
        };

        (clearTypes[type] || clearTypes.all)();
        map.closePopup();
    },

    clearLinesByRouteNumber(routeNumber) {
        const groupTag = `group:${routeNumber + 1}`;
        const linesToClear = [];
        
        [pathDrawing.routePathCache, pathDrawing.dashedRoutePathCache].forEach(cache => {
            Object.values(cache).forEach(lineSet => {
                lineSet.forEach(line => {
                    line instanceof Line && line.tags.has(groupTag) && linesToClear.push(line);
                });
            });
        });

        linesToClear.forEach(line => {
            line.remove();
            [pathDrawing.routePathCache, pathDrawing.dashedRoutePathCache].forEach(cache => {
                if (cache[line.routeId]) {
                    cache[line.routeId] = cache[line.routeId].filter(l => l !== line);
                    !cache[line.routeId].length && delete cache[line.routeId];
                }
            });
        });
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
        const { originAirport, destinationAirport, price, date } = routeData;
        const formattedDate = date ? new Date(date).toLocaleDateString("en-US", {
            year: 'numeric', month: 'long', day: 'numeric'
        }) : '';

        const content = `
            <div style="line-height: 1.5;">
                <strong>Route Information</strong><br>
                <strong>From:</strong> ${originAirport.name} (${originAirport.iata_code})<br>
                <strong>To:</strong> ${destinationAirport.name} (${destinationAirport.iata_code})<br>
                <strong>Price:</strong> $${price}<br>
                ${formattedDate ? `<strong>Date:</strong> ${formattedDate}<br>` : ''}
            </div>`;

        this.clearPopups('route');
        const popup = this.createPopup(event.latlng, content)
            .on('remove', () => {
                this.linesWithPopups.delete(visibleLine);
                pathDrawing.popupFromClick = false;
                document.removeEventListener('click', this.outsideClickListener);
                
                if (!visibleLine.isTableRoute) {
                    this.clearLines('specific', [{ visibleLine, invisibleLine }]);
                } else {
                    pathDrawing.routePathCache[visibleLine.routeData.tableRouteId]?.forEach(segment => {
                        segment instanceof Line && 
                        segment.visibleLine.setStyle({ color: segment.visibleLine.originalColor });
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
        line.visibleLine?.setStyle({ color: 'white', weight: 2, opacity: 1 });
        line instanceof Line && line.highlight();

        const { routeData } = line;
        const content = `
            <div style="line-height: 1.2; margin: 0;">
                ${routeData?.destinationAirport?.city || 'Unknown City'}<br>
                <span><strong><span style="color: #ccc; font-size: 14px;">
                    $${routeData?.price ? Math.round(routeData.price) : 'N/A'}
                </span></strong></span>
                ${routeData?.date ? `<br><span style="line-height: 1; display: block; color: #666">
                    on ${new Date(routeData.date).toLocaleDateString("en-US", 
                    { year: 'numeric', month: 'long', day: 'numeric' })}
                </span>` : ''}
            </div>`;

        const popup = this.createPopup(e.latlng, content, { closeOnClick: true });
        popup.openOn(map);
        this.popups.hover.add(popup);
    },

    onMouseOut(line) {
        if (pathDrawing.popupFromClick || this.linesWithPopups.has(line.visibleLine)) return;
        line instanceof Line && line.reset();
        this.clearPopups('hover');
        this.hoveredLine = null;
    },

    onClickHandler(e, line) {
        this.clearPopups('hover');
        pathDrawing.popupFromClick = true;
        line.addTag('status:highlighted');
        line.routeData ? 
            this.showRoutePopup(e, line.routeData, line.visibleLine, line.invisibleLine) : 
            console.error('Route data is undefined for the clicked line.');
    },

    outsideClickListener: e => {
        !e.target.closest('.leaflet-popup') && lineManager.clearPopups('route');
    }
};

export { lineManager };