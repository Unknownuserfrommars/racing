from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone
from typing import Any

import pandas as pd
import streamlit as st
import streamlit.components.v1 as components
from st_supabase_connection import SupabaseConnection

APP_VERSION = "v1.0.0-streamlit"
PLAYER_ID_COOKIE = "racing_player_id"
PLAYER_ID_LOCAL_STORAGE_KEY = "racing_player_id"


def format_ms(ms: int) -> str:
    minutes = ms // 60000
    seconds = (ms % 60000) // 1000
    millis = ms % 1000
    return f"{minutes:02d}:{seconds:02d}.{millis:03d}"


def today_map_id() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def normalize_uuid(candidate: str | None) -> str | None:
    if not candidate:
        return None
    try:
        return str(uuid.UUID(str(candidate).strip()))
    except (ValueError, TypeError, AttributeError):
        return None


def get_player_id() -> str:
    cookie_player_id = normalize_uuid(st.context.cookies.get(PLAYER_ID_COOKIE))
    if cookie_player_id:
        st.session_state.player_id = cookie_player_id
        return cookie_player_id

    session_player_id = normalize_uuid(st.session_state.get("player_id"))
    if session_player_id:
        st.session_state.player_id = session_player_id
        return session_player_id

    generated_player_id = str(uuid.uuid4())
    st.session_state.player_id = generated_player_id
    return generated_player_id


def sync_player_id_client_storage(player_id: str) -> None:
    components.html(
        f"""
        <script>
          (() => {{
            const playerId = {player_id!r};
            const storageKey = {PLAYER_ID_LOCAL_STORAGE_KEY!r};
            const cookieKey = {PLAYER_ID_COOKIE!r};
            const uuidPattern = /^[0-9a-f]{{8}}-[0-9a-f]{{4}}-[1-5][0-9a-f]{{3}}-[89ab][0-9a-f]{{3}}-[0-9a-f]{{12}}$/i;
            const fromStorage = window.localStorage.getItem(storageKey);
            const stableId = uuidPattern.test(fromStorage || "") ? fromStorage : playerId;
            window.localStorage.setItem(storageKey, stableId);
            document.cookie = `${{cookieKey}}=${{stableId}}; path=/; max-age=315360000; samesite=lax`;
          }})();
        </script>
        """,
        height=0,
    )


def dedupe_best_per_player(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    best: dict[str, dict[str, Any]] = {}
    for row in rows:
        player_id = str(row.get("player_id", ""))
        if not player_id:
            continue
        prev = best.get(player_id)
        if prev is None or int(row.get("time_ms", 10**12)) < int(prev.get("time_ms", 10**12)):
            best[player_id] = row

    return sorted(best.values(), key=lambda item: int(item.get("time_ms", 10**12)))


@st.cache_resource
def get_conn() -> SupabaseConnection:
    return st.connection("supabase", type=SupabaseConnection)


def fetch_leaderboard(map_id: str) -> list[dict[str, Any]]:
    conn = get_conn()
    response = (
        conn.client.table("runs")
        .select("id,player_id,display_name,map_id,time_ms,replay_data,created_at")
        .eq("map_id", map_id)
        .order("time_ms", desc=False)
        .execute()
    )
    rows = response.data or []
    return dedupe_best_per_player(rows)[:20]


def fetch_history(limit: int = 200) -> list[dict[str, Any]]:
    conn = get_conn()
    response = (
        conn.client.table("history")
        .select("player_id,display_name,map_id,time_ms,rank,created_at")
        .order("map_id", desc=True)
        .order("rank", desc=False)
        .limit(limit)
        .execute()
    )
    return response.data or []


def submit_run(map_id: str, display_name: str, time_ms: int) -> None:
    conn = get_conn()
    payload = {
        "player_id": get_player_id(),
        "display_name": display_name.strip(),
        "map_id": map_id,
        "time_ms": int(time_ms),
        "replay_data": {
            "source": "streamlit-stopwatch",
            "submitted_at": datetime.now(timezone.utc).isoformat(),
        },
    }
    conn.client.table("runs").insert(payload).execute()


def run_stopwatch() -> int | None:
    if "run_started_at" not in st.session_state:
        st.session_state.run_started_at = None
    if "last_run_ms" not in st.session_state:
        st.session_state.last_run_ms = None
    if "last_run_token" not in st.session_state:
        st.session_state.last_run_token = None
    if "submitted_run_tokens" not in st.session_state:
        st.session_state.submitted_run_tokens = set()

    col1, col2, _ = st.columns([1, 1, 2])
    with col1:
        if st.button("Start run", width="stretch"):
            st.session_state.run_started_at = time.perf_counter()
            st.session_state.last_run_ms = None
            st.session_state.last_run_token = None
    with col2:
        if st.button("Finish run", width="stretch"):
            started_at = st.session_state.run_started_at
            if started_at is not None:
                elapsed_ms = int((time.perf_counter() - started_at) * 1000)
                st.session_state.last_run_ms = elapsed_ms
                st.session_state.last_run_token = str(uuid.uuid4())
                st.session_state.run_started_at = None

    active = st.session_state.run_started_at is not None
    if active:
        elapsed_live = int((time.perf_counter() - st.session_state.run_started_at) * 1000)
        st.info(f"Run in progress: **{format_ms(elapsed_live)}**")
        time.sleep(0.1)
        st.rerun()
    elif st.session_state.last_run_ms is not None:
        st.success(f"Last run: **{format_ms(st.session_state.last_run_ms)}**")

    return st.session_state.last_run_ms


def main() -> None:
    st.set_page_config(page_title="Daily Browser Racer (Streamlit)", page_icon="🏁", layout="wide")
    st.title("🏁 Daily Browser Racer — Streamlit Edition")
    st.caption(f"{APP_VERSION} • Supabase-backed top 20 leaderboard")

    map_id = today_map_id()
    player_id = get_player_id()
    sync_player_id_client_storage(player_id)

    with st.sidebar:
        st.subheader("Driver profile")
        display_name = st.text_input("Display name", key="display_name", max_chars=32)
        st.text_input("Player ID", value=player_id, disabled=True)
        st.text_input("Today's map", value=map_id, disabled=True)
        st.markdown("---")
        st.write("This Streamlit version replaces the old Node/Next hosting flow.")

    st.subheader("Race attempt")
    st.write("Use the stopwatch controls to record a run, then submit to today's leaderboard.")
    last_run_ms = run_stopwatch()

    run_token = st.session_state.get("last_run_token")
    already_submitted = bool(run_token and run_token in st.session_state.submitted_run_tokens)
    can_submit = bool(display_name.strip() and last_run_ms is not None and not already_submitted)
    if not display_name.strip():
        st.caption('Please enter "Display name" before submitting your result.')
    elif last_run_ms is None:
        st.caption('Please click "Start run" and "Finish run" before submitting.')
    elif already_submitted:
        st.caption("This run has already been submitted. Record a new run to submit again.")
    if st.button("Submit run", type="primary", disabled=not can_submit):
        submit_run(map_id=map_id, display_name=display_name, time_ms=last_run_ms)
        if run_token:
            st.session_state.submitted_run_tokens.add(run_token)
        st.toast("Run submitted.")
        st.rerun()

    st.markdown("---")
    st.subheader("Today's leaderboard")
    st.caption("Map preview coming soon — current daily map key is shown in the sidebar.")

    if st.button("Refresh leaderboard"):
        st.cache_data.clear()

    rows = fetch_leaderboard(map_id)
    if not rows:
        st.info("No runs submitted yet for today's map.")
    else:
        leaderboard_view = pd.DataFrame(
            {
                "Rank": list(range(1, len(rows) + 1)),
                "Driver": [row.get("display_name", "Unknown") for row in rows],
                "Time": [format_ms(int(row.get("time_ms", 0))) for row in rows],
                "Time (ms)": [int(row.get("time_ms", 0)) for row in rows],
                "Player ID": [row.get("player_id", "") for row in rows],
            }
        )

        st.dataframe(leaderboard_view, width="stretch", hide_index=True)

    st.markdown("---")
    st.subheader("History")
    st.caption("Daily top runs archived by the cron job.")

    if st.button("Refresh history"):
        st.cache_data.clear()

    history_rows = fetch_history()
    if not history_rows:
        st.info("No history records yet.")
        return

    history_view = pd.DataFrame(
        {
            "Map (day)": [row.get("map_id", "") for row in history_rows],
            "Rank": [int(row.get("rank", 0)) for row in history_rows],
            "Driver": [row.get("display_name", "Unknown") for row in history_rows],
            "Time": [format_ms(int(row.get("time_ms", 0))) for row in history_rows],
            "Time (ms)": [int(row.get("time_ms", 0)) for row in history_rows],
            "Player ID": [row.get("player_id", "") for row in history_rows],
            "Archived at": [row.get("created_at", "") for row in history_rows],
        }
    )

    st.dataframe(history_view, width="stretch", hide_index=True)


if __name__ == "__main__":
    main()
