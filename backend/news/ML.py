import os
import spacy
from transformers import pipeline
from flask import Flask, request
from dotenv import load_dotenv
import torch
from yahooquery import search

load_dotenv()

#=========================================================================
# Purpose: provide machine learning functionalities through libraries
#=========================================================================

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
# names of organizations.
# Small, medium, large models: en_core_web_sm, en_core_web_md, en_core_web_lg
nlp = spacy.load(
    "en_core_web_lg", disable=["parser", "tagger", "lemmatizer", "attribute_ruler"]
)

finbert_sentiment_pipeline = pipeline(
    "sentiment-analysis", model="yiyanghkust/finbert-tone", device=0
)

if torch.cuda.is_available():
    print("GPU Enabled. GPU Device Name:", torch.cuda.get_device_name(0))

app = Flask(__name__)


# ------------------------------------------------------------------------
# Perform sentiment Analysis in parallel
# \param texts: list of list of texts 
# ------------------------------------------------------------------------
@app.route("/analyze", methods=["POST"])
def analyze():
    text_list = request.json
    
    # Keep track of how many items are in each list to restore them
    data_to_process = [] # Combined list of all texts to process
    num_text = [] # List to hold how many text are in each list
    for texts in text_list:
        num_text.append(len(texts))
        data_to_process.extend(texts)
    
    analysis = []
    if data_to_process:
        # Divide into smaller batches to avoid memory issues
        try:
            results = finbert_sentiment_pipeline(data_to_process, batch_size=BATCH_SIZE)

            for value in results:
                label, score = value["label"], value["score"]
                determination = 0

                # Accept sentiment anlysis is Positive or Negative
                # if the probability is not too close to call
                # if not (QUESTIONABLE_LOWER <= score <= QUESTIONABLE_UPPER):
                if label == "Positive":
                    determination = score
                elif label == "Negative":
                    determination = -1
                else:
                    determination = 0

                analysis.append(determination)

        except RuntimeError as err:
            print(f"Batch size before error: {BATCH_SIZE}")
            print("Error:", err)

    # Return the scores in their respecive lists
    results = []
    curr_ind = 0
    for count in num_text:
        results.append(analysis[curr_ind : curr_ind + count])
        curr_ind += count
        
    return {"results": results}


# ------------------------------------------------------------------------
# Find ticker symbols of organizations witin texts.
# ------------------------------------------------------------------------
@app.route("/findTickers", methods=["POST"])
def findOrgs():
    texts = request.json
    org_names = set()
    num_cores = 1 if (PROCESSOR == 0) else AVAILABLE_CORES
    batch_size = 256 if (PROCESSOR == 0) else 16

    # Find with spacy
    try:
        for doc in nlp.pipe(texts, batch_size=batch_size, n_process=num_cores):
            orgs = [ent.text for ent in doc.ents if ent.label_ == "ORG"]

            for org in orgs:
                org_names.add(org)
    except RuntimeError as err:
        print(f"Failed to find orgs from text with spacy")
        print("Error:", err)

    ticker_symbols = []
    for org in org_names:
        print("searching for:", org)
        try:
            item = search(news_count=0, first_quote=True, query=org)
            print(item.get("symbol"))
            if item.get("symbol") != None:
                ticker_symbols.append(item.get("symbol"))
        except Exception as e:
            print(f"Error searching for ticker symbol for {org}: {e}")
            
    # TODO: could try removing everything after verb to get majority of cases
    # TODO: could also use fuzzy match to see if stock name from yahoo news
    # kinda matches resulting text
    return {"symbols": ticker_symbols}


# ------------------------------------------------------------------------
# The app
# ------------------------------------------------------------------------
if __name__ == "__main__":
    app.run(
        debug=False,
        port=REQUEST_PORT,
        ssl_context=("../../cert/cert.pem", "../../cert/key.pem"),
    )
