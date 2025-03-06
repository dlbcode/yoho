const axios = require('axios');
const updateDirectRoutes = require('./directRouteHandler');

module.exports = function(app, db, tequila) {
    app.get('/cheapestFlightsTo', async (req, res) => {
        const { 
            destination, 
            date_from: dateFrom, 
            date_to: dateTo, 
            price_to: priceTo = 500, 
            limit = 50, 
            radius = 2000
        } = req.query;

        if (!destination || !dateFrom || !dateTo) {
            return res.status(400).send('Destination and date range are required');
        }

        try {
            const flightsCollection = db.collection('flights');
            const airportsCollection = db.collection('airports');
            
            // First, get the destination airport's coordinates
            const destAirport = await airportsCollection.findOne({ iata_code: destination });
            
            if (!destAirport?.latitude || !destAirport?.longitude) {
                return res.status(400).send('Could not find coordinates for the destination airport');
            }

            // Check cache first
            const cacheKey = { type: 'cheapestFlightsTo', destination, dateFrom, dateTo, radius, priceTo };
            const cachedData = await flightsCollection.findOne(cacheKey);
            
            if (cachedData && (Date.now() - cachedData.timestamp.getTime() < 24 * 60 * 60 * 1000)) {
                console.log(`Serving cached results for ${destination}`);
                return res.json(cachedData.results);
            }

            // Cache miss - perform search with four search circles around destination
            const encodedDates = {
                from: dateFrom.replace(/\//g, '%2F'),
                to: dateTo.replace(/\//g, '%2F')
            };
            
            const destLat = parseFloat(destAirport.latitude);
            const destLon = parseFloat(destAirport.longitude);
            const offsetDegrees = Math.ceil(radius / 111);
            
            // Create search circles (each positioned to avoid including the destination)
            const searchCircles = [
                // Circle centers in top-left, top-right, bottom-left, bottom-right quadrants
                `${(destLat + offsetDegrees).toFixed(6)}-${(destLon - offsetDegrees).toFixed(6)}-${radius}km`,
                `${(destLat + offsetDegrees).toFixed(6)}-${(destLon + offsetDegrees).toFixed(6)}-${radius}km`,
                `${(destLat - offsetDegrees).toFixed(6)}-${(destLon - offsetDegrees).toFixed(6)}-${radius}km`,
                `${(destLat - offsetDegrees).toFixed(6)}-${(destLon + offsetDegrees).toFixed(6)}-${radius}km`
            ];
            
            const allResults = { data: [], currency: "USD" };
            const seenFlightIds = new Set();
            
            // Fetch data from all search circles in parallel
            await Promise.all(searchCircles.map(async (radiusParam) => {
                try {
                    const apiUrl = `https://api.tequila.kiwi.com/v2/search?fly_from=${radiusParam}&fly_to=${destination}&date_from=${encodedDates.from}&date_to=${encodedDates.to}&limit=${limit}&one_for_city=1&price_to=${priceTo}`;
                    
                    const response = await axios.get(apiUrl, {
                        headers: { 'apikey': tequila.headers.apikey }
                    });
                    
                    if (response.data?.data?.length) {
                        response.data.data.forEach(flight => {
                            if (!seenFlightIds.has(flight.id)) {
                                allResults.data.push(flight);
                                seenFlightIds.add(flight.id);
                            }
                        });
                    }
                } catch (err) {
                    console.error(`API error: ${err.message}`);
                }
            }));
            
            // Sort and finalize results
            allResults.data.sort((a, b) => a.price - b.price);
            allResults.search_id = `combined-${Date.now()}`;
            allResults._results = allResults.data.length;
            
            // Cache results and process direct routes if we found any flights
            if (allResults.data.length) {
                processDirectRoutes(allResults.data).catch(err => 
                    console.error(`Error processing direct routes: ${err.message}`));
                
                flightsCollection.updateOne(
                    cacheKey,
                    { $set: { ...cacheKey, timestamp: new Date(), results: allResults }},
                    { upsert: true }
                ).catch(err => console.error(`Error caching results: ${err.message}`));
            }
            
            return res.json(allResults);
        } catch (error) {
            console.error(`Error in cheapestFlightsTo: ${error.message}`);
            return res.status(500).send('Server error while processing flight search request');
        }
    });

    async function processDirectRoutes(flightsData) {
        const directFlights = flightsData.filter(flight => flight.route?.length === 1);
        if (!directFlights.length) return;
        
        const cheapestDirect = directFlights.reduce(
            (lowest, flight) => flight.price < lowest.price ? flight : lowest, 
            directFlights[0]
        );
        
        if (cheapestDirect.route?.[0]) {
            await updateDirectRoutes(db, [{
                origin: cheapestDirect.route[0].flyFrom,
                destination: cheapestDirect.route[0].flyTo,
                price: cheapestDirect.price,
                departureDate: new Date(cheapestDirect.local_departure).toISOString()
            }]);
        }
    }
};