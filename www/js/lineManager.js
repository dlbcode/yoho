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
        const lines = this.getLinesByTags(tags);
        lines.forEach(line => {
            // Don't clear lines that are part of appState.routes
            if (!line.tags.has('isPermanent')) {
                line.remove();
            }
        });
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
        console.log('line', line);
        if (pathDrawing.popupFromClick) return;

        if (this.hoveredLine && this.hoveredLine !== line) {
            this.hoveredLine instanceof Line && this.hoveredLine.reset();
            this.clearPopups('hover');
        }

        this.hoveredLine = line;
        line.visibleLine?.setStyle({ color: 'white', weight: 2, opacity: 1 });
        line instanceof Line && line.highlight();

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