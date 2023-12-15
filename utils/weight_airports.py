from pymongo import MongoClient
from pymongo.errors import PyMongoError
import os

def calculate_airport_weights(db):
    # Count references for each airport
    pipeline = [
        {'$group': {'_id': '$origin', 'count': {'$sum': 1}}},
        {'$sort': {'count': -1}}
    ]
    origin_counts = list(db.routes.aggregate(pipeline))

    pipeline = [
        {'$group': {'_id': '$destination', 'count': {'$sum': 1}}},
        {'$sort': {'count': -1}}
    ]
    destination_counts = list(db.routes.aggregate(pipeline))

    # Combine counts
    total_counts = {}
    for entry in origin_counts + destination_counts:
        total_counts[entry['_id']] = total_counts.get(entry['_id'], 0) + entry['count']

    # Sort airports by total count
    sorted_airports = sorted(total_counts.items(), key=lambda x: x[1], reverse=True)

    # Divide into deciles and assign weights
    decile_size = len(sorted_airports) // 10
    weights = {}
    for i, (airport, _) in enumerate(sorted_airports):
        weight = i // decile_size + 1
        weight = min(weight, 10)  # Ensure weight does not exceed 10
        weights[airport] = weight

    return weights

def update_airport_weights(db, weights):
    for airport, weight in weights.items():
        try:
            db.airports.update_one({'iata_code': airport}, {'$set': {'weight': weight}})
        except PyMongoError as e:
            print(f"Error updating weight for airport {airport}: {e}")

# MongoDB setup
mongodb_password = os.getenv('MONGODB_RSUSER_PASSWORD')
client = MongoClient(f'mongodb://rsuser:{mongodb_password}@localhost:27017/rsdb')
db = client['rsdb']

# Calculate and update weights
weights = calculate_airport_weights(db)
update_airport_weights(db, weights)
