from fastapi.testclient import TestClient

from app.main import create_app


def make_client(tmp_path):
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "app.js").write_text("console.log(1)")
    (tmp_path / "index.html").write_text("<html>trivia</html>")
    (tmp_path / "favicon.svg").write_text("<svg/>")
    (tmp_path.parent / "secreto.txt").write_text("no")
    return TestClient(create_app(use_lifespan=False, web_dist=tmp_path))


def test_sirve_el_website_y_hace_fallback_de_rutas_de_react(tmp_path):
    c = make_client(tmp_path)
    assert c.get("/").text == "<html>trivia</html>"
    assert c.get("/sala/K7X4QM").text == "<html>trivia</html>"  # ruta de React Router
    assert c.get("/partida/g1/resultados").status_code == 200
    assert c.get("/assets/app.js").text == "console.log(1)"
    assert c.get("/favicon.svg").text == "<svg/>"
    assert c.get("/").headers["cache-control"] == "no-cache"


def test_no_sale_del_directorio_ni_pisa_la_api(tmp_path):
    c = make_client(tmp_path)
    assert c.get("/..%2Fsecreto.txt").text == "<html>trivia</html>"
    assert c.get("/%2e%2e/secreto.txt").text == "<html>trivia</html>"
    r = c.get("/api/v1/nada")
    assert (r.status_code, r.json()["error"]["code"]) == (404, "NOT_FOUND")
    assert c.post("/api/v1/nada").json()["error"]["code"] == "NOT_FOUND"
    assert "x-server-time" in r.headers


def test_sin_dist_solo_hay_api(tmp_path):
    c = TestClient(create_app(use_lifespan=False, web_dist=tmp_path / "no-existe"))
    assert c.get("/").status_code == 404
