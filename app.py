from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone
from typing import Any

import pandas as pd
import streamlit as st
from st_supabase_connection import SupabaseConnection

APP_VERSION = "v1.0.0-streamlit"
PLAYER_ID_QUERY_PARAM = "player_id"


def format_ms(ms: int) -> str:
    minutes = ms // 60000
    seconds = (ms % 60000) // 1000
    millis = ms % 1000
    return f"{minutes:02d}:{seconds:02d}.{millis:03d}"


def today_map_id() -> str:
    return f"{datetime.now(timezone.utc).date().isoformat()}-track"


def get_player_id() -> str:
    session_player_id = st.session_state.get("player_id")
    if session_player_id:
        st.query_params[PLAYER_ID_QUERY_PARAM] = session_player_id
        return session_player_id

    query_player_id = str(st.query_params.get(PLAYER_ID_QUERY_PARAM, "")).strip()
    if query_player_id:
        try:
            stable_player_id = str(uuid.UUID(query_player_id))
            st.session_state.player_id = stable_player_id
            return stable_player_id
        except ValueError:
            pass

    generated_player_id = str(uuid.uuid4())
    st.session_state.player_id = generated_player_id
    st.query_params[PLAYER_ID_QUERY_PARAM] = generated_player_id
    return generated_player_id


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
        if st.button("Start run", use_container_width=True):
            st.session_state.run_started_at = time.perf_counter()
            st.session_state.last_run_ms = None
            st.session_state.last_run_token = None
    with col2:
        if st.button("Finish run", use_container_width=True):
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
        return

    leaderboard_view = pd.DataFrame(
        {
            "Rank": list(range(1, len(rows) + 1)),
            "Driver": [row.get("display_name", "Unknown") for row in rows],
            "Time": [format_ms(int(row.get("time_ms", 0))) for row in rows],
            "Time (ms)": [int(row.get("time_ms", 0)) for row in rows],
            "Player ID": [row.get("player_id", "") for row in rows],
        }
    )

    st.dataframe(leaderboard_view, use_container_width=True, hide_index=True)


if __name__ == "__main__":
    main()
