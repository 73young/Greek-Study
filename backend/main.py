import hashlib
import hmac
import os
import sqlite3
import unicodedata
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
DB_PATH = os.environ.get("DB_PATH", "/workspace/data/app.db")
DIST_PATH = Path(os.environ.get("DIST_PATH", "/workspace/dist"))
COOKIE_NAME = "greek_learner"
ADMIN_COOKIE_NAME = "greek_admin"
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "").strip() or "466801"
def normalize_text(value: str) -> str:
    return unicodedata.normalize("NFC", value).replace("\u200b", "").replace("\u200c", "").replace("\u200d", "").replace("\ufeff", "").replace("\u00a0", " ").strip()
def get_db():
    os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn
def backup_existing_db():
    if not os.path.exists(DB_PATH):
        return
    backup_dir = os.path.join(os.path.dirname(DB_PATH) or ".", "backups")
    os.makedirs(backup_dir, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = os.path.join(backup_dir, f"app-before-update-{stamp}.db")
    source = sqlite3.connect(DB_PATH)
    target = sqlite3.connect(backup_path)
    try:
        source.backup(target)
    finally:
        target.close()
        source.close()
    backups = sorted(Path(backup_dir).glob("app-before-update-*.db"), key=lambda item: item.stat().st_mtime, reverse=True)
    for old_backup in backups[10:]:
        old_backup.unlink(missing_ok=True)
def init_db():
    backup_existing_db()
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
        conn.execute("ALTER TABLE lessons ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0") if "sort_order" not in [row[1] for row in conn.execute("PRAGMA table_info(lessons)").fetchall()] else None
        conn.execute("UPDATE lessons SET sort_order = id WHERE sort_order = 0")
        conn.execute("ALTER TABLE sentence_tests ADD COLUMN source_reference TEXT NOT NULL DEFAULT ''") if "source_reference" not in [row[1] for row in conn.execute("PRAGMA table_info(sentence_tests)").fetchall()] else None
        conn.execute("ALTER TABLE sentence_tests ADD COLUMN source_checked_at TEXT NOT NULL DEFAULT ''") if "source_checked_at" not in [row[1] for row in conn.execute("PRAGMA table_info(sentence_tests)").fetchall()] else None
        conn.execute("ALTER TABLE sentence_tests ADD COLUMN source_url TEXT NOT NULL DEFAULT ''") if "source_url" not in [row[1] for row in conn.execute("PRAGMA table_info(sentence_tests)").fetchall()] else None
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
            "INSERT OR IGNORE INTO sentence_tests (lesson_id, greek_text, korean_answer, hint, source_reference, source_checked_at, source_url) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
                (lesson["id"], "αὐτὸς δὲ εἶπεν· Μενοῦν μακάριοι οἱ ἀκούοντες τὸν λόγον τοῦ θεοῦ καὶ φυλάσσοντες.", "오히려 하나님의 말씀을 듣고 지키는 사람들이 복이 있다.", "ἀκούοντες: 듣는 사람들 · λόγον: 말씀을", "누가복음 11:28 · SBLGNT", "2026-09-28", "https://www.biblegateway.com/passage/?search=%CE%9A%CE%91%CE%A4%CE%91+%CE%9B%CE%9F%CE%A5%CE%9A%CE%91%CE%9D+11%3A28-30&version=SBLGNT"),
                (lesson["id"], "Ἐν ἀρχῇ ἦν ὁ λόγος.", "태초에 말씀이 계셨다.", "ἐν ἀρχῇ: 태초에 · λόγος: 말씀", "요한복음 1:1 앞부분 · SBLGNT", "2026-09-28", "https://www.biblegateway.com/passage/?search=john+1%3A1&version=SBLGNT"),
            ],
        )
        conn.execute(
            "UPDATE sentence_tests SET source_url = ? WHERE lesson_id = ? AND greek_text = ?",
            ("https://www.biblegateway.com/passage/?search=%CE%9A%CE%91%CE%A4%CE%91+%CE%9B%CE%9F%CE%A5%CE%9A%CE%91%CE%9D+11%3A28-30&version=SBLGNT", lesson["id"], "αὐτὸς δὲ εἶπεν· Μενοῦν μακάριοι οἱ ἀκούοντες τὸν λόγον τοῦ θεοῦ καὶ φυλάσσοντες."),
        )
        conn.execute(
            "UPDATE sentence_tests SET source_url = ? WHERE lesson_id = ? AND greek_text = ?",
            ("https://www.biblegateway.com/passage/?search=john+1%3A1&version=SBLGNT", lesson["id"], "Ἐν ἀρχῇ ἦν ὁ λόγος."),
        )
        conn.execute(
            "DELETE FROM sentence_tests WHERE lesson_id = ? AND source_reference = ''",
            (lesson["id"],),
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
class LessonInput(BaseModel):
    name: str
class WordUpdateInput(BaseModel):
    greek: str
    pronunciation: str
    part_of_speech: str
    meaning: str
class FormInput(BaseModel):
    word_id: int
    form_text: str
    grammar_label: str
    gloss: str = ""
class LessonOrderInput(BaseModel):
    lesson_ids: list[int]
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
        lessons = conn.execute("SELECT l.id, l.name, l.sort_order, COUNT(w.id) AS word_count FROM lessons l LEFT JOIN words w ON w.lesson_id = l.id GROUP BY l.id ORDER BY l.sort_order, l.id").fetchall()
    return {"learners": learner_count, "words": word_count, "forms": form_count, "sentences": sentence_count, "lessons": [dict(row) for row in lessons]}
@app.post("/api/admin/lessons")
def create_lesson(payload: LessonInput, request: Request):
    require_admin(request)
    name = payload.name.strip()
    if not name:
        raise HTTPException(400, "과 이름을 입력해 주세요.")
    if len(name) > 40:
        raise HTTPException(400, "과 이름은 40자 이내로 입력해 주세요.")
    with get_db() as conn:
        next_order = conn.execute("SELECT COALESCE(MAX(sort_order), 0) + 1 FROM lessons").fetchone()[0]
        try:
            cursor = conn.execute("INSERT INTO lessons (name, sort_order) VALUES (?, ?)", (name, next_order))
        except sqlite3.IntegrityError:
            raise HTTPException(400, "같은 이름의 과가 이미 있어요.")
        lesson = conn.execute("SELECT id, name, sort_order, 0 AS word_count FROM lessons WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return dict(lesson)
@app.put("/api/admin/lessons/order")
def update_lesson_order(payload: LessonOrderInput, request: Request):
    require_admin(request)
    if len(payload.lesson_ids) != len(set(payload.lesson_ids)):
        raise HTTPException(400, "과 순서에 중복된 항목이 있어요.")
    with get_db() as conn:
        existing_ids = [row[0] for row in conn.execute("SELECT id FROM lessons ORDER BY sort_order, id").fetchall()]
        if set(payload.lesson_ids) != set(existing_ids):
            raise HTTPException(400, "현재 과 목록과 순서 정보가 일치하지 않아요. 새로고침 후 다시 시도해 주세요.")
        for order, lesson_id in enumerate(payload.lesson_ids, start=1):
            conn.execute("UPDATE lessons SET sort_order = ? WHERE id = ?", (order, lesson_id))
    return {"ok": True}
@app.put("/api/admin/lessons/{lesson_id}")
def update_lesson(lesson_id: int, payload: LessonInput, request: Request):
    require_admin(request)
    name = payload.name.strip()
    if not name:
        raise HTTPException(400, "과 이름을 입력해 주세요.")
    if len(name) > 40:
        raise HTTPException(400, "과 이름은 40자 이내로 입력해 주세요.")
    with get_db() as conn:
        if not conn.execute("SELECT id FROM lessons WHERE id = ?", (lesson_id,)).fetchone():
            raise HTTPException(404, "과를 찾을 수 없습니다.")
        try:
            conn.execute("UPDATE lessons SET name = ? WHERE id = ?", (name, lesson_id))
        except sqlite3.IntegrityError:
            raise HTTPException(400, "같은 이름의 과가 이미 있어요.")
        lesson = conn.execute("SELECT l.id, l.name, COUNT(w.id) AS word_count FROM lessons l LEFT JOIN words w ON w.lesson_id = l.id WHERE l.id = ? GROUP BY l.id", (lesson_id,)).fetchone()
    return dict(lesson)
@app.post("/api/admin/forms")
def create_form(payload: FormInput, request: Request):
    require_admin(request)
    values = [normalize_text(payload.form_text), normalize_text(payload.grammar_label), normalize_text(payload.gloss)]
    if not values[0] or not values[1]:
        raise HTTPException(400, "변화형 표기와 문법 정보를 입력해 주세요.")
    with get_db() as conn:
        word = conn.execute("SELECT id, lesson_id FROM words WHERE id = ?", (payload.word_id,)).fetchone()
        if not word:
            raise HTTPException(404, "기본 단어를 찾을 수 없습니다.")
        try:
            cursor = conn.execute("INSERT INTO word_forms (word_id, form_text, grammar_label, gloss) VALUES (?, ?, ?, ?)", (payload.word_id, *values))
        except sqlite3.IntegrityError:
            raise HTTPException(400, "같은 변화형이 이미 등록되어 있어요.")
        form = conn.execute("SELECT f.*, w.greek, w.pronunciation, w.part_of_speech, w.meaning FROM word_forms f JOIN words w ON w.id = f.word_id WHERE f.id = ?", (cursor.lastrowid,)).fetchone()
    return dict(form)
@app.delete("/api/admin/forms/{form_id}")
def delete_form(form_id: int, request: Request):
    require_admin(request)
    with get_db() as conn:
        cursor = conn.execute("DELETE FROM word_forms WHERE id = ?", (form_id,))
        if cursor.rowcount == 0:
            raise HTTPException(404, "변화형을 찾을 수 없습니다.")
    return {"ok": True}
@app.get("/api/admin/lessons/{lesson_id}/words")
def admin_words(lesson_id: int, request: Request):
    require_admin(request)
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM words WHERE lesson_id = ? ORDER BY id", (lesson_id,)).fetchall()
    return [dict(row) for row in rows]
@app.put("/api/admin/words/{word_id}")
def update_word(word_id: int, payload: WordUpdateInput, request: Request):
    require_admin(request)
    values = [normalize_text(payload.greek), normalize_text(payload.pronunciation), normalize_text(payload.part_of_speech), normalize_text(payload.meaning)]
    if not all(values):
        raise HTTPException(400, "헬라어, 발음, 품사, 뜻을 모두 입력해 주세요.")
    with get_db() as conn:
        existing = conn.execute("SELECT lesson_id FROM words WHERE id = ?", (word_id,)).fetchone()
        if not existing:
            raise HTTPException(404, "단어를 찾을 수 없습니다.")
        try:
            conn.execute("UPDATE words SET greek = ?, pronunciation = ?, part_of_speech = ?, meaning = ? WHERE id = ?", (*values, word_id))
        except sqlite3.IntegrityError:
            raise HTTPException(400, "이 과에 같은 헬라어 표기의 단어가 이미 있어요.")
        word = conn.execute("SELECT * FROM words WHERE id = ?", (word_id,)).fetchone()
    return dict(word)
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
        rows = conn.execute("SELECT l.id, l.name, l.sort_order, COUNT(w.id) AS word_count FROM lessons l LEFT JOIN words w ON l.id = w.lesson_id GROUP BY l.id ORDER BY l.sort_order, l.id").fetchall()
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
            values = [normalize_text(word.greek), normalize_text(word.pronunciation), normalize_text(word.part_of_speech), normalize_text(word.meaning)]
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
