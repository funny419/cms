from api.helpers import error_response, get_pagination_params, success_response


def test_pagination_defaults(app):
    with app.test_request_context("/?page=1&per_page=20"):
        page, per_page, offset = get_pagination_params()
        assert page == 1 and per_page == 20 and offset == 0


def test_pagination_zero_page(app):
    with app.test_request_context("/?page=0"):
        page, per_page, offset = get_pagination_params()
        assert page == 1  # min 1


def test_pagination_over_limit(app):
    with app.test_request_context("/?per_page=200"):
        page, per_page, offset = get_pagination_params()
        assert per_page == 100  # max 100


def test_pagination_offset(app):
    with app.test_request_context("/?page=3&per_page=10"):
        page, per_page, offset = get_pagination_params()
        assert offset == 20  # (3-1) * 10


def test_success_response(app):
    with app.test_request_context():
        res, status = success_response({"id": 1})
        assert status == 200
        assert res.get_json()["success"] is True
        assert res.get_json()["data"] == {"id": 1}
        assert res.get_json()["error"] == ""


def test_success_response_custom_status(app):
    with app.test_request_context():
        res, status = success_response({"id": 1}, 201)
        assert status == 201


def test_error_response(app):
    with app.test_request_context():
        res, status = error_response("오류", 400)
        assert status == 400
        assert res.get_json()["success"] is False
        assert res.get_json()["error"] == "오류"
        assert res.get_json()["data"] == {}


def test_error_response_default_status(app):
    with app.test_request_context():
        res, status = error_response("Not found", 404)
        assert status == 404
