#!/bin/bash

set -e  # Exit immediately if a command fails

echo "Cloning Aida-BOT repository..."
git clone https://github.com/Olatuyitony347/Aida-BOT.git && cd Aida-BOT

echo "Installing NVM..."
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash

echo "Loading NVM..."
source ~/.bashrc

echo "Installing Node.js 18..."
nvm install 18

echo "Using Node.js 18..."
nvm use 18

echo "Installing dependencies..."
npm install

echo "Making bot.sh executable..."
chmod +x bot.sh

echo "Starting bot.sh..."
./bot.sh

echo "Installation and bot execution completed successfully!"
