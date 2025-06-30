# base image
FROM node:20

# working directory in the container
WORKDIR /app

# Copying the application files into the container
COPY . /app

# Install the application dependencies
RUN npm install

# Exposing running port
EXPOSE 8000

# startup command
CMD ["npm", "start"]
