from flask import Flask, render_template, request, jsonify
import json
import os

app = Flask(__name__, static_folder='static', template_folder='templates')

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/3d")
def three_d():
    return render_template("3d_fabriek.html")

@app.route("/data")
def view_data():
    try:
        with open("data/inventory.json") as f:
            raw = json.load(f)

        parsed = {}
        for key, value in raw.items():
            if isinstance(value, str):
                try:
                    parsed[key] = json.loads(value)
                except Exception:
                    parsed[key] = value
            else:
                parsed[key] = value

        # 🚫 Ensure no old rentalPayments are lingering in the inventory blob
        parsed.pop("rentalPayments", None)

        # ✅ Load proper rentalPayments from separate file
        rental_payments_path = "data/rental_payments.json"
        if os.path.exists(rental_payments_path):
            with open(rental_payments_path) as f:
                parsed['rentalPayments'] = json.load(f)
        else:
            parsed['rentalPayments'] = []

        print("📦 Loaded keys from backend:", parsed.keys())
        return jsonify(parsed)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/save", methods=["POST"])
def save_data():
    try:
        data = request.json

        # Extract rental payments separately
        rental_payments = data.get("rentalPayments", [])

        # Remove rentalPayments before saving main data
        data.pop("rentalPayments", None)

        # Save main data to inventory.json
        with open("data/inventory.json", "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        # Save rental payments to rental_payments.json
        with open("data/rental_payments.json", "w", encoding="utf-8") as f:
            json.dump(rental_payments, f, indent=2, ensure_ascii=False)

        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)