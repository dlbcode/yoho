#!/bin/bash
# filepath: /home/dbueno/repos/yoho/restore-db.sh

# Configuration
BACKUP_DIR="/home/dbueno/backup/mongodb/20250228_133230"
DOCKER_COMPOSE_DIR="/home/dbueno/repos/yoho"

# Get the MongoDB root password from .env or prompt for it
if [ -f "${DOCKER_COMPOSE_DIR}/.env" ]; then
  source "${DOCKER_COMPOSE_DIR}/.env"
  ROOT_PASSWORD="${MONGODB_RSROOT_PASSWORD}"
  RSUSER_PASSWORD="${MONGODB_RSUSER_PASSWORD}"
else
  read -sp "Enter MongoDB root password: " ROOT_PASSWORD
  echo
  read -sp "Enter MongoDB rsuser password: " RSUSER_PASSWORD
  echo
fi

# Step 1: Stop existing MongoDB container
echo "Stopping MongoDB container..."
cd "${DOCKER_COMPOSE_DIR}"
docker-compose stop mongodb

# Step 2: Start a temporary MongoDB container with access to the data volume
echo "Starting temporary MongoDB container for restoration..."
docker run --rm -d --name mongo-restore \
  -v yoho_mongodb_data:/data/db \
  -p 27017:27017 \
  mongo:6.0 --noauth

# Wait for MongoDB to start
echo "Waiting for MongoDB to start..."
sleep 5

# Step 3: Restore the database
echo "Restoring database from backup: ${BACKUP_DIR}"
mongorestore --host localhost:27017 "${BACKUP_DIR}"

# Step 4: Create the users
echo "Creating users..."
mongosh admin --eval "db.createUser({user:'rsroot', pwd:'${ROOT_PASSWORD}', roles:[{role:'root', db:'admin'}]})"
mongosh rsdb --eval "db.createUser({user:'rsuser', pwd:'${RSUSER_PASSWORD}', roles:[{role:'readWrite', db:'rsdb'}]})"

# Step 5: Stop the temporary container
echo "Stopping temporary MongoDB container..."
docker stop mongo-restore

# Step 6: Restart MongoDB with docker-compose
echo "Restarting MongoDB container..."
docker-compose up -d mongodb

# Step 7: Wait for MongoDB to start
echo "Waiting for MongoDB to start..."
sleep 10

# Step 8: Test connection
echo "Testing connection to MongoDB..."
docker exec -it yh-db mongosh --eval "db.runCommand({connectionStatus:1})" --authenticationDatabase admin -u rsroot -p "${ROOT_PASSWORD}"

echo "Restoration complete. You can now restart your Node.js container with:"
echo "docker-compose restart nodejs"
