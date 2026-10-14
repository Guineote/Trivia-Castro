from tests.conftest import ejemplo


def test_headers_y_formato_de_errores(api):
    r = api.c.get("/api/v1/rooms/NOEXIS")
    assert r.status_code == 404
    assert r.json() == {"error": {"code": "ROOM_NOT_FOUND", "message": "No existe esa sala"}}
    assert r.headers["x-server-time"].endswith("Z")
    assert api.c.get("/api/v1/nada").json()["error"]["code"] == "NOT_FOUND"
    r = api.c.post("/api/v1/rooms", json={})
    assert (r.status_code, r.json()["error"]["code"]) == (401, "UNAUTHORIZED")
    assert "x-server-time" in r.headers


def test_validacion_de_nickname(api):
    for bad in ["", " a ", "x" * 21, 5, None]:
        r = api.c.post("/api/v1/players", json={"nickname": bad})
        assert (r.status_code, r.json()["error"]["code"]) == (422, "VALIDATION_ERROR")
    assert api.c.post("/api/v1/players", json={"nickname": "  Ana "}).json()["nickname"] == "Ana"


def test_crear_y_consultar_sala_con_forma_del_contrato(api):
    ana = api.player("Ana")
    room = api.room(ana)
    assert room["participantId"] == room["hostParticipantId"]
    expected = ejemplo("room")
    assert set(room) - {"participantId"} == set(expected)
    assert set(room["settings"]) == set(expected["settings"])
    assert room["settings"] == {"maxPlayers": 8, "rounds": 10, "lives": 3, "categoryIds": []}
    assert set(room["participants"][0]) == set(expected["participants"][0])
    got = api.c.get(f"/api/v1/rooms/{room['code'].lower()}").json()
    assert got["currentGameId"] is None and got["status"] == "WAITING"
    assert len(room["code"]) == 6


def test_unirse_201_200_y_errores(api):
    ana, beto, caro = api.player("Ana"), api.player("Beto"), api.player("Caro")
    room = api.room(ana, maxPlayers=2)
    r = api.join(room, beto)
    assert r.status_code == 201 and len(r.json()["participants"]) == 2
    again = api.join(room, beto)
    assert again.status_code == 200 and again.json()["participantId"] == r.json()["participantId"]
    full = api.join(room, caro)
    assert (full.status_code, full.json()["error"]["code"]) == (409, "ROOM_FULL")


def test_nickname_repetido_se_resuelve_con_otro_nombre(api):
    ana, otra = api.player("Ana"), api.player("ana")
    room = api.room(ana)
    r = api.join(room, otra)
    assert (r.status_code, r.json()["error"]["code"]) == (422, "NICKNAME_TAKEN")
    r = api.c.post(f"/api/v1/rooms/{room['code']}/players", headers=otra["h"], json={"nickname": "Ana2"})
    assert r.status_code == 201


def test_ajustes_solo_el_host_y_rangos(api):
    ana, beto = api.player("Ana"), api.player("Beto")
    room = api.room(ana)
    api.join(room, beto)
    url = f"/api/v1/rooms/{room['code']}"
    assert api.c.patch(url, headers=beto["h"], json={"settings": {"rounds": 5}}).json()["error"]["code"] == "NOT_HOST"
    ok = api.c.patch(url, headers=ana["h"], json={"settings": {"rounds": 5}})
    assert ok.status_code == 200 and ok.json()["settings"]["rounds"] == 5 and ok.json()["settings"]["lives"] == 3
    for bad in [{"rounds": 99}, {"lives": 0}, {"maxPlayers": 1}, {"maxPlayers": "8"}, {"categoryIds": ["c99"]}]:
        r = api.c.patch(url, headers=ana["h"], json={"settings": bad})
        assert (r.status_code, r.json()["error"]["code"]) == (422, "VALIDATION_ERROR"), bad
    # no se puede bajar maxPlayers por debajo de los participantes
    assert api.c.patch(url, headers=ana["h"], json={"settings": {"maxPlayers": 2}}).status_code == 200
    ok = api.c.patch(url, headers=ana["h"], json={"settings": {"categoryIds": ["c1"]}})
    assert ok.json()["settings"]["categoryIds"] == ["c1"]


def test_salir_expulsar_y_traspaso_de_host(api):
    ana, beto, caro = api.player("Ana"), api.player("Beto"), api.player("Caro")
    room = api.room(ana)
    pb = api.join(room, beto).json()["participantId"]
    pc = api.join(room, caro).json()["participantId"]
    base = f"/api/v1/rooms/{room['code']}/players"
    assert api.c.delete(f"{base}/{pc}", headers=beto["h"]).json()["error"]["code"] == "FORBIDDEN"
    assert api.c.delete(f"{base}/{pc}", headers=ana["h"]).status_code == 204  # el host expulsa
    r = api.c.delete(f"{base}/{room['participantId']}", headers=ana["h"])  # sale el host
    assert r.status_code == 204 and r.content == b""
    after = api.c.get(f"/api/v1/rooms/{room['code']}").json()
    assert after["hostParticipantId"] == pb and len(after["participants"]) == 1
    assert api.c.delete(f"{base}/{pb}", headers=beto["h"]).status_code == 204
    assert api.c.get(f"/api/v1/rooms/{room['code']}").status_code == 404  # sala vacía → se borra


def test_categorias_y_preguntas(api):
    ana = api.player("Ana")
    cats = api.c.get("/api/v1/categories", headers=ana["h"]).json()["items"]
    assert len(cats) == 10 and cats[0] == {"id": "c1", "name": "Videojuegos"}
    page = api.c.get("/api/v1/questions?categoryId=c1&limit=5", headers=ana["h"]).json()
    assert len(page["items"]) == 5 and page["total"] >= 12
    assert set(page["items"][0]["options"][0]) == {"id", "text", "isCorrect"}
    body = {"text": "¿2+2?", "categoryId": "c4", "difficulty": "EASY",
            "options": [{"text": "4", "isCorrect": True}, {"text": "3", "isCorrect": False},
                        {"text": "5", "isCorrect": False}, {"text": "22", "isCorrect": False}]}
    assert api.c.post("/api/v1/questions", headers=ana["h"], json=body).status_code == 201
    body["options"][1]["isCorrect"] = True  # dos correctas
    assert api.c.post("/api/v1/questions", headers=ana["h"], json=body).json()["error"]["code"] == "VALIDATION_ERROR"


def test_revancha_en_la_misma_sala(api):
    """D13: el host puede iniciar otra partida desde una sala FINISHED; todo se reinicia y los poderes no se acumulan."""
    ana, beto = api.player("Ana"), api.player("Beto")
    room = api.room(ana, rounds=3)
    api.join(room, beto)
    url = f"/api/v1/rooms/{room['code']}/games"

    first = api.start(room, ana)
    # con una partida en curso sigue sin poder iniciarse otra
    assert api.c.post(url, headers=ana["h"]).json()["error"]["code"] == "GAME_ALREADY_STARTED"

    api.to_phase(first, ana, "QUESTION")
    assert api.power(first, 1, ana, "SHIELD").status_code == 200  # Ana gasta el escudo en la partida 1
    api.wait(10 * 60 * 1000)
    assert api.c.get(f"/api/v1/rooms/{room['code']}").json()["status"] == "FINISHED"

    # solo el host inicia la revancha
    assert api.c.post(url, headers=beto["h"]).json()["error"]["code"] == "NOT_HOST"
    r = api.c.post(url, headers=ana["h"])
    assert r.status_code == 201, r.text
    second = r.json()["gameId"]
    assert second != first and r.json()["phase"] == "ROUND_INTRO"

    after = api.c.get(f"/api/v1/rooms/{room['code']}").json()
    assert after["status"] == "IN_GAME" and after["currentGameId"] == second
    assert len(after["participants"]) == 2  # mismos participantes, mismos ajustes

    me = api.state(second, ana).json()["me"]
    assert (me["score"], me["lives"], me["status"], me["lastResult"]) == (0, 3, "ACTIVE", None)
    assert sorted(p["powerType"] for p in me["powers"]) == ["DOUBLE", "HINT", "SHIELD"]  # inventario nuevo, sin duplicados

    # HINT no se gastó en la partida 1: si el inventario viejo siguiera vivo, tras usarlo aquí aún quedaría uno
    api.to_phase(second, ana, "QUESTION")
    assert api.power(second, 1, ana, "HINT").status_code == 200
    powers = [p["powerType"] for p in api.state(second, ana).json()["me"]["powers"]]
    assert "HINT" not in powers and sorted(powers) == ["DOUBLE", "SHIELD"]

    # la partida anterior sigue existiendo
    assert api.state(first, beto).status_code == 200


def test_revancha_sigue_validando_jugadores(api):
    ana = api.player("Ana")
    room = api.room(ana, rounds=1)
    # una sola persona no puede iniciar (D4), tampoco en revancha
    assert api.c.post(f"/api/v1/rooms/{room['code']}/games", headers=ana["h"]).json()["error"]["code"] == "NOT_ENOUGH_PLAYERS"
