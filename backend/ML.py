import os
import spacy
from transformers import pipeline
from flask import Flask, request, jsonify
from dotenv import load_dotenv
import torch

load_dotenv()

# ------------------------------------------------------------------------
# Constants and other globals
# ------------------------------------------------------------------------
BATCH_SIZE = 128  # The number of articles to analyze in parallel
REQUEST_PORT = os.getenv("ML_PORT")  # Port to listen for requests
PROCESSOR = int(os.getenv("PROCESSOR"))  # If CPU or GPU should be used

# How many CPU cores are availble to use for spacy
AVAILABLE_CORES = int(os.getenv("AVAILABLE_CORES"))

if PROCESSOR == 0:
    spacy.require_gpu()

# Load spaCy's English model. Disable components not used for recognizing
# names of organizations
nlp = spacy.load(
    "en_core_web_sm", disable=["parser", "tagger", "lemmatizer", "attribute_ruler"]
)

finbert_sentiment_pipeline = pipeline(
    "sentiment-analysis", model="yiyanghkust/finbert-tone", device=0
)

if torch.cuda.is_available():
    print("GPU Enabled. GPU Device Name:", torch.cuda.get_device_name(0))

app = Flask(__name__)


# ------------------------------------------------------------------------
# Perform sentiment Analysis all news on the stocks in parallel
# ------------------------------------------------------------------------
@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.json

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
                    # if not (QUESTIONABLE_LOWER <= score <= QUESTIONABLE_UPPER):
                    if label == "Positive":
                        determination = 1
                    elif label == "Negative":
                        determination = -1

                    analysis.append(determination)

            except RuntimeError as err:
                print(f"Batch size before error: {BATCH_SIZE}")
                print("error:", err)

    return {"analysis": analysis}


# ------------------------------------------------------------------------
# Find names of organizations witin texts.
# ------------------------------------------------------------------------
@app.route("/findOrgs", methods=["POST"])
def findOrgs():
    texts = request.json
    print(texts)
    org_names = set()
    num_cores = 1 if (PROCESSOR == 0) else AVAILABLE_CORES

    for doc in nlp.pipe(texts, batch_size=50, n_process=num_cores):
        orgs = [ent.text for ent in doc.ents if ent.label_ == "ORG"]

        for org in orgs:
            org_names.add(org)

    return {"orgs": list(org_names)}


# ------------------------------------------------------------------------
# The app
# ------------------------------------------------------------------------
if __name__ == "__main__":
    app.run(
        debug=False,
        port=REQUEST_PORT,
        ssl_context=("../cert/cert.pem", "../cert/key.pem"),
    )
