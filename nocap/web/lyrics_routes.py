from __future__ import annotations

from flask import abort, request

from nocap.library import LibraryStore

from .state import SessionState


def register_lyrics_routes(app, store: LibraryStore, state: SessionState) -> None:
    """Edit a library track's lyrics (one line per bar) and restore its transcription."""

    @app.route("/api/library/<track_id>/lyrics", methods=["POST"])
    def lyrics_edit_api(track_id: str):
        from nocap.pipeline.relyrics import edit_lyrics

        body = request.get_json(silent=True) or {}
        try:
            edits = {int(bar): str(text) for bar, text in (body.get("bars") or {}).items()}
        except (TypeError, ValueError):
            abort(400)
        if not edits:
            abort(400)
        return _update(track_id, lambda flowmap, audio: edit_lyrics(flowmap, edits, audio))

    @app.route("/api/library/<track_id>/lyrics/restore", methods=["POST"])
    def lyrics_restore_api(track_id: str):
        from nocap.pipeline.relyrics import restore_transcription

        return _update(track_id, restore_transcription)

    def _update(track_id: str, change):
        try:
            flowmap, audio_path, _vocals, _meta = store.load_track(track_id)
        except FileNotFoundError:
            abort(404)
        try:
            updated = change(flowmap, audio_path if audio_path.is_file() else None)
        except ValueError as exc:
            return {"error": str(exc)}, 400
        metadata = store.replace_analysis(track_id, updated)
        updated["metadata"]["audio_path"] = str(audio_path)
        state.flowmap = updated
        return {"flowmap": updated, "track": metadata}
