package handler

import (
	"net/http"
	"valley-server/internal/bootstrap"
)

func Handler(w http.ResponseWriter, r *http.Request) {
	_, app, err := bootstrap.Init()
	if err != nil {
		http.Error(w, "server init failed: "+err.Error(), http.StatusInternalServerError)
		return
	}
	app.ServeHTTP(w, r)
}
