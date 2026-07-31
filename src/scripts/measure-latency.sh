#!/data/data/com.termux/files/usr/bin/bash

URL="https://azadi-coffee-bot.zahedrastgar316.workers.dev/webhook"

echo "=== Measuring /start latency ==="
curl -s -w "Latency: %{time_total}s\n" -o /dev/null -X POST $URL \
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

echo -e "\n=== Measuring /list_products latency ==="
curl -s -w "Latency: %{time_total}s\n" -o /dev/null -X POST $URL \
  -H "Content-Type: application/json" \
  -d '{
    "update_id": 2,
    "message": {
      "message_id": 2,
      "from": {"id": 93792739, "is_bot": false, "first_name": "Admin"},
      "chat": {"id": 93792739, "type": "private"},
      "date": 1690000000,
      "text": "/list_products"
    }
  }'

echo -e "\n=== Measuring AI text message latency ==="
curl -s -w "Latency: %{time_total}s\n" -o /dev/null -X POST $URL \
  -H "Content-Type: application/json" \
  -d '{
    "update_id": 3,
    "message": {
      "message_id": 3,
      "from": {"id": 123, "is_bot": false, "first_name": "User"},
      "chat": {"id": 123, "type": "private"},
      "date": 1690000000,
      "text": "Tell me about your coffee beans."
    }
  }'
