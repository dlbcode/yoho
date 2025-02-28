#!/bin/bash

# Configuration
BACKUP_DIR="${HOME}/backup/mongodb"
MONGODB_URI="mongodb://rsuser:rspass@localhost:27017/rsdb"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_PATH="${BACKUP_DIR}/${TIMESTAMP}"

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

# Function to display usage information
function show_usage {
  echo "MongoDB Backup Script"
  echo "Usage: $0 [backup_path]"
  echo "  If backup_path is not provided, backup will be stored in: ${BACKUP_PATH}"
}

# Process command line arguments
if [ $# -eq 1 ] && [ "$1" == "--help" ]; then
  show_usage
  exit 0
elif [ $# -eq 1 ]; then
  BACKUP_PATH="$1"
fi

echo "Starting MongoDB backup to ${BACKUP_PATH}..."

# Execute backup
if mongodump --uri="${MONGODB_URI}" --out="${BACKUP_PATH}"; then
  echo "Backup completed successfully at: ${BACKUP_PATH}"
  
  # Optional: List the backup contents
  echo "Backup contents:"
  find "${BACKUP_PATH}" -type d -maxdepth 1
else
  echo "Error: Backup failed!"
  exit 1
fi