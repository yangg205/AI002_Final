# Emotional Support System

A Vietnamese mental-health first-aid chatbot that combines the PSS-10 perceived
stress scale with the five coping skills from the WHO guide *Doing What Matters
in Times of Stress*. Answers are grounded in that document through RAG, and
every turn passes the guardrail layers before anything else runs.

## Run with Docker

```bash
cp .env.example .env          # then fill in GROQ_API_KEY and GEMINI_API_KEY
docker compose up --build -d
# open http://localhost:8501
```

```bash
docker compose logs -f app api
docker compose ps
docker compose restart app
docker compose down
chmod 777 vector_store eval    # only if the container hits permission errors
```

The same compose file also starts the frontend API at `http://localhost:8000`:

The `init-indexes` service prepares the WHO and kNN collections in the shared
volume before either interface starts, including when starting only `api`.
If initialization fails, inspect `docker compose logs init-indexes`, correct
the reported configuration/network error, then run `docker compose up -d` again.
The API health check uses port 8000; `rag_available` requires a nonempty WHO
collection as well as the Gemini key.

```bash
curl http://localhost:8000/api/health
curl -X POST http://localhost:8000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"Mình đang thấy hơi căng thẳng","history":[]}'
```

Available endpoints: `GET /api/health`, `POST /api/chat`,
`GET /api/assessment/questions`, and `POST /api/assessment/score`. Each chat
turn passes the safety guardrails first, then intent classification (LLM with
the kNN router). Advice questions retrieve matching WHO guide passages before
the answer is generated and cited; emotional sharing uses the conversation
response path. Set `API_CORS_ORIGINS` to the frontend origin(s) in production
instead of `*`.

Account endpoints: `POST /api/auth/register`, `POST /api/auth/login`,
`GET /api/auth/me`, `POST /api/auth/consent`, and
`POST /api/auth/consent/revoke`. Registration and login return an access token;
send it as `Authorization: Bearer <access_token>` to authenticated endpoints.
Tokens expire after 24 hours. With history consent enabled, use
`GET /api/history` to list conversations, `GET /api/history/{id}` to reopen one,
`GET /api/history/latest` to restore the latest, and
`POST /api/history/delete` to clear saved history. Trusted contacts are stored
per account through `GET`, `PUT`, and `DELETE /api/profile/trusted-contact`.

The app and API log request status, chat pipeline stages, retrieval outcomes,
database persistence, fallbacks, and exceptions to terminal output. They do not
log chat message contents. For Docker, view both services with
`docker compose logs -f app api`; filter to the API with
`docker compose logs -f api`. For a local run, start the API with
`uvicorn src.api:app --reload --port 8000` and Streamlit in another terminal.
Set `LOG_LEVEL=DEBUG` when you need more detailed diagnostics.
Usernames must be 3–32 characters. Passwords need at least 8 characters and
can use up to 72 UTF-8 bytes.

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"minhnguyen","password":"matkhau123"}'
curl -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"minhnguyen","password":"matkhau123"}'
curl http://localhost:8000/api/auth/me \
  -H 'Authorization: Bearer <access_token>'
```

## Browse the database

Adminer starts with `docker compose up -d` and restarts automatically with Docker.
To start just the database and Adminer web interface:

```bash
docker compose up -d adminer
```

Open http://localhost:8080 and choose **PostgreSQL**. Use server `db`,
username from `POSTGRES_USER`, password from `POSTGRES_PASSWORD`, and database
from `POSTGRES_DB` in `.env` (default username and database: `capstone`).
Click a table, then **Select data** to view saved rows.
Use `db` (port `5432`) inside Adminer; `localhost:5433` is for database clients
running directly on Windows, and `http://localhost:8080` is the Adminer web page.
The interface is available only on your local machine. Stop it with
`docker compose stop adminer`.

## Run without Docker

Requires Python 3.10+.

```bash
python3 -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env           # then fill in GROQ_API_KEY and GEMINI_API_KEY

# first run on a new machine: vector_store/ is gitignored, so build both indexes
python3 tools/index_documents.py    # WHO document -> collection who_dwm_vi
python3 tools/index_examples.py     # labeled examples -> collection knn_examples_vi

streamlit run src/app.py
```

Skipping the two index commands leaves the advice flow without WHO passages and
**silently disables guardrail layer 1b**. The app shows a short user-facing
notice; the technical reason is written to the terminal. Docker Compose runs
both indexes through `init-indexes` before starting the chat services; a manual
run does not.

```bash
streamlit run src/app.py --server.port 8502
```

## Build and inspect the RAG index

The existing WHO PDF and kNN JSONL schema are preserved. Additional reading on
music and dancing lives in `data/relaxation_documents.jsonl`, with NCCIH/WHO URLs
kept in retrieval metadata and displayed in chat citations. The 5/10-minute
exercise timers are app suggestions, not clinically validated treatment doses.
After adding documents or training examples, refresh both indexes:

```bash
docker compose exec api python tools/initialize_indexes.py
```

The document manifest includes the supplemental file hash, so normal startup
also detects additions. This updates retrieval and intent examples, not LLM weights.

```bash
python3 tools/index_documents.py                  # index if needed
python3 tools/index_documents.py --status         # vector store status
python3 tools/index_documents.py --force          # reindex regardless of manifest
python3 tools/index_documents.py --query "làm sao để tiếp đất"
```

## Build the kNN example index (layer 1b)

```bash
python3 tools/check_example_overlap.py            # leakage gate, no API calls
python3 tools/index_examples.py --status
python3 tools/index_examples.py                   # index if the manifest is stale
python3 tools/index_examples.py --force
python3 tools/index_examples.py --query "muốn biến mất" --kind risk
```

```bash
python3 tools/preview_chunks.py                   # chunk stats
python3 tools/preview_chunks.py --full            # full chunk text
python3 tools/tune_threshold.py                   # measured similarity per query group
```

Inside Docker:

```bash
docker compose exec app python tools/index_documents.py --force
```

## Run the evaluation suite

```bash
python3 eval/scripts/run_all.py --dry-run           # count API calls only
python3 eval/scripts/run_all.py                     # all 6 sections
python3 eval/scripts/run_all.py --no-cache          # ignore cache, always call the API
python3 eval/scripts/run_all.py --only guardrails   # repeatable: --only eval --only routing
python3 eval/scripts/run_all.py --only eval --no-rag
```

Sections: `eval` (reliability / fairness / robustness), `normalize`
(layer 0 keyword normalization, no API calls), `guardrails`, `knn`
(layer 1b threshold sweep on the dev split plus the ablation), `routing`,
`mapping`. Results append to `eval/output/results.md`; per-row
detail is overwritten in `eval/output/csv/`.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `GROQ_API_KEY` | — | Chat completions: guardrails layer 2, intent classification, empathetic replies, RAG answers, PSS-10 Likert mapping. Without it the chat falls back to scripted replies. |
| `GEMINI_API_KEY` | — | Embeddings for indexing and retrieval. Without it the advice flow returns a technical error instead of an answer. |
| `DATABASE_URL` | — | Postgres connection string for login and history. Without it the app runs in guest-only mode. |
| `API_CORS_ORIGINS` | `*` | Comma-separated frontend origins allowed to call the API. |
| `AUTH_TOKEN_SECRET` | — | Required by the account API. Generate one with `openssl rand -hex 32`; keep it private and stable so active tokens remain valid. |
| `LOG_LEVEL` | `INFO` | Terminal logging level for app and API (`DEBUG`, `INFO`, `WARNING`, or `ERROR`). |

Guests are never persisted: their turns live only in `st.session_state` and are
gone when the tab closes. A signed-in user who accepts the storage consent gets
their turns written to Postgres, always **after PII masking**, together with the
guardrail layer that fired, the intent labels from both sources, and the WHO
pages the answer came from. Each account can only read or delete its own rows,
and both "delete my history" and "delete my account" are available in the
sidebar.

Guardrail layers, in order: layer 0 normalizes the text for the keyword match,
layer 1 matches risk keywords, layer 1b votes with a kNN router over labeled
examples, layer 2 asks the LLM. They are OR-combined, so a later layer can only
add a block, never remove one. Layer 1b and the intent cross-check are behind
`KNN_RISK_ENABLED` / `KNN_INTENT_ENABLED` in `src/config/constants.py`.

Chat completions use temperature 0 and a fixed seed so the Streamlit interface
and API clients produce stable replies when both the message and conversation
history match. Replies allow up to 900 tokens, including the model's reasoning
budget, so guidance is less likely to be cut off mid-sentence.

## Project structure

```
capstone/
├── data/
│   ├── pss10_questions.csv     10 PSS-10 items: item_id, text_vi, reverse, options
│   ├── crisis_resources.json   crisis hotlines with operating hours
│   ├── who_dwm_vi.pdf          WHO source document for RAG
│   └── knn_examples.jsonl      labeled examples for the layer 1b router (train / dev)
├── src/
│   ├── config/
│   │   ├── __init__.py         re-export, so callers just do `import config; config.X`
│   │   ├── constants.py        paths, score/similarity thresholds, model names, env flags
│   │   ├── prompts.py          5 system prompts, one per LLM flow
│   │   └── copy_vi.py          user-facing Vietnamese text
│   ├── guardrails_keywords.py  risk keyword and regex lists
│   ├── guardrails.py           layer 1 check_keyword(), layer 2 classify_risk(), assess_risk()
│   ├── text_normalize.py       layer 0: teencode / split-letter / leet normalization for layer 1
│   ├── knn_router.py           layer 1b: kNN over labeled examples in ChromaDB
│   ├── masking.py              PII masking (phone / national ID / email) before outbound calls
│   ├── assessment.py           PSS-10 state machine and deterministic score()
│   ├── rag_engine.py           PDF extraction, chunking, embedding, ChromaDB, retrieve()
│   ├── llm.py                  Groq: chat, classify_intent, Likert mapping, grounded answers
│   ├── chat_pipeline.py        shared intent/RAG/chat routing for Streamlit and API clients
│   ├── api.py                  FastAPI endpoints for the frontend
│   └── app.py                  Streamlit application
├── tools/                      index_documents.py, index_examples.py, check_example_overlap.py,
│                               preview_chunks.py, tune_threshold.py
├── eval/
│   ├── scripts/
│   │   ├── run_all.py          all 6 evaluation sections, select with --only
│   │   ├── pipeline.py, report.py, cache.py, testdata.py, heuristics.py, clioptions.py
│   │   └── .cache/             cached API responses (gitignored)
│   ├── input/
│   │   ├── testset.jsonl       reliability / fairness / robustness (incl. teencode)
│   │   ├── routing_test.jsonl  intent routing
│   │   ├── bypass_test.jsonl   guardrails + storytelling bypass
│   │   ├── mapping_gold.csv    gold labels for Likert mapping
│   │   └── knn_holdout.jsonl   sealed holdout, scored once at the very end
│   └── output/
│       ├── results.md          appended run history with config snapshot
│       └── csv/                per-row detail, 8 files, UTF-8 with BOM for Excel
├── vector_store/               ChromaDB (gitignored, regenerable)
├── Dockerfile
├── entrypoint.sh
├── docker-compose.yml
├── requirements.txt
└── .env.example
```

## Note

This is a course project. It is not a diagnostic tool and does not replace a
mental health professional. In an emergency in Vietnam, call **115**.
