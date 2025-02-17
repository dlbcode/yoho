export function sortDeckByField(container, fieldName, asc = true) {
    const dirModifier = asc ? 1 : -1;
    const cards = Array.from(container.querySelectorAll(".route-card:not([style*='display: none'])"));

    const sortedCards = cards.sort((a, b) => {
        // Define a mapping between field names and data extraction logic
        const fieldMap = {
            'departure': (card) => {
                const element = card.querySelector('.card-details .detail-value[data-departure]');
                return element ? element.textContent.trim() : '';
            },
            'arrival': (card) => {
                const element = card.querySelector('.card-details .detail-value[data-arrival]');
                return element ? element.textContent.trim() : '';
            },
            'price': (card) => {
                const element = card.querySelector('.card-price');
                return element ? element.textContent.replace('$', '').trim() : '';
            },
            'stops': (card) => {
                const detailGroups = card.querySelectorAll('.card-details .detail-group');
                const stopsGroup = Array.from(detailGroups).find(group => 
                    group.querySelector('.detail-label').textContent.trim() === 'Stops'
                );
                const element = stopsGroup?.querySelector('.detail-value');
                return element ? element.textContent.trim() : '0';
            },
            'duration': (card) => {
                const element = card.querySelector('.card-duration .detail-value');
                return element ? element.textContent.trim() : '';
            }
        };

        // Extract data based on the field name
        const aText = fieldMap[fieldName] ? fieldMap[fieldName](a) : '';
        const bText = fieldMap[fieldName] ? fieldMap[fieldName](b) : '';

        // Use the convertData function to handle data conversion
        let aValue = convertData(aText, fieldName);
        let bValue = convertData(bText, fieldName);

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

function convertData(data, fieldName) {
    switch (fieldName) {
        case 'departure':
        case 'arrival':
            return new Date(data);
        case 'price':
            return parseFloat(data.replace(/[^0-9.]/g, ''));
        case 'stops':
            return parseInt(data, 10);
        case 'duration':
            const [hours, minutes] = data.split('h ');
            return parseInt(hours) * 60 + parseInt(minutes.replace('m', ''));
        default:
            return data;
    }
}