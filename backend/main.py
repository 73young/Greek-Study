import hashlib
import hmac
import os
import sqlite3
import uuid
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
DB_PATH = os.environ.get("DB_PATH", "/workspace/data/app.db")
DIST_PATH = Path(os.environ.get("DIST_PATH", "/workspace/dist"))
COOKIE_NAME = "greek_learner"
ADMIN_COOKIE_NAME = "greek_admin"
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
def get_db():
    os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn
def init_db():
    with get_db() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS lessons (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE);
        CREATE TABLE IF NOT EXISTS words (
          id INTEGER PRIMARY KEY AUTOINCREMENT, lesson_id INTEGER NOT NULL, greek TEXT NOT NULL,
          pronunciation TEXT NOT NULL, part_of_speech TEXT NOT NULL, meaning TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(lesson_id, greek),
          FOREIGN KEY(lesson_id) REFERENCES lessons(id)
        );
        CREATE TABLE IF NOT EXISTS word_forms (
          id INTEGER PRIMARY KEY AUTOINCREMENT, word_id INTEGER NOT NULL, form_text TEXT NOT NULL,
          grammar_label TEXT NOT NULL, gloss TEXT NOT NULL DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(word_id, form_text, grammar_label), FOREIGN KEY(word_id) REFERENCES words(id)
        );
        CREATE TABLE IF NOT EXISTS sentence_tests (
          id INTEGER PRIMARY KEY AUTOINCREMENT, lesson_id INTEGER NOT NULL, greek_text TEXT NOT NULL,
          korean_answer TEXT NOT NULL, hint TEXT NOT NULL DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(lesson_id, greek_text), FOREIGN KEY(lesson_id) REFERENCES lessons(id)
        );
        CREATE TABLE IF NOT EXISTS learners (id TEXT PRIMARY KEY, created_at TEXT DEFAULT CURRENT_TIMESTAMP, last_seen_at TEXT DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS learner_wrong_notes (
          learner_id TEXT NOT NULL, word_id INTEGER NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY(learner_id, word_id), FOREIGN KEY(learner_id) REFERENCES learners(id), FOREIGN KEY(word_id) REFERENCES words(id)
        );
        CREATE TABLE IF NOT EXISTS learner_state (
          learner_id TEXT NOT NULL, state_key TEXT NOT NULL, state_value TEXT NOT NULL,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(learner_id, state_key), FOREIGN KEY(learner_id) REFERENCES learners(id)
        );
        """)
        conn.execute("ALTER TABLE sentence_tests ADD COLUMN source_reference TEXT NOT NULL DEFAULT ''") if "source_reference" not in [row[1] for row in conn.execute("PRAGMA table_info(sentence_tests)").fetchall()] else None
        conn.execute("ALTER TABLE sentence_tests ADD COLUMN source_checked_at TEXT NOT NULL DEFAULT ''") if "source_checked_at" not in [row[1] for row in conn.execute("PRAGMA table_info(sentence_tests)").fetchall()] else None
        for lesson_name in ["1과", "2과", "3과"]:
            conn.execute("INSERT OR IGNORE INTO lessons (name) VALUES (?)", (lesson_name,))
        lesson = conn.execute("SELECT id FROM lessons WHERE name = '1과'").fetchone()
        conn.executemany(
            "INSERT OR IGNORE INTO words (lesson_id, greek, pronunciation, part_of_speech, meaning) VALUES (?, ?, ?, ?, ?)",
            [(lesson["id"], "ἀκούω", "아쿠오", "동사", "듣다"), (lesson["id"], "βλέπω", "블레포", "동사", "보다"), (lesson["id"], "λόγος", "로고스", "명사", "말씀")],
        )
        for base, form_text, grammar_label, gloss in [
            ("ἀκούω", "ἀκούεις", "현재 능동 직설법 2인칭 단수", "너는 듣는다"),
            ("ἀκούω", "ἀκούει", "현재 능동 직설법 3인칭 단수", "그/그녀는 듣는다"),
            ("βλέπω", "βλέπεις", "현재 능동 직설법 2인칭 단수", "너는 본다"),
            ("βλέπω", "βλέπει", "현재 능동 직설법 3인칭 단수", "그/그녀는 본다"),
            ("λόγος", "λόγου", "남성 단수 속격", "말씀의"), ("λόγος", "λόγῳ", "남성 단수 여격", "말씀에게 / 말씀으로"),
            ("λόγος", "λόγον", "남성 단수 대격", "말씀을"),
        ]:
            word = conn.execute("SELECT id FROM words WHERE greek = ?", (base,)).fetchone()
            if word:
                conn.execute("INSERT OR IGNORE INTO word_forms (word_id, form_text, grammar_label, gloss) VALUES (?, ?, ?, ?)", (word["id"], form_text, grammar_label, gloss))
        conn.executemany(
            "INSERT OR IGNORE INTO sentence_tests (lesson_id, greek_text, korean_answer, hint, source_reference, source_checked_at) VALUES (?, ?, ?, ?, ?, ?)",
            [
                (lesson["id"], "αὐτὸς δὲ εἶπεν· Μενοῦν μακάριοι οἱ ἀκούοντες τὸν λόγον τοῦ θεοῦ καὶ φυλάσσοντες.", "오히려 하나님의 말씀을 듣고 지키는 사람들이 복이 있다.", "ἀκούοντες: 듣는 사람들 · λόγον: 말씀을", "누가복음 11:28 · SBLGNT", "2026-09-28"),
                (lesson["id"], "Ἐν ἀρχῇ ἦν ὁ λόγος.", "태초에 말씀이 계셨다.", "ἐν ἀρχῇ: 태초에 · λόγος: 말씀", "요한복음 1:1 앞부분 · SBLGNT", "2026-09-28"),
            ],
        )
        old_sentence = conn.execute(
            "SELECT id FROM sentence_tests WHERE lesson_id = ? AND greek_text = ?",
            (lesson["id"], "Μενοῦν μακάριοι οἱ ἀκούοντες τὸν λόγον τοῦ θεοῦ καὶ φυλάσσοντες."),
        ).fetchone()
        verified_sentence = conn.execute(
            "SELECT id FROM sentence_tests WHERE lesson_id = ? AND greek_text = ?",
            (lesson["id"], "αὐτὸς δὲ εἶπεν· Μενοῦν μακάριοι οἱ ἀκούοντες τὸν λόγον τοῦ θεοῦ καὶ φυλάσσοντες."),
        ).fetchone()
        if old_sentence and verified_sentence:
            conn.execute("DELETE FROM sentence_tests WHERE id = ?", (old_sentence["id"],))
        elif old_sentence:
            conn.execute(
                "UPDATE sentence_tests SET greek_text = ?, source_reference = ?, source_checked_at = ? WHERE id = ?",
                ("αὐτὸς δὲ εἶπεν· Μενοῦν μακάριοι οἱ ἀκούοντες τὸν λόγον τοῦ θεοῦ καὶ φυλάσσοντες.", "누가복음 11:28 · SBLGNT", "2026-09-28", old_sentence["id"]),
            )
app = FastAPI()
init_db()
class WordInput(BaseModel):
    greek: str
    pronunciation: str
    part_of_speech: str
    meaning: str
class BatchWords(BaseModel):
    words: list[WordInput]
class StateInput(BaseModel):
    key: str
    value: str
class AdminLogin(BaseModel):
    password: str
def learner_id(request: Request) -> str:
    value = request.cookies.get(COOKIE_NAME)
    if not value:
        raise HTTPException(401, "학습 환경을 준비하고 있어요. 잠시 후 다시 시도해 주세요.")
    return value
def admin_token() -> str:
    return hmac.new(ADMIN_PASSWORD.encode(), b"greek-study-admin", hashlib.sha256).hexdigest()
def is_admin(request: Request) -> bool:
    return bool(ADMIN_PASSWORD) and hmac.compare_digest(request.cookies.get(ADMIN_COOKIE_NAME, ""), admin_token())
def require_admin(request: Request):
    if not is_admin(request):
        raise HTTPException(403, "관리자만 학습 자료를 추가할 수 있어요.")
@app.get("/api/health")
def health():
    return {"ok": True}
@app.post("/api/session")
def session(request: Request, response: Response):
    learner = request.cookies.get(COOKIE_NAME) or uuid.uuid4().hex
    with get_db() as conn:
        conn.execute("INSERT OR IGNORE INTO learners (id) VALUES (?)", (learner,))
        conn.execute("UPDATE learners SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?", (learner,))
    response.set_cookie(COOKIE_NAME, learner, max_age=31536000, httponly=True, samesite="lax", secure=os.environ.get("COOKIE_SECURE", "false").lower() == "true")
    return {"ok": True}
@app.get("/api/admin/status")
def admin_status(request: Request):
    return {"is_admin": is_admin(request), "configured": bool(ADMIN_PASSWORD)}
@app.post("/api/admin/login")
def admin_login(payload: AdminLogin, response: Response):
    if not ADMIN_PASSWORD:
        raise HTTPException(503, "관리자 비밀번호가 아직 설정되지 않았어요.")
    if not hmac.compare_digest(payload.password, ADMIN_PASSWORD):
        raise HTTPException(401, "비밀번호를 다시 확인해 주세요.")
    response.set_cookie(ADMIN_COOKIE_NAME, admin_token(), max_age=28800, httponly=True, samesite="lax", secure=os.environ.get("COOKIE_SECURE", "false").lower() == "true")
    return {"ok": True}
@app.post("/api/admin/logout")
def admin_logout(response: Response):
    response.delete_cookie(ADMIN_COOKIE_NAME)
    return {"ok": True}
@app.get("/api/admin/overview")
def admin_overview(request: Request):
    require_admin(request)
    with get_db() as conn:
        learner_count = conn.execute("SELECT COUNT(*) FROM learners").fetchone()[0]
        word_count = conn.execute("SELECT COUNT(*) FROM words").fetchone()[0]
        form_count = conn.execute("SELECT COUNT(*) FROM word_forms").fetchone()[0]
        sentence_count = conn.execute("SELECT COUNT(*) FROM sentence_tests").fetchone()[0]
        lessons = conn.execute("SELECT l.id, l.name, COUNT(w.id) AS word_count FROM lessons l LEFT JOIN words w ON w.lesson_id = l.id GROUP BY l.id ORDER BY l.id").fetchall()
    return {"learners": learner_count, "words": word_count, "forms": form_count, "sentences": sentence_count, "lessons": [dict(row) for row in lessons]}
@app.get("/api/admin/lessons/{lesson_id}/words")
def admin_words(lesson_id: int, request: Request):
    require_admin(request)
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM words WHERE lesson_id = ? ORDER BY id", (lesson_id,)).fetchall()
    return [dict(row) for row in rows]
@app.delete("/api/admin/words/{word_id}")
def delete_word(word_id: int, request: Request):
    require_admin(request)
    with get_db() as conn:
        cursor = conn.execute("DELETE FROM words WHERE id = ?", (word_id,))
        if cursor.rowcount == 0:
            raise HTTPException(404, "단어를 찾을 수 없습니다.")
    return {"ok": True}
@app.get("/api/lessons")
def lessons():
    with get_db() as conn:
        rows = conn.execute("SELECT l.id, l.name, COUNT(w.id) AS word_count FROM lessons l LEFT JOIN words w ON l.id = w.lesson_id GROUP BY l.id ORDER BY l.id").fetchall()
    return [dict(row) for row in rows]
@app.get("/api/lessons/{lesson_id}/forms")
def get_forms(lesson_id: int):
    with get_db() as conn:
        rows = conn.execute("SELECT f.*, w.greek, w.pronunciation, w.part_of_speech, w.meaning FROM word_forms f JOIN words w ON w.id = f.word_id WHERE w.lesson_id = ? ORDER BY w.id, f.id", (lesson_id,)).fetchall()
    return [dict(row) for row in rows]
@app.get("/api/lessons/{lesson_id}/sentences")
def get_sentences(lesson_id: int):
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM sentence_tests WHERE lesson_id = ? ORDER BY id", (lesson_id,)).fetchall()
    return [dict(row) for row in rows]
@app.get("/api/lessons/{lesson_id}/words")
def get_words(lesson_id: int):
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM words WHERE lesson_id = ? ORDER BY id", (lesson_id,)).fetchall()
    return [dict(row) for row in rows]
@app.post("/api/lessons/{lesson_id}/words")
def add_words(lesson_id: int, payload: BatchWords, request: Request):
    require_admin(request)
    if not payload.words:
        raise HTTPException(400, "추가할 단어가 없습니다.")
    with get_db() as conn:
        if not conn.execute("SELECT id FROM lessons WHERE id = ?", (lesson_id,)).fetchone():
            raise HTTPException(404, "과를 찾을 수 없습니다.")
        added = 0
        for word in payload.words:
            values = [word.greek.strip(), word.pronunciation.strip(), word.part_of_speech.strip(), word.meaning.strip()]
            if not all(values):
                raise HTTPException(400, "헬라어, 발음, 품사, 뜻을 모두 입력해 주세요.")
            added += conn.execute("INSERT OR IGNORE INTO words (lesson_id, greek, pronunciation, part_of_speech, meaning) VALUES (?, ?, ?, ?, ?)", (lesson_id, *values)).rowcount
    return {"added": added}
@app.get("/api/wrong-notes")
def wrong_notes(request: Request, lesson_id: Optional[int] = None):
    learner = learner_id(request)
    query, args = "SELECT w.* FROM learner_wrong_notes n JOIN words w ON w.id = n.word_id WHERE n.learner_id = ?", [learner]
    if lesson_id is not None:
        query += " AND w.lesson_id = ?"
        args.append(lesson_id)
    with get_db() as conn:
        rows = conn.execute(query + " ORDER BY n.created_at DESC", args).fetchall()
    return [dict(row) for row in rows]
@app.post("/api/wrong-notes/{word_id}")
def add_wrong_note(word_id: int, request: Request):
    learner = learner_id(request)
    with get_db() as conn:
        if not conn.execute("SELECT id FROM words WHERE id = ?", (word_id,)).fetchone():
            raise HTTPException(404, "단어를 찾을 수 없습니다.")
        conn.execute("INSERT OR IGNORE INTO learner_wrong_notes (learner_id, word_id) VALUES (?, ?)", (learner, word_id))
    return {"ok": True}
@app.delete("/api/wrong-notes/{word_id}")
def remove_wrong_note(word_id: int, request: Request):
    learner = learner_id(request)
    with get_db() as conn:
        conn.execute("DELETE FROM learner_wrong_notes WHERE learner_id = ? AND word_id = ?", (learner, word_id))
    return {"ok": True}
@app.get("/api/state/{key}")
def get_state(key: str, request: Request):
    learner = learner_id(request)
    with get_db() as conn:
        row = conn.execute("SELECT state_value FROM learner_state WHERE learner_id = ? AND state_key = ?", (learner, key)).fetchone()
    return {"value": row["state_value"] if row else None}
@app.put("/api/state")
def save_state(payload: StateInput, request: Request):
    learner = learner_id(request)
    with get_db() as conn:
        conn.execute("INSERT INTO learner_state (learner_id, state_key, state_value, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(learner_id, state_key) DO UPDATE SET state_value = excluded.state_value, updated_at = CURRENT_TIMESTAMP", (learner, payload.key, payload.value))
    return {"ok": True}
if DIST_PATH.is_dir():
    app.mount("/", StaticFiles(directory=str(DIST_PATH), html=True), name="frontend")
