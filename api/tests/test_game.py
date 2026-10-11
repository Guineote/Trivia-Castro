import pytest
from sqlalchemy.exc import IntegrityError

from app import clock
from app.models import SubmittedAnswer
from tests.conftest import _ms, ejemplo

# El servidor añade powerUsed a lastResult (propuesta #4); el resto debe coincidir con el contrato.
EXTRA_LAST_RESULT = {"powerUsed"}


def assert_same_shape(real: dict, example: dict, extra: set[str] = frozenset()):
    assert set(real) - extra == set(example), (set(real), set(example))


def assert_state_shape(real: dict, example: dict):
    assert_same_shape(real, example)
    if example["round"]:
        assert_same_shape(real["round"], example["round"])
        if example["round"]["question"]:
            assert_same_shape(real["round"]["question"], example["round"]["question"])
            assert_same_shape(real["round"]["question"]["options"][0], example["round"]["question"]["options"][0])
    assert_same_shape(real["me"], example["me"])
    if example["me"]["lastResult"]:
        assert_same_shape(real["me"]["lastResult"], example["me"]["lastResult"], EXTRA_LAST_RESULT)
    assert_same_shape(real["players"][0], example["players"][0])
    if example["ranking"]:
        assert_same_shape(real["ranking"][0], example["ranking"][0])
    if example["winner"]:
        assert_same_shape(real["winner"], example["winner"])


@pytest.fixture()
def duo(api):
    """Ana (host) y Beto en una sala de 3 rondas con la partida iniciada."""
    ana, beto = api.player("Ana"), api.player("Beto")
    room = api.room(ana, rounds=3)
    api.join(room, beto)
    gid = api.start(room, ana)
    return api, ana, beto, room, gid


def test_iniciar_partida_y_errores(api):
    ana, beto = api.player("Ana"), api.player("Beto")
    room = api.room(ana, rounds=3)
    url = f"/api/v1/rooms/{room['code']}/games"
    assert api.c.post(url, headers=ana["h"]).json()["error"]["code"] == "NOT_ENOUGH_PLAYERS"
    api.join(room, beto)
    assert api.c.post(url, headers=beto["h"]).json()["error"]["code"] == "NOT_HOST"
    api.c.patch(f"/api/v1/rooms/{room['code']}", headers=ana["h"], json={"settings": {"rounds": 15, "categoryIds": ["c1"]}})
    assert api.c.post(url, headers=ana["h"]).json()["error"]["code"] == "NOT_ENOUGH_QUESTIONS"
    api.c.patch(f"/api/v1/rooms/{room['code']}", headers=ana["h"], json={"settings": {"rounds": 3}})
    r = api.c.post(url, headers=ana["h"])
    assert r.status_code == 201 and r.json()["phase"] == "ROUND_INTRO" and r.json()["version"] == 1
    assert api.c.post(url, headers=ana["h"]).json()["error"]["code"] == "GAME_ALREADY_STARTED"
    room_now = api.c.get(f"/api/v1/rooms/{room['code']}").json()
    assert room_now["status"] == "IN_GAME" and room_now["currentGameId"] == r.json()["gameId"]
    caro = api.player("Caro")
    assert api.join(room, caro).json()["error"]["code"] == "GAME_ALREADY_STARTED"
    assert api.join(room, beto).status_code == 200  # reconexión


def test_etag_304_y_headers(duo):
    api, ana, beto, room, gid = duo
    r = api.state(gid, ana)
    etag = r.headers["etag"]
    assert etag == f'"{gid}-v1"' and "Authorization" in r.headers["vary"]
    assert_state_shape(r.json(), ejemplo("state-round-intro"))
    cached = api.state(gid, ana, **{"If-None-Match": etag})
    assert cached.status_code == 304 and cached.content == b""
    assert cached.headers["etag"] == etag and "x-server-time" in cached.headers
    api.wait(3000)
    changed = api.state(gid, ana, **{"If-None-Match": etag})
    assert changed.status_code == 200 and changed.headers["etag"] == f'"{gid}-v2"'


def test_acceso_a_la_partida(duo):
    api, ana, beto, room, gid = duo
    intruso = api.player("Intruso")
    assert api.state(gid, intruso).json()["error"]["code"] == "NOT_IN_GAME"
    assert api.c.get(f"/api/v1/games/g999/state", headers=ana["h"]).json()["error"]["code"] == "GAME_NOT_FOUND"
    assert api.c.get(f"/api/v1/games/{gid}/state").status_code == 401
    assert api.c.post(f"/api/v1/games/{gid}/advance", headers=beto["h"]).json()["error"]["code"] == "NOT_HOST"


def test_partida_completa_de_3_rondas(duo):
    api, ana, beto, room, gid = duo
    # ── ronda 1: Beto acierta a los 5 s, Ana falla
    q = api.to_phase(gid, ana, "QUESTION")
    assert_state_shape(q, ejemplo("state-question"))
    assert all("isCorrect" not in o for o in q["round"]["question"]["options"])
    assert q["round"]["number"] == 1 and q["round"]["type"] == "NORMAL" and q["round"]["totalRounds"] == 3
    assert _ms(q["round"]["endsAt"]) - _ms(q["serverTime"]) == 20_000
    api.wait(5000)
    assert api.answer(gid, 1, beto, api.correct_option(gid, 1)).json() == {"accepted": True}
    assert api.answer(gid, 1, beto, api.correct_option(gid, 1)).json()["error"]["code"] == "ALREADY_ANSWERED"
    assert api.answer(gid, 1, ana, "o999999").json()["error"]["code"] == "INVALID_OPTION"
    assert api.answer(gid, 1, ana, 7).json()["error"]["code"] == "INVALID_OPTION"
    assert api.answer(gid, 2, ana, api.wrong_option(gid, 1)).json()["error"]["code"] == "ROUND_NOT_ACTIVE"
    mid = api.state(gid, ana).json()
    assert [p["hasAnswered"] for p in mid["players"]] == [False, True] and mid["me"]["hasAnswered"] is False
    assert api.answer(gid, 1, ana, api.wrong_option(gid, 1)).status_code == 202

    rv = api.to_phase(gid, beto, "REVEAL")
    assert_state_shape(rv, ejemplo("state-reveal"))
    assert sum(o["isCorrect"] for o in rv["round"]["question"]["options"]) == 1
    won = rv["me"]["lastResult"]
    assert won["answerTimeMs"] == 5000 and won["speedBonus"] == 300 and won["roundMultiplier"] == 1
    assert won["pointsAwarded"] == won["basePoints"] + 300 == rv["me"]["score"]
    lost = api.state(gid, ana).json()["me"]
    assert lost["lastResult"]["isCorrect"] is False and lost["lastResult"]["livesLost"] == 1 and lost["lives"] == 2
    assert [p["pointsThisRound"] for p in rv["players"]] == [0, won["pointsAwarded"]]

    sb = api.to_phase(gid, ana, "SCOREBOARD")
    assert_state_shape(sb, ejemplo("state-scoreboard"))
    assert all(p["pointsThisRound"] is None for p in sb["players"])
    assert [(r["participantId"], r["positionDelta"]) for r in sb["ranking"]] == [
        (room_pt(api, room, "Beto"), 1), (room_pt(api, room, "Ana"), -1)]
    assert sb["me"]["lastResult"] is not None
    assert api.c.get(f"/api/v1/games/{gid}/ranking", headers=ana["h"]).json()["afterRound"] == 1

    # ── ronda 2 y 3: nadie responde (timeout). La 3 es DOUBLE.
    r2 = api.to_phase(gid, ana, "ROUND_INTRO")
    assert r2["round"]["number"] == 2 and r2["me"]["lastResult"] is None and r2["round"]["question"] is None
    final = api.to_phase(gid, ana, "FINAL")
    assert_state_shape(final, ejemplo("state-final"))
    assert final["round"] is None and final["winner"]["nickname"] == "Beto"
    assert final["me"]["lives"] == 0 and final["me"]["status"] == "SPECTATOR"  # 3 vidas: -1 -1 -1
    assert all(r["positionDelta"] == 0 for r in final["ranking"])
    assert api.c.get(f"/api/v1/rooms/{room['code']}").json()["status"] == "FINISHED"
    assert api.c.post(f"/api/v1/games/{gid}/advance", headers=ana["h"]).json()["error"]["code"] == "GAME_FINISHED"

    res = api.c.get(f"/api/v1/games/{gid}/results", headers=ana["h"]).json()
    assert_same_shape(res, ejemplo("results"))
    assert_same_shape(res["stats"][0], ejemplo("results")["stats"][0])
    assert_same_shape(res["stats"][0]["bestRound"], ejemplo("results")["stats"][0]["bestRound"])
    assert_same_shape(res["ranking"][0], ejemplo("results")["ranking"][0])
    assert res["roomCode"] == room["code"] and res["totalRounds"] == 3 and res["winner"]["nickname"] == "Beto"
    beto_stats = res["stats"][0]
    assert (beto_stats["correctAnswers"], beto_stats["totalAnswers"], beto_stats["averageAnswerTimeMs"]) == (1, 1, 5000)
    assert res["stats"][1]["totalAnswers"] == 1 and res["stats"][1]["correctAnswers"] == 0

    rr = api.c.get(f"/api/v1/games/{gid}/rounds/1/results", headers=ana["h"]).json()
    assert_same_shape(rr, ejemplo("round-results"))
    assert_same_shape(rr["round"], ejemplo("round-results")["round"])
    assert_same_shape(rr["results"][0], ejemplo("round-results")["results"][0])
    assert rr["results"][0]["nickname"] == "Beto"
    assert api.c.get(f"/api/v1/games/{gid}/rounds/4/results", headers=ana["h"]).json()["error"]["code"] == "ROUND_NOT_FINISHED"
    rk = api.c.get(f"/api/v1/games/{gid}/ranking", headers=ana["h"]).json()
    assert_same_shape(rk, ejemplo("ranking"))
    assert rk["afterRound"] == 3


def room_pt(api, room: dict, nickname: str) -> str:
    live = api.c.get(f"/api/v1/rooms/{room['code']}").json()
    return next(p["participantId"] for p in live["participants"] if p["nickname"] == nickname)


def test_resultados_antes_de_terminar(duo):
    api, ana, *_, gid = duo
    assert api.c.get(f"/api/v1/games/{gid}/results", headers=ana["h"]).json()["error"]["code"] == "GAME_NOT_FINISHED"
    assert api.c.get(f"/api/v1/games/{gid}/rounds/1/results", headers=ana["h"]).json()["error"]["code"] == "ROUND_NOT_FINISHED"


def test_no_se_puede_responder_fuera_de_la_fase_ni_tarde(duo):
    api, ana, beto, room, gid = duo
    assert api.answer(gid, 1, ana, "o1").json()["error"]["code"] == "ROUND_NOT_ACTIVE"  # ROUND_INTRO
    api.to_phase(gid, ana, "QUESTION")
    api.wait(20_001)  # la ronda ya cerró aunque nadie haya consultado
    assert api.answer(gid, 1, ana, api.correct_option(gid, 1)).json()["error"]["code"] == "ROUND_NOT_ACTIVE"


def test_timeout_con_y_sin_shield(duo):
    api, ana, beto, room, gid = duo
    api.to_phase(gid, ana, "QUESTION")
    assert api.power(gid, 1, ana, "SHIELD").json() == {"powerType": "SHIELD", "effect": {}}
    assert api.power(gid, 1, ana, "HINT").json()["error"]["code"] == "POWER_NOT_AVAILABLE"  # un poder por ronda
    st = api.state(gid, ana).json()["me"]
    assert st["activePower"] == "SHIELD" and [p["powerType"] for p in st["powers"]] == ["DOUBLE", "HINT"]
    rv = api.to_phase(gid, ana, "REVEAL")
    ana_r, beto_r = rv["me"]["lastResult"], api.state(gid, beto).json()["me"]["lastResult"]
    assert (ana_r["chosenOptionId"], ana_r["answerTimeMs"], ana_r["pointsAwarded"]) == (None, None, 0)
    assert (ana_r["livesLost"], ana_r["powerUsed"], rv["me"]["lives"]) == (0, "SHIELD", 3)
    assert (beto_r["livesLost"], beto_r["powerUsed"]) == (1, None)
    api.to_phase(gid, ana, "ROUND_INTRO")
    api.to_phase(gid, ana, "QUESTION")
    assert api.power(gid, 2, ana, "SHIELD").json()["error"]["code"] == "POWER_NOT_AVAILABLE"  # ya gastado
    assert api.state(gid, ana).json()["me"]["activePower"] is None


def test_hint_quita_dos_incorrectas(duo):
    api, ana, beto, room, gid = duo
    api.to_phase(gid, ana, "QUESTION")
    before = api.state(gid, ana).json()["round"]["question"]["options"]
    effect = api.power(gid, 1, ana, "HINT").json()["effect"]["removedOptionIds"]
    after = [o["id"] for o in api.state(gid, ana).json()["round"]["question"]["options"]]
    assert len(before) == 4 and len(after) == 2 and set(effect).isdisjoint(after)
    assert api.correct_option(gid, 1) in after
    assert len(api.state(gid, beto).json()["round"]["question"]["options"]) == 4  # solo afecta a quien lo usó
    api.answer(gid, 1, ana, after[0])
    assert api.power(gid, 1, ana, "DOUBLE").json()["error"]["code"] == "ALREADY_ANSWERED"


def test_poder_double_y_ronda_double(api):
    ana, beto = api.player("Ana"), api.player("Beto")
    room = api.room(ana, rounds=3)
    api.join(room, beto)
    gid = api.start(room, ana)
    pts = {}
    for n in (1, 2, 3):  # la ronda 3 es DOUBLE; en la 1 Ana usa el poder DOUBLE; en la 2 no responde
        api.to_phase(gid, ana, "QUESTION")
        if n == 1:
            assert api.power(gid, 1, ana, "DOUBLE").status_code == 200
        if n != 2:
            api.answer(gid, n, ana, api.correct_option(gid, n))
        api.to_phase(gid, ana, "REVEAL")
        pts[n] = api.state(gid, ana).json()["me"]["lastResult"]
        api.to_phase(gid, ana, "SCOREBOARD")
        if n < 3:
            api.to_phase(gid, ana, "ROUND_INTRO")
    assert pts[1]["powerMultiplier"] == 2 and pts[1]["roundMultiplier"] == 1
    assert pts[1]["pointsAwarded"] == (pts[1]["basePoints"] + pts[1]["speedBonus"]) * 2
    assert pts[2]["pointsAwarded"] == 0
    assert pts[3]["roundMultiplier"] == 2 and pts[3]["powerMultiplier"] == 1


def test_espectador_no_puede_actuar(api):
    ana, beto = api.player("Ana"), api.player("Beto")
    room = api.room(ana, rounds=3, lives=1)
    api.join(room, beto)
    gid = api.start(room, ana)
    api.to_phase(gid, ana, "QUESTION")
    api.answer(gid, 1, beto, api.correct_option(gid, 1))
    rv = api.to_phase(gid, ana, "REVEAL")  # Ana no respondió: pierde su única vida
    assert rv["me"]["status"] == "SPECTATOR" and rv["me"]["lastResult"]["becameSpectator"] is True
    api.to_phase(gid, ana, "ROUND_INTRO")
    q = api.to_phase(gid, ana, "QUESTION")
    assert q["round"]["question"] is not None  # el espectador sigue viendo la pregunta
    assert api.answer(gid, 2, ana, "o1").json()["error"]["code"] == "SPECTATOR_CANNOT_ACT"
    assert api.power(gid, 2, ana, "HINT").json()["error"]["code"] == "SPECTATOR_CANNOT_ACT"
    rv2 = api.to_phase(gid, ana, "REVEAL")
    assert rv2["me"]["lastResult"] is None
    assert [p["pointsThisRound"] for p in rv2["players"]][0] is None


def test_advance_del_host_salta_la_fase(duo):
    api, ana, beto, room, gid = duo
    r = api.c.post(f"/api/v1/games/{gid}/advance", headers=ana["h"])
    assert r.json() == {"phase": "QUESTION", "version": 2}
    api.answer(gid, 1, ana, api.correct_option(gid, 1))
    r = api.c.post(f"/api/v1/games/{gid}/advance", headers=ana["h"])
    assert r.json()["phase"] == "REVEAL"
    assert api.state(gid, ana).json()["me"]["lastResult"]["isCorrect"] is True


def test_reloj_perezoso_alcanza_el_final(duo):
    api, ana, beto, room, gid = duo
    api.wait(10 * 60 * 1000)  # nadie consultó en 10 minutos
    st = api.state(gid, ana).json()
    assert st["phase"] == "FINAL" and st["me"]["status"] == "SPECTATOR"
    # cada transición se aplicó con su hora programada, no con la actual
    assert api.c.get(f"/api/v1/rooms/{room['code']}").json()["status"] == "FINISHED"


def test_indice_unico_de_respuesta_en_la_base(duo):
    api, ana, beto, room, gid = duo
    api.to_phase(gid, ana, "QUESTION")
    api.answer(gid, 1, ana, api.correct_option(gid, 1))
    with api.factory() as db:
        first = db.query(SubmittedAnswer).one()
        db.add(SubmittedAnswer(round_id=first.round_id, participant_id=first.participant_id,
                               option_id=first.option_id, answer_time_ms=1))
        with pytest.raises(IntegrityError):
            db.commit()
