import os
import csv
from pymongo import MongoClient
from pymongo.errors import PyMongoError

# MongoDB setup
mongodb_password = os.getenv('MONGODB_RSUSER_PASSWORD')
client = MongoClient(f'mongodb://rsuser:{mongodb_password}@localhost:27017/rsdb')
db = client['rsdb']
flights_collection = db['flights']

def read_flights_csv(flights_file):
    """Read flight data from a CSV file."""
    with open(flights_file, mode='r', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        for row in reader:
            yield {
                'origin_iata': row['origin_iata'],
                'flight_number': row['flight_number'],
                'dest_iata': row['dest_iata'],
                'departure': row['departure'],
                'arrival': row['arrival'],
                'duration': row['duration']
            }

def insert_flights_to_mongo(flights_file):
    """Insert flight data into MongoDB."""
    for flight_data in read_flights_csv(flights_file):
        try:
            result = flights_collection.update_one(
                {'flight_number': flight_data['flight_number']}, 
                {'$set': flight_data}, 
                upsert=True
            )
            if result.upserted_id:
                print(f"Inserted a new document for {flight_data['flight_number']}")
            elif result.modified_count > 0:
                print(f"Updated document for {flight_data['flight_number']}")
            else:
                print(f"No changes for {flight_data['flight_number']}")
        except PyMongoError as e:
            print(f"MongoDB Error for {flight_data['flight_number']}: {e}")

try:
    flights_file = 'flights.csv'  # Path to your flights.csv file
    print("Inserting/updating flight data into MongoDB...")
    insert_flights_to_mongo(flights_file)
    print("Data insertion/update complete.")
except Exception as e:
    print("An error occurred:", e)

