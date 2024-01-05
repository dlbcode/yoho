import csv
import requests
from bs4 import BeautifulSoup
from datetime import datetime

# Function to convert date to YYYYMMDD format
def convert_date(date_str):
    current_year = datetime.now().year
    return datetime.strptime(f'{date_str} {current_year}', '%d %b %Y').strftime('%Y%m%d')

# Function to read CSV data
def read_csv(file_name):
    with open(file_name, mode='r', newline='', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        return list(reader)

# Function to write flight data to CSV
def write_to_csv(file_name, data, header):
    with open(file_name, mode='a', newline='', encoding='utf-8') as file:
        writer = csv.DictWriter(file, fieldnames=header)
        if file.tell() == 0:  # Write header only if file is empty
            writer.writeheader()
        writer.writerow(data)

# Read the airports data
airports = read_csv('filtered_airports.csv')

# Header for the flights CSV
flights_header = ['time', 'date', 'origin_iata', 'dest_iata', 'dest', 'flight', 'airline']

# Iterate over each airport
for airport in airports:
    iata_code = airport['iata_code']
    if not iata_code:
        continue

    print(f"Fetching data for IATA code: {iata_code}")

    # Fetch data from Avionio
    url = f'https://www.avionio.com/en/airport/{iata_code}/departures'
    response = requests.get(url)
    soup = BeautifulSoup(response.content, 'html.parser')

    # Find all flight rows in the table
    flights = soup.find_all('tr')

    # Process each flight
    for flight in flights[1:]:  # Skip the header row
        columns = flight.find_all('td')
        if len(columns) < 6:
            continue

        # Extract the airline name, excluding any status number
        airline = columns[5].text.strip()
        airline = ' '.join([word for word in airline.split() if not word.isdigit()])

        flight_data = {
            'time': columns[0].text.strip(),
            'date': convert_date(columns[1].text.strip()),
            'origin_iata': iata_code,
            'dest_iata': columns[2].text.strip(),
            'dest': columns[3].text.strip(),
            'flight': columns[4].text.strip(),
            'airline': airline
        }

        # Write to flights.csv
        write_to_csv('flights.csv', flight_data, flights_header)

    print(f"Data fetched and written for IATA code: {iata_code}")

print("All data fetched and written to flights.csv")

