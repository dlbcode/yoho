import csv
import re
import requests
from bs4 import BeautifulSoup
from datetime import datetime

def read_csv(file_name):
    """ Read CSV and return list of IATA codes """
    iata_codes = []
    with open(file_name, mode='r', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        for row in reader:
            if row['iata_code']:
                iata_codes.append(row['iata_code'])
    return iata_codes

def format_flight_number(flight_number):
    """ Format the flight number by inserting a hyphen """
    for i, c in enumerate(flight_number):
        if c.isdigit():
            return flight_number[:i] + '-' + flight_number[i:]
    return flight_number

def convert_time_format(time_str):
    """ Convert time to desired format YYYYMMDDHH """
    return datetime.strptime(time_str, '%d %b %Y %H:%M').strftime('%Y%m%d%H%M')

def scrape_departures(iata_code):
    url = f"https://www.avionio.com/en/airport/{iata_code}/departures"
    response = requests.get(url)
    soup = BeautifulSoup(response.content, 'html.parser')
    departures = []
    for row in soup.find_all('tr', class_="tt-row"):
        cols = row.find_all('td')
        if len(cols) >= 5:
            flight_link = cols[4].find('a', href=True)
            if flight_link:
                href = flight_link['href']
                flight_number = href.split('/en/flight/')[1].split('?')[0]  # Extract flight number from href
                dest_iata = cols[2].text.strip()
                departures.append({'flight_number': flight_number, 'dest_iata': dest_iata})
    return departures

def scrape_flight_info(flight_number):
    """ Scrape individual flight information """
    url = f"https://www.avionio.com/en/flight/{flight_number}"
    response = requests.get(url)
    soup = BeautifulSoup(response.content, 'html.parser')

    departure_div = soup.find('div', id='flight-departure')
    arrival_div = soup.find('div', id='flight-arrival')

    if departure_div and arrival_div:
        try:
            departure_time_text = departure_div.find_all('p')[1] if len(departure_div.find_all('p')) > 1 else None
            arrival_time_text = arrival_div.find_all('p')[1] if len(arrival_div.find_all('p')) > 1 else None

            if departure_time_text and arrival_time_text:
                departure_time = departure_time_text.text.split('Scheduled: ')[1].strip()
                arrival_time = arrival_time_text.text.split('Scheduled: ')[1].strip()
                departure = datetime.strptime(departure_time, '%d %b %Y %H:%M')
                arrival = datetime.strptime(arrival_time, '%d %b %Y %H:%M')
                delta = arrival - departure
                hours, remainder = divmod(delta.seconds, 3600)
                minutes = remainder // 60
                duration = f"{hours:02d}h{minutes:02d}m"
                return departure.strftime('%Y%m%d%H%M'), arrival.strftime('%Y%m%d%H%M'), duration, None
            else:
                raise ValueError("Missing departure or arrival time")
        except Exception as e:
            error_message = f"Error processing flight {flight_number}: {e}"
            with open('flights.err', 'a') as error_file:
                error_file.write(error_message + "\n")
            return 'N/A', 'N/A', 'N/A', error_message

    return 'N/A', 'N/A', 'N/A', f"No flight information found for {flight_number}"

def write_to_csv(data, file_name='flights.csv'):
    """ Write flight data to CSV """
    with open(file_name, mode='a', encoding='utf-8', newline='') as file:
        writer = csv.writer(file)
        writer.writerow(data)

def main():
    print("Reading IATA codes from CSV...")
    iata_codes = read_csv('filtered_airports.csv')

    for iata_code in iata_codes:
        print(f"Processing departures for IATA code: {iata_code}")
        departures = scrape_departures(iata_code)
        if not departures:
            print(f"No departures found for {iata_code}.")
            continue
        for flight in departures:
            departure, arrival, duration, error = scrape_flight_info(flight['flight_number'])
            if error:
                with open('flights.err', 'a') as error_file:
                    error_file.write(f"{error}\n")
            else:
                data = [iata_code, flight['dest_iata'], flight['flight_number'], departure, arrival, duration]
                write_to_csv(data)

    print("Flight data collection complete.")

if __name__ == "__main__":
    main()
