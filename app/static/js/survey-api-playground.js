/**
 * Browser mirror of contracts/surveyApi.ts — vanilla JS for /survey-playground.
 * Uses the Survey API bearer (SURVEY_API_BEARER_TOKEN / third-party token), not the app JWT.
 */
function createSurveyApiClient(baseUrl, token) {
  var base = (baseUrl || "").replace(/\/$/, "");

  async function request(method, path, body) {
    var headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = "Bearer " + token;

    var init = { method: method, headers: headers };
    if (body !== undefined) init.body = JSON.stringify(body);

    var res = await fetch(base + path, init);
    if (!res.ok) {
      var detail = {};
      try {
        detail = await res.json();
      } catch (e) {
        detail = { detail: res.statusText };
      }
      var msg = detail.detail != null ? detail.detail : res.statusText;
      if (typeof msg !== "string") msg = JSON.stringify(msg);
      throw new Error(res.status + " " + msg);
    }
    if (res.status === 204) return undefined;
    return res.json();
  }

  function get(path) {
    return request("GET", path, undefined);
  }
  function post(path, body) {
    return request("POST", path, body);
  }
  function put(path, body) {
    return request("PUT", path, body === undefined ? {} : body);
  }
  function del(path) {
    return request("DELETE", path, undefined);
  }

  return {
    getSurveys: function () {
      return get("/surveys");
    },
    getSurvey: function (id) {
      return get("/surveys/" + encodeURIComponent(id));
    },
    getSurveyMeta: function (id) {
      return get("/surveys/" + encodeURIComponent(id) + "/metadata");
    },
    createSurvey: function (title, survey_json) {
      return post("/surveys", { title: title, survey_json: survey_json });
    },
    updateSurvey: function (id, title, survey_json) {
      return put("/surveys/" + encodeURIComponent(id), { title: title, survey_json: survey_json });
    },
    deleteSurvey: function (id) {
      return del("/surveys/" + encodeURIComponent(id));
    },
    getDeploys: function (surveyId) {
      return get("/surveys/" + encodeURIComponent(surveyId) + "/deploys");
    },
    getDeploy: function (id) {
      return get("/deploys/" + encodeURIComponent(id));
    },
    getDeployMeta: function (id) {
      return get("/deploys/" + encodeURIComponent(id) + "/metadata");
    },
    createDeploy: function (surveyId) {
      return post("/surveys/" + encodeURIComponent(surveyId) + "/deploys", {});
    },
    stopDeploy: function (id) {
      return put("/deploys/" + encodeURIComponent(id) + "/stop", {});
    },
    resumeDeploy: function (id) {
      return put("/deploys/" + encodeURIComponent(id) + "/resume", {});
    },
    closeDeploy: function (id) {
      return put("/deploys/" + encodeURIComponent(id) + "/close", {});
    },
    deleteDeploy: function (id) {
      return del("/deploys/" + encodeURIComponent(id));
    },
    getLinks: function (deployId) {
      return get("/deploys/" + encodeURIComponent(deployId) + "/links");
    },
    createLinks: function (deployId, count) {
      return post("/deploys/" + encodeURIComponent(deployId) + "/links/" + count, {});
    },
    deleteLink: function (deployId, linkId) {
      return del("/deploys/" + encodeURIComponent(deployId) + "/links/" + encodeURIComponent(linkId));
    },
    getAnswers: function (deployId) {
      return get("/deploys/" + encodeURIComponent(deployId) + "/answers");
    },
    submitAnswer: function (deployId, answer_json) {
      return post("/deploys/" + encodeURIComponent(deployId) + "/answers", { answer_json: answer_json });
    },
    submitAnswerLink: function (deployId, linkId, answer_json) {
      return post(
        "/deploys/" + encodeURIComponent(deployId) + "/answers/" + encodeURIComponent(linkId),
        { answer_json: answer_json }
      );
    },
    deleteAnswer: function (id) {
      return del("/answers/" + encodeURIComponent(id));
    },
  };
}

(function () {
  function baseUrl() {
    return (document.getElementById("baseUrl").value || "").trim();
  }
  function tokenStr() {
    return (document.getElementById("token").value || "").trim();
  }
  function client() {
    return createSurveyApiClient(baseUrl(), tokenStr() || undefined);
  }
  function surveyId() {
    return (document.getElementById("surveyId").value || "").trim();
  }
  function deployId() {
    return (document.getElementById("deployId").value || "").trim();
  }
  function parseJson(id, fallback) {
    var raw = document.getElementById(id).value || "";
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  }

  function log(title, data) {
    var out = document.getElementById("output");
    var body = data === undefined ? "(no body)" : typeof data === "string" ? data : JSON.stringify(data, null, 2);
    out.value = title + "\n" + body;
  }

  async function run(title, fn) {
    try {
      var data = await fn();
      log(title, data);
    } catch (e) {
      log(title + " ERROR", e.message || String(e));
    }
  }

  document.getElementById("btnListSurveys").onclick = function () {
    run("GET /surveys", function () {
      return client().getSurveys();
    });
  };
  document.getElementById("btnCreateSurvey").onclick = function () {
    run("POST /surveys", function () {
      var title = document.getElementById("surveyTitle").value || "Untitled";
      var sj = parseJson("surveyJson", {});
      return client().createSurvey(title, sj);
    });
  };
  document.getElementById("btnGetSurvey").onclick = function () {
    run("GET /surveys/{id}", function () {
      return client().getSurvey(surveyId());
    });
  };
  document.getElementById("btnSurveyMeta").onclick = function () {
    run("GET /surveys/{id}/metadata", function () {
      return client().getSurveyMeta(surveyId());
    });
  };
  document.getElementById("btnUpdateSurvey").onclick = function () {
    run("PUT /surveys/{id}", function () {
      var title = document.getElementById("surveyTitle").value || "Untitled";
      var sj = parseJson("surveyJson", {});
      return client().updateSurvey(surveyId(), title, sj);
    });
  };
  document.getElementById("btnDeleteSurvey").onclick = function () {
    run("DELETE /surveys/{id}", function () {
      return client().deleteSurvey(surveyId());
    });
  };

  document.getElementById("btnListDeploys").onclick = function () {
    run("GET /surveys/{id}/deploys", function () {
      return client().getDeploys(surveyId());
    });
  };
  document.getElementById("btnCreateDeploy").onclick = function () {
    run("POST /surveys/{id}/deploys", function () {
      return client().createDeploy(surveyId());
    });
  };
  document.getElementById("btnGetDeploy").onclick = function () {
    run("GET /deploys/{id}", function () {
      return client().getDeploy(deployId());
    });
  };
  document.getElementById("btnDeployMeta").onclick = function () {
    run("GET /deploys/{id}/metadata", function () {
      return client().getDeployMeta(deployId());
    });
  };
  document.getElementById("btnStop").onclick = function () {
    run("PUT /deploys/{id}/stop", function () {
      return client().stopDeploy(deployId());
    });
  };
  document.getElementById("btnResume").onclick = function () {
    run("PUT /deploys/{id}/resume", function () {
      return client().resumeDeploy(deployId());
    });
  };
  document.getElementById("btnClose").onclick = function () {
    run("PUT /deploys/{id}/close", function () {
      return client().closeDeploy(deployId());
    });
  };
  document.getElementById("btnDeleteDeploy").onclick = function () {
    run("DELETE /deploys/{id}", function () {
      return client().deleteDeploy(deployId());
    });
  };

  document.getElementById("btnGetLinks").onclick = function () {
    run("GET /deploys/{id}/links", function () {
      return client().getLinks(deployId());
    });
  };
  document.getElementById("btnCreateLinks").onclick = function () {
    run("POST /deploys/{id}/links/{count}", function () {
      var n = parseInt(document.getElementById("linkCount").value, 10) || 1;
      return client().createLinks(deployId(), n);
    });
  };
  document.getElementById("btnDeleteLink").onclick = function () {
    run("DELETE link", function () {
      var lid = (document.getElementById("linkId").value || "").trim();
      return client().deleteLink(deployId(), lid);
    });
  };

  document.getElementById("btnListAnswers").onclick = function () {
    run("GET /deploys/{id}/answers", function () {
      return client().getAnswers(deployId());
    });
  };
  document.getElementById("btnSubmitAnswer").onclick = function () {
    run("POST /deploys/{id}/answers", function () {
      var aj = parseJson("answerJson", {});
      return client().submitAnswer(deployId(), aj);
    });
  };
  document.getElementById("btnSubmitAnswerLink").onclick = function () {
    run("POST /deploys/{id}/answers/{linkId}", function () {
      var aj = parseJson("answerJson", {});
      var lid = (document.getElementById("linkId").value || "").trim();
      return client().submitAnswerLink(deployId(), lid, aj);
    });
  };
  document.getElementById("btnDeleteAnswer").onclick = function () {
    run("DELETE /answers/{id}", function () {
      var aid = (document.getElementById("answerId").value || "").trim();
      return client().deleteAnswer(aid);
    });
  };
})();
