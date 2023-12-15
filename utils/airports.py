import os
import csv
import requests
from io import StringIO
from pymongo import MongoClient
from pymongo.errors import PyMongoError

mongodb_password = os.getenv('MONGODB_RSUSER_PASSWORD')
iata_codes_file = 'iata_codes.csv'

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

def read_iata_codes(iata_codes_file):
    """Read IATA codes from a CSV file."""
    with open(iata_codes_file, mode='r', encoding='utf-8') as file:
        reader = csv.reader(file)
        return {row[2] for row in reader}

def filter_airports(airports_file, iata_codes_file, output_file):
    """Filter airports based on IATA codes."""
    iata_codes = read_iata_codes(iata_codes_file)

    with open(airports_file, mode='r', encoding='utf-8') as infile, \
         open(output_file, mode='w', encoding='utf-8', newline='') as outfile:
        reader = csv.reader(infile)
        writer = csv.writer(outfile)
        writer.writerow(['id','ident','type','name','latitude_deg','longitude_deg','elevation_ft','continent','iso_country','iso_region','municipality','scheduled_service','gps_code','iata_code','local_code','home_link','wikipedia_link','keywords'])

        for row in reader:
            # Check if the IATA code is in the list (column index 13)
            if row[13] in iata_codes:
                writer.writerow(row)

def filter_csv_and_upsert_to_mongo(infile):
    reader = csv.DictReader(infile)
    for row in reader:
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
    all_airports_csv = download_csv(csv_url)
    with open('airports.csv', 'w') as outfile:
       outfile.write(all_airports_csv.getvalue())
    filter_airports('airports.csv', 'iata_codes.csv', 'filtered_airports.csv')
    filtered_airports_csv = open('filtered_airports.csv', 'r')
    print("CSV data written to airports.csv") 
    print("Inserting/updating data into MongoDB...")
    filter_csv_and_upsert_to_mongo(filtered_airports_csv)
    print("Data insertion/update complete.")
except requests.HTTPError as e:
    print("An HTTP error occurred while downloading the CSV:", e)
except Exception as e:
    print("An error occurred:", e)
