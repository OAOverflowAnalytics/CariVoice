# CariVoice
An LLM that primarily utilizes speech to turn into text and product images/videos. The primary use case is to be used as a transcription system for Caribbean folklore stories and plays.

# Setup
To start using CariVoice, fork or clone this repository. You will see two folders: `frontend` and `backend`.

Within the `frontend` folder, open a terminal within this folder and run the command:
```bash
npm run build && npm start
```

Leave this running, and navigate to the backend folder. Open another terminal in this folder and run the command:
```bash
python app.py
```

By default, the application should be running on `http://127.0.0.1:5000` but you can check the terminal of the backend to see the URL to navigate to.