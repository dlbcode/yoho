# Use the official Node.js image as the base image
FROM node:latest

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy the package.json and package-lock.json files
COPY package*.json ./

# Install the Node.js dependencies specified in package.json
RUN npm install
# If you're building for production, you can use npm ci instead
# RUN npm ci --only=production

# Copy the rest of your application's code
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Define the command to run your app
# (This should be the file that starts your Node.js server)
CMD [ "node", "app.js" ]

