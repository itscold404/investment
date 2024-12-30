import os
from transformers import pipeline
from flask import Flask, request, jsonify
from dotenv import load_dotenv

load_dotenv()

# ------------------------------------------------------------------------
# Constants and other globals
# ------------------------------------------------------------------------
BATCH_SIZE = 128  # The number of articles to analyze in parallel
REQUEST_PORT = os.getenv("SENTIMENT_ANALYSIS_PORT")  # Port to listen for requests

# Lower bound of probability such that the sentiment analysis is too
# close to call
QUESTIONABLE_LOWER = 0.5

# Upper bound of probability such that the sentiment analysis is too
# close to call
QUESTIONABLE_UPPER = 0.55

print("SENTIMENT ANALYSIS: ... LOADING")

app = Flask(__name__)

# Set device=0 to use GPU
# TODO: Fix CUDA installation to enable GPU usage
finbert_sentiment_pipeline = pipeline(
    "sentiment-analysis", model="yiyanghkust/finbert-tone", device=0
)


# ------------------------------------------------------------------------
# Perform sentiment Analysis all news on the stocks in parallel
# ------------------------------------------------------------------------
@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.json
    print(data)

    analysis = []
    if data:
        # Divide into smaller batches to avoid memory issues
        for i in range(0, len(data), BATCH_SIZE):
            try:
                batch = data[i : i + BATCH_SIZE]
                results = [finbert_sentiment_pipeline(text) for text in batch]
                # print(results)

                for value in results:
                    print(value)
                    label, score = value[0]["label"], value[0]["score"]
                    determination = 0

                    # Accept sentiment anlysis is Positive or Negative
                    # if the probability is not too close to call
                    if not (QUESTIONABLE_LOWER <= score <= QUESTIONABLE_UPPER):
                        if label == "Positive":
                            determination = 1
                        elif label == "Negative":
                            determination = -1

                    analysis.append(determination)

            except RuntimeError as err:
                print(f"Batch size before error: {BATCH_SIZE}")
                print("error:", err)

    return {"analysis": analysis}


if __name__ == "__main__":
    app.run(port=REQUEST_PORT)
