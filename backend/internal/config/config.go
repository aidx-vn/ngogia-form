package config

import (
	"os"
	"strings"
)

type Config struct {
	Port           string
	DatabaseURL    string
	JWTSecret      string
	GoogleID       string
	GoogleSecret   string
	FacebookID     string
	FacebookSecret string
	FrontendURL    string
	BackendURL     string
	DevAuth        bool
	AdminEmails    map[string]bool
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func Load() *Config {
	admins := map[string]bool{}
	for _, e := range strings.Split(os.Getenv("ADMIN_EMAILS"), ",") {
		e = strings.TrimSpace(strings.ToLower(e))
		if e != "" {
			admins[e] = true
		}
	}
	return &Config{
		Port:           getenv("PORT", "8080"),
		// Local dev: connect through PgBouncer (infra_pgbouncer, auth_type=trust) on 5433.
		DatabaseURL:    getenv("DATABASE_URL", "postgres://pgadmin:trust@localhost:5433/survey?sslmode=disable"),
		JWTSecret:      getenv("JWT_SECRET", "dev-secret-change-in-production"),
		GoogleID:       os.Getenv("GOOGLE_CLIENT_ID"),
		GoogleSecret:   os.Getenv("GOOGLE_CLIENT_SECRET"),
		FacebookID:     os.Getenv("FACEBOOK_CLIENT_ID"),
		FacebookSecret: os.Getenv("FACEBOOK_CLIENT_SECRET"),
		FrontendURL:    getenv("FRONTEND_URL", "http://localhost:5173"),
		BackendURL:     getenv("BACKEND_URL", "http://localhost:8080"),
		DevAuth:        getenv("DEV_AUTH", "0") == "1",
		AdminEmails:    admins,
	}
}
