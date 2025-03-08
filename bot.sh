#!/bin/bash

LOG_FILE="bot.log"      # Log file to monitor
NODE_SCRIPT="main.js"   # The main script to run
DELAY=2                 # Delay before restarting (optional)

# Function to reset account and token files
reset_files() {
    echo "Resetting accounts.txt and token.txt..."
    rm -rf accounts.txt token.txt
    touch accounts.txt token.txt
}

# Function to start the bot and log output
start_bot() {
    reset_files  # Clear old data before running
    echo "Starting bot..."
    node "$NODE_SCRIPT" | tee "$LOG_FILE"
}

# Infinite loop to monitor the log file
while true; do
    start_bot

    # Check if the bot finished processing
    if grep -q "Bot finished processing all tokens." "$LOG_FILE"; then
        echo "Restarting bot..."
        sleep "$DELAY"  # Optional delay before restart
    else
        echo "Bot exited unexpectedly, restarting..."
    fi
done
