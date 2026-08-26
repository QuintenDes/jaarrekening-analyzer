"""Tests for live ratio configuration store, API, and enabled filtering."""

from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

import pytest
import yaml
from fastapi.testclient import TestClient

from app.main import app
from app.mar.aggregator import CodeAggregator
from app.middleware.rate_limit import RateLimitMiddleware
from app.models.schemas import StatementLine
from app.ratios.engine import compute_ratios, parse_ratios_yaml, validate_ratios_config
from app.ratios.store import BUNDLED_RATIOS_PATH, seed_if_missing

ADMIN = "test-admin-token"


def _rate_limit_middleware() -> RateLimitMiddleware | None:
    current = app.middleware_stack
    seen: set[int] = set()
    while current is not None and id(current) not in seen:
        seen.add(id(current))
        if isinstance(current, RateLimitMiddleware):
            return current
        current = getattr(current, "app", None)
    return None


@contextmanager
def _client(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, token: str | None = ADMIN
) -> Iterator[TestClient]:
    monkeypatch.setenv("RATIOS_CONFIG_PATH", str(tmp_path / "ratios.yaml"))
    if token is None:
        monkeypatch.delenv("ADMIN_TOKEN", raising=False)
    else:
        monkeypatch.setenv("ADMIN_TOKEN", token)
    with TestClient(app) as client:
        middleware = _rate_limit_middleware()
        original = middleware.max_requests if middleware is not None else None
        if middleware is not None:
            middleware._hits.clear()
            middleware.max_requests = 10_000
        try:
            yield client
        finally:
            if middleware is not None and original is not None:
                middleware.max_requests = original
                middleware._hits.clear()


def _auth(token: str = ADMIN) -> dict[str, str]:
    return {"X-Admin-Token": token}


def _sample_lines() -> list[StatementLine]:
    return [
        StatementLine(
            section="balans_activa",
            label="Vlottende activa",
            code="29/58",
            current=200,
            previous=None,
        ),
        StatementLine(
            section="balans_passiva",
            label="Kortlopende schulden",
            code="42/48",
            current=100,
            previous=None,
        ),
    ]


def test_seed_when_override_missing(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("RATIOS_CONFIG_PATH", str(tmp_path / "ratios.yaml"))
    override = tmp_path / "ratios.yaml"
    assert not override.exists()
    seed_if_missing()
    assert override.is_file()
    bundled = yaml.safe_load(BUNDLED_RATIOS_PATH.read_text(encoding="utf-8"))
    saved = yaml.safe_load(override.read_text(encoding="utf-8"))
    assert saved["ratios"][0]["id"] == bundled["ratios"][0]["id"]
    assert (tmp_path / "ratios.meta.json").is_file()


def test_existing_override_not_overwritten_by_seed(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("RATIOS_CONFIG_PATH", str(tmp_path / "ratios.yaml"))
    override = tmp_path / "ratios.yaml"
    override.write_text(
        "ratios:\n  - id: custom\n    name: Custom\n    category: overig\n    numerator: '10/15'\n",
        encoding="utf-8",
    )
    seed_if_missing()
    saved = yaml.safe_load(override.read_text(encoding="utf-8"))
    assert saved["ratios"][0]["id"] == "custom"
    assert len(saved["ratios"]) == 1


def test_save_persists_and_reload(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    with _client(tmp_path, monkeypatch) as client:
        current = client.get("/api/ratios").json()
        specs = current["ratios"]
        specs[0]["name"] = "Gewijzigde current ratio"
        saved = client.put(
            "/api/ratios",
            json={"ratios": specs, "version": current["version"]},
            headers=_auth(),
        )
        assert saved.status_code == 200, saved.text
        body = saved.json()
        assert body["ratios"][0]["name"] == "Gewijzigde current ratio"
        assert body["version"] == current["version"] + 1
        assert body["source"] == "saved"

    with _client(tmp_path, monkeypatch) as client:
        reloaded = client.get("/api/ratios").json()
        assert reloaded["ratios"][0]["name"] == "Gewijzigde current ratio"
        disk = yaml.safe_load((tmp_path / "ratios.yaml").read_text(encoding="utf-8"))
        assert disk["ratios"][0]["name"] == "Gewijzigde current ratio"


def test_reset_restores_bundled(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    bundled = yaml.safe_load(BUNDLED_RATIOS_PATH.read_text(encoding="utf-8"))
    with _client(tmp_path, monkeypatch) as client:
        current = client.get("/api/ratios").json()
        specs = current["ratios"]
        specs[0]["name"] = "Tijdelijke naam"
        client.put(
            "/api/ratios",
            json={"ratios": specs, "version": current["version"]},
            headers=_auth(),
        )
        reset = client.post("/api/ratios/reset", headers=_auth())
        assert reset.status_code == 200, reset.text
        assert reset.json()["ratios"][0]["name"] == bundled["ratios"][0]["name"]
        disk = yaml.safe_load((tmp_path / "ratios.yaml").read_text(encoding="utf-8"))
        assert disk["ratios"][0]["name"] == bundled["ratios"][0]["name"]


def test_duplicate_ids_rejected(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    with _client(tmp_path, monkeypatch) as client:
        current = client.get("/api/ratios").json()
        specs = current["ratios"]
        specs[1]["id"] = specs[0]["id"]
        response = client.put(
            "/api/ratios",
            json={"ratios": specs, "version": current["version"]},
            headers=_auth(),
        )
        assert response.status_code == 422
        assert "Dubbele" in response.json()["detail"]


def test_unknown_keys_rejected() -> None:
    with pytest.raises(ValueError, match="onbekende velden"):
        validate_ratios_config(
            [
                {
                    "id": "x",
                    "name": "X",
                    "numerator": "10",
                    "description": "niet toegestaan",
                }
            ]
        )


def test_empty_list_rejected(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    with _client(tmp_path, monkeypatch) as client:
        current = client.get("/api/ratios").json()
        response = client.put(
            "/api/ratios",
            json={"ratios": [], "version": current["version"]},
            headers=_auth(),
        )
        assert response.status_code == 422


def test_missing_and_incorrect_admin_token(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    with _client(tmp_path, monkeypatch) as client:
        current = client.get("/api/ratios").json()
        payload = {"ratios": current["ratios"], "version": current["version"]}
        missing = client.put("/api/ratios", json=payload)
        assert missing.status_code == 401
        wrong = client.put(
            "/api/ratios",
            json=payload,
            headers=_auth("wrong-token"),
        )
        assert wrong.status_code == 401


def test_writes_disabled_without_admin_token(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    with _client(tmp_path, monkeypatch, token=None) as client:
        current = client.get("/api/ratios").json()
        response = client.put(
            "/api/ratios",
            json={"ratios": current["ratios"], "version": current["version"]},
            headers=_auth("anything"),
        )
        assert response.status_code == 503
        assert "ADMIN_TOKEN" in response.json()["detail"]


def test_stale_version_conflict(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    with _client(tmp_path, monkeypatch) as client:
        current = client.get("/api/ratios").json()
        specs = current["ratios"]
        specs[0]["name"] = "Eerste tab"
        first = client.put(
            "/api/ratios",
            json={"ratios": specs, "version": current["version"]},
            headers=_auth(),
        )
        assert first.status_code == 200
        stale = client.put(
            "/api/ratios",
            json={"ratios": specs, "version": current["version"]},
            headers=_auth(),
        )
        assert stale.status_code == 409
        assert "Laad opnieuw" in stale.json()["detail"]
        live = client.get("/api/ratios").json()
        assert live["ratios"][0]["name"] == "Eerste tab"


def test_history_snapshot_and_restore(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    with _client(tmp_path, monkeypatch) as client:
        current = client.get("/api/ratios").json()
        original_name = current["ratios"][0]["name"]
        specs = current["ratios"]
        specs[0]["name"] = "Na snapshot"
        saved = client.put(
            "/api/ratios",
            json={"ratios": specs, "version": current["version"]},
            headers=_auth(),
        )
        assert saved.status_code == 200
        history = client.get("/api/ratios/history").json()["items"]
        assert history
        snapshot_version = history[0]["version"]
        restored = client.post(
            f"/api/ratios/history/{snapshot_version}/restore",
            headers=_auth(),
        )
        assert restored.status_code == 200, restored.text
        assert restored.json()["ratios"][0]["name"] == original_name
        assert restored.json()["version"] == saved.json()["version"] + 1


def test_disabled_ratio_omitted_from_compute() -> None:
    specs = parse_ratios_yaml(BUNDLED_RATIOS_PATH.read_text(encoding="utf-8"))
    current = next(spec for spec in specs if spec["id"] == "current_ratio")
    current["enabled"] = False
    results = compute_ratios(CodeAggregator(_sample_lines()), specs)
    ids = [item.id for item in results]
    assert "current_ratio" not in ids
    assert "quick_ratio" in ids


def test_enabled_and_missing_enabled_compute_as_before() -> None:
    specs = parse_ratios_yaml(BUNDLED_RATIOS_PATH.read_text(encoding="utf-8"))
    assert "enabled" not in yaml.safe_load(
        BUNDLED_RATIOS_PATH.read_text(encoding="utf-8")
    )["ratios"][0]
    results = compute_ratios(CodeAggregator(_sample_lines()), specs)
    current = next(item for item in results if item.id == "current_ratio")
    assert current.value == 2.0
    enabled_specs = [{**spec, "enabled": spec.get("enabled", True)} for spec in specs]
    enabled_results = compute_ratios(CodeAggregator(_sample_lines()), enabled_specs)
    assert [item.id for item in enabled_results] == [item.id for item in results]
    assert enabled_results[0].value == results[0].value
