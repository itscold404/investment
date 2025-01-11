## Ensure dependencies are installed by running:

- install node_modules: npm ci
- start new virtual machine (recommended): .\\venv\Scripts\activate
  - install python requirements: pip install -r requirements.txt
  - note: may need to change python interpreter from virtual environment in settings if continuing development in IDE
  - note: ensure BATCH_SIZE in sentimentAnalysis is appropriate for the amount of computing resources you have

## How to run program (need 3 terminals for starting 3 things):

- Generate the keys and certs in the certs directory
- start front-end: npm dev run (1st terminal)
- start back-end:
  - get into backend directory: cd backend
    - start python sentiment analysis by... (2nd terminal)
      - starting virtual machine: .\\venv\Scripts\activate
      - starting the API: python sentimentAnalysis.py
    - start server.js: node server.js (3rd terminal)
