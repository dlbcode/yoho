import json
import os
import requests
import sys

def download_airline_logo(airline_code, output_dir):
    # Create the output directory if it doesn't exist
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    print(f"Output directory '{output_dir}' is ready.")

    logo_url = f"https://www.gstatic.com/flights/airline_logos/70px/{airline_code}.png"
    try:
        response = requests.get(logo_url)
        print(f"Attempting to download logo for {airline_code} from URL: {logo_url}")
        
        if response.status_code == 200:
            # Save the logo file
            logo_path = os.path.join(output_dir, f"{airline_code}.png")
            with open(logo_path, 'wb') as f:
                f.write(response.content)
            print(f"Downloaded logo for {airline_code}")
            return True
        else:
            print(f"Failed to download logo for {airline_code}. HTTP status code: {response.status_code}")
            return False
    except Exception as e:
        print(f"Error downloading logo for {airline_code}. Error: {e}")
        return False

def download_airline_logos(airline_codes_file, output_dir):
    # Create the output directory if it doesn't exist
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    print(f"Output directory '{output_dir}' is ready.")

    # Load airline codes from a JSON file
    try:
        with open(airline_codes_file, 'r') as file:
            airline_codes = json.load(file)
        print("Airline codes loaded successfully.")
    except Exception as e:
        print(f"Error loading airline codes from {airline_codes_file}: {e}")
        return

    # Iterate over the airline codes and download each logo
    for code, name in airline_codes.items():
        logo_url = f"https://www.gstatic.com/flights/airline_logos/70px/{code}.png"
        try:
            response = requests.get(logo_url)
            print(f"Attempting to download logo for {name} ({code}) from URL: {logo_url}")
            
            if response.status_code == 200:
                # Save the logo file
                logo_path = os.path.join(output_dir, f"{code}.png")
                with open(logo_path, 'wb') as f:
                    f.write(response.content)
                print(f"Downloaded logo for {name} - {code}")
            else:
                print(f"Failed to download logo for {name} - {code}. HTTP status code: {response.status_code}")
        except Exception as e:
            print(f"Error downloading logo for {name} ({code}). Error: {e}")

# Configuration
output_dir = '70px'

# Check if an airline code is provided as a command-line argument
if __name__ == "__main__":
    if len(sys.argv) > 1:
        airline_code = sys.argv[1].upper()  # Convert to uppercase for consistency
        download_airline_logo(airline_code, output_dir)
    else:
        # Default behavior: use the JSON file
        airline_codes_file = 'airlines.json'
        download_airline_logos(airline_codes_file, output_dir)