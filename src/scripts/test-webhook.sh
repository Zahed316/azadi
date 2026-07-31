#!/data/data/com.termux/files/usr/bin/bash

# Ensure secret token is provided to match the worker env
SECRET="TEST_SECRET"
URL="http://localhost:8787/webhook"

echo "=== Testing /start command ==="
curl -s -X POST $URL \
  -H "X-Telegram-Bot-Api-Secret-Token: $SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "update_id": 1,
    "message": {
      "message_id": 1,
      "from": {"id": 123, "is_bot": false, "first_name": "User"},
      "chat": {"id": 123, "type": "private"},
      "date": 1690000000,
      "text": "/start"
    }
  }'
echo -e "\n\n=== Testing AI message ==="
curl -s -X POST $URL \
  -H "X-Telegram-Bot-Api-Secret-Token: $SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "update_id": 2,
    "message": {
      "message_id": 2,
      "from": {"id": 123, "is_bot": false, "first_name": "User"},
      "chat": {"id": 123, "type": "private"},
      "date": 1690000000,
      "text": "What is your best coffee?"
    }
  }'
echo -e "\n\n=== Testing Admin List Products ==="
curl -s -X POST $URL \
  -H "X-Telegram-Bot-Api-Secret-Token: $SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "update_id": 3,
    "message": {
      "message_id": 3,
      "from": {"id": 93792739, "is_bot": false, "first_name": "Admin"},
      "chat": {"id": 93792739, "type": "private"},
      "date": 1690000000,
      "text": "/list_products"
    }
  }'
echo -e "\nDone."
