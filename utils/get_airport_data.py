import os
import csv
import requests
from io import StringIO
from pymongo import MongoClient
from pymongo.errors import PyMongoError

mongodb_password = os.getenv('MONGODB_RSUSER_PASSWORD')

# URL of the CSV file
csv_url = 'https://davidmegginson.github.io/ourairports-data/airports.csv'

# MongoDB setup
client = MongoClient(f'mongodb://rsuser:{mongodb_password}@localhost:27017/rsdb')
db = client['rsdb']
airports_collection = db['airports']

def download_csv(url):
    response = requests.get(url)
    response.raise_for_status()
    return StringIO(response.text)

def filter_csv_and_upsert_to_mongo(infile):
    reader = csv.DictReader(infile)
    for row in reader:
        if row['type'] == 'large_airport' and row['scheduled_service'] == 'yes':
            airport_data = {
                'iata_code': row['iata_code'],
                'name': row['name'],
                'latitude': float(row['latitude_deg']),
                'longitude': float(row['longitude_deg']),
                'country': row['iso_country'],
                'city': row['municipality']
            }
            try:
                result = airports_collection.update_one(
                    {'iata_code': row['iata_code']}, 
                    {'$set': airport_data}, 
                    upsert=True
                )
                if result.upserted_id:
                    print(f"Inserted a new document for {row['iata_code']}")
                elif result.modified_count > 0:
                    print(f"Updated document for {row['iata_code']}")
                else:
                    print(f"No changes for {row['iata_code']}")
            except PyMongoError as e:
                print(f"MongoDB Error for {row['iata_code']}: {e}")

try:
    print("Downloading CSV data...")
    csv_data = download_csv(csv_url)
    print("Inserting/updating data into MongoDB...")
    filter_csv_and_upsert_to_mongo(csv_data)
    print("Data insertion/update complete.")
except requests.HTTPError as e:
    print("An HTTP error occurred while downloading the CSV:", e)
except Exception as e:
    print("An error occurred:", e)
