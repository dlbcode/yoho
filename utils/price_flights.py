import os
from pymongo import MongoClient
from pymongo.errors import PyMongoError
from math import radians, cos, sin, asin, sqrt
from datetime import datetime

def haversine(lon1, lat1, lon2, lat2):
    """Calculate the great circle distance in miles between two points on the earth."""
    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    r = 3956  # Radius of Earth in miles
    return c * r

def get_airport_info(db, iata_code):
    """Retrieve airport information from the database."""
    return db.airports.find_one({'iata_code': iata_code})

def calculate_price(db, origin, destination):
    """Calculate the price for a flight using the updated pricing model."""
    origin_info = get_airport_info(db, origin)
    destination_info = get_airport_info(db, destination)

    if not origin_info or not destination_info:
        return None  # Airport info not found

    distance = haversine(origin_info['longitude'], origin_info['latitude'],
                         destination_info['longitude'], destination_info['latitude'])

    # Updated pricing model with a 20% increase
    base_fee = 48  # Increased base fee
    price_per_mile = 0.072  # Increased price per mile
    weight_discount = (11 - origin_info.get('weight', 10)) * 2 + (11 - destination_info.get('weight', 10)) * 2

    final_price = max(base_fee + (distance * price_per_mile) - weight_discount, base_fee)
    return round(final_price, 2)

def update_or_create_flights(db):
    """Create or update flight documents based on routes."""
    routes = db.routes.find()

    for route in routes:
        # Calculate price for each route
        price = calculate_price(db, route['origin'], route['destination'])
        if price is not None:
            # Prepare the document to be inserted or updated
            flight_data = {
                'origin': route['origin'],
                'destination': route['destination'],
                'price': str(price),
                'timestamp': datetime.now().strftime('%Y%m%d%H%M%S')
            }

            # Upsert operation: update if exists, else create new
            try:
                result = db.flights.update_one(
                    {'origin': route['origin'], 'destination': route['destination']},
                    {'$set': flight_data},
                    upsert=True
                )
                if result.upserted_id:
                    print(f"Created new flight from {route['origin']} to {route['destination']}: ${price}")
                elif result.modified_count > 0:
                    print(f"Updated flight from {route['origin']} to {route['destination']}: ${price}")
                else:
                    print(f"No changes made for flight from {route['origin']} to {route['destination']}")
            except PyMongoError as e:
                print(f"Error in upserting flight {route['origin']} to {route['destination']}: {e}")

# MongoDB setup
mongodb_password = os.getenv('MONGODB_RSUSER_PASSWORD')
client = MongoClient(f'mongodb://rsuser:{mongodb_password}@localhost:27017/rsdb')
db = client['rsdb']

# Create or update flights based on routes
update_or_create_flights(db)