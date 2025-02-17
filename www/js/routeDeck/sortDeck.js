export function sortDeckByColumn(container, columnIndex, asc = true) {
    const dirModifier = asc ? 1 : -1;
    // Only sort visible cards
    const cards = Array.from(container.querySelectorAll(".route-card:not([style*='display: none'])"));

    const sortedCards = cards.sort((a, b) => {
        // Define a mapping between column index and data extraction logic
        const columnMap = {
            0: (card) => { //departure
                const departureElement = card.querySelector('.card-details .detail-value[data-departure]');
                return departureElement ? departureElement.textContent.trim() : '';
            },
            1: (card) => { //arrival
                const arrivalElement = card.querySelector('.card-details .detail-value[data-arrival]');
                return arrivalElement ? arrivalElement.textContent.trim() : '';
            },
            2: (card) => { //price
                const priceElement = card.querySelector('.card-price');
                return priceElement ? priceElement.textContent.replace('$', '').trim() : '';
            },
            5: (card) => { //stops
                const detailGroups = card.querySelectorAll('.card-details .detail-group');
                const stopsGroup = Array.from(detailGroups).find(group => 
                    group.querySelector('.detail-label').textContent.trim() === 'Stops'
                );
                const stopsElement = stopsGroup?.querySelector('.detail-value');
                return stopsElement ? stopsElement.textContent.trim() : '0';
            },
            7: (card) => { //duration
                const durationElement = card.querySelector('.card-duration .detail-value');
                return durationElement ? durationElement.textContent.trim() : '';
            }
        };

        // Extract data based on the column index
        const aColText = columnMap[columnIndex] ? columnMap[columnIndex](a) : '';
        const bColText = columnMap[columnIndex] ? columnMap[columnIndex](b) : '';

        // Use the convertData function to handle data conversion
        let aValue = convertData(aColText, columnIndex);
        let bValue = convertData(bColText, columnIndex);

        if (typeof aValue === "number" && typeof bValue === "number") {
            return (aValue - bValue) * dirModifier;
        } else if (typeof aValue === "boolean" && typeof bValue === "boolean") {
            return (aValue === bValue ? 0 : aValue ? -1 : 1) * dirModifier;
        } else if (aValue instanceof Date && bValue instanceof Date) {
            return (aValue - bValue) * dirModifier;
        } else {
            return aValue.localeCompare(bValue, undefined, { numeric: true }) * dirModifier;
        }
    });

    // Remove all cards
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
    // Append the sorted cards
    sortedCards.forEach(card => container.appendChild(card));
}

function convertData(data, columnIndex) {
    switch (columnIndex) {
        case 0:
        case 1:
            return new Date(data);
        case 2: // Price
            return parseFloat(data.replace(/[^0-9.]/g, ''));
        case 5: // Stops
            return parseInt(data, 10);
        case 7: // Duration
            const [hours, minutes] = data.split('h ');
            return parseInt(hours) * 60 + parseInt(minutes.replace('m', ''));
        default:
            return data;
    }
}