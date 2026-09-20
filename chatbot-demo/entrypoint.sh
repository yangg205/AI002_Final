#!/bin/sh
set -e

if [ -n "$DATABASE_URL" ]; then
    echo "[entrypoint] Cho Postgres san sang..."
    i=0
    until python3 -c "import sys, psycopg; psycopg.connect(sys.argv[1], connect_timeout=3).close()" "$DATABASE_URL" 2>/dev/null; do
        i=$((i + 1))
        if [ "$i" -ge 30 ]; then
            echo "[entrypoint] CANH BAO: khong ket noi duoc Postgres sau 30 lan thu." \
                 "App van khoi dong nhung se chay o che do khach (khong dang nhap duoc)."
            break
        fi
        sleep 2
    done
    if [ "$i" -lt 30 ]; then
        echo "[entrypoint] Postgres da san sang."
    fi
else
    echo "[entrypoint] Khong co DATABASE_URL, bo qua Postgres." \
         "App chay o che do khach, khong luu lich su."
fi

if [ -n "$GEMINI_API_KEY" ]; then
    echo "[entrypoint] Kiem tra vector store, index neu can..."
    if ! python3 tools/index_documents.py; then
        echo "[entrypoint] CANH BAO: index that bai (xem log phia tren)." \
             "App van khoi dong nhung luong tu van RAG se bao loi."
    fi

    echo "[entrypoint] Kiem tra bo cau mau kNN, index neu can..."
    if ! python3 tools/index_examples.py; then
        echo "[entrypoint] CANH BAO: index bo cau mau that bai." \
             "Lop 1b (kNN) se tu tat, lop 1 va lop 2 van chay."
    fi
else
    echo "[entrypoint] CANH BAO: thieu GEMINI_API_KEY trong bien moi truong," \
         "bo qua buoc index. Luong tu van RAG se bao loi."
fi

echo "[entrypoint] Khoi dong Streamlit..."
exec streamlit run src/app.py
