import csv
import os
from pymongo import MongoClient
from pymongo.errors import PyMongoError
from datetime import datetime

def read_iata_codes_from_airports(airports_file):
    """Read IATA codes from the airports CSV file."""
    iata_codes = set()
    with open(airports_file, mode='r', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        for row in reader:
            iata_code = row['iata_code']
            if iata_code:
                iata_codes.add(iata_code)
    return iata_codes

def filter_routes(routes_file, iata_codes, output_file):
    """Filter routes based on IATA codes, write specific columns, and ensure unique origin-destination pairs."""
    unique_pairs = set()
    filtered_routes = []
    with open(routes_file, mode='r', encoding='utf-8') as infile, \
         open(output_file, mode='w', encoding='utf-8', newline='') as outfile:
        reader = csv.reader(infile)
        writer = csv.writer(outfile)

        for row in reader:
            origin_iata = row[2]
            destination_iata = row[4]
            pair = (origin_iata, destination_iata)

            if origin_iata in iata_codes and destination_iata in iata_codes and pair not in unique_pairs:
                unique_pairs.add(pair)
                writer.writerow([row[2], row[4], row[7]])
                filtered_routes.append({
                    'origin': origin_iata,
                    'destination': destination_iata,
                    'timestamp': datetime.now().strftime('%Y%m%d%H%M%S')  # Adjusted format
                })
    return filtered_routes

def upsert_routes_to_mongo(routes, db):
    """Upsert filtered routes into MongoDB."""
    try:
        for route in routes:
            query = {'origin': route['origin'], 'destination': route['destination']}
            update = {'$set': route}
            result = db['routes'].update_one(query, update, upsert=True)
            if result.upserted_id:
                print(f"Upserted a new document for route {route['origin']} to {route['destination']}")
            elif result.modified_count > 0:
                print(f"Updated document for route {route['origin']} to {route['destination']}")
            else:
                print(f"No changes for route {route['origin']} to {route['destination']}")
    except PyMongoError as e:
        print(f"Error upserting routes into MongoDB: {e}")

# MongoDB setup
mongodb_password = os.getenv('MONGODB_RSUSER_PASSWORD')
client = MongoClient(f'mongodb://rsuser:{mongodb_password}@localhost:27017/rsdb')
db = client['rsdb']

# Usage
iata_codes = read_iata_codes_from_airports('filtered_airports.csv')
filtered_routes = filter_routes('routes.csv', iata_codes, 'filtered_routes.csv')
upsert_routes_to_mongo(filtered_routes, db)
