import json
import os

backup_file = "data/localStorage_backup.json"
target_file = "data/inventory.json"

with open(backup_file) as f:
    data = json.load(f)

with open(target_file, "w") as f:
    json.dump(data, f, indent=2)

print("✅ Imported localStorage_backup.json into inventory.json")
