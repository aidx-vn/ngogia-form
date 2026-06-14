package main

import (
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"survey/backend/internal/auth"
	"survey/backend/internal/config"
	"survey/backend/internal/db"
	"survey/backend/internal/handlers"
)

func main() {
	cfg := config.Load()
	database := db.Connect(cfg.DatabaseURL)
	db.Seed(database, "seed")

	oauth := auth.NewOAuth(cfg, database)
	authH := handlers.NewAuthHandler(cfg, database)
	settingsH := handlers.NewSettingsHandler(database)
	surveysH := handlers.NewSurveysHandler(database)
	adminH := handlers.NewAdminHandler(database)

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{cfg.FrontendURL},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type"},
		AllowCredentials: true,
	}))
	r.Use(auth.LoadUser(cfg.JWTSecret, database))

	r.Route("/api", func(r chi.Router) {
		r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
			w.Write([]byte(`{"status":"ok"}`))
		})

		r.Route("/auth", func(r chi.Router) {
			r.Get("/dev/login", oauth.DevLogin)
			r.Get("/{provider}/login", oauth.Login)
			r.Get("/{provider}/callback", oauth.Callback)
			r.Get("/me", authH.Me)
			r.Post("/logout", authH.Logout)
			r.With(auth.RequireAuth).Delete("/me", authH.DeleteAccount)
		})

		r.Get("/settings", settingsH.Get)

		r.Route("/surveys", func(r chi.Router) {
			r.Get("/", surveysH.List)
			r.Get("/{id}", surveysH.Get)
			r.Group(func(r chi.Router) {
				r.Use(auth.RequireAuth)
				r.Get("/{id}/my-response", surveysH.MyResponse)
				r.Post("/{id}/responses", surveysH.Submit)
			})
		})

		r.Route("/admin", func(r chi.Router) {
			r.Use(auth.RequireAdmin)
			r.Get("/stats", adminH.Dashboard)
			r.Put("/settings", settingsH.Update)
			r.Route("/surveys", func(r chi.Router) {
				r.Get("/", adminH.ListSurveys)
				r.Post("/", adminH.CreateSurvey)
				r.Get("/{id}", adminH.GetSurvey)
				r.Put("/{id}", adminH.UpdateSurvey)
				r.Delete("/{id}", adminH.DeleteSurvey)
				r.Get("/{id}/responses", adminH.ListResponses)
				r.Get("/{id}/stats", adminH.SurveyStats)
			})
		})
	})

	log.Printf("backend listening on :%s (db via pgbouncer, dev auth: %v)", cfg.Port, cfg.DevAuth)
	log.Fatal(http.ListenAndServe(":"+cfg.Port, r))
}
